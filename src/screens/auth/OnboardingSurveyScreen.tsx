// ============================================
// ONBOARDING SURVEY SCREEN
// 3 steps: 1) staffType/need  2) province  3) availability
// ทุก step กดข้ามได้ — data บันทึกลง Firestore > users/{uid}
// ============================================

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { STAFF_TYPES } from '../../constants/jobOptions';
import { POPULAR_PROVINCES, ALL_PROVINCES } from '../../constants/locations';
import { RootStackParamList } from '../../types';

const { width: W } = Dimensions.get('window');

// ============================================
// Types
// ============================================
type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingSurvey'>;
type Route = RouteProp<RootStackParamList, 'OnboardingSurvey'>;

interface Props {
  navigation: Nav;
  route: Route;
}

// ============================================
// Component
// ============================================
export default function OnboardingSurveyScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();
  const role = user?.role || 'user';

  // Survey state
  const [step, setStep] = useState(0);
  const [selectedStaffTypes, setSelectedStaffTypes] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [selectedShifts, setSelectedShifts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;

  const totalSteps = 3;

  // Animate progress bar
  const animateProgress = (toStep: number) => {
    Animated.timing(progressAnim, {
      toValue: (toStep + 1) / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const goNext = () => {
    if (step < totalSteps - 1) {
      const next = step + 1;
      setStep(next);
      animateProgress(next);
    } else {
      finishSurvey();
    }
  };

  const goBack = () => {
    if (step > 0) {
      const prev = step - 1;
      setStep(prev);
      animateProgress(prev);
    }
  };

  const skipAll = () => {
    finishSurvey();
  };

  const finishSurvey = async () => {
    setSaving(true);
    try {
      const updates: any = { onboardingCompleted: true };
      if (selectedStaffTypes.length > 0) {
        if (role === 'nurse') {
          updates.staffType = selectedStaffTypes[0]; // primary
          updates.staffTypes = selectedStaffTypes;
        } else {
          updates.interestedStaffTypes = selectedStaffTypes;
        }
      }
      if (selectedProvince) {
        updates.preferredProvince = selectedProvince;
        if (!user?.location ) {
          updates.location = { province: selectedProvince, district: '' };
        }
      }
      if (selectedShifts.length > 0) {
        updates.availability = {
          isAvailable: true,
          preferredShifts: selectedShifts,
          preferredDays: [],
        };
      }
      await updateUser(updates);
    } catch (e) {
      console.warn('Onboarding save error:', e);
    } finally {
      setSaving(false);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    }
  };

  // Toggle helper
  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  // =============================
  // STEP 1: Staff type / need
  // =============================
  const renderStep1 = () => {
    const isNurse = role === 'nurse';
    const title = isNurse ? 'คุณเป็นบุคลากรประเภทไหน?' : 'คุณกำลังหาบุคลากรประเภทไหน?';
    const subtitle = isNurse
      ? 'เลือกได้มากกว่า 1 ข้อ'
      : 'เลือกประเภทที่คุณสนใจ (เลือกได้หลายข้อ)';

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>

        <View style={styles.chipGrid}>
          {STAFF_TYPES.map((st) => {
            const selected = selectedStaffTypes.includes(st.code);
            return (
              <TouchableOpacity
                key={st.code}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggle(selectedStaffTypes, st.code, setSelectedStaffTypes)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {st.shortName} — {st.nameTH}
                </Text>
                {selected && <Ionicons name="checkmark-circle" size={18} color="#FFF" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // =============================
  // STEP 2: Province
  // =============================
  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>คุณอยู่จังหวัดไหน?</Text>
      <Text style={styles.stepSubtitle}>เราจะแสดงงานใกล้ตัวคุณก่อน</Text>

      {/* Popular */}
      <Text style={styles.sectionLabel}>ยอดนิยม</Text>
      <View style={styles.chipGrid}>
        {POPULAR_PROVINCES.map((prov) => {
          const selected = selectedProvince === prov;
          return (
            <TouchableOpacity
              key={prov}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => setSelectedProvince(selected ? '' : prov)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{prov}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* All provinces (scrollable) */}
      <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>ทั้งหมด</Text>
      <View style={styles.chipGrid}>
        {ALL_PROVINCES.filter(p => !POPULAR_PROVINCES.includes(p as any)).map((prov) => {
          const selected = selectedProvince === prov;
          return (
            <TouchableOpacity
              key={prov}
              style={[styles.chipSmall, selected && styles.chipSelected]}
              onPress={() => setSelectedProvince(selected ? '' : prov)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipSmallText, selected && styles.chipTextSelected]}>{prov}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // =============================
  // STEP 3: Availability
  // =============================
  const SHIFT_OPTIONS = [
    { key: 'morning', label: 'เช้า (08:00–16:00)', icon: 'sunny-outline' as const, color: '#F59E0B' },
    { key: 'afternoon', label: 'บ่าย (16:00–00:00)', icon: 'partly-sunny-outline' as const, color: '#F97316' },
    { key: 'night', label: 'ดึก (00:00–08:00)', icon: 'moon-outline' as const, color: '#6366F1' },
  ];

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {role === 'nurse' ? 'คุณรับงานช่วงไหนได้บ้าง?' : 'คุณต้องการคนดูแลช่วงไหน?'}
      </Text>
      <Text style={styles.stepSubtitle}>เลือกได้หลายข้อ</Text>

      <View style={{ gap: SPACING.md, marginTop: SPACING.md }}>
        {SHIFT_OPTIONS.map((opt) => {
          const selected = selectedShifts.includes(opt.key);
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.shiftCard, selected && { borderColor: opt.color, backgroundColor: opt.color + '12' }]}
              onPress={() => toggle(selectedShifts, opt.key, setSelectedShifts)}
              activeOpacity={0.7}
            >
              <View style={[styles.shiftIcon, { backgroundColor: opt.color + '20' }]}>
                <Ionicons name={opt.icon} size={28} color={opt.color} />
              </View>
              <Text style={[styles.shiftLabel, selected && { color: opt.color, fontWeight: '700' }]}>
                {opt.label}
              </Text>
              <View style={[styles.radio, selected && { borderColor: opt.color }]}>
                {selected && <View style={[styles.radioDot, { backgroundColor: opt.color }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  // =============================
  // Render
  // =============================
  const STEPS = [renderStep1, renderStep2, renderStep3];
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      {/* Steps label */}
      <View style={styles.topRow}>
        <Text style={styles.stepIndicator}>{step + 1} / {totalSteps}</Text>
        <TouchableOpacity onPress={skipAll}>
          <Text style={styles.skipAllText}>ข้ามทั้งหมด →</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {STEPS[step]()}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.backText}>ย้อนกลับ</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />

        <TouchableOpacity onPress={goNext} style={styles.skipStepBtn}>
          <Text style={styles.skipStepText}>ข้าม</Text>
        </TouchableOpacity>

        <Button
          title={step === totalSteps - 1 ? 'เสร็จสิ้น' : 'ถัดไป'}
          onPress={goNext}
          loading={saving}
          style={styles.nextBtn}
        />
      </View>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Progress
  progressTrack: { height: 4, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.sm },
  stepIndicator: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  skipAllText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  scrollContent: { padding: SPACING.lg, paddingBottom: 120 },

  // Step container
  stepContainer: {},
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  stepSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center',
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  chipTextSelected: { color: '#FFF', fontWeight: '700' },
  chipSmall: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipSmallText: { fontSize: 12, color: COLORS.text },

  // Shift cards
  shiftCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: SPACING.md, borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card,
  },
  shiftIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  shiftLabel: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 6 },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 14, color: COLORS.text },
  skipStepBtn: { marginRight: SPACING.sm },
  skipStepText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  nextBtn: { minWidth: 100 },
});
