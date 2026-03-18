// ============================================
// HOME SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, UserLocation } from '../../utils/useLocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Helper: คำนวณระยะทางระหว่าง 2 จุด (Haversine)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JobCard } from '../../components/job/JobCard';
import { Loading, EmptyState, ModalContainer, Chip, KittenButton as Button, Avatar, FAB, FirstVisitTip, StickyInboxPanel } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import {
  ALL_PROVINCES,
  POPULAR_PROVINCES,
  PROVINCES_BY_REGION,
  REGIONS,
  getDistrictsForProvince,
} from '../../constants/locations';
import {
  STAFF_TYPES,
  LOCATION_TYPES,
  ALL_DEPARTMENTS,
  HOME_CARE_TYPES,
  PAYMENT_TYPES,
  getStaffTypeLabel,
  getLocationTypeLabel,
} from '../../constants/jobOptions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { useOnboardingSurveyEnabled } from '../../hooks/useOnboardingSurveyEnabled';
import { useScreenPerformance } from '../../hooks/useScreenPerformance';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import { getJobs, getJobsNearby, subscribeToJobs, getUserPosts } from '../../services/jobService';
import { subscribeToNotifications } from '../../services/notificationsService';
import { subscribeToFavorites, toggleFavorite, Favorite } from '../../services/favoritesService';
import { JobPost, MainTabParamList, JobFilters } from '../../types';
import { trackEvent } from '../../services/analyticsService';
import { StickyInboxItem, subscribeStickyInboxItems } from '../../services/communicationsService';
import {
  SavedJobFilterPreset,
  loadSavedJobFilterPresets,
  removeSavedJobFilterPreset,
  saveJobFilterPreset,
} from '../../services/workflowPreferencesService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROVINCE_COORDS: Record<string, { lat: number; lng: number }> = {
  'กรุงเทพมหานคร': { lat: 13.7563, lng: 100.5018 },
  'นนทบุรี': { lat: 13.8621, lng: 100.5134 },
  'ปทุมธานี': { lat: 14.0208, lng: 100.5250 },
  'สมุทรปราการ': { lat: 13.5990, lng: 100.5998 },
  'เชียงใหม่': { lat: 18.7883, lng: 98.9853 },
  'ขอนแก่น': { lat: 16.4419, lng: 102.8359 },
  'นครราชสีมา': { lat: 14.9799, lng: 102.0978 },
  'อุดรธานี': { lat: 17.4156, lng: 102.7870 },
  'สงขลา': { lat: 7.1897, lng: 100.5953 },
  'ภูเก็ต': { lat: 7.8804, lng: 98.3923 },
  'ชลบุรี': { lat: 13.3611, lng: 100.9847 },
  'ระยอง': { lat: 12.6814, lng: 101.2816 },
};

function getJobCoords(job: JobPost): { lat: number; lng: number } | null {
  const lat = (job as any).lat ?? job.location?.lat ?? (job.location as any)?.coordinates?.lat;
  const lng = (job as any).lng ?? job.location?.lng ?? (job.location as any)?.coordinates?.lng;
  if (lat != null && lng != null) return { lat, lng };

  const province = job.location?.province || (job as any).province || '';
  return PROVINCE_COORDS[province] ?? null;
}

// ─── Category Tabs ──────────────────────────────────────────────────
const CATEGORY_TABS = [
  { key: 'all',      label: 'ทั้งหมด',      icon: 'apps-outline'             as const, color: '#0EA5E9' },
  { key: 'shift',    label: 'แทนเวร',       icon: 'swap-horizontal-outline'  as const, color: '#8B5CF6' },
  { key: 'job',      label: 'รับสมัคร',    icon: 'briefcase-outline'        as const, color: '#F59E0B' },
  { key: 'homecare', label: 'ดูแลผู้ป่วย', icon: 'home-outline'             as const, color: '#10B981' },
] as const;
type CategoryKey = typeof CATEGORY_TABS[number]['key'];

// ============================================
// Types
// ============================================
type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

// ============================================
// URGENT JOBS BANNER COMPONENT
// ============================================
interface UrgentBannerProps {
  urgentJobs: JobPost[];
  totalUrgentJobs: number;
  onPress: (job: JobPost) => void;
  onViewAll: () => void;
}

const URGENT_CARD_WIDTH = Math.min(SCREEN_WIDTH * 0.46, 176);
const URGENT_CARD_GAP = SPACING.sm;
const URGENT_AUTO_SCROLL_INTERVAL = 3200;

