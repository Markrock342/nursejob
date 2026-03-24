// ============================================
// CHOOSE ROLE SCREEN — "คุณเป็นใคร?"
// 3 roles: nurse / hospital / user (คนทั่วไป)
// Sub-type selection embedded in card after role pick
// ============================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { AuthStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { completeUserOnboarding } from '../../services/authService';
import { trackEvent } from '../../services/analyticsService';
import { useI18n } from '../../i18n';

// ============================================
// Role definitions
// ============================================
type RoleKey = 'nurse' | 'hospital' | 'user';
type OrgType = 'public_hospital' | 'private_hospital' | 'clinic' | 'agency';

interface RoleOption {
  key: RoleKey;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  title: string;
  subtitle: string;
  bullets: string[];
}

const getRoles = (t: any): RoleOption[] => [
  {
    key: 'nurse',
    icon: 'heart-circle-outline',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    title: t('chooseRole.nurseTitle'),
    subtitle: t('chooseRole.nurseSubtitle'),
    bullets: [
      t('chooseRole.nurseBullet1'),
      t('chooseRole.nurseBullet2'),
      t('chooseRole.nurseBullet3'),
    ],
  },
  {
    key: 'hospital',
    icon: 'business-outline',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    title: t('chooseRole.hospitalTitle'),
    subtitle: t('chooseRole.hospitalSubtitle'),
    bullets: [
      t('chooseRole.hospitalBullet1'),
      t('chooseRole.hospitalBullet2'),
      t('chooseRole.hospitalBullet3'),
    ],
  },
  {
    key: 'user',
    icon: 'people-outline',
    color: '#10B981',
    bg: '#ECFDF5',
    title: t('chooseRole.userTitle'),
    subtitle: t('chooseRole.userSubtitle'),
    bullets: [
      t('chooseRole.userBullet1'),
      t('chooseRole.userBullet2'),
      t('chooseRole.userBullet3'),
    ],
  },
];

// ============================================
// Sub-type options
// ============================================
const getNurseStaffTypes = (t: any) => [
  { code: 'RN',    label: t('chooseRole.staffRN') },
  { code: 'PN',    label: t('chooseRole.staffPN') },
  { code: 'NA',    label: t('chooseRole.staffNA') },
  { code: 'ANES',  label: t('chooseRole.staffANES') },
  { code: 'CG',    label: t('chooseRole.staffCG') },
  { code: 'SITTER',label: t('chooseRole.staffSitter') },
  { code: 'OTHER', label: t('chooseRole.staffOther') },
];

const getOrgTypes = (t: any): { code: OrgType; label: string; icon: keyof typeof Ionicons.glyphMap }[] => [
  { code: 'public_hospital',  label: t('chooseRole.orgPublic'),    icon: 'medkit-outline' },
  { code: 'private_hospital', label: t('chooseRole.orgPrivate'),  icon: 'business-outline' },
  { code: 'clinic',           label: t('chooseRole.orgClinic'),           icon: 'bandage-outline' },
  { code: 'agency',           label: t('chooseRole.orgAgency'), icon: 'briefcase-outline' },
];

// ============================================
// Component
// ============================================
type Nav = NativeStackNavigationProp<AuthStackParamList, 'ChooseRole'>;
type Route = RouteProp<AuthStackParamList, 'ChooseRole'>;

