// ============================================
// ONBOARDING SURVEY SCREEN â€” v2
// Step 1: staffType  Step 2: province (searchable)  Step 3: role-aware Q
// ============================================

import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { STAFF_TYPES } from '../../constants/jobOptions';
import { POPULAR_PROVINCES, ALL_PROVINCES } from '../../constants/locations';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingSurvey'>;
type Route = RouteProp<RootStackParamList, 'OnboardingSurvey'>;
interface Props { navigation: Nav; route: Route; }

// â”€â”€ Step-3 options per role â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NURSE_WORK_STYLES = [
  { key: 'fulltime',  label: 'à¸›à¸£à¸°à¸ˆà¸³ / à¹€à¸•à¹‡à¸¡à¹€à¸§à¸¥à¸²',        icon: 'briefcase-outline'   as const, color: '#2563EB' },
  { key: 'parttime',  label: 'à¸žà¸²à¸£à¹Œà¸—à¹„à¸—à¸¡à¹Œ / à¸Šà¸±à¹ˆà¸§à¸„à¸£à¸²à¸§',   icon: 'time-outline'        as const, color: '#7C3AED' },
  { key: 'weekend',   label: 'à¹€à¸‰à¸žà¸²à¸°à¸§à¸±à¸™à¸«à¸¢à¸¸à¸”/à¹€à¸ªà¸²à¸£à¹Œ-à¸­à¸²à¸—à¸´à¸•à¸¢à¹Œ', icon: 'calendar-outline' as const, color: '#059669' },
  { key: 'flexible',  label: 'à¸¢à¸·à¸”à¸«à¸¢à¸¸à¹ˆà¸™ à¸—à¸³à¹„à¸”à¹‰à¸—à¸¸à¸à¹à¸šà¸š',  icon: 'options-outline'    as const, color: '#0EA5E9' },
];

const USER_CARE_TYPES = [
  { key: 'elderly',    label: 'à¸œà¸¹à¹‰à¸ªà¸¹à¸‡à¸­à¸²à¸¢à¸¸à¸—à¸±à¹ˆà¸§à¹„à¸›',          icon: 'people-outline'        as const, color: '#F59E0B' },
  { key: 'bedridden',  label: 'à¸œà¸¹à¹‰à¸›à¹ˆà¸§à¸¢à¸•à¸´à¸”à¹€à¸•à¸µà¸¢à¸‡',           icon: 'bed-outline'           as const, color: '#EF4444' },
  { key: 'postsurg',   label: 'à¸œà¸¹à¹‰à¸›à¹ˆà¸§à¸¢à¸«à¸¥à¸±à¸‡à¸œà¹ˆà¸²à¸•à¸±à¸”',         icon: 'medkit-outline'        as const, color: '#8B5CF6' },
  { key: 'child',      label: 'à¹€à¸”à¹‡à¸ / à¸œà¸¹à¹‰à¸žà¸´à¸à¸²à¸£',           icon: 'happy-outline'         as const, color: '#10B981' },
  { key: 'terminal',   label: 'à¸œà¸¹à¹‰à¸›à¹ˆà¸§à¸¢à¸£à¸°à¸¢à¸°à¸ªà¸¸à¸”à¸—à¹‰à¸²à¸¢',        icon: 'heart-outline'         as const, color: '#EC4899' },
  { key: 'other',      label: 'à¸­à¸·à¹ˆà¸™à¹†',                     icon: 'ellipsis-horizontal-outline' as const, color: '#6B7280' },
];

const HOSPITAL_URGENCY = [
  { key: 'now',    label: 'à¸”à¹ˆà¸§à¸™à¸¡à¸²à¸ à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸—à¸±à¸™à¸—à¸µ',    icon: 'flash-outline'    as const, color: '#EF4444' },
  { key: 'week',   label: 'à¸ à¸²à¸¢à¹ƒà¸™ 1 à¸ªà¸±à¸›à¸”à¸²à¸«à¹Œ',          icon: 'calendar-outline' as const, color: '#F59E0B' },
  { key: 'month',  label: 'à¸ à¸²à¸¢à¹ƒà¸™ 1 à¹€à¸”à¸·à¸­à¸™',             icon: 'hourglass-outline' as const, color: '#2563EB' },
  { key: 'plan',   label: 'à¸§à¸²à¸‡à¹à¸œà¸™à¸¥à¹ˆà¸§à¸‡à¸«à¸™à¹‰à¸²',           icon: 'clipboard-outline' as const, color: '#059669' },
];

