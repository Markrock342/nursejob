// ============================================
// CHOOSE ROLE SCREEN — "คุณเป็นใคร?"
// 3 roles: nurse / hospital / user (คนทั่วไป)
// Sub-type selection embedded in card after role pick
// ============================================

import React, { useState } from 'react';
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
import { AuthStackParamList } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { completeUserOnboarding } from '../../services/authService';

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

const ROLES: RoleOption[] = [
  {
    key: 'nurse',
    icon: 'heart-circle-outline',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    title: 'พยาบาล / บุคลากรทางการแพทย์',
    subtitle: 'กำลังมองหางานเวร, งานพาร์ทไทม์',
    bullets: [
      'รับงานเวร / งานพาร์ทไทม์',
      'แจ้งเตือนงานใกล้ตัวอัตโนมัติ',
      'แสดงใบประกอบวิชาชีพได้',
    ],
  },
  {
    key: 'hospital',
    icon: 'business-outline',
    color: '#8B5CF6',
    bg: '#F5F3FF',
    title: 'โรงพยาบาล / คลินิก / เอเจนซี่',
    subtitle: 'ต้องการโพสต์หาบุคลากร',
    bullets: [
      'โพสต์งานหาพยาบาล / CG',
      'จัดการผู้สมัครได้',
      'ดูสถิติ + ประวัติผู้สมัคร',
    ],
  },
  {
    key: 'user',
    icon: 'people-outline',
    color: '#10B981',
    bg: '#ECFDF5',
    title: 'คนทั่วไป / ญาติผู้ป่วย',
    subtitle: 'กำลังหาคนดูแลผู้ป่วยที่บ้าน',
    bullets: [
      'หาผู้ดูแลผู้ป่วย / เฝ้าไข้',
      'ดูรีวิว + ตรวจสอบตัวตนได้',
      'แชทกับผู้ดูแลได้โดยตรง',
    ],
  },
];

// ============================================
// Sub-type options
// ============================================
const NURSE_STAFF_TYPES = [
  { code: 'RN',    label: 'RN — พยาบาลวิชาชีพ' },
  { code: 'PN',    label: 'PN — พยาบาลเทคนิค' },
  { code: 'NA',    label: 'NA — ผู้ช่วยพยาบาล' },
  { code: 'ANES',  label: 'ANES — วิสัญญีพยาบาล' },
  { code: 'CG',    label: 'CG — ผู้ดูแลผู้ป่วย' },
  { code: 'SITTER',label: 'เฝ้าไข้' },
  { code: 'OTHER', label: 'อื่นๆ' },
];

const ORG_TYPES: { code: OrgType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { code: 'public_hospital',  label: 'โรงพยาบาลรัฐ',    icon: 'medkit-outline' },
  { code: 'private_hospital', label: 'โรงพยาบาลเอกชน',  icon: 'business-outline' },
  { code: 'clinic',           label: 'คลินิก',           icon: 'bandage-outline' },
  { code: 'agency',           label: 'เอเจนซี่จัดหางาน', icon: 'briefcase-outline' },
];

// ============================================
// Component
// ============================================
type Nav = NativeStackNavigationProp<AuthStackParamList, 'ChooseRole'>;
type Route = RouteProp<AuthStackParamList, 'ChooseRole'>;

export default function ChooseRoleScreen({ navigation, route }: { navigation: Nav; route: Route }) {
  const { phone, registrationData, fromGoogle } = route.params;
  const { user, refreshUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleKey | null>(null);
  const [selectedStaffType, setSelectedStaffType] = useState<string | null>(null);
  const [selectedOrgType, setSelectedOrgType] = useState<OrgType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleContinue = async () => {
    if (fromGoogle) {
      // Google users: save role directly to Firestore and close the Auth modal
      setIsSaving(true);
      try {
        if (!user?.uid) {
          throw new Error('ไม่พบผู้ใช้ที่เข้าสู่ระบบ');
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
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกได้ กรุณาลองใหม่');
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
      ...registrationData,
    });
  };

  const handleSkip = () => {
    if (fromGoogle) {
      if (!user?.uid) {
        Alert.alert('เกิดข้อผิดพลาด', 'ไม่พบผู้ใช้ที่เข้าสู่ระบบ');
        return;
      }
      setIsSaving(true);
      completeUserOnboarding(user.uid, { role: 'user' })
        .then(() => refreshUser())
        .then(() => {
          navigation.getParent()?.goBack();
        })
        .catch(() => {
          Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกได้ กรุณาลองใหม่');
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
    });
  };

  // Clear sub-selection when role changes
  const handleSelectRole = (role: RoleKey) => {
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
          <Text style={styles.step}>ขั้นตอนที่ 2 / 3</Text>
          <Text style={styles.title}>คุณเป็นใคร?</Text>
          <Text style={styles.subtitle}>เลือกบทบาทเพื่อประสบการณ์ที่เหมาะกับคุณ</Text>
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
                    <Text style={[styles.subLabel, { color: role.color }]}>คุณเป็นบุคลากรประเภทไหน? <Text style={styles.subOptional}>(ไม่บังคับ)</Text></Text>
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
                    <Text style={[styles.subLabel, { color: role.color }]}>ประเภทองค์กรของคุณ? <Text style={styles.subOptional}>(ไม่บังคับ)</Text></Text>
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
          title={isSaving ? 'กำลังบันทึก...' : 'ดำเนินการต่อ'}
          onPress={handleContinue}
          disabled={selectedRole === null || isSaving}
          loading={isSaving}
          style={styles.continueBtn}
        />
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>ข้ามไปก่อน</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
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
