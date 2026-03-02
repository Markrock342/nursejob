// ============================================
// MAP JOBS SCREEN — NurseGo v2
// Shows nearby job postings as map pins
// Tap pin → bottom sheet card → JobDetail
// ============================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { SPACING, FONT_SIZES, BORDER_RADIUS, COLORS } from '../../theme';
import { JobPost, JobFilters } from '../../types';

const { width: W, height: H } = Dimensions.get('window');

const STAFF_LABELS: Record<string, string> = {
  rn: 'พยาบาลวิชาชีพ',
  RN: 'พยาบาลวิชาชีพ',
  lpn: 'พยาบาลเทคนิค',
  LPN: 'พยาบาลเทคนิค',
  nurse_aide: 'ผู้ช่วยพยาบาล',
  ward_clerk: 'เสมียนวอร์ด',
  caregiver: 'ผู้ดูแลผู้ป่วย',
  other: 'อื่นๆ',
};

const POST_TYPE_LABELS: Record<string, string> = {
  shift: 'หาคนแทนเวร',
  job: 'รับสมัครงาน',
  homecare: 'ดูแลผู้ป่วย',
};
const PROVINCE_COORDS: Record<string, { lat: number; lng: number }> = {
  'กรุงเทพมหานคร': { lat: 13.7563, lng: 100.5018 },
  'นนทบุรี':        { lat: 13.8621, lng: 100.5134 },
  'ปทุมธานี':       { lat: 14.0208, lng: 100.5250 },
  'สมุทรปราการ':    { lat: 13.5990, lng: 100.5998 },
  'เชียงใหม่':      { lat: 18.7883, lng: 98.9853 },
  'ขอนแก่น':        { lat: 16.4419, lng: 102.8359 },
  'นครราชสีมา':     { lat: 14.9799, lng: 102.0978 },
  'อุดรธานี':       { lat: 17.4156, lng: 102.7870 },
  'สงขลา':          { lat: 7.1897, lng: 100.5953 },
  'ภูเก็ต':         { lat: 7.8804, lng: 98.3923 },
  'ชลบุรี':         { lat: 13.3611, lng: 100.9847 },
  'ระยอง':          { lat: 12.6814, lng: 101.2816 },
  'เชียงราย':       { lat: 19.9105, lng: 99.8406 },
  'นครสวรรค์':      { lat: 15.7047, lng: 100.1371 },
  'พิษณุโลก':       { lat: 16.8211, lng: 100.2659 },
  'สุราษฎร์ธานี':   { lat: 9.1382, lng: 99.3214 },
  'นครศรีธรรมราช':  { lat: 8.4304, lng: 99.9631 },
};

function getCoords(job: JobPost): { lat: number; lng: number } | null {
  const loc = (job as any).location;
  // 1. Exact coords in location sub-object
  if (loc?.lat && loc?.lng) return { lat: loc.lat, lng: loc.lng };
  // 2. Top-level lat/lng (older posts)
  if ((job as any).lat && (job as any).lng) return { lat: (job as any).lat, lng: (job as any).lng };
  // 3. Province approximate fallback
  const province = loc?.province || (job as any).province || '';
  return PROVINCE_COORDS[province] ?? null;
}

// Bangkok center default
const DEFAULT_REGION: Region = {
  latitude: 13.736717,
  longitude: 100.523186,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

interface MapJobsProps { navigation: any; route?: any; }

// ── Filter types ─────────────────────────────────────────────────────────
interface MapFilter {
  postType: string;
  staffType: string;
  rateMin: number;
  urgentOnly: boolean;
}
const DEFAULT_FILTER: MapFilter = { postType: '', staffType: '', rateMin: 0, urgentOnly: false };

function serializeJob(job: JobPost) {
  return {
    ...job,
    shiftDate: job.shiftDate
      ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate)
      : undefined,
    shiftDateEnd: (job as any).shiftDateEnd
      ? ((job as any).shiftDateEnd instanceof Date
          ? (job as any).shiftDateEnd.toISOString()
          : (job as any).shiftDateEnd)
      : undefined,
  } as any;
}