export default function ChooseRoleScreen({
  navigation, route }: { navigation: Nav; route: Route }) {
  const { t } = useI18n();
  const ROLES = useMemo(() => getRoles(t), [t]);
  const NURSE_STAFF_TYPES = useMemo(() => getNurseStaffTypes(t), [t]);
  const ORG_TYPES = useMemo(() => getOrgTypes(t), [t]);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { phone, registrationData, fromGoogle } = route.params;
  const { user, refreshUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [selectedStaffType, setSelectedStaffType] = useState<string | null>(null);
  const [selectedOrgType, setSelectedOrgType] = useState<OrgType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    trackEvent({
      eventName: 'onboarding_started',
      screenName: 'ChooseRole',
      props: {
        entryPoint: fromGoogle ? 'google_sign_in' : 'phone_registration',
      },
    });
  }, [fromGoogle]);

  const handleContinue = async () => {
    await trackEvent({
      eventName: 'onboarding_step_completed',
      screenName: 'ChooseRole',
      props: {
        step: 'role_selection',
        role: selectedRole || 'user',
        staffType: selectedRole === 'nurse' ? selectedStaffType || null : null,
        orgType: selectedRole === 'hospital' ? selectedOrgType || null : null,
        entryPoint: fromGoogle ? 'google_sign_in' : 'phone_registration',
      },
    });

    if (fromGoogle) {
      // Google users: save role directly to Firestore and close the Auth modal
      setIsSaving(true);
      try {
        if (!user?.uid) {
          throw new Error(t('chooseRole.userNotFound'));
        }
        await completeUserOnboarding(user.uid, {
          role: selectedRole || 'user',
          staffType: selectedRole === 'nurse' ? (selectedStaffType || undefined) : undefined,
          orgType: selectedRole === 'hospital' ? (selectedOrgType || undefined) : undefined,
        });
        await refreshUser();
        // Close the Auth modal (navigate up two levels: ChooseRole → AuthNavigator → RootStack)
        navigation.getParent()?.goBack();
      } catch {
        Alert.alert(t('chooseRole.errorTitle'), t('chooseRole.errorSave'));
      } finally {
        setIsSaving(false);
      }
      return;
    }
    // OTP/phone flow: proceed to CompleteRegistration as normal
    navigation.navigate('CompleteRegistration', {
      phone: phone || '',
      phoneVerified: true,
      role: selectedRole || 'user',
      staffType: selectedRole === 'nurse' ? (selectedStaffType || undefined) : undefined,
      orgType: selectedRole === 'hospital' ? (selectedOrgType || undefined) : undefined,
      registrationData,
    });
  };

  const handleSkip = () => {
    trackEvent({
      eventName: 'onboarding_step_completed',
      screenName: 'ChooseRole',
      props: {
        step: 'role_selection_skipped',
        role: 'user',
        entryPoint: fromGoogle ? 'google_sign_in' : 'phone_registration',
      },
    });

    if (fromGoogle) {
      if (!user?.uid) {
        Alert.alert(t('chooseRole.errorTitle'), t('chooseRole.userNotFound'));
        return;
      }
      setIsSaving(true);
      completeUserOnboarding(user.uid, { role: 'user' })
        .then(() => refreshUser())
        .then(() => {
          navigation.getParent()?.goBack();
        })
        .catch(() => {
          Alert.alert(t('chooseRole.errorTitle'), t('chooseRole.errorSave'));
        })
        .finally(() => {
          setIsSaving(false);
        });
      return;
    }
    navigation.navigate('CompleteRegistration', {
      phone: phone || '',
      phoneVerified: true,
      role: 'user',
      registrationData,
    });
  };

  // Clear sub-selection when role changes
  const handleSelectRole = (role: RoleKey) => {
    trackEvent({
      eventName: 'role_selected',
      screenName: 'ChooseRole',
      props: {
        role,
        entryPoint: fromGoogle ? 'google_sign_in' : 'phone_registration',
      },
    });

    setSelectedRole(role);
    setSelectedStaffType(null);
    setSelectedOrgType(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>{t('chooseRole.stepLabel')}</Text>
          <Text style={styles.title}>{t('chooseRole.title')}</Text>
          <Text style={styles.subtitle}>{t('chooseRole.subtitle')}</Text>
        </View>

        {/* Role Cards */}
        <View style={styles.cards}>
          {ROLES.map((role) => {
            const selected = selectedRole === role.key;
            return (
              <TouchableOpacity
                key={role.key}
                activeOpacity={0.7}
                style={[
                  styles.card,
                  { borderColor: selected ? role.color : COLORS.border },
                  selected && { backgroundColor: role.bg, borderWidth: 2.5 },
                ]}
                onPress={() => handleSelectRole(role.key)}
              >
                <View style={styles.cardRow}>
                  {/* Icon */}
                  <View style={[styles.iconCircle, { backgroundColor: selected ? role.color : role.bg }]}>
                    <Ionicons name={role.icon} size={28} color={selected ? '#FFF' : role.color} />
                  </View>

                  {/* Text */}
                  <View style={styles.cardText}>
                    <Text style={[styles.cardTitle, selected && { color: role.color }]}>{role.title}</Text>
                    <Text style={styles.cardSub}>{role.subtitle}</Text>
                  </View>

                  {/* Radio */}
                  <View style={[styles.radio, selected && { borderColor: role.color }]}>
                    {selected && <View style={[styles.radioDot, { backgroundColor: role.color }]} />}
                  </View>
                </View>

                {/* Bullets (show when selected) */}
                {selected && (
                  <View style={styles.bullets}>
                    {role.bullets.map((b, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Ionicons name="checkmark-circle" size={16} color={role.color} />
                        <Text style={styles.bulletText}>{b}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Sub-type picker: Nurse → staffType */}
                {selected && role.key === 'nurse' && (
                  <View style={styles.subSection}>
                    <Text style={[styles.subLabel, { color: role.color }]}>{t('chooseRole.staffTypeQuestion')} <Text style={styles.subOptional}>{t('chooseRole.optional')}</Text></Text>
                    <View style={styles.subChipGrid}>
                      {NURSE_STAFF_TYPES.map((st) => {
                        const active = selectedStaffType === st.code;
                        return (
                          <TouchableOpacity
                            key={st.code}
                            style={[styles.subChip, active && { backgroundColor: role.color, borderColor: role.color }]}
                            onPress={() => setSelectedStaffType(active ? null : st.code)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.subChipText, active && { color: '#FFF', fontWeight: '700' }]}>{st.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Sub-type picker: Hospital → orgType */}
                {selected && role.key === 'hospital' && (
                  <View style={styles.subSection}>
                    <Text style={[styles.subLabel, { color: role.color }]}>{t('chooseRole.orgTypeQuestion')} <Text style={styles.subOptional}>{t('chooseRole.optional')}</Text></Text>
                    <View style={styles.subOrgGrid}>
                      {ORG_TYPES.map((org) => {
                        const active = selectedOrgType === org.code;
                        return (
                          <TouchableOpacity
                            key={org.code}
                            style={[styles.subOrgCard, active && { backgroundColor: role.color + '18', borderColor: role.color, borderWidth: 2 }]}
                            onPress={() => setSelectedOrgType(active ? null : org.code)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name={org.icon} size={22} color={active ? role.color : COLORS.textSecondary} />
                            <Text style={[styles.subOrgLabel, active && { color: role.color, fontWeight: '700' }]}>{org.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Continue */}
        <Button
          title={isSaving ? t('chooseRole.saving') : t('chooseRole.continue')}
          onPress={handleContinue}
          disabled={selectedRole === null || isSaving}
          loading={isSaving}
          style={styles.continueBtn}
        />
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>{t('chooseRole.skip')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 60 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  header: { marginBottom: SPACING.lg },
  step: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, lineHeight: 22 },

  cards: { gap: SPACING.md, marginBottom: SPACING.lg },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  cardSub: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  radio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },

  bullets: { marginTop: SPACING.sm, paddingLeft: 64 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  bulletText: { fontSize: 13, color: COLORS.textSecondary },

  // Sub-type section
  subSection: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  subLabel: { fontSize: 13, fontWeight: '700', marginBottom: SPACING.sm },
  subOptional: { fontWeight: '400', color: COLORS.textSecondary },
  subChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  subChipText: { fontSize: 13, color: COLORS.text },
  subOrgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subOrgCard: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  subOrgLabel: { fontSize: 13, color: COLORS.text },

  continueBtn: { marginTop: SPACING.sm },
  skipBtn: { alignItems: 'center', marginTop: SPACING.md },
  skipText: { color: COLORS.primary, fontSize: FONT_SIZES.md, fontWeight: '500' },
});