function getUrgentJobDateLabel(job: JobPost) {
  if (job.postType === 'job') {
    return job.startDateNote || 'เริ่มงานตามตกลง';
  }
  if (!job.shiftDate) return 'ตามตกลง';
  const d = typeof job.shiftDate === 'string' ? new Date(job.shiftDate) : job.shiftDate;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function getUrgentJobTimeLabel(job: JobPost) {
  if (job.postType === 'job') {
    return job.workHours || job.shiftTime || 'เวลางานตามตกลง';
  }
  return job.shiftTime || 'ตามตกลง';
}

function getRateUnit(rateType?: string) {
  return rateType === 'hour' ? '/ชม.' : rateType === 'day' ? '/วัน' : rateType === 'month' ? '/เดือน' : '/เวร';
}

function UrgentJobsBanner({ urgentJobs, totalUrgentJobs, onPress, onViewAll }: UrgentBannerProps) {
  if (urgentJobs.length === 0) return null;

  const remainingCount = Math.max(totalUrgentJobs - urgentJobs.length, 0);
  const previewJobs = urgentJobs.slice(0, 5);
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollIndexRef = useRef(0);
  const hasUserInteractedRef = useRef(false);
  const totalSlides = previewJobs.length + (remainingCount > 0 ? 1 : 0);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    autoScrollIndexRef.current = 0;
    hasUserInteractedRef.current = false;
    setActiveSlide(0);

    if (totalSlides <= 1) return;

    const interval = setInterval(() => {
      if (hasUserInteractedRef.current) return;

      autoScrollIndexRef.current = (autoScrollIndexRef.current + 1) % totalSlides;
      setActiveSlide(autoScrollIndexRef.current);
      scrollRef.current?.scrollTo({
        x: autoScrollIndexRef.current * (URGENT_CARD_WIDTH + URGENT_CARD_GAP),
        animated: true,
      });
    }, URGENT_AUTO_SCROLL_INTERVAL);

    return () => clearInterval(interval);
  }, [totalSlides]);

  const stopAutoScroll = () => {
    hasUserInteractedRef.current = true;
  };

  const handleMomentumScrollEnd = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.round(offsetX / (URGENT_CARD_WIDTH + URGENT_CARD_GAP));
    autoScrollIndexRef.current = nextIndex;
    setActiveSlide(nextIndex);
  };

  return (
    <View style={urgentStyles.container}>
      <View pointerEvents="none" style={urgentStyles.backgroundGlowPrimary} />
      <View pointerEvents="none" style={urgentStyles.backgroundGlowSecondary} />
      <View style={urgentStyles.header}>
        <View style={urgentStyles.headerCopy}>
          <View style={urgentStyles.headerLeft}>
            <View style={urgentStyles.flashIconWrap}>
              <Ionicons name="flash" size={16} color="#FFFFFF" />
            </View>
            <Text style={urgentStyles.headerTitle}>งานด่วน</Text>
            <View style={urgentStyles.badge}>
              <Text style={urgentStyles.badgeText}>{totalUrgentJobs} รายการ</Text>
            </View>
          </View>
          <Text style={urgentStyles.headerSubtitle} numberOfLines={1}>
            รวมงานเร่งด่วนที่ควรดูตอนนี้ และเปิดทั้งหมดได้ทันที
          </Text>
        </View>

        <TouchableOpacity
          style={urgentStyles.viewAllButton}
          onPress={onViewAll}
          onPressIn={stopAutoScroll}
          activeOpacity={0.85}
        >
          <Ionicons name="menu-outline" size={15} color="#FFFFFF" />
          <Text style={urgentStyles.viewAllButtonText}>ดูทั้งหมด</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={urgentStyles.scrollContent}
        decelerationRate="fast"
        onScrollBeginDrag={stopAutoScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      >
        {previewJobs.map((job, index) => (
          <TouchableOpacity
            key={job.id}
            style={urgentStyles.card}
            onPress={() => onPress(job)}
            onPressIn={stopAutoScroll}
            activeOpacity={0.86}
          >
            <View pointerEvents="none" style={urgentStyles.cardAccentBar} />
            <View style={urgentStyles.cardTopRow}>
              <View style={urgentStyles.rankBadge}>
                <Text style={urgentStyles.rankBadgeText}>#{index + 1}</Text>
              </View>
              <View style={urgentStyles.urgentBadge}>
                <Ionicons name="flash" size={12} color="#FFF" />
                <Text style={urgentStyles.urgentBadgeText}>ด่วน</Text>
              </View>
            </View>

            <Text style={urgentStyles.cardTitle} numberOfLines={1}>
              {job.title || job.department}
            </Text>
            <View style={urgentStyles.locationRow}>
              <View style={urgentStyles.locationIconWrap}>
                <Ionicons name="location-outline" size={12} color="#F43F5E" />
              </View>
              <Text style={urgentStyles.cardLocation} numberOfLines={1}>
                {job.location?.hospital || job.location?.district || job.location?.province || 'ไม่ระบุสถานที่'}
              </Text>
            </View>

            <View style={urgentStyles.cardMetaStack}>
              <View style={urgentStyles.cardMetaPill}>
                <View style={urgentStyles.cardMetaIconWrap}>
                  <Ionicons name="calendar-outline" size={12} color="#F43F5E" />
                </View>
                <Text style={urgentStyles.cardMetaLabel}>{job.postType === 'job' ? 'เริ่มงาน' : 'วันที่'}</Text>
                <Text style={urgentStyles.cardMetaText} numberOfLines={1}>
                  {getUrgentJobDateLabel(job)}
                </Text>
              </View>
              <View style={urgentStyles.cardMetaPill}>
                <View style={urgentStyles.cardMetaIconWrap}>
                  <Ionicons name="time-outline" size={12} color="#F43F5E" />
                </View>
                <Text style={urgentStyles.cardMetaLabel}>{job.postType === 'job' ? 'เวลางาน' : 'เวลา'}</Text>
                <Text style={urgentStyles.cardMetaText} numberOfLines={1}>
                  {getUrgentJobTimeLabel(job)}
                </Text>
              </View>
              {(job as any)._distanceKm !== undefined ? (
                <View style={[urgentStyles.cardMetaPill, urgentStyles.cardMetaPillAccent]}>
                  <View style={[urgentStyles.cardMetaIconWrap, urgentStyles.cardMetaIconWrapAccent]}>
                    <Ionicons name="navigate-outline" size={12} color="#EA580C" />
                  </View>
                  <Text style={urgentStyles.cardMetaLabel}>ระยะทาง</Text>
                  <Text style={urgentStyles.cardDistance}>
                    {((job as any)._distanceKm as number) < 1 ? `${Math.round(((job as any)._distanceKm as number) * 1000)} ม.` : `${((job as any)._distanceKm as number).toFixed(1)} กม.`}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={urgentStyles.cardBottomRow}>
              <View style={urgentStyles.cardPriceBlock}>
                <Text style={urgentStyles.cardPrice}>฿{job.shiftRate?.toLocaleString()}</Text>
                <Text style={urgentStyles.cardPriceUnit}>{getRateUnit(job.rateType)}</Text>
              </View>
              <View style={urgentStyles.cardActionPill}>
                <Text style={urgentStyles.cardActionText}>ดูงาน</Text>
                <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {remainingCount > 0 ? (
          <TouchableOpacity style={urgentStyles.moreCard} onPress={onViewAll} onPressIn={stopAutoScroll} activeOpacity={0.86}>
            <View style={urgentStyles.moreCardTopRow}>
              <View style={urgentStyles.moreCardIconWrap}>
                <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              </View>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
            <Text style={urgentStyles.moreCardTitle}>ดูทั้งหมด</Text>
            <Text style={urgentStyles.moreCardCount}>+{remainingCount} งาน</Text>
            <Text style={urgentStyles.moreCardSub}>เปิดรายการงานด่วนทั้งหมด</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {totalSlides > 1 && (
        <View style={urgentStyles.pagination}>
          {Array.from({ length: totalSlides }).map((_, index) => (
            <View
              key={`urgent-dot-${index}`}
              style={[
                urgentStyles.paginationDot,
                index === activeSlide && urgentStyles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const urgentStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    backgroundColor: '#0F172A',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.22)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  backgroundGlowPrimary: {
    position: 'absolute',
    top: -34,
    right: -24,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(251,113,133,0.22)',
  },
  backgroundGlowSecondary: {
    position: 'absolute',
    left: -36,
    bottom: -52,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(249,115,22,0.16)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  headerCopy: {
    gap: 3,
    flex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  flashIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F43F5E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 13,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFE4E6',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  viewAllButtonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scrollContent: {
    gap: SPACING.sm,
    paddingBottom: 2,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#FB7185',
  },
  card: {
    width: URGENT_CARD_WIDTH,
    backgroundColor: '#FFFDFD',
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,113,133,0.18)',
    ...SHADOWS.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#FB7185',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rankBadge: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  rankBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    minHeight: 18,
    lineHeight: 17,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
  },
  locationIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F2',
  },
  cardLocation: {
    fontSize: 10,
    color: '#475569',
    flex: 1,
  },
  cardMetaStack: {
    gap: 5,
  },
  cardMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4E6',
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  cardMetaPillAccent: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  cardMetaIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
  },
  cardMetaIconWrapAccent: {
    backgroundColor: '#FFFFFF',
  },
  cardMetaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9F1239',
    minWidth: 40,
    marginRight: 4,
  },
  cardMetaText: {
    fontSize: 9,
    color: '#334155',
    fontWeight: '700',
    flex: 1,
  },
  cardDistance: {
    fontSize: 9,
    color: '#C2410C',
    fontWeight: '800',
    flex: 1,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 6,
  },
  cardPriceBlock: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardPriceUnit: {
    fontSize: 9,
    color: '#FDA4AF',
    marginTop: 1,
  },
  cardActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F43F5E',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FB7185',
  },
  cardActionText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderWidth: 1,
    borderColor: '#FECDD3',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 4,
  },
  urgentBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#E11D48',
  },
  moreCard: {
    width: 132,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    padding: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  moreCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  moreCardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(251,113,133,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  moreCardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  moreCardCount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFE4E6',
    marginTop: 2,
  },
  moreCardSub: {
    fontSize: 9,
    lineHeight: 12,
    color: 'rgba(255,255,255,0.72)',
    marginTop: 5,
  },
});

// ============================================
// Component
// ============================================
export default function HomeScreen({ navigation }: Props) {
  useScreenPerformance('Home');
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  // Nearby location
  const { location, loading: locationLoading, error: locationError, getLocation } = useLocation();
  const [nearbyMode, setNearbyMode] = useState(false); // true = ใกล้ฉัน
  // Auth context
  const { user, requireAuth, isInitialized } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const headerBackground = isDark ? colors.surface : colors.primary;
  const headerTextColor = isDark ? colors.text : colors.white;
  const headerMutedTextColor = isDark ? colors.textSecondary : 'rgba(255,255,255,0.8)';
  const headerButtonBackground = isDark ? colors.backgroundSecondary : 'rgba(255,255,255,0.2)';

  // State
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const jobsListRef = useRef<FlatList<JobPost>>(null);
  const lastDocRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [expiringPosts, setExpiringPosts] = useState<JobPost[]>([]);
  const [showNearbyPromo, setShowNearbyPromo] = useState(false);
  const [stickyInboxItems, setStickyInboxItems] = useState<StickyInboxItem[]>([]);
  const [savedFilterPresets, setSavedFilterPresets] = useState<SavedJobFilterPreset[]>([]);
  const nearbyRadiusKm = user?.nearbyJobAlert?.radiusKm ?? 20;
  const hasSavedNearbyLocation = user?.nearbyJobAlert?.lat != null && user?.nearbyJobAlert?.lng != null;
  const hasNearbyAlertSetup = Boolean(user?.nearbyJobAlert?.enabled && hasSavedNearbyLocation);
  const [filters, setFilters] = useState<JobFilters>({
    province: '',
    district: '',
    department: '',
    urgentOnly: false,
    verifiedOnly: false,
    sortBy: 'latest',
    staffType: undefined,
    locationType: undefined,
    homeCareOnly: false,
    paymentType: undefined,
  });

  // ทุก role เริ่มที่แท็บ "ทั้งหมด" โดยใช้ค่าเริ่มต้นของ filters.postType = undefined

  // Get urgent jobs for banner (paid premium placement)
  // Fetch location silently on mount — enables distance badges on all job cards
  useEffect(() => {
    const unsubscribe = subscribeStickyInboxItems('home', setStickyInboxItems);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!location) {
      getLocation().catch(() => {}); // silent fail — if denied, distances just won't show
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getNearbyBaseLocation = useCallback((override?: UserLocation | null): UserLocation | null => {
    if (override) return override;
    if (location) return location;

    const savedLat = user?.nearbyJobAlert?.lat;
    const savedLng = user?.nearbyJobAlert?.lng;
    if (savedLat != null && savedLng != null) {
      return {
        latitude: savedLat,
        longitude: savedLng,
      };
    }

    return null;
  }, [location, user?.nearbyJobAlert?.lat, user?.nearbyJobAlert?.lng]);

  const openNearbySettings = useCallback(() => {
    (navigation as any).navigate('NearbyJobAlert');
  }, [navigation]);

  const enableNearbyMode = useCallback(async () => {
    let resolvedLocation = getNearbyBaseLocation();
    if (!resolvedLocation) {
      resolvedLocation = getNearbyBaseLocation(await getLocation());
    }

    if (!resolvedLocation) {
      toast.error(locationError || 'ตั้งค่าตำแหน่งสำหรับงานใกล้คุณก่อน เพื่อให้ระบบช่วยเรียงงานได้แม่นขึ้น');
      openNearbySettings();
      return false;
    }

    setNearbyMode(true);
    return true;
  }, [getLocation, getNearbyBaseLocation, locationError, openNearbySettings, toast]);

  // Fetch jobs (infinite scroll + nearby)
  const fetchJobs = useCallback(async (showRefresh = false, loadMore = false) => {
    if (!nearbyMode && loadMore) return;
    if (loadMore && !hasMoreRef.current) return;
    if (loadMore) setIsLoadingMore(true);
    else if (showRefresh) { setIsRefreshing(true); lastDocRef.current = null; hasMoreRef.current = true; }
    else { setIsLoading(true); lastDocRef.current = null; hasMoreRef.current = true; }

    try {
      let fetchedJobs: JobPost[];
      const nearbyBaseLocation = getNearbyBaseLocation();

      if (nearbyMode && nearbyBaseLocation) {
        fetchedJobs = await getJobsNearby(
          nearbyBaseLocation.latitude,
          nearbyBaseLocation.longitude,
          nearbyRadiusKm,
          {
            screenName: 'Home',
            source: 'home:nearby_fetch',
          },
        );
        lastDocRef.current = null;
        hasMoreRef.current = false;
        setJobs(fetchedJobs);
      } else if (nearbyMode) {
        lastDocRef.current = null;
        hasMoreRef.current = false;
        setJobs([]);
      } else {
        const cursor = loadMore ? lastDocRef.current : null;
        const result = await getJobs(undefined, cursor, undefined, {
          screenName: 'Home',
          source: loadMore ? 'home:feed_load_more' : 'home:feed_fetch',
        });
        fetchedJobs = result.jobs;
        lastDocRef.current = result.lastDoc;
        hasMoreRef.current = result.lastDoc !== null && fetchedJobs.length > 0;

        if (loadMore) {
          setJobs(prev => {
            const ids = new Set(prev.map(j => j.id));
            return [...prev, ...fetchedJobs.filter(j => !ids.has(j.id))];
          });
        } else {
          setJobs(fetchedJobs);
        }
      }
    } catch (error: any) {
      // ไม่แสดง Alert ถ้า permission-denied (ยังไม่ login) หรือ loadMore
      if (error?.code !== 'permission-denied' && !loadMore) {
        console.warn('Error fetching jobs:', error);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [getNearbyBaseLocation, nearbyMode, nearbyRadiusKm]);

  // Initial load — only for nearbyMode (normal mode uses subscription below)
  useEffect(() => {
    if (nearbyMode) fetchJobs();
  }, [fetchJobs, nearbyMode]);

  useTabRefresh(
    useCallback(() => {
      fetchJobs(true);
    }, [fetchJobs]),
    {
      scrollToTop: () => jobsListRef.current?.scrollToOffset({ offset: 0, animated: true }),
    },
  );

  // Real-time notification subscription
  useEffect(() => {
    if (!user?.uid || !isInitialized) {
      setNotificationCount(0);
      return;
    }

    // Subscribe to notifications - real-time updates
    const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
      const unreadCount = notifications.filter(n => !n.isRead).length;
      setNotificationCount(unreadCount);
    }, {
      screenName: 'Home',
      source: 'home:notifications_subscription',
    });

    return () => unsubscribe();
  }, [user?.uid, isInitialized]);

  // Real-time favorites subscription
  useEffect(() => {
    if (!user?.uid || !isInitialized) {
      setFavoriteIds([]);
      return;
    }

    const unsubscribe = subscribeToFavorites(user.uid, (favorites: Favorite[]) => {
      setFavoriteIds(favorites.map(f => f.jobId));
    }, {
      screenName: 'Home',
      source: 'home:favorites_subscription',
    });

    return () => unsubscribe();
  }, [user?.uid, isInitialized]);

  // Check for expiring posts on app load
  useEffect(() => {
    // Show nearby job alert promo popup once per install (only for logged-in users)
    let promoTimer: ReturnType<typeof setTimeout> | null = null;

    const checkNearbyPromo = async () => {
      if (!user?.uid) return;
      // If already set up, never show
      if (user.nearbyJobAlert?.enabled) return;
      try {
        const shown = await AsyncStorage.getItem(`nearby_promo_shown_${user.uid}`);
        if (!shown) {
          promoTimer = setTimeout(() => setShowNearbyPromo(true), 1800);
        }
      } catch (_) {}
    };
    checkNearbyPromo();
  // ใช้ nearbyJobAlert?.enabled เป็น dep ด้วย เพื่อซ่อน banner ทันทีที่ user save ตั้งค่า
    return () => {
      if (promoTimer) clearTimeout(promoTimer);
    };
  }, [user?.uid, user?.nearbyJobAlert?.enabled]);

  const dismissNearbyPromo = useCallback(async (navigate = false) => {
    setShowNearbyPromo(false);
    if (user?.uid) {
      await AsyncStorage.setItem(`nearby_promo_shown_${user.uid}`, '1');
    }
    if (navigate) {
      (navigation as any).navigate('NearbyJobAlert');
    }
  }, [user?.uid, navigation]);

  useEffect(() => {
    let isMounted = true;

    const loadPresets = async () => {
      if (!user?.uid) {
        if (isMounted) setSavedFilterPresets([]);
        return;
      }

      const presets = await loadSavedJobFilterPresets(user.uid);
      if (isMounted) setSavedFilterPresets(presets);
    };

    loadPresets();
    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Check for expiring posts on app load
  useEffect(() => {
    const checkExpiringPosts = async () => {
      if (!user?.uid) return;
      
      try {
        const userPosts = await getUserPosts(user.uid, {
          screenName: 'Home',
          source: 'home:user_posts_check',
        });
        const now = new Date();
        
        // Filter posts that are expiring within 1 day (changed from 3 days)
        const expiring = userPosts.filter(post => {
          if (post.status === 'closed') return false;
          if (!post.expiresAt) return false;
          
          const expiryDate = (post.expiresAt as any)?.toDate?.() || post.expiresAt;
          const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft <= 1 && daysLeft > 0; // Only show when 1 day or less remaining
        });
        
        if (expiring.length > 0) {
          setExpiringPosts(expiring);
          setShowExpiryPopup(true);
        }
      } catch (error) {
        console.log('Error checking expiring posts:', error);
      }
    };

    // Only check once per session
    const timer = setTimeout(checkExpiringPosts, 2000);
    return () => clearTimeout(timer);
  }, [user?.uid]);

  // Real-time jobs subscription
  useEffect(() => {
    if (nearbyMode) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Subscribe to jobs updates
    const unsubscribe = subscribeToJobs((newJobs) => {
      console.log(`Jobs loaded: ${newJobs.length} total`);
      setJobs(newJobs);
      setIsLoading(false);
    }, {
      screenName: 'Home',
      source: 'home:jobs_subscription',
    });

    return () => unsubscribe();
  }, [nearbyMode]);

  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);

    if (text.trim().length >= 2) {
      trackEvent({
        eventName: 'search_filter_applied',
        screenName: 'Home',
        props: {
          queryLength: text.trim().length,
          hasProvinceFilter: Boolean(filters.province),
          hasStaffTypeFilter: Boolean(filters.staffType),
          urgentOnly: Boolean(filters.urgentOnly),
        },
      });
    }
  };

  // Handle job press
  const handleJobPress = (job: JobPost) => {
    trackEvent({
      eventName: 'job_detail_view',
      screenName: 'Home',
      subjectType: 'shift',
      subjectId: job.id,
      jobId: job.id,
      province: job.location?.province,
      props: {
        source: filters.urgentOnly ? 'urgent_filter' : 'home_feed',
        postType: job.postType || 'shift',
        staffType: job.staffType || null,
        isUrgent: Boolean(job.status === 'urgent' || job.isUrgent),
      },
    });

    const serializedJob = {
      ...job,
      shiftDate: job.shiftDate ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate) : undefined,
      shiftDateEnd: (job as any).shiftDateEnd ? ((job as any).shiftDateEnd instanceof Date ? (job as any).shiftDateEnd.toISOString() : (job as any).shiftDateEnd) : undefined,
    } as any;
    (navigation as any).navigate('JobDetail', {
      job: serializedJob,
      source: filters.urgentOnly ? 'home_urgent_filter' : 'home_feed',
    });
  };

  // Handle save job (toggle favorite)
  const handleSaveJob = async (job: JobPost) => {
    requireAuth(async () => {
      if (!user?.uid) return;
      
      try {
        await trackEvent({
          eventName: 'search_filter_applied',
          screenName: 'Home',
          subjectType: 'shift',
          subjectId: job.id,
          jobId: job.id,
          province: job.location?.province,
          props: {
            action: 'favorite_toggle',
            postType: job.postType || 'shift',
            staffType: job.staffType || null,
          },
        });

        const isNowFavorite = await toggleFavorite(user.uid, job.id);
        if (isNowFavorite) {
          toast.success(`เพิ่ม "${job.title}" ไปยังรายการโปรดแล้ว`, 'บันทึกแล้ว');
        } else {
          toast.info(`ลบ "${job.title}" ออกจากรายการโปรดแล้ว`, 'ลบออกแล้ว');
        }
      } catch (error) {
        toast.error('ไม่สามารถบันทึกงานได้');
      }
    });
  };

  // Apply filters
  const applyFilters = async (nextNearbyMode = nearbyMode, nextFilters = filters) => {
    if (nextNearbyMode) {
      const enabled = await enableNearbyMode();
      if (!enabled) return;
    } else {
      setNearbyMode(false);
    }

    setShowFilters(false);

    trackEvent({
      eventName: 'search_filter_applied',
      screenName: 'Home',
      props: {
        province: nextFilters.province || null,
        district: nextFilters.district || null,
        department: nextFilters.department || null,
        staffType: nextFilters.staffType || null,
        locationType: nextFilters.locationType || null,
        paymentType: nextFilters.paymentType || null,
        urgentOnly: Boolean(nextFilters.urgentOnly),
        verifiedOnly: Boolean(nextFilters.verifiedOnly),
        nearbyMode: Boolean(nextNearbyMode),
        sortBy: nextFilters.sortBy || 'latest',
        activeFilterCount:
          (nextFilters.province ? 1 : 0) +
          (nextFilters.district ? 1 : 0) +
          (nextFilters.department ? 1 : 0) +
          (nextFilters.urgentOnly ? 1 : 0) +
          (nextFilters.verifiedOnly ? 1 : 0) +
          (nextFilters.minRate || nextFilters.maxRate ? 1 : 0) +
          (nextFilters.staffType ? 1 : 0) +
          (nextFilters.locationType ? 1 : 0) +
          (nextFilters.homeCareOnly ? 1 : 0) +
          (nextFilters.paymentType ? 1 : 0),
      },
    });
  };

  const handleSaveCurrentFilterPreset = useCallback(async (nextFilters: JobFilters, nextNearbyMode: boolean) => {
    if (!user?.uid) {
      toast.info('เข้าสู่ระบบก่อนเพื่อบันทึกตัวกรองโปรด');
      return;
    }

    const hasMeaningfulFilter = Boolean(
      nextNearbyMode ||
      nextFilters.province ||
      nextFilters.district ||
      nextFilters.department ||
      nextFilters.staffType ||
      nextFilters.locationType ||
      nextFilters.paymentType ||
      nextFilters.postType ||
      nextFilters.minRate ||
      nextFilters.maxRate ||
      nextFilters.urgentOnly ||
      nextFilters.verifiedOnly
    );

    if (!hasMeaningfulFilter) {
      toast.info('ตั้งค่าตัวกรองก่อน แล้วค่อยบันทึกเป็นตัวกรองโปรด');
      return;
    }

    const presets = await saveJobFilterPreset(user.uid, nextFilters, nextNearbyMode);
    setSavedFilterPresets(presets);
    toast.success('บันทึกชุดตัวกรองไว้แล้ว เรียกใช้ซ้ำได้จากหน้าแรก');
  }, [toast, user?.uid]);

  const applySavedFilterPreset = useCallback(async (preset: SavedJobFilterPreset) => {
    setFilters(preset.filters);
    setNearbyMode(preset.nearbyMode);
    await applyFilters(preset.nearbyMode, preset.filters);
    toast.success(`เรียกใช้ชุด \"${preset.label}\" เรียบร้อยแล้ว`);
  }, [toast]);

  const handleRemoveSavedFilterPreset = useCallback((preset: SavedJobFilterPreset) => {
    if (!user?.uid) return;

    Alert.alert(
      'ลบตัวกรองโปรด',
      `ต้องการลบ \"${preset.label}\" หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            const presets = await removeSavedJobFilterPreset(user.uid, preset.id);
            setSavedFilterPresets(presets);
            toast.info('นำชุดตัวกรองนี้ออกจากรายการแล้ว');
          },
        },
      ],
    );
  }, [toast, user?.uid]);

  // Clear filters
  const clearFilters = () => {
    setNearbyMode(false);
    setFilters({
      province: '',
      district: '',
      department: '',
      urgentOnly: false,
      verifiedOnly: false,
      sortBy: 'latest',
      minRate: undefined,
      maxRate: undefined,
      staffType: undefined,
      locationType: undefined,
      homeCareOnly: false,
      paymentType: undefined,
      postType: undefined,
    });
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.province) count++;
    if (filters.district) count++;
    if (filters.department) count++;
    if (filters.urgentOnly) count++;
    if (filters.verifiedOnly) count++;
    if (filters.minRate || filters.maxRate) count++;
    if (filters.staffType) count++;
    if (filters.locationType) count++;
    if (filters.homeCareOnly) count++;
    if (filters.paymentType) count++;
    return count;
  }, [filters]);

  // Compute distance for each job (if user location is available)
  const jobsWithDistance = useMemo(() => {
    const baseLat = location?.latitude ?? user?.nearbyJobAlert?.lat;
    const baseLng = location?.longitude ?? user?.nearbyJobAlert?.lng;
    if (baseLat == null || baseLng == null) return jobs;

    return jobs.map(job => {
      const coords = getJobCoords(job);
      if (!coords) return job;
      const dist = getDistanceKm(baseLat, baseLng, coords.lat, coords.lng);
      return { ...job, _distanceKm: Math.round(dist * 10) / 10 } as JobPost;
    });
  }, [jobs, location, user?.nearbyJobAlert?.lat, user?.nearbyJobAlert?.lng]);

  const visibleJobs = useMemo(() => {
    let filteredJobs = jobsWithDistance;
    const query = searchQuery.trim().toLowerCase();

    if (filters.province) {
      filteredJobs = filteredJobs.filter(job => job.location?.province === filters.province);
    }
    if (filters.district) {
      filteredJobs = filteredJobs.filter(job => job.location?.district === filters.district);
    }
    if (filters.department) {
      filteredJobs = filteredJobs.filter(job => job.department === filters.department);
    }
    if (filters.urgentOnly) {
      filteredJobs = filteredJobs.filter(job => job.status === 'urgent');
    }
    if (filters.verifiedOnly) {
      filteredJobs = filteredJobs.filter(job => job.posterVerified === true);
    }
    if (filters.minRate && filters.minRate > 0) {
      filteredJobs = filteredJobs.filter(job => job.shiftRate >= filters.minRate!);
    }
    if (filters.maxRate && filters.maxRate > 0) {
      filteredJobs = filteredJobs.filter(job => job.shiftRate <= filters.maxRate!);
    }
    if (filters.staffType) {
      filteredJobs = filteredJobs.filter(job => job.staffType === filters.staffType);
    }
    if (filters.locationType) {
      filteredJobs = filteredJobs.filter(job => job.locationType === filters.locationType);
    }
    if (filters.paymentType) {
      filteredJobs = filteredJobs.filter(job => job.paymentType === filters.paymentType);
    }
    if (filters.homeCareOnly) {
      filteredJobs = filteredJobs.filter(job => job.locationType === 'HOME');
    }
    if (filters.postType) {
      filteredJobs = filteredJobs.filter(job => job.postType === filters.postType);
    }
    if (filters.sortBy === 'morning') {
      filteredJobs = filteredJobs.filter(job => {
        const startHour = parseInt(job.shiftTime?.split(':')[0] || '8');
        return startHour >= 5 && startHour < 12;
      });
    } else if (filters.sortBy === 'night') {
      filteredJobs = filteredJobs.filter(job => {
        const startHour = parseInt(job.shiftTime?.split(':')[0] || '8');
        return startHour >= 18 || startHour < 5;
      });
    }

    if (query) {
      filteredJobs = filteredJobs.filter((job) => {
        const searchableFields = [
          job.title,
          job.department,
          job.description,
          job.posterName,
          job.location?.hospital,
          job.location?.district,
          job.location?.province,
        ];

        return searchableFields.some((value) => String(value || '').toLowerCase().includes(query));
      });
    }

    if (filters.sortBy === 'highestPay') {
      return [...filteredJobs].sort((a, b) => (b.shiftRate || 0) - (a.shiftRate || 0));
    }

    return filteredJobs;
  }, [filters, jobsWithDistance, searchQuery]);

  const urgentJobs = useMemo(() => {
    return visibleJobs.filter(job => job.status === 'urgent');
  }, [visibleJobs]);

  const featuredUrgentJobs = useMemo(() => {
    return urgentJobs.slice(0, 8);
  }, [urgentJobs]);

  const totalUrgentJobs = urgentJobs.length;
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const nearbyInfoMessage = useMemo(() => {
    if (hasNearbyAlertSetup) {
      return `ค้นหางานภายในรัศมี ${nearbyRadiusKm} กม. และเรียงจากใกล้ที่สุด`;
    }
    if (locationLoading) {
      return 'กำลังตรวจสอบตำแหน่งของคุณ...';
    }
    return 'เปิดสิทธิ์ตำแหน่งและตั้งค่ารัศมีที่หน้า งานใกล้คุณ ก่อน เพื่อให้ระบบช่วยหางานได้เร็วขึ้น';
  }, [hasNearbyAlertSetup, locationLoading, nearbyRadiusKm]);

  // Render job item
  const renderJobItem = useCallback(({ item }: { item: JobPost }) => (
    <JobCard
      job={item}
      onPress={() => handleJobPress(item)}
      onSave={() => handleSaveJob(item)}
      isSaved={favoriteIdSet.has(item.id)}
    />
  ), [favoriteIdSet, handleJobPress, handleSaveJob]);

  // Render header
  const renderHeader = () => {
    // Role-aware onboarding banner text
    const onboardingTitle = user?.role === 'hospital'
      ? 'ตั้งค่าองค์กรของคุณ'
      : user?.role === 'user'
      ? 'บอกเราว่าคุณต้องการอะไร'
      : 'ตั้งค่าโปรไฟล์ของคุณ';
    const onboardingSub = user?.role === 'hospital'
      ? 'ระบุประเภทองค์กรและบุคลากรที่ต้องการ เพื่อให้การโพสต์งานง่ายขึ้น'
      : user?.role === 'user'
      ? 'บอกเราประเภทการดูแลที่ต้องการ เราจะแสดงผู้ดูแลที่ตรงกับคุณ'
      : 'บอกเราสักเล็กน้อย เราจะแนะนำงานที่ตรงกับคุณยิ่งขึ้น';

    return (
    <View style={styles.listHeader}>
      {user && user.onboardingCompleted && (
        <FirstVisitTip
          storageKey={`first_tip_home_${user.uid}`}
          icon="compass-outline"
          title="หน้าแรกคือศูนย์รวมการค้นหางานของคุณ"
          description="ใช้ช่องค้นหา ตัวกรอง และโหมดงานใกล้คุณเพื่อเจองานที่ตรงได้เร็วขึ้น พร้อมเริ่มคุยต่อผ่านแอปได้สะดวกในที่เดียว"
          actionLabel="ดูคู่มือ"
          onAction={onboardingSurveyEnabled ? () => (navigation as any).navigate('OnboardingSurvey') : undefined}
          containerStyle={{ marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 10 }}
        />
      )}

      {/* Onboarding Banner — แสดงตอนเข้าแอปครั้งแรก */}
      {user && !user.onboardingCompleted && onboardingSurveyEnabled && (
        <TouchableOpacity
          style={styles.onboardingBanner}
          onPress={() => (navigation as any).navigate('OnboardingSurvey')}
          activeOpacity={0.88}
        >
          {/* Left accent stripe */}
          <View style={styles.onboardingBannerStripe} />

          {/* Content */}
          <View style={styles.onboardingBannerContent}>
            <View style={styles.onboardingBannerRow}>
              <View style={styles.onboardingBannerIcon}>
                <Ionicons name="sparkles" size={16} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.onboardingBannerTag}>เริ่มใช้งานได้เร็ว</Text>
                <Text style={styles.onboardingBannerTitle}>{onboardingTitle}</Text>
                <Text style={styles.onboardingBannerSub}>{onboardingSub}</Text>
              </View>
            </View>
            {/* Progress dots + CTA row */}
            <View style={styles.onboardingBannerFooter}>
              <View style={styles.onboardingDots}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.onboardingDot, i === 0 && styles.onboardingDotActive]} />
                ))}
              </View>
              <View style={styles.onboardingBannerCTA}>
                <Text style={styles.onboardingBannerCTAText}>เริ่มเลย</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFF" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Nearby Job Alert Banner — always visible until user sets up */}
      {user && !user.nearbyJobAlert?.enabled && (
        <TouchableOpacity
          style={styles.nearbyBanner}
          onPress={openNearbySettings}
          activeOpacity={0.85}
        >
          <View style={styles.nearbyBannerLeft}>
            <View style={styles.nearbyBannerIcon}>
              <Ionicons name="location" size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nearbyBannerTitle}>งานใกล้คุณ</Text>
              <Text style={styles.nearbyBannerSub}>
                ตั้งค่าตำแหน่งและรัศมี เพื่อให้ระบบเรียงงานใกล้ตัวและแจ้งเตือนได้เร็วขึ้น
              </Text>
            </View>
          </View>
          <View style={styles.nearbyBannerCTA}>
            <Text style={styles.nearbyBannerCTAText}>ตั้งค่า</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
      )}

      <StickyInboxPanel items={stickyInboxItems} maxItems={2} containerStyle={[styles.stickyAnnouncementWrap, { paddingHorizontal: SPACING.md }]} />

      {/* Urgent Jobs Banner - Premium Placement */}
      {urgentJobs.length > 0 && (
        <View style={{ paddingHorizontal: SPACING.md }}>
          <UrgentJobsBanner 
            urgentJobs={featuredUrgentJobs}
            totalUrgentJobs={totalUrgentJobs}
            onPress={handleJobPress}
            onViewAll={() => setFilters((prev) => ({ ...prev, urgentOnly: true, sortBy: 'latest' }))}
          />
        </View>
      )}

      {/* Quick Filters */}
      <ScrollView 
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFilters}
      >
        <Chip
          label="ทั้งหมด"
          selected={!filters.urgentOnly && !filters.staffType && !filters.locationType && filters.sortBy === 'latest'}
          onPress={() => setFilters({ ...filters, urgentOnly: false, staffType: undefined, locationType: undefined, sortBy: 'latest' })}
        />
        <Chip
          label={totalUrgentJobs > 0 ? `ด่วน ${totalUrgentJobs}` : 'ด่วน'}
          selected={filters.urgentOnly}
          onPress={() => setFilters({ ...filters, urgentOnly: !filters.urgentOnly })}
        />
        <Chip
          label="ยืนยันตัวตน"
          selected={filters.verifiedOnly}
          onPress={() => setFilters({ ...filters, verifiedOnly: !filters.verifiedOnly })}
        />
        <Chip
          label="ใกล้ฉัน"
          selected={nearbyMode}
          onPress={async () => {
            if (!nearbyMode) {
              await enableNearbyMode();
            } else {
              setNearbyMode(false);
            }
          }}
        />
        <Chip
          label="ดูแลที่บ้าน"
          selected={filters.locationType === 'HOME'}
          onPress={() => setFilters({ ...filters, locationType: filters.locationType === 'HOME' ? undefined : 'HOME' })}
        />
        <Chip
          label="รพ."
          selected={filters.locationType === 'HOSPITAL'}
          onPress={() => setFilters({ ...filters, locationType: filters.locationType === 'HOSPITAL' ? undefined : 'HOSPITAL' })}
        />
        <Chip
          label="💰 NET"
          selected={filters.paymentType === 'NET'}
          onPress={() => setFilters({ ...filters, paymentType: filters.paymentType === 'NET' ? undefined : 'NET' })}
        />
        <Chip
          label="🌙 เวรดึก"
          selected={filters.sortBy === 'night'}
          onPress={() => setFilters({ ...filters, sortBy: filters.sortBy === 'night' ? 'latest' : 'night' })}
        />
        <Chip
          label="💵 ค่าสูง"
          selected={filters.sortBy === 'highestPay'}
          onPress={() => setFilters({ ...filters, sortBy: filters.sortBy === 'highestPay' ? 'latest' : 'highestPay' })}
        />
      </ScrollView>

      {!hasNearbyAlertSetup && (
        <TouchableOpacity
          style={styles.nearbyHelperCard}
          onPress={openNearbySettings}
          activeOpacity={0.85}
        >
          <View style={styles.nearbyHelperIconWrap}>
            <Ionicons
              name="location-outline"
              size={18}
              color="#B45309"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.nearbyHelperTitle}>เปิดงานใกล้คุณให้พร้อม</Text>
            <Text style={styles.nearbyHelperText}>{nearbyInfoMessage}</Text>
          </View>
          <View style={styles.nearbyHelperCTA}>
            <Text style={styles.nearbyHelperCTAText}>ตั้งค่า</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </TouchableOpacity>
      )}

      {/* Results count */}
      <View style={styles.resultsRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={(CATEGORY_TABS.find(t => t.key === (filters.postType ?? 'all'))?.icon || 'apps-outline') as any}
            size={14}
            color={colors.textSecondary}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.resultsText}>
            พบ <Text style={styles.resultsCount}>{visibleJobs.length}</Text>{' '}
            {CATEGORY_TABS.find(t => t.key === (filters.postType ?? 'all'))?.label ?? 'งาน'}
          </Text>
        </View>
        {nearbyMode && (
          <Text style={styles.nearbySortLabel}>ใกล้สุดก่อน • {nearbyRadiusKm} กม.</Text>
        )}
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFilters}>ล้างตัวกรอง</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  }; // end renderHeader

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar backgroundColor={headerBackground} barStyle="light-content" translucent={false} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBackground }]}> 
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: headerTextColor }]}>
              {user ? `สวัสดี, ${user.displayName?.split(' ')[0] || 'คุณ'}` : 'บอร์ดหาคนแทน'}
            </Text>
            <Text style={[styles.headerSubtitle, { color: headerMutedTextColor }]}>
              {user ? 'หางานหรือหาคนแทน' : 'เข้าสู่ระบบเพื่อประกาศ'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {/* Notification Icon */}
            <TouchableOpacity 
              style={[styles.notificationButton, { backgroundColor: headerButtonBackground }]}
              onPress={() => (navigation as any).navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={headerTextColor} />
              {notificationCount > 0 && (
                <View style={[styles.notificationBadge, { borderColor: headerBackground }]}> 
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Profile */}
            <TouchableOpacity 
              style={[styles.profileButton, { borderColor: isDark ? colors.border : colors.white }]}
              onPress={() => (navigation as any).navigate('Profile')}
            >
              <Avatar 
                uri={user?.photoURL} 
                name={user?.displayName || 'Guest'} 
                size={44} 
              />
            </TouchableOpacity>
          </View>
        </View>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface }]}> 
            <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="ค้นหาเวร, แผนก, สถานที่..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterButton, { backgroundColor: activeFilterCount > 0 ? colors.primary : headerButtonBackground }]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={22} color={activeFilterCount > 0 ? colors.white : headerTextColor} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {savedFilterPresets.length > 0 && (
          <View style={styles.savedPresetSection}>
            <View style={styles.savedPresetHeader}>
              <View style={styles.savedPresetHeaderLeft}>
                <Ionicons name="sparkles-outline" size={14} color={headerTextColor} />
                <Text style={[styles.savedPresetHeaderTitle, { color: headerTextColor }]}>ชุดที่ใช้บ่อย</Text>
              </View>
              <Text style={[styles.savedPresetHeaderHint, { color: 'rgba(255,255,255,0.82)' }]}>แตะเพื่อใช้ซ้ำ • กดค้างเพื่อลบ</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedPresetRow}
            >
              {savedFilterPresets.map((preset) => {
                const isPresetActive = JSON.stringify(filters) === JSON.stringify(preset.filters) && nearbyMode === preset.nearbyMode;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.savedPresetChip,
                      {
                        backgroundColor: isPresetActive ? colors.white : 'rgba(255,255,255,0.14)',
                        borderColor: isPresetActive ? colors.white : 'rgba(255,255,255,0.22)',
                      },
                    ]}
                    onPress={() => applySavedFilterPreset(preset)}
                    onLongPress={() => handleRemoveSavedFilterPreset(preset)}
                    activeOpacity={0.85}
                  >
                    <View style={[
                      styles.savedPresetIconBadge,
                      { backgroundColor: isPresetActive ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.16)' },
                    ]}>
                      <Ionicons
                        name={isPresetActive ? 'star' : 'sparkles-outline'}
                        size={13}
                        color={isPresetActive ? colors.primary : headerTextColor}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.savedPresetText,
                        { color: isPresetActive ? colors.primary : headerTextColor },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: headerBackground }}
          contentContainerStyle={styles.categoryTabs}
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = (filters.postType ?? 'all') === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.categoryTab,
                  isActive && { backgroundColor: colors.surface },
                ]}
                onPress={() =>
                  setFilters((prev) => ({
                    ...prev,
                    postType: tab.key === 'all' ? undefined : (tab.key as 'shift' | 'job' | 'homecare'),
                  }))
                }
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? tab.color : headerTextColor}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.categoryTabLabel,
                    { color: isActive ? tab.color : headerTextColor },
                    isActive && { fontWeight: '700' as const },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Job List */}
  <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isLoading ? (
        <Loading text="กำลังโหลดงาน..." />
      ) : (
        <FlatList
          ref={jobsListRef}
          data={visibleJobs}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon="😢"
              title={nearbyMode ? `ยังไม่พบงานในรัศมี ${nearbyRadiusKm} กม.` : 'ไม่พบเวรที่ตรงกับเงื่อนไข'}
              description={nearbyMode ? 'ลองขยายรัศมีหรืออัปเดตตำแหน่งที่หน้า งานใกล้คุณ เพื่อเห็นตัวเลือกมากขึ้น' : 'ลองเปลี่ยนตัวกรองหรือคำค้นหา เพื่อให้เจองานที่ตรงได้เร็วขึ้น'}
              actionText={nearbyMode ? 'ตั้งค่างานใกล้คุณ' : 'ล้างตัวกรอง'}
              onAction={nearbyMode ? openNearbySettings : clearFilters}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchJobs(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={nearbyMode ? () => fetchJobs(false, true) : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>โหลดเพิ่มเติม...</Text>
              </View>
            ) : visibleJobs.length > 0 && !hasMoreRef.current ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>— แสดงทั้งหมด {visibleJobs.length} รายการ —</Text>
              </View>
            ) : null
          }
        />
      )}

      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={applyFilters}
        onClear={clearFilters}
        onSaveCurrent={handleSaveCurrentFilterPreset}
        nearbyMode={nearbyMode}
        setNearbyMode={setNearbyMode}
      />

      {/* ── Nearby Job Alert Promo Popup ─────────────────────── */}
      <ModalContainer
        visible={showNearbyPromo}
        onClose={() => dismissNearbyPromo(false)}
        title=""
      >
        <View style={styles.promoWrap}>
          {/* Icon */}
          <View style={[styles.promoIconCircle, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name="location" size={44} color={colors.primary} />
          </View>

          <Text style={[styles.promoTitle, { color: colors.text }]}>รู้ไวขึ้นกับงานใกล้คุณ</Text>
          <Text style={[styles.promoDesc, { color: colors.textSecondary }]}>
            เมื่อมีงานใหม่ในรัศมีที่คุณกำหนด{`\n`}
            แอปจะส่งแจ้งเตือนให้คุณอย่างรวดเร็ว เพื่อไม่พลาดโอกาสสำคัญ
          </Text>

          {/* Feature list */}
          {[
            { icon: 'notifications', text: 'รับแจ้งเตือนทันทีเมื่อมีงานใหม่ในพื้นที่ที่สนใจ' },
            { icon: 'resize', text: 'กำหนดรัศมีเองได้ตามสไตล์การรับงานของคุณ' },
            { icon: 'location-outline', text: 'ใช้ตำแหน่งจากมือถือเพื่อเรียงงานใกล้ตัวได้แม่นขึ้น' },
          ].map((f) => (
            <View key={f.icon} style={styles.promoFeatureRow}>
              <View style={[styles.promoFeatureDot, { backgroundColor: colors.primaryBackground }]}> 
                <Ionicons name={f.icon as any} size={15} color={colors.primary} />
              </View>
              <Text style={[styles.promoFeatureText, { color: colors.text }]}>{f.text}</Text>
            </View>
          ))}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.promoCTA, { backgroundColor: colors.primary }]}
            onPress={() => dismissNearbyPromo(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="location" size={18} color={colors.white} />
            <Text style={styles.promoCTAText}>เปิดแจ้งเตือนงานใกล้คุณ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.promoDismiss}
            onPress={() => dismissNearbyPromo(false)}
          >
            <Text style={[styles.promoDismissText, { color: colors.textSecondary }]}>ไว้ทีหลัง</Text>
          </TouchableOpacity>
        </View>
      </ModalContainer>

      {/* Expiring Posts Popup */}
      <ModalContainer
        visible={showExpiryPopup}
        onClose={() => setShowExpiryPopup(false)}
        title="ประกาศใกล้หมดอายุ"
      >
        <View style={{ padding: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZES.md, color: colors.textSecondary, marginBottom: SPACING.md, textAlign: 'center' }}>
            คุณมี {expiringPosts.length} ประกาศที่ใกล้หมดอายุ
          </Text>
          
          {expiringPosts.slice(0, 3).map((post) => {
            const now = new Date();
            const expiryDate = (post.expiresAt as any)?.toDate?.() || post.expiresAt;
            const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <View key={post.id} style={{ 
                backgroundColor: daysLeft <= 1 ? colors.errorLight : colors.warningLight, 
                padding: SPACING.md, 
                borderRadius: BORDER_RADIUS.md,
                marginBottom: SPACING.sm,
                borderLeftWidth: 4,
                borderLeftColor: colors.error,
              }}>
                <Text style={{ fontWeight: '600', color: colors.text }} numberOfLines={1}>
                  {post.title}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.sm, color: colors.error, marginTop: 4 }}>
                  ⚠️ จะหมดอายุภายใน 24 ชั่วโมง!
                </Text>
              </View>
            );
          })}
          
          <View style={{ 
            backgroundColor: colors.infoLight, 
            padding: SPACING.md, 
            borderRadius: BORDER_RADIUS.md,
            marginTop: SPACING.sm,
          }}>
            <Text style={{ fontSize: FONT_SIZES.sm, color: colors.primary, textAlign: 'center' }}>
              💡 ต่ออายุประกาศได้ในราคา 19 บาท/วัน
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
            <Button
                variant="outline"
                onPress={() => setShowExpiryPopup(false)}
                style={{ flex: 1 }}
              >ปิด</Button>
              <Button
                onPress={() => {
                  setShowExpiryPopup(false);
                  (navigation as any).navigate('MyPosts');
                }}
                style={{ flex: 1 }}
              >จัดการประกาศ</Button>
          </View>
        </View>
      </ModalContainer>

      {/* FAB - Quick Actions */}
      <FAB
        mainIcon="add"
        size={64}
        actions={[
          {
            icon: 'create-outline',
            label: 'โพสต์งาน',
            onPress: () => navigation.navigate('PostJob' as any),
            color: '#0EA5E9',
          },
          {
            icon: 'navigate-outline',
            label: 'งานใกล้คุณ',
            onPress: openNearbySettings,
            color: '#14B8A6',
          },
          {
            icon: 'map-outline',
            label: 'ดูแผนที่',
            onPress: () => (navigation as any).getParent()?.navigate('MapJobs'),
            color: '#6366F1',
          },
          {
            icon: 'heart-outline',
            label: 'รายการโปรด',
            onPress: () => (navigation as any).getParent()?.navigate('Favorites'),
            color: '#EC4899',
          },
        ]}
      />
    </SafeAreaView>
  );
}

// ============================================
// FILTER MODAL COMPONENT
// ============================================
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: JobFilters;
  setFilters: React.Dispatch<React.SetStateAction<JobFilters>>;
  onClear: () => void;
  onSaveCurrent: (filters: JobFilters, nearbyMode: boolean) => void | Promise<void>;
  nearbyMode: boolean;
  setNearbyMode: (val: boolean) => void;
  onApply: (nextNearbyMode?: boolean, nextFilters?: JobFilters) => void | Promise<void>;
}

function FilterModal({ visible, onClose, filters, setFilters, onApply, onClear, onSaveCurrent, nearbyMode, setNearbyMode }: FilterModalProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [provinceSearch, setProvinceSearch] = useState('');
  const [showAllProvinces, setShowAllProvinces] = useState(false);
  const [nearbyPreset, setNearbyPreset] = useState(!!nearbyMode);
  const [minRateText, setMinRateText] = useState(filters.minRate?.toString() ?? '');
  const [maxRateText, setMaxRateText] = useState(filters.maxRate?.toString() ?? '');

  useEffect(() => {
    if (!visible) return;
    setNearbyPreset(!!nearbyMode);
  }, [visible, nearbyMode]);

  const filteredProvinces = provinceSearch
    ? ALL_PROVINCES.filter(p => p.toLowerCase().includes(provinceSearch.toLowerCase()))
    : (showAllProvinces ? ALL_PROVINCES : POPULAR_PROVINCES);

  const SectionHeader = ({ icon, label, iconColor = colors.primary }: { icon: string; label: string; iconColor?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: iconColor + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{label}</Text>
    </View>
  );

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title="ตัวกรองการค้นหา"
      fullScreen={true}
    >
      <ScrollView
        style={[styles.filterContent, { backgroundColor: colors.background }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Near Me */}
        <View style={{ marginBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setNearbyPreset(!nearbyPreset)}
            style={{
              backgroundColor: nearbyPreset ? colors.primaryBackground : colors.surface,
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: nearbyPreset ? 2 : 1,
              borderColor: nearbyPreset ? colors.primary : colors.border,
              shadowColor: colors.primary,
              shadowOpacity: nearbyPreset ? 0.12 : 0,
              shadowRadius: 8,
              elevation: nearbyPreset ? 3 : 0,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: nearbyPreset ? colors.primary : colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name="location" size={22} color={nearbyPreset ? colors.white : colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: nearbyPreset ? colors.primary : colors.text }}>ใกล้ฉัน</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>งานใกล้ตำแหน่งของคุณมากที่สุด</Text>
            </View>
            <View style={{
              width: 28, height: 16, borderRadius: 8,
              backgroundColor: nearbyPreset ? colors.primary : colors.textLight,
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}>
              <View style={{
                width: 12, height: 12, borderRadius: 6, backgroundColor: colors.white,
                alignSelf: nearbyPreset ? 'flex-end' : 'flex-start',
              }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Staff Type */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="person-outline" label="ประเภทบุคลากร" iconColor={colors.primary} />
          <View style={styles.filterOptions}>
            <Chip label="ทั้งหมด" selected={!filters.staffType}
              onPress={() => setFilters({ ...filters, staffType: undefined })} style={styles.optionChip} />
            {STAFF_TYPES.map((type) => (
              <Chip key={type.code} label={type.shortName}
                selected={filters.staffType === type.code}
                onPress={() => setFilters({ ...filters, staffType: type.code })}
                style={styles.optionChip} />
            ))}
          </View>
        </View>

        {/* Location Type */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="business-outline" label="ประเภทสถานที่" iconColor="#8B5CF6" />
          <View style={styles.filterOptions}>
            <Chip label="ทั้งหมด" selected={!filters.locationType}
              onPress={() => setFilters({ ...filters, locationType: undefined, homeCareOnly: false })}
              style={styles.optionChip} />
            {LOCATION_TYPES.map((loc) => (
              <Chip key={loc.code}
                label={loc.nameTH}
                selected={filters.locationType === loc.code}
                onPress={() => setFilters({ ...filters, locationType: loc.code, homeCareOnly: loc.code === 'HOME' })}
                style={styles.optionChip} />
            ))}
          </View>
        </View>

        {/* Province */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="map-outline" label="จังหวัด" iconColor="#10B981" />
          <TextInput
            style={[styles.provinceSearchInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
            placeholder="ค้นหาจังหวัด..."
            placeholderTextColor={colors.textMuted}
            value={provinceSearch}
            onChangeText={setProvinceSearch}
          />
          <View style={styles.filterOptions}>
            <Chip label="ทั้งหมด" selected={!filters.province}
              onPress={() => setFilters({ ...filters, province: '', district: '' })} style={styles.optionChip} />
            {filteredProvinces.map((province) => (
              <Chip key={province} label={province}
                selected={filters.province === province}
                onPress={() => setFilters({ ...filters, province, district: '' })}
                style={styles.optionChip} />
            ))}
          </View>
          {!provinceSearch && (
            <TouchableOpacity style={styles.showMoreButton} onPress={() => setShowAllProvinces(!showAllProvinces)}>
              <Text style={[styles.showMoreText, { color: colors.primary }]}>{showAllProvinces ? 'แสดงน้อยลง' : 'ดูทั้งหมด 77 จังหวัด'}</Text>
              <Ionicons name={showAllProvinces ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        {/* District (conditional) */}
        {filters.province && getDistrictsForProvince(filters.province).length > 0 && (
          <View style={[styles.filterCard, { marginBottom: 14 }]}>
            <SectionHeader icon="location-outline" label={filters.province === 'กรุงเทพมหานคร' ? 'เขต' : 'อำเภอ'} iconColor="#10B981" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label={filters.province === 'กรุงเทพมหานคร' ? 'ทุกเขต' : 'ทุกอำเภอ'}
                  selected={!filters.district}
                  onPress={() => setFilters({ ...filters, district: '' })} style={styles.optionChip} />
                {getDistrictsForProvince(filters.province).map((district) => (
                  <Chip key={district} label={district}
                    selected={filters.district === district}
                    onPress={() => setFilters({ ...filters, district })}
                    style={styles.optionChip} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Salary Range */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="cash-outline" label="ค่าตอบแทน (บาท)" iconColor="#F59E0B" />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>ขั้นต่ำ</Text>
              <TextInput
                style={[styles.provinceSearchInput, { marginBottom: 0, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                placeholder="เช่น 500"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={minRateText}
                onChangeText={(t) => {
                  setMinRateText(t);
                  setFilters({ ...filters, minRate: t ? parseInt(t) || undefined : undefined });
                }}
              />
            </View>
            <Text style={{ color: colors.textMuted, marginTop: 16 }}>—</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>สูงสุด</Text>
              <TextInput
                style={[styles.provinceSearchInput, { marginBottom: 0, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                placeholder="เช่น 3000"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={maxRateText}
                onChangeText={(t) => {
                  setMaxRateText(t);
                  setFilters({ ...filters, maxRate: t ? parseInt(t) || undefined : undefined });
                }}
              />
            </View>
          </View>
          {/* Quick rate chips */}
          <View style={[styles.filterOptions, { marginTop: 10 }]}>
            {[300, 500, 700, 1000, 1500, 2000].map((rate) => (
              <TouchableOpacity
                key={rate}
                onPress={() => {
                  setMinRateText(rate.toString());
                  setFilters({ ...filters, minRate: rate, maxRate: undefined });
                  setMaxRateText('');
                }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: filters.minRate === rate && !filters.maxRate ? colors.warning : colors.warningLight,
                  borderWidth: 1, borderColor: colors.warning,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: filters.minRate === rate && !filters.maxRate ? colors.white : colors.warning }}>
                  {rate.toLocaleString()}+
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Special + Sort */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="options-outline" label="ตัวเลือกพิเศษ" iconColor="#EF4444" />
          <View style={styles.filterOptions}>
            <Chip label="🔥 ด่วนเท่านั้น" selected={filters.urgentOnly || false}
              onPress={() => setFilters({ ...filters, urgentOnly: !filters.urgentOnly })} style={styles.optionChip} />
            <Chip label="✓ ยืนยันตัวตน" selected={filters.verifiedOnly || false}
              onPress={() => setFilters({ ...filters, verifiedOnly: !filters.verifiedOnly })} style={styles.optionChip} />
          </View>
        </View>

        <View style={[styles.filterCard, { marginBottom: 24 }]}>
          <SectionHeader icon="swap-vertical-outline" label="เรียงตาม" iconColor="#64748B" />
          <View style={styles.filterOptions}>
            <Chip label="ล่าสุด" selected={filters.sortBy === 'latest' || !filters.sortBy}
              onPress={() => setFilters({ ...filters, sortBy: 'latest' })} style={styles.optionChip} />
            <Chip label="ค่าตอบแทนสูงสุด" selected={filters.sortBy === 'highestPay'}
              onPress={() => setFilters({ ...filters, sortBy: 'highestPay' })} style={styles.optionChip} />
            <Chip label="เช้า" selected={filters.sortBy === 'morning'}
              onPress={() => setFilters({ ...filters, sortBy: 'morning' })} style={styles.optionChip} />
            <Chip label="กลางคืน" selected={filters.sortBy === 'night'}
              onPress={() => setFilters({ ...filters, sortBy: 'night' })} style={styles.optionChip} />
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={[styles.filterActions, {
        paddingBottom: Math.max(insets.bottom, 16) + SPACING.md,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        shadowColor: isDark ? '#000000' : '#000000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
      }]}>
        <Button onPress={() => { onClear(); setMinRateText(''); setMaxRateText(''); }}
          variant="outline"
          style={{ flex: 1, marginRight: SPACING.xs, borderRadius: 14, height: 50 }}>
          ล้างตัวกรอง
        </Button>
        <Button
          onPress={() => onSaveCurrent(filters, nearbyPreset)}
          variant="outline"
          style={{ flex: 1, marginHorizontal: SPACING.xs, borderRadius: 14, height: 50 }}>
          บันทึกชุดนี้
        </Button>
        <Button
          onPress={() => { onApply(nearbyPreset, filters); }}
          style={{ flex: 1.4, marginLeft: SPACING.xs, borderRadius: 14, height: 50 }}>
          ค้นหา
        </Button>
      </View>
    </ModalContainer>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  profileButton: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 22,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: '#0F172A',
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#0EA5E9',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // List
  listContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  stickyAnnouncementWrap: {
    gap: 10,
    marginBottom: 12,
  },
  stickyAnnouncementCard: {
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  stickyAnnouncementBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  stickyAnnouncementBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  stickyAnnouncementTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  stickyAnnouncementBody: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  listHeader: {
    marginBottom: SPACING.sm,
  },

  // Quick Filters
  quickFilters: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  savedPresetRow: {
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  savedPresetSection: {
    marginTop: 14,
  },
  savedPresetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  savedPresetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savedPresetHeaderTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  savedPresetHeaderHint: {
    fontSize: FONT_SIZES.xs,
  },
  savedPresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 14,
    paddingVertical: 9,
    marginRight: 8,
    maxWidth: 240,
  },
  savedPresetIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  savedPresetText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },

  // Results
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  resultsText: {
    fontSize: FONT_SIZES.sm,
    color: '#64748B',
  },
  resultsCount: {
    fontWeight: '700',
    color: '#0EA5E9',
  },
  clearFilters: {
    fontSize: FONT_SIZES.sm,
    color: '#0EA5E9',
    fontWeight: '500',
  },

  // Filter Modal
  filterContent: {
    flex: 1,
    padding: SPACING.md,
  },
  filterSection: {
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: SPACING.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  optionChip: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  provinceSearchInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: '#0F172A',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  showMoreText: {
    fontSize: FONT_SIZES.sm,
    color: '#0EA5E9',
    marginRight: 4,
  },
  filterActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  // ── Onboarding Banner ─────────────────────────────────────────────
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FAFAFF',
    borderRadius: 16,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  onboardingBannerStripe: {
    width: 5,
    backgroundColor: '#7C3AED',
  },
  onboardingBannerContent: {
    flex: 1,
    padding: SPACING.md,
    paddingLeft: 12,
    gap: 10,
  },
  onboardingBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  onboardingBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  onboardingBannerTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  onboardingBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  onboardingBannerSub: {
    fontSize: 11,
    color: '#6D28D9',
    marginTop: 2,
    lineHeight: 15,
  },
  onboardingBannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onboardingDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  onboardingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DDD6FE',
  },
  onboardingDotActive: {
    width: 16,
    backgroundColor: '#7C3AED',
  },
  onboardingBannerCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  onboardingBannerCTAText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── Nearby Job Alert Banner ───────────────────────────────────────
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  nearbyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  nearbyBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#0C4A6E',
  },
  nearbyBannerSub: {
    fontSize: 11,
    color: '#0369A1',
    marginTop: 2,
  },
  nearbyHelperCard: {
    marginTop: 12,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nearbyHelperCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BAE6FD',
  },
  nearbyHelperIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyHelperTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  nearbyHelperText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#64748B',
  },
  nearbyHelperCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 8,
  },
  nearbyHelperCTAText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  nearbySortLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
  nearbyBannerCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    gap: 2,
  },
  nearbyBannerCTAText: {
    fontSize: 12,
    color: '#0EA5E9',
    fontWeight: '700',
  },

  // ── Nearby Promo Modal ─────────────────────────────────────────────
  promoWrap: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  promoIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  promoTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  promoDesc: {
    fontSize: FONT_SIZES.sm,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  promoFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'stretch',
    marginBottom: SPACING.sm,
  },
  promoFeatureDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoFeatureText: {
    fontSize: FONT_SIZES.sm,
    color: '#334155',
    flex: 1,
  },
  promoCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0EA5E9',
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
  },
  promoCTAText: {
    color: '#FFF',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  promoDismiss: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  promoDismissText: {
    fontSize: FONT_SIZES.sm,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },

  // ── Category Tabs ─────────────────────────────────────────────────
  categoryTabs: {
    flexDirection: 'row' as const,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.md,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: '#0EA5E9',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  categoryTabActive: {
    backgroundColor: '#FFFFFF',
  },
  categoryTabLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  categoryTabLabelActive: {
    color: '#0284C7',
    fontWeight: '700' as const,
  },
});