export default function MapJobsScreen({ navigation }: MapJobsProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView>(null);
  const [allJobs, setAllJobs]   = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [region, setRegion]     = useState<Region>(DEFAULT_REGION);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  const [filter, setFilter]             = useState<MapFilter>(DEFAULT_FILTER);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftFilter, setDraftFilter]   = useState<MapFilter>(DEFAULT_FILTER);

  const activeFilterCount = (
    (filter.postType   ? 1 : 0) +
    (filter.staffType  ? 1 : 0) +
    (filter.rateMin > 0  ? 1 : 0) +
    (filter.urgentOnly ? 1 : 0)
  );

  const jobs = useMemo(() => {
    let list = allJobs;
    if (filter.postType)    list = list.filter(j => (j as any).postType === filter.postType);
    if (filter.staffType)   list = list.filter(j => (j as any).staffType === filter.staffType);
    if (filter.rateMin > 0) list = list.filter(j => ((j as any).shiftRate || 0) >= filter.rateMin);
    if (filter.urgentOnly)  list = list.filter(j => j.status === 'urgent' || (j as any).isUrgent);
    return list;
  }, [allJobs, filter]);

  const draftCount = useMemo(() => {
    let list = allJobs;
    if (draftFilter.postType)    list = list.filter(j => (j as any).postType === draftFilter.postType);
    if (draftFilter.staffType)   list = list.filter(j => (j as any).staffType === draftFilter.staffType);
    if (draftFilter.rateMin > 0) list = list.filter(j => ((j as any).shiftRate || 0) >= draftFilter.rateMin);
    if (draftFilter.urgentOnly)  list = list.filter(j => j.status === 'urgent' || (j as any).isUrgent);
    return list.length;
  }, [allJobs, draftFilter]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        setUserLocation({ lat, lng });
        const newRegion = { latitude: lat, longitude: lng, latitudeDelta: 0.12, longitudeDelta: 0.12 };
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 700);
      }
      await loadJobs();
    })();
  }, []);

  useEffect(() => {
    if (!isLoading && allJobs.length > 0) {
      // Android: flip fast (100ms) — just enough for one render pass before bitmap capture
      // iOS: 600ms is fine since it uses native UIView (not bitmap)
      const delay = Platform.OS === 'android' ? 100 : 600;
      const t = setTimeout(() => setTracksViewChanges(false), delay);
      return () => clearTimeout(t);
    }
  }, [isLoading, allJobs.length]);

  const loadJobs = async () => {
    setIsLoading(true);
    try {
      const { getJobs } = await import('../../services/jobService');
      const result = await getJobs({ sortBy: 'latest' } as JobFilters, undefined, 200);
      const arr: JobPost[] = Array.isArray(result) ? result : (result as any)?.jobs || [];
      setAllJobs(arr.filter(j => getCoords(j) !== null));
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const flyToUser = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        { latitude: userLocation.lat, longitude: userLocation.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 },
        600,
      );
    } else {
      Alert.alert('ไม่พบตำแหน่ง', 'กรุณาเปิดใช้ GPS แล้วลองใหม่');
    }
  }, [userLocation]);

  const pinColor = (job: JobPost) => {
    if (job.status === 'urgent' || (job as any).isUrgent) return '#EF4444';
    const rate = (job as any).shiftRate || 0;
    if (rate >= 1500) return '#0EA5E9';
    if (rate >= 700)  return '#10B981';
    return '#F59E0B';
  };

  const formatRate = (job: JobPost) => {
    const rate = (job as any).shiftRate;
    const rateType = (job as any).rateType;
    if (!rate) return 'ดูอัตรา';
    const unit: Record<string, string> = { shift: '/เวร', hour: '/ชม', day: '/วัน', month: '/เดือน' };
    const num = Number(rate);
    const display = num >= 10000 ? `${(num / 1000).toFixed(0)}K` : num.toLocaleString();
    return `฿${display}${unit[rateType] || '/เวร'}`;
  };

  const openJobDetail = (job: JobPost) => {
    setSelectedJob(null);
    navigation.navigate('JobDetail', { job: serializeJob(job) });
  };

  const openFilter = () => { setDraftFilter(filter); setShowFilterModal(true); };
  const applyFilter = () => { setFilter(draftFilter); setShowFilterModal(false); setSelectedJob(null); };
  const resetFilter = () => setDraftFilter(DEFAULT_FILTER);

  return (
    <View style={{ flex: 1 }}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsScale={false}
        showsCompass={false}
        onPress={() => setSelectedJob(null)}
      >
        {jobs.map(job => {
          const coords = getCoords(job);
          if (!coords) return null;
          const hasExact = !!(job as any).location?.lat;
          return (
            <Marker
              key={job.id}
              coordinate={{ latitude: coords.lat, longitude: coords.lng }}
              onPress={(e) => { e.stopPropagation(); setSelectedJob(job); }}
              tracksViewChanges={tracksViewChanges}
              opacity={hasExact ? 1 : 0.7}
              anchor={Platform.OS === 'ios' ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }}
            >
              {Platform.OS === 'ios' ? (
                // iOS: bubble + tail — native UIView renders correctly
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.pinBubble, { backgroundColor: pinColor(job) }]}>
                    <Text style={styles.pinRate} numberOfLines={1}>{formatRate(job)}</Text>
                  </View>
                  <View style={[styles.pinTail, { borderTopColor: pinColor(job) }]} />
                </View>
              ) : (
                // Android: fixed-size pill, tracksViewChanges=false, single view
                // Dynamic sizing (paddingVertical/maxWidth) causes bitmap crop bug
                <View collapsable={false} style={[styles.pinBubbleAndroid, { backgroundColor: pinColor(job) }]}>
                  <Text style={styles.pinRate} numberOfLines={1}>{formatRate(job)}</Text>
                </View>
              )}
            </Marker>
          );
        })}
      </MapView>

      {/* ── Top bar ─────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.topBtn, { backgroundColor: colors.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>

        <View style={[styles.topTitle, { backgroundColor: colors.surface }]}>
          <Ionicons name="map" size={16} color={colors.primary} />
          <Text style={[styles.topTitleText, { color: colors.text }]}>
            {isLoading ? 'กำลังโหลด...' : `${jobs.length} งานบนแผนที่`}
          </Text>
        </View>

        {/* Filter button */}
        <TouchableOpacity
          style={[styles.topBtn, { backgroundColor: colors.surface }]}
          onPress={openFilter}
        >
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.primary : colors.text} />
          {activeFilterCount > 0 && (
            <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* GPS button */}
        <TouchableOpacity
          style={[styles.topBtn, { backgroundColor: colors.surface }]}
          onPress={flyToUser}
        >
          <Ionicons name="locate" size={20} color={colors.primary} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* ── Active filter chips ─────────────────────── */}
      {activeFilterCount > 0 && (
        <View style={[styles.activeFiltersRow, { top: insets.top + 62 }]} pointerEvents="box-none">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
            {filter.postType && (
              <FilterChip label={POST_TYPE_LABELS[filter.postType] || filter.postType} onRemove={() => setFilter(f => ({ ...f, postType: '' }))} />
            )}
            {filter.staffType && (
              <FilterChip label={STAFF_LABELS[filter.staffType] || filter.staffType} onRemove={() => setFilter(f => ({ ...f, staffType: '' }))} />
            )}
            {filter.rateMin > 0 && (
              <FilterChip label={`฿${filter.rateMin.toLocaleString()}+`} onRemove={() => setFilter(f => ({ ...f, rateMin: 0 }))} />
            )}
            {filter.urgentOnly && (
              <FilterChip label="ด่วนเท่านั้น" onRemove={() => setFilter(f => ({ ...f, urgentOnly: false }))} />
            )}
          </ScrollView>
        </View>
      )}

      {/* ── Legend ────────────────────────────────── */}
      <View style={[styles.legend, { backgroundColor: colors.surface, top: insets.top + (activeFilterCount > 0 ? 102 : 62) }]}>
        <LegendDot color="#EF4444" label="ด่วน" />
        <LegendDot color="#0EA5E9" label="≥฿1,500" />
        <LegendDot color="#10B981" label="≥฿700" />
        <LegendDot color="#F59E0B" label="< ฿700" />
      </View>

      {/* ── Loading ────────────────────────────────── */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={{ color: colors.textSecondary, marginTop: 10, fontSize: 13 }}>กำลังโหลดงาน...</Text>
        </View>
      )}

      {/* ── Bottom job card ────────────────────────── */}
      {selectedJob && !isLoading && (
        <SafeAreaView edges={['bottom']} style={styles.bottomCardWrap} pointerEvents="box-none">
          <View style={[styles.bottomCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.closeCardBtn} onPress={() => setSelectedJob(null)}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {(selectedJob as any).postType && (
              <View style={[styles.typeBadge, { backgroundColor: colors.primaryBackground }]}>
                <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
                  {POST_TYPE_LABELS[(selectedJob as any).postType] || (selectedJob as any).postType}
                </Text>
              </View>
            )}

            <View style={styles.cardContent}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                  {(selectedJob as any).title ||
                    `${POST_TYPE_LABELS[(selectedJob as any).postType] || 'งาน'} ${STAFF_LABELS[(selectedJob as any).staffType] || ''}`}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                  <Ionicons name="business-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.cardHospital, { color: colors.textSecondary }]} numberOfLines={1}>
                    {(selectedJob as any).location?.hospital || '-'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.cardLocation, { color: colors.textMuted }]} numberOfLines={1}>
                    {[(selectedJob as any).location?.district, (selectedJob as any).location?.province]
                      .filter(Boolean).join(', ') || '-'}
                  </Text>
                </View>
                <View style={styles.cardTags}>
                  {(selectedJob as any).staffType && (
                    <View style={[styles.tag, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={[styles.tagText, { color: '#1D4ED8' }]}>
                        {STAFF_LABELS[(selectedJob as any).staffType] || (selectedJob as any).staffType}
                      </Text>
                    </View>
                  )}
                  {(selectedJob.status === 'urgent' || (selectedJob as any).isUrgent) && (
                    <View style={[styles.tag, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={[styles.tagText, { color: '#DC2626' }]}>⚡ ด่วน</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.rateValue, { color: COLORS.success }]}>{formatRate(selectedJob)}</Text>
                <TouchableOpacity
                  style={[styles.viewBtn, { backgroundColor: colors.primary }]}
                  onPress={() => openJobDetail(selectedJob)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.viewBtnText}>ดูงาน</Text>
                  <Ionicons name="chevron-forward" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      )}

      {/* ── Filter Modal ───────────────────────────── */}
      <Modal visible={showFilterModal} animationType="slide" transparent onRequestClose={() => setShowFilterModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowFilterModal(false)} />
        <View style={[styles.filterSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>กรองงาน</Text>
            <TouchableOpacity onPress={resetFilter}>
              <Text style={[styles.filterReset, { color: colors.primary }]}>รีเซ็ต</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>ประเภทประกาศ</Text>
            <View style={styles.filterChipRow}>
              {(['', 'shift', 'job', 'homecare'] as const).map(v => (
                <TouchableOpacity
                  key={v || 'all'}
                  style={[styles.filterChip, { borderColor: draftFilter.postType === v ? colors.primary : colors.border }, draftFilter.postType === v && { backgroundColor: colors.primary }]}
                  onPress={() => setDraftFilter(f => ({ ...f, postType: v }))}
                >
                  <Text style={[styles.filterChipText, { color: draftFilter.postType === v ? '#fff' : colors.text }]}>
                    {v === '' ? 'ทั้งหมด' : POST_TYPE_LABELS[v]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>ประเภทบุคลากร</Text>
            <View style={styles.filterChipRow}>
              {(['', 'RN', 'LPN', 'nurse_aide', 'caregiver', 'other'] as const).map(v => (
                <TouchableOpacity
                  key={v || 'all'}
                  style={[styles.filterChip, { borderColor: draftFilter.staffType === v ? colors.primary : colors.border }, draftFilter.staffType === v && { backgroundColor: colors.primary }]}
                  onPress={() => setDraftFilter(f => ({ ...f, staffType: v }))}
                >
                  <Text style={[styles.filterChipText, { color: draftFilter.staffType === v ? '#fff' : colors.text }]}>
                    {v === '' ? 'ทั้งหมด' : (STAFF_LABELS[v] || v)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>ค่าตอบแทนขั้นต่ำ</Text>
            <View style={styles.filterChipRow}>
              {([0, 500, 700, 1000, 1500, 3000] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.filterChip, { borderColor: draftFilter.rateMin === v ? colors.primary : colors.border }, draftFilter.rateMin === v && { backgroundColor: colors.primary }]}
                  onPress={() => setDraftFilter(f => ({ ...f, rateMin: v }))}
                >
                  <Text style={[styles.filterChipText, { color: draftFilter.rateMin === v ? '#fff' : colors.text }]}>
                    {v === 0 ? 'ทั้งหมด' : `฿${v.toLocaleString()}+`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.filterSectionLabel, { color: colors.textSecondary }]}>สถานะ</Text>
            <View style={styles.filterChipRow}>
              <TouchableOpacity
                style={[styles.filterChip, { borderColor: !draftFilter.urgentOnly ? colors.primary : colors.border }, !draftFilter.urgentOnly && { backgroundColor: colors.primary }]}
                onPress={() => setDraftFilter(f => ({ ...f, urgentOnly: false }))}
              >
                <Text style={[styles.filterChipText, { color: !draftFilter.urgentOnly ? '#fff' : colors.text }]}>ทั้งหมด</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChip, { borderColor: draftFilter.urgentOnly ? '#EF4444' : colors.border }, draftFilter.urgentOnly && { backgroundColor: '#EF4444' }]}
                onPress={() => setDraftFilter(f => ({ ...f, urgentOnly: true }))}
              >
                <Text style={[styles.filterChipText, { color: draftFilter.urgentOnly ? '#fff' : colors.text }]}>⚡ ด่วนเท่านั้น</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={applyFilter} activeOpacity={0.85}>
            <Text style={styles.applyBtnText}>แสดง{draftCount} รายการ</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <TouchableOpacity style={styles.activeChip} onPress={onRemove}>
      <Text style={styles.activeChipText}>{label}</Text>
      <Ionicons name="close" size={12} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
    zIndex: 10,
  },
  topBtn: {
    width: 42, height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  filterBadge: {
    position: 'absolute', top: 6, right: 6,
    width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  topTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 21,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  topTitleText: { fontSize: 14, fontWeight: '600' },

  activeFiltersRow: {
    position: 'absolute', left: 0, right: 0, zIndex: 9,
  },
  activeChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 99, gap: 4,
  },
  activeChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  legend: {
    position: 'absolute', right: 12,
    borderRadius: 12, padding: 10, gap: 5,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 10, color: '#64748B' },

  pinBubble: {
    // iOS: dynamic sizing is fine (native UIView)
    maxWidth: 100,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  // Android: fixed dimensions — Android must know exact size before bitmap capture
  pinBubbleAndroid: {
    minWidth: 62,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinRate: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  pinTail: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    alignSelf: 'center',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  bottomCardWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 14, paddingBottom: 8, zIndex: 10,
  },
  bottomCard: {
    borderRadius: 20, padding: 16, paddingTop: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12, shadowRadius: 8,
  },
  closeCardBtn: { position: 'absolute', top: 12, right: 12, padding: 4 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginBottom: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: '600' },
  cardContent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: 4 },
  cardHospital: { fontSize: 13 },
  cardLocation: { fontSize: 12 },
  cardTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  tagText: { fontSize: 11, fontWeight: '600' },
  cardRight: { alignItems: 'flex-end', gap: 10, paddingTop: 2, minWidth: 80 },
  rateValue: { fontSize: 15, fontWeight: '700' },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 99, gap: 4,
  },
  viewBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Filter modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  filterSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: H * 0.75,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  filterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  filterTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  filterReset: { fontSize: FONT_SIZES.sm, fontWeight: '600' },
  filterSectionLabel: {
    fontSize: FONT_SIZES.xs, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 14, marginBottom: 8,
  },
  filterChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, borderWidth: 1.5 },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { marginTop: 20, paddingVertical: 14, borderRadius: BORDER_RADIUS.xl, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: FONT_SIZES.md, fontWeight: '700' },
});
