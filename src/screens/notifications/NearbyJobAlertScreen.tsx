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
  TextInput,
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
import { getStaffTypeOptions } from '../../constants/jobOptions';
import { useI18n } from '../../i18n';

// ─── Constants ────────────────────────────────
const RADIUS_OPTIONS = [1, 3, 5, 10, 20, 50];

// ─── Main Component ───────────────────────────
export default function NearbyJobAlertScreen() {
  const navigation = useNavigation() as any;
  const { user, updateUser } = useAuth();
  const { hasPermission, registerForNotifications } = useNotifications();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const staffTypeOptions = getStaffTypeOptions();

  const permissionTone = hasPermission
    ? {
        background: colors.successLight,
        text: colors.success,
      }
    : {
        background: colors.warningLight,
        text: colors.warning,
      };

  const [enabled, setEnabled] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [locationLabel, setLocationLabel] = useState<string | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [preferredProvince, setPreferredProvince] = useState('');
  const [preferredStaffTypes, setPreferredStaffTypes] = useState<string[]>([]);
  const [minRateText, setMinRateText] = useState('');
  const [maxRateText, setMaxRateText] = useState('');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const selectedSignalCount = Number(Boolean(preferredProvince)) + preferredStaffTypes.length + Number(Boolean(minRateText || maxRateText));

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
        setPreferredProvince(contextAlert.province || '');
        setPreferredStaffTypes(Array.isArray(contextAlert.staffTypes) ? contextAlert.staffTypes : []);
        setMinRateText(contextAlert.minRate ? String(contextAlert.minRate) : '');
        setMaxRateText(contextAlert.maxRate ? String(contextAlert.maxRate) : '');
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
          setPreferredProvince(alert.province || '');
          setPreferredStaffTypes(Array.isArray(alert.staffTypes) ? alert.staffTypes : []);
          setMinRateText(alert.minRate ? String(alert.minRate) : '');
          setMaxRateText(alert.maxRate ? String(alert.maxRate) : '');
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
          t('nearbyAlerts.alerts.permissionDeniedTitle'),
          t('nearbyAlerts.alerts.permissionDeniedMessage'),
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
      Alert.alert(t('nearbyAlerts.alerts.locationErrorTitle'), t('nearbyAlerts.alerts.locationErrorMessage'));
    } finally {
      setIsLoadingLocation(false);
    }
  }, [reverseGeocode]);

  // ─── Save ──────────────────────────────────
  const handleSave = async () => {
    if (!user?.uid) return;

    if (enabled && (!lat || !lng)) {
      Alert.alert(
        t('nearbyAlerts.alerts.locationRequiredTitle'),
        t('nearbyAlerts.alerts.locationRequiredMessage'),
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
      const minRate = minRateText ? Number(minRateText) || undefined : undefined;
      const maxRate = maxRateText ? Number(maxRateText) || undefined : undefined;

      if (minRate && maxRate && minRate > maxRate) {
        Alert.alert(t('nearbyAlerts.alerts.invalidRangeTitle'), t('nearbyAlerts.alerts.invalidRangeMessage'));
        setIsSaving(false);
        return;
      }

      // updateUser เขียน Firestore + sync AuthContext + AsyncStorage ทันที
      await updateUser({
        nearbyJobAlert: {
          enabled,
          radiusKm,
          lat: lat ?? 0,
          lng: lng ?? 0,
          geohash4,
          province: preferredProvince || undefined,
          staffTypes: preferredStaffTypes,
          minRate,
          maxRate,
          updatedAt: new Date(),
        },
      });

      Alert.alert(
        t('nearbyAlerts.alerts.saveSuccessTitle'),
        enabled
          ? t('nearbyAlerts.alerts.saveEnabledMessage', { radius: radiusKm })
          : t('nearbyAlerts.alerts.saveDisabledMessage'),
        [{ text: t('common.actions.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (_) {
      Alert.alert(t('nearbyAlerts.alerts.saveFailedTitle'), t('common.alerts.genericTryAgain'));
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('nearbyAlerts.headerTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.quickIntro, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={styles.quickIntroHeader}>
              <View>
                <Text style={[styles.quickEyebrow, { color: colors.primary }]}>Smart Alerts</Text>
                <Text style={[styles.quickTitle, { color: colors.text }]}>{t('nearbyAlerts.quickTitle')}</Text>
              </View>
              <View style={[styles.quickIntroBadge, { backgroundColor: isDark ? colors.card : colors.primaryBackground }]}> 
                <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
                <Text style={[styles.quickIntroBadgeText, { color: colors.primary }]}>{t('nearbyAlerts.smartBadge')}</Text>
              </View>
            </View>
            <Text style={[styles.quickSubtitle, { color: colors.textSecondary }]}> 
              {t('nearbyAlerts.quickSubtitle')}
            </Text>
            <View style={styles.signalSummaryRow}>
              <View style={[styles.signalSummaryPill, { backgroundColor: isDark ? colors.card : colors.background }]}> 
                <Text style={[styles.signalSummaryValue, { color: colors.text }]}>{radiusKm}</Text>
                <Text style={[styles.signalSummaryLabel, { color: colors.textSecondary }]}>{t('nearbyAlerts.signals.distance')}</Text>
              </View>
              <View style={[styles.signalSummaryPill, { backgroundColor: isDark ? colors.card : colors.background }]}> 
                <Text style={[styles.signalSummaryValue, { color: colors.text }]}>{preferredStaffTypes.length || 0}</Text>
                <Text style={[styles.signalSummaryLabel, { color: colors.textSecondary }]}>{t('nearbyAlerts.signals.staffTypes')}</Text>
              </View>
              <View style={[styles.signalSummaryPill, { backgroundColor: isDark ? colors.card : colors.background }]}> 
                <Text style={[styles.signalSummaryValue, { color: colors.text }]}>{selectedSignalCount}</Text>
                <Text style={[styles.signalSummaryLabel, { color: colors.textSecondary }]}>{t('nearbyAlerts.signals.filters')}</Text>
              </View>
            </View>
            <View style={[styles.permissionPill, { backgroundColor: permissionTone.background }]}> 
              <Ionicons
                name={hasPermission ? 'notifications' : 'notifications-off'}
                size={16}
                color={permissionTone.text}
              />
              <Text style={[styles.permissionPillText, { color: permissionTone.text }]}> 
                {hasPermission ? t('nearbyAlerts.permissionReady') : t('nearbyAlerts.permissionOnSave')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}> 
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('nearbyAlerts.toggleTitle')}</Text>
                <Text style={[styles.cardHint, { color: colors.textSecondary }]}> 
                  {t('nearbyAlerts.toggleSubtitle')}
                </Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.border, true: colors.primaryBackground }}
                thumbColor={enabled ? colors.primary : colors.textMuted}
              />
            </View>
          </View>

          {enabled && (
            <>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('nearbyAlerts.locationTitle')}</Text>
                <Text style={[styles.cardHint, { color: colors.textSecondary }]}> 
                  {t('nearbyAlerts.locationSubtitle')}
                </Text>
                <TouchableOpacity
                  style={[styles.locationButton, { backgroundColor: isDark ? colors.card : colors.primaryBackground }]}
                  onPress={getLocation}
                  disabled={isLoadingLocation}
                  activeOpacity={0.8}
                >
                  {isLoadingLocation ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name={lat ? 'location' : 'location-outline'} size={20} color={colors.primary} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.locationPrimary, { color: lat ? colors.text : colors.textMuted }]}> 
                      {isLoadingLocation
                        ? t('nearbyAlerts.findingLocation')
                        : locationLabel ?? t('nearbyAlerts.useCurrentLocation')}
                    </Text>
                    <Text style={[styles.locationSecondary, { color: colors.textSecondary }]}> 
                      {lat !== null && lng !== null
                        ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                        : t('nearbyAlerts.noLocationSelected')}
                    </Text>
                  </View>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('nearbyAlerts.radiusTitle')}</Text>
                <Text style={[styles.cardHint, { color: colors.textSecondary }]}> 
                  {t('nearbyAlerts.radiusSubtitle', { radius: radiusKm })}
                </Text>
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
                          {r} {t('nearbyAlerts.signals.distance')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t('nearbyAlerts.filtersTitle')}</Text>
                <Text style={[styles.cardHint, { color: colors.textSecondary }]}>{t('nearbyAlerts.filtersSubtitle')}</Text>

                <Text style={[styles.fieldLabel, { color: colors.text }]}>{t('nearbyAlerts.provinceLabel')}</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.card : colors.background }]}
                  placeholder={t('nearbyAlerts.provincePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={preferredProvince}
                  onChangeText={setPreferredProvince}
                />
                <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{t('nearbyAlerts.provinceHint')}</Text>

                <Text style={[styles.fieldLabel, { color: colors.text }]}>{t('nearbyAlerts.staffTypeLabel')}</Text>
                <View style={styles.staffTypeWrap}>
                  {staffTypeOptions.map((item) => {
                    const selected = preferredStaffTypes.includes(item.code);
                    return (
                      <TouchableOpacity
                        key={item.code}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: selected ? colors.primary : (isDark ? colors.card : colors.background),
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setPreferredStaffTypes((prev) => selected ? prev.filter((code) => code !== item.code) : [...prev, item.code])}
                      >
                        <Text style={[styles.filterChipText, { color: selected ? colors.white : colors.textSecondary }]}>{item.shortDisplayName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.fieldLabel, { color: colors.text }]}>{t('nearbyAlerts.compensationLabel')}</Text>
                <View style={styles.rateRow}>
                  <TextInput
                    style={[styles.input, styles.rateInput, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.card : colors.background }]}
                    placeholder={t('nearbyAlerts.minPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={minRateText}
                    onChangeText={setMinRateText}
                  />
                  <Text style={[styles.rateSeparator, { color: colors.textMuted }]}>-</Text>
                  <TextInput
                    style={[styles.input, styles.rateInput, { borderColor: colors.border, color: colors.text, backgroundColor: isDark ? colors.card : colors.background }]}
                    placeholder={t('nearbyAlerts.maxPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    value={maxRateText}
                    onChangeText={setMaxRateText}
                  />
                </View>
                <Text style={[styles.fieldHint, { color: colors.textMuted }]}>{t('nearbyAlerts.compensationHint')}</Text>
              </View>
            </>
          )}
        </View>

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
              <Text style={styles.saveBtnText}>{t('nearbyAlerts.saveButton')}</Text>
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
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
  },

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

  quickIntro: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  quickIntroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickEyebrow: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
    letterSpacing: 0.4,
  },
  quickTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  quickSubtitle: { fontSize: FONT_SIZES.sm, lineHeight: 20 },
  quickIntroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  quickIntroBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  signalSummaryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  signalSummaryPill: {
    flex: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  signalSummaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  signalSummaryLabel: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  permissionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  permissionPillText: { fontSize: FONT_SIZES.xs, fontWeight: '600' },

  card: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  cardHint: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: 8,
  },
  fieldHint: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
  },
  staffTypeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rateInput: {
    flex: 1,
  },
  rateSeparator: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  toggleCopy: {
    flex: 1,
  },

  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  locationPrimary: { fontSize: FONT_SIZES.sm, fontWeight: '600' },
  locationSecondary: { fontSize: FONT_SIZES.xs, marginTop: 2 },

  radiusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  radiusChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  radiusChipText: { fontSize: FONT_SIZES.sm, fontWeight: '600' },

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
