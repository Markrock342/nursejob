// ============================================
// NEARBY JOB ALERT SCREEN
// ตั้งค่าแจ้งเตือนงานใกล้ตัว
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { encodeGeohash } from '../../utils/geohash';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme';

// ─── Constants ────────────────────────────────
const RADIUS_OPTIONS = [1, 3, 5, 10, 20, 50];

// ─── Main Component ───────────────────────────
export default function NearbyJobAlertScreen() {
  const navigation = useNavigation() as any;
  const { user } = useAuth();
  const { colors } = useTheme();

  const [enabled, setEnabled] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // ─── Load existing settings ────────────────
  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        const alert = data.nearbyJobAlert;
        if (alert) {
          setEnabled(Boolean(alert.enabled));
          setRadiusKm(alert.radiusKm ?? 5);
          if (alert.lat && alert.lng) {
            setLat(alert.lat);
            setLng(alert.lng);
            reverseGeocode(alert.lat, alert.lng);
          }
        }
      }
    } catch (e) {
      console.error('loadCurrentSettings error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const reverseGeocode = useCallback(async (latitude: number, longitude: number) => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.district, r.city, r.region].filter(Boolean);
        setLocationLabel(parts.join(', '));
      }
    } catch (_) {}
  }, []);

  // ─── Get device location ───────────────────
  const getLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'ไม่ได้รับอนุญาต',
          'กรุณาเปิดการเข้าถึงตำแหน่งในการตั้งค่าของมือถือ',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      setLat(latitude);
      setLng(longitude);
      await reverseGeocode(latitude, longitude);
    } catch (_) {
      Alert.alert('ไม่สามารถหาตำแหน่งได้', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoadingLocation(false);
    }
  }, [reverseGeocode]);

  // ─── Save ──────────────────────────────────
  const handleSave = async () => {
    if (!user?.uid) return;

    if (enabled && (!lat || !lng)) {
      Alert.alert(
        'ต้องการตำแหน่งของคุณ',
        'กรุณากดปุ่ม "หาตำแหน่งปัจจุบัน" ก่อนเปิดการแจ้งเตือน',
      );
      return;
    }

    setIsSaving(true);
    try {
      const geohash4 = lat && lng ? encodeGeohash(lat, lng, 4) : '';
      await updateDoc(doc(db, 'users', user.uid), {
        nearbyJobAlert: {
          enabled,
          radiusKm,
          lat: lat ?? 0,
          lng: lng ?? 0,
          geohash4,
          updatedAt: new Date(),
        },
      });

      Alert.alert(
        'บันทึกแล้ว',
        enabled
          ? `คุณจะได้รับแจ้งเตือนเมื่อมีงานใหม่ในรัศมี ${radiusKm} กม.`
          : 'ปิดการแจ้งเตือนงานใกล้ฉันแล้ว',
        [{ text: 'ตกลง', onPress: () => navigation.goBack() }],
      );
    } catch (_) {
      Alert.alert('เกิดข้อผิดพลาด', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Loading skeleton ──────────────────────
  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['top']}
      >
        <ActivityIndicator style={{ flex: 1 }} size="large" color="#0EA5E9" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* ── Header ────────────────────────── */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>งานใกล้ฉัน</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Hero section ─────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="location" size={38} color="#0EA5E9" />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>แจ้งเตือนงานใกล้คุณ</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            เมื่อมีคนโพสต์งานเวรในรัศมีที่คุณกำหนด{'\n'}คุณจะได้รับ Push Notification ทันที
          </Text>
        </View>

        {/* ── Toggle card ───────────────────── */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <View style={styles.toggleIconWrap}>
                <Ionicons name="notifications" size={20} color="#0EA5E9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  เปิดการแจ้งเตือน
                </Text>
                <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>
                  {enabled ? 'แจ้งเตือนเมื่อมีงานใหม่ในรัศมีที่กำหนด' : 'ปิดอยู่'}
                </Text>
              </View>
            </View>
            <Switch
              value={enabled}
              onValueChange={setEnabled}
              trackColor={{ false: colors.border, true: '#BAE6FD' }}
              thumbColor={enabled ? '#0EA5E9' : '#CBD5E1'}
            />
          </View>
        </View>

        {/* ── Location & radius (only when enabled) ── */}
        {enabled && (
          <>
            {/* Location card */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>ตำแหน่งของคุณ</Text>
              <TouchableOpacity
                style={styles.locationRow}
                onPress={getLocation}
                disabled={isLoadingLocation}
                activeOpacity={0.7}
              >
                {isLoadingLocation ? (
                  <ActivityIndicator size="small" color="#0EA5E9" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons
                    name={lat ? 'location' : 'location-outline'}
                    size={22}
                    color="#0EA5E9"
                    style={{ marginRight: 8 }}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.locationText,
                      { color: lat ? colors.text : colors.textMuted },
                    ]}
                  >
                    {isLoadingLocation
                      ? 'กำลังหาตำแหน่ง...'
                      : locationLabel ?? 'แตะเพื่อหาตำแหน่งปัจจุบัน'}
                  </Text>
                  {lat !== null && lng !== null && (
                    <Text style={[styles.coordText, { color: colors.textMuted }]}>
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </Text>
                  )}
                </View>
                <View style={styles.refreshTag}>
                  <Ionicons name="refresh" size={14} color="#0EA5E9" />
                  <Text style={styles.refreshTagText}>อัพเดท</Text>
                </View>
              </TouchableOpacity>

              {!lat && (
                <View style={styles.locationHint}>
                  <Ionicons name="information-circle-outline" size={14} color="#F59E0B" />
                  <Text style={styles.locationHintText}>
                    ต้องการตำแหน่งของคุณเพื่อแจ้งเตือนงานใกล้เคียง
                  </Text>
                </View>
              )}
            </View>

            {/* Radius picker card */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                รัศมีการแจ้งเตือน
              </Text>

              <Text style={styles.radiusBig}>{radiusKm} กม.</Text>

              <View style={styles.radiusGrid}>
                {RADIUS_OPTIONS.map((r) => {
                  const isActive = radiusKm === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.radiusChip,
                        {
                          backgroundColor: isActive ? '#0EA5E9' : colors.background,
                          borderColor: isActive ? '#0EA5E9' : colors.border,
                        },
                      ]}
                      onPress={() => setRadiusKm(r)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.radiusChipText,
                          { color: isActive ? '#FFF' : colors.textSecondary },
                        ]}
                      >
                        {r} กม.
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* visual scale bar */}
              <View style={styles.scaleBar}>
                <View style={[styles.scaleTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.scaleFill,
                      {
                        width: `${(RADIUS_OPTIONS.indexOf(radiusKm) + 1) / RADIUS_OPTIONS.length * 100}%`,
                      },
                    ]}
                  />
                </View>
                <View style={styles.scaleLabels}>
                  <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>1 กม.</Text>
                  <Text style={[styles.scaleLabel, { color: colors.textMuted }]}>50 กม.</Text>
                </View>
              </View>

              <Text style={[styles.radiusHint, { color: colors.textMuted }]}>
                งานที่โพสต์ภายในรัศมี {radiusKm} กม. จากตำแหน่งของคุณ
              </Text>
            </View>

            {/* Info box */}
            <View style={styles.infoBox}>
              <Ionicons name="bulb-outline" size={18} color="#0EA5E9" style={{ marginTop: 2 }} />
              <Text style={styles.infoText}>
                ระบบจะส่ง Push Notification ทันทีเมื่อมีการโพสต์งานใหม่ภายในรัศมีที่คุณกำหนด
                ตำแหน่งของคุณจะถูกใช้เพื่อคำนวณระยะทางเท่านั้น
              </Text>
            </View>
          </>
        )}

        {/* ── Save button ───────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.saveBtnText}>บันทึกการตั้งค่า</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700' },

  hero: {
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  card: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
    marginRight: SPACING.sm,
  },
  toggleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: { fontSize: FONT_SIZES.md, fontWeight: '600' },
  toggleSub: { fontSize: FONT_SIZES.xs, marginTop: 2 },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  locationText: { fontSize: FONT_SIZES.sm, fontWeight: '500' },
  coordText: { fontSize: 11, marginTop: 2 },
  refreshTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: SPACING.sm,
  },
  refreshTagText: { fontSize: 11, color: '#0EA5E9', fontWeight: '600' },
  locationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    backgroundColor: '#FFFBEB',
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  locationHintText: { fontSize: FONT_SIZES.xs, color: '#92400E', flex: 1 },

  radiusBig: {
    fontSize: 52,
    fontWeight: '800',
    color: '#0EA5E9',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  radiusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  radiusChip: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  radiusChipText: { fontSize: FONT_SIZES.sm, fontWeight: '600' },

  scaleBar: { marginBottom: SPACING.sm },
  scaleTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  scaleFill: {
    height: 6,
    backgroundColor: '#0EA5E9',
    borderRadius: 3,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: { fontSize: 10 },
  radiusHint: { fontSize: FONT_SIZES.xs, textAlign: 'center', marginTop: 4 },

  infoBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    backgroundColor: '#EFF6FF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: '#0EA5E9',
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: '#1E40AF',
    lineHeight: 18,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0EA5E9',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveBtnText: { color: '#FFF', fontSize: FONT_SIZES.md, fontWeight: '700' },
});
