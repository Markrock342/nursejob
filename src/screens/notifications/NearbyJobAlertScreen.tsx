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
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTheme } from '../../context/ThemeContext';
import { encodeGeohash } from '../../utils/geohash';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../theme';

// ─── Constants ────────────────────────────────
const RADIUS_OPTIONS = [1, 3, 5, 10, 20, 50];

// ─── Main Component ───────────────────────────
export default function NearbyJobAlertScreen() {
  const navigation = useNavigation() as any;
  const { user, updateUser } = useAuth();
  const { hasPermission, registerForNotifications } = useNotifications();
  const { colors, isDark } = useTheme();

  const heroTone = {
    background: colors.primaryBackground,
    icon: colors.primary,
  };
  const pushStatusTone = hasPermission
    ? {
        background: colors.successLight,
        border: colors.success,
        icon: colors.success,
        title: colors.success,
        text: colors.success,
      }
    : {
        background: colors.warningLight,
        border: colors.warning,
        icon: colors.warning,
        title: colors.warning,
        text: colors.warning,
      };
  const locationTone = {
    background: isDark ? colors.card : colors.primaryBackground,
    refreshBackground: colors.primaryBackground,
    hintBackground: colors.warningLight,
    hintText: colors.warning,
  };
  const infoTone = {
    background: colors.infoLight,
    border: colors.info,
    text: colors.info,
  };

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
      // อ่านจาก user context ก่อน (เร็วกว่า และเป็นข้อมูลล่าสุดที่ save ไว้)
      const contextAlert = user.nearbyJobAlert;
      if (contextAlert) {
        setEnabled(Boolean(contextAlert.enabled));
        setRadiusKm(contextAlert.radiusKm ?? 5);
        if (contextAlert.lat && contextAlert.lng) {
          setLat(contextAlert.lat);
          setLng(contextAlert.lng);
          reverseGeocode(contextAlert.lat, contextAlert.lng);
        }
        setIsLoading(false);
        return; // ไม่ต้อง fetch Firestore แล้ว
      }

      // Fallback: อ่านจาก Firestore ถ้า context ยังไม่มีข้อมูล
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
      if (enabled) {
        // Make sure push permission/token flow is triggered when user enables nearby alerts.
        await registerForNotifications();
      }

      const geohash4 = lat && lng ? encodeGeohash(lat, lng, 4) : '';
      // updateUser เขียน Firestore + sync AuthContext + AsyncStorage ทันที
      await updateUser({
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
        <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />
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
          <View style={[styles.heroIcon, { backgroundColor: heroTone.background }]}>
            <Ionicons name="location" size={38} color={heroTone.icon} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.text }]}>แจ้งเตือนงานใกล้คุณ</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            เมื่อมีคนโพสต์งานเวรในรัศมีที่คุณกำหนด{'\n'}คุณจะได้รับ Push Notification ทันที
          </Text>
        </View>

        {/* Push status */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: pushStatusTone.background,
              borderColor: pushStatusTone.border,
            },
          ]}
        >
          <Ionicons
            name={hasPermission ? 'notifications-circle' : 'notifications-off-circle'}
            size={22}
            color={pushStatusTone.icon}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: pushStatusTone.title }]}>
              {hasPermission ? 'Push Notification พร้อมใช้งาน' : 'ยังไม่เปิดสิทธิ์แจ้งเตือน'}
            </Text>
            <Text style={[styles.statusSub, { color: pushStatusTone.text }]}>
              {hasPermission
                ? 'เมื่อมีงานใหม่ในรัศมีที่ตั้งไว้ ระบบจะส่งแจ้งเตือนทันที'
                : 'กดบันทึกเพื่อขอสิทธิ์แจ้งเตือน และรับงานใหม่ใกล้ตัว'}
            </Text>
          </View>
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
              <View style={[styles.toggleIconWrap, { backgroundColor: colors.primaryBackground }]}>
                <Ionicons name="notifications" size={20} color={colors.primary} />
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
              trackColor={{ false: colors.border, true: colors.primaryBackground }}
              thumbColor={enabled ? colors.primary : colors.textMuted}
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
                style={[styles.locationRow, { backgroundColor: locationTone.background }]}
                onPress={getLocation}
                disabled={isLoadingLocation}
                activeOpacity={0.7}
              >
                {isLoadingLocation ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons
                    name={lat ? 'location' : 'location-outline'}
                    size={22}
                    color={colors.primary}
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
                <View style={[styles.refreshTag, { backgroundColor: locationTone.refreshBackground }]}> 
                  <Ionicons name="refresh" size={14} color={colors.primary} />
                  <Text style={[styles.refreshTagText, { color: colors.primary }]}>อัพเดท</Text>
                </View>
              </TouchableOpacity>

              {!lat && (
                <View style={[styles.locationHint, { backgroundColor: locationTone.hintBackground }]}> 
                  <Ionicons name="information-circle-outline" size={14} color={locationTone.hintText} />
                  <Text style={[styles.locationHintText, { color: locationTone.hintText }]}> 
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

              <View style={styles.radiusHeroRow}>
                <View
                  style={[
                    styles.radiusBigWrap,
                    { backgroundColor: colors.primaryBackground, borderColor: colors.primary },
                  ]}
                >
                  <Text style={[styles.radiusBig, { color: colors.primary }]}>{radiusKm}</Text>
                  <Text style={[styles.radiusUnit, { color: colors.primaryDark }]}>กม.</Text>
                </View>
                <View style={styles.radiusMetaWrap}>
                  <Text style={[styles.radiusMetaTitle, { color: colors.textSecondary }]}>โหมดครอบคลุม</Text>
                  <Text style={[styles.radiusMetaValue, { color: colors.text }]}>
                    {radiusKm <= 3 ? 'แม่นยำสูง' : radiusKm <= 10 ? 'สมดุล' : 'ครอบคลุมกว้าง'}
                  </Text>
                  <Text style={[styles.radiusMetaHint, { color: colors.textSecondary }]}>ปรับระยะได้ตามความต้องการรับงาน</Text>
                </View>
              </View>

              <View style={styles.radiusGrid}>
                {RADIUS_OPTIONS.map((r) => {
                  const isActive = radiusKm === r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.radiusChip,
                        {
                          backgroundColor: isActive ? colors.primary : (isDark ? colors.card : colors.background),
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setRadiusKm(r)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.radiusChipText,
                          { color: isActive ? colors.white : colors.textSecondary },
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
                        backgroundColor: colors.primary,
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
            <View style={[styles.infoBox, { backgroundColor: infoTone.background, borderLeftColor: infoTone.border }]}> 
              <Ionicons name="bulb-outline" size={18} color={infoTone.border} style={{ marginTop: 2 }} />
              <Text style={[styles.infoText, { color: infoTone.text }]}> 
                ระบบจะส่ง Push Notification ทันทีเมื่อมีการโพสต์งานใหม่ภายในรัศมีที่คุณกำหนด
                ตำแหน่งของคุณจะถูกใช้เพื่อคำนวณระยะทางเท่านั้น
              </Text>
            </View>
          </>
        )}

        {/* ── Save button ───────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
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
  statusCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  statusSub: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTitle: { fontSize: FONT_SIZES.md, fontWeight: '600' },
  toggleSub: { fontSize: FONT_SIZES.xs, marginTop: 2 },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  locationText: { fontSize: FONT_SIZES.sm, fontWeight: '500' },
  coordText: { fontSize: 11, marginTop: 2 },
  refreshTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: SPACING.sm,
  },
  refreshTagText: { fontSize: 11, fontWeight: '600' },
  locationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    padding: SPACING.sm,
  },
  locationHintText: { fontSize: FONT_SIZES.xs, flex: 1 },

  radiusHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  radiusBigWrap: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  radiusBig: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
  },
  radiusUnit: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  radiusMetaWrap: {
    flex: 1,
  },
  radiusMetaTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    marginBottom: 2,
  },
  radiusMetaValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  radiusMetaHint: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
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
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderLeftWidth: 3,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
  },

  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
  },
  saveBtnText: { color: '#FFF', fontSize: FONT_SIZES.md, fontWeight: '700' },
});