// ============================================
// Component
// ============================================
export default function OnboardingSurveyScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();
  const role = user?.role || 'user';

  const [step, setStep]                         = useState(0);
  const [selectedStaffTypes, setSelectedStaffTypes] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState<string>('');
  const [provinceQuery, setProvinceQuery]       = useState('');
  const [selectedStep3, setSelectedStep3]       = useState<string[]>([]);
  const [saving, setSaving]                     = useState(false);
  const progressAnim                            = useRef(new Animated.Value(0)).current;

  const totalSteps = 3;

  const animateProgress = (toStep: number) => {
    Animated.timing(progressAnim, {
      toValue: (toStep + 1) / totalSteps,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const goNext = () => {
    if (step < totalSteps - 1) { const n = step + 1; setStep(n); animateProgress(n); }
    else { finishSurvey(); }
  };

  const goBack = () => {
    if (step > 0) { const p = step - 1; setStep(p); animateProgress(p); }
  };

  const finishSurvey = async () => {
    setSaving(true);
    try {
      const updates: any = { onboardingCompleted: true };
      if (selectedStaffTypes.length > 0) {
        if (role === 'nurse') { updates.staffType = selectedStaffTypes[0]; updates.staffTypes = selectedStaffTypes; }
        else { updates.interestedStaffTypes = selectedStaffTypes; }
      }
      if (selectedProvince) {
        updates.preferredProvince = selectedProvince;
        updates.location = { province: selectedProvince, district: user?.location?.district || '' };
      }
      if (selectedStep3.length > 0) {
        if (role === 'nurse')    updates.workStyle = selectedStep3;
        else if (role === 'user') updates.careTypes = selectedStep3;
        else if (role === 'hospital') updates.hiringUrgency = selectedStep3[0];
      }
      await updateUser(updates);
    } catch (e) { console.warn('Onboarding save error:', e); }
    finally { setSaving(false); navigation.reset({ index: 0, routes: [{ name: 'Main' }] }); }
  };

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void, single = false) => {
    if (single) { setter(arr.includes(val) ? [] : [val]); return; }
    setter(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  };

  // â”€â”€ Filtered provinces for search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const filteredProvinces = useMemo(() => {
    const q = provinceQuery.trim();
    if (!q) return ALL_PROVINCES as unknown as string[];
    return (ALL_PROVINCES as unknown as string[]).filter(p => p.includes(q));
  }, [provinceQuery]);

  // =============================
  // STEP 1: Staff type
  // =============================
  const renderStep1 = () => {
    const isNurse = role === 'nurse';
    const title    = isNurse ? 'à¸„à¸¸à¸“à¹€à¸›à¹‡à¸™à¸šà¸¸à¸„à¸¥à¸²à¸à¸£à¸›à¸£à¸°à¹€à¸ à¸—à¹„à¸«à¸™?' : role === 'hospital' ? 'à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸£à¸±à¸šà¸šà¸¸à¸„à¸¥à¸²à¸à¸£à¸›à¸£à¸°à¹€à¸ à¸—à¹ƒà¸”?' : 'à¸„à¸¸à¸“à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸šà¸¸à¸„à¸¥à¸²à¸à¸£à¸›à¸£à¸°à¹€à¸ à¸—à¹ƒà¸”?';
    const subtitle = 'à¹€à¸¥à¸·à¸­à¸à¹„à¸”à¹‰à¸¡à¸²à¸à¸à¸§à¹ˆà¸² 1 à¸‚à¹‰à¸­';
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
        <View style={styles.chipGrid}>
          {STAFF_TYPES.map((st) => {
            const selected = selectedStaffTypes.includes(st.code);
            return (
              <TouchableOpacity key={st.code}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggle(selectedStaffTypes, st.code, setSelectedStaffTypes)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {st.shortName} â€” {st.nameTH}
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
  // STEP 2: Province â€” searchable list
  // =============================
  const renderStep2 = () => (
    <View style={[styles.stepContainer, { flex: 1 }]}>
      <Text style={styles.stepTitle}>à¸„à¸¸à¸“à¸­à¸¢à¸¹à¹ˆà¸ˆà¸±à¸‡à¸«à¸§à¸±à¸”à¹„à¸«à¸™?</Text>
      <Text style={styles.stepSubtitle}>à¸ˆà¸°à¹à¸ªà¸”à¸‡à¹ƒà¸™à¹‚à¸›à¸£à¹„à¸Ÿà¸¥à¹Œà¹à¸¥à¸°à¸Šà¹ˆà¸§à¸¢à¹à¸™à¸°à¸™à¸³à¸‡à¸²à¸™à¹ƒà¸à¸¥à¹‰à¸•à¸±à¸§</Text>

      {/* Selected tag */}
      {selectedProvince ? (
        <TouchableOpacity style={styles.selectedTag} onPress={() => setSelectedProvince('')}>
          <Ionicons name="location" size={16} color={COLORS.primary} />
          <Text style={styles.selectedTagText}>{selectedProvince}</Text>
          <Ionicons name="close-circle" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      ) : null}

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="à¸žà¸´à¸¡à¸žà¹Œà¸Šà¸·à¹ˆà¸­à¸ˆà¸±à¸‡à¸«à¸§à¸±à¸”..."
          placeholderTextColor={COLORS.textMuted}
          value={provinceQuery}
          onChangeText={setProvinceQuery}
          autoCorrect={false}
        />
        {provinceQuery.length > 0 && (
          <TouchableOpacity onPress={() => setProvinceQuery('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Popular â€” shown only when no search query */}
      {!provinceQuery && (
        <>
          <Text style={styles.sectionLabel}>à¸¢à¸­à¸”à¸™à¸´à¸¢à¸¡</Text>
          <View style={styles.chipGrid}>
            {(POPULAR_PROVINCES as unknown as string[]).map((prov) => {
              const selected = selectedProvince === prov;
              return (
                <TouchableOpacity key={prov}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setSelectedProvince(selected ? '' : prov)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{prov}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[styles.sectionLabel, { marginTop: SPACING.md }]}>à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”</Text>
        </>
      )}

      {/* Full list */}
      <FlatList
        data={provinceQuery ? filteredProvinces : (ALL_PROVINCES as unknown as string[]).filter(p => !(POPULAR_PROVINCES as unknown as string[]).includes(p))}
        keyExtractor={(item) => item}
        scrollEnabled={false}
        renderItem={({ item: prov }) => {
          const selected = selectedProvince === prov;
          return (
            <TouchableOpacity
              style={[styles.listRow, selected && styles.listRowSelected]}
              onPress={() => setSelectedProvince(selected ? '' : prov)}
              activeOpacity={0.7}
            >
              <Text style={[styles.listRowText, selected && styles.listRowTextSelected]}>{prov}</Text>
              {selected && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );

  // =============================
  // STEP 3: Role-aware question
  // =============================
  const renderStep3 = () => {
    let title = '';
    let subtitle = '';
    let options: { key: string; label: string; icon: any; color: string }[] = [];
    let single = false;

    if (role === 'nurse') {
      title    = 'à¸£à¸¹à¸›à¹à¸šà¸šà¸‡à¸²à¸™à¸—à¸µà¹ˆà¸„à¸¸à¸“à¸•à¹‰à¸­à¸‡à¸à¸²à¸£?';
      subtitle = 'à¹€à¸¥à¸·à¸­à¸à¹„à¸”à¹‰à¸«à¸¥à¸²à¸¢à¸‚à¹‰à¸­ â€” à¹€à¸£à¸²à¸ˆà¸°à¹à¸™à¸°à¸™à¸³à¸‡à¸²à¸™à¸—à¸µà¹ˆà¹€à¸«à¸¡à¸²à¸°à¸à¸±à¸šà¸„à¸¸à¸“';
      options  = NURSE_WORK_STYLES;
    } else if (role === 'hospital') {
      title    = 'à¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸šà¸¸à¸„à¸¥à¸²à¸à¸£à¸”à¹ˆà¸§à¸™à¹à¸„à¹ˆà¹„à¸«à¸™?';
      subtitle = 'à¸Šà¹ˆà¸§à¸¢à¹ƒà¸«à¹‰à¹€à¸£à¸²à¸ˆà¸±à¸”à¸¥à¸³à¸”à¸±à¸šà¸à¸²à¸£à¹à¸ªà¸”à¸‡à¸œà¸¥à¸‚à¸­à¸‡à¸›à¸£à¸°à¸à¸²à¸¨à¸„à¸¸à¸“';
      options  = HOSPITAL_URGENCY;
      single   = true;
    } else {
      title    = 'à¸œà¸¹à¹‰à¸—à¸µà¹ˆà¸•à¹‰à¸­à¸‡à¸à¸²à¸£à¸à¸²à¸£à¸”à¸¹à¹à¸¥à¹€à¸›à¹‡à¸™à¹ƒà¸„à¸£?';
      subtitle = 'à¹€à¸¥à¸·à¸­à¸à¹„à¸”à¹‰à¸«à¸¥à¸²à¸¢à¸‚à¹‰à¸­ â€” à¹€à¸£à¸²à¸ˆà¸°à¹à¸ªà¸”à¸‡à¸œà¸¹à¹‰à¸”à¸¹à¹à¸¥à¸—à¸µà¹ˆà¸•à¸£à¸‡à¸à¸±à¸šà¸„à¸§à¸²à¸¡à¸•à¹‰à¸­à¸‡à¸à¸²à¸£';
      options  = USER_CARE_TYPES;
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
        <View style={{ gap: SPACING.sm, marginTop: SPACING.sm }}>
          {options.map((opt) => {
            const selected = selectedStep3.includes(opt.key);
            return (
              <TouchableOpacity key={opt.key}
                style={[styles.optionCard, selected && { borderColor: opt.color, backgroundColor: opt.color + '10' }]}
                onPress={() => toggle(selectedStep3, opt.key, setSelectedStep3, single)}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIcon, { backgroundColor: opt.color + '20' }]}>
                  <Ionicons name={opt.icon} size={24} color={opt.color} />
                </View>
                <Text style={[styles.optionLabel, selected && { color: opt.color, fontWeight: '700' }]}>
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
  };

  const STEPS = [renderStep1, renderStep2, renderStep3];
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.topRow}>
        <Text style={styles.stepIndicator}>{step + 1} / {totalSteps}</Text>
        <TouchableOpacity onPress={finishSurvey}>
          <Text style={styles.skipAllText}>à¸‚à¹‰à¸²à¸¡à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸” â†’</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {STEPS[step]()}
      </ScrollView>

      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity onPress={goBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
            <Text style={styles.backText}>à¸¢à¹‰à¸­à¸™à¸à¸¥à¸±à¸š</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={goNext} style={styles.skipStepBtn}>
          <Text style={styles.skipStepText}>à¸‚à¹‰à¸²à¸¡</Text>
        </TouchableOpacity>
        <Button
          title={step === totalSteps - 1 ? 'à¹€à¸ªà¸£à¹‡à¸ˆà¸ªà¸´à¹‰à¸™' : 'à¸–à¸±à¸”à¹„à¸›'}
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
  container:      { flex: 1, backgroundColor: COLORS.background },
  progressTrack:  { height: 4, backgroundColor: COLORS.border, marginHorizontal: SPACING.lg, marginTop: SPACING.sm, borderRadius: 2, overflow: 'hidden' },
  progressFill:   { height: '100%', backgroundColor: COLORS.primary, borderRadius: 2 },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, marginTop: SPACING.sm },
  stepIndicator:  { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  skipAllText:    { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
  scrollContent:  { padding: SPACING.lg, paddingBottom: 120 },
  stepContainer:  {},
  stepTitle:      { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  stepSubtitle:   { fontSize: 14, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 20 },
  sectionLabel:   { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.xs, textTransform: 'uppercase', letterSpacing: 0.6 },

  // Chips (step 1)
  chipGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  chip:         { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface, flexDirection: 'row', alignItems: 'center' },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:     { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  chipTextSelected: { color: '#FFF', fontWeight: '700' },

  // Province selected tag
  selectedTag:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primaryLight || '#EFF6FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start', marginBottom: SPACING.sm, borderWidth: 1.5, borderColor: COLORS.primary },
  selectedTagText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },

  // Search box (step 2)
  searchBox:   { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: BORDER_RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.md, paddingVertical: 10, marginBottom: SPACING.md },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },

  // Province list rows
  listRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 4 },
  listRowSelected: { },
  listRowText:     { fontSize: 15, color: COLORS.text },
  listRowTextSelected: { fontWeight: '700', color: COLORS.primary },
  separator:       { height: 1, backgroundColor: COLORS.border },

  // Step 3 option cards
  optionCard:   { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  optionIcon:   { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  optionLabel:  { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  radio:        { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioDot:     { width: 11, height: 11, borderRadius: 6 },

  // Bottom bar
  bottomBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  backBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:     { fontSize: 14, color: COLORS.text },
  skipStepBtn:  { marginRight: SPACING.sm },
  skipStepText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  nextBtn:      { minWidth: 100 },
});

