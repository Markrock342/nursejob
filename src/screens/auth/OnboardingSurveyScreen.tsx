// ============================================
// OnboardingSurvey v2 — 3 steps, role-aware
// Province: searchable FlatList
// Step 3: nurse/hospital/user specific
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

// Step-3 options per role
const NURSE_WORK_STYLES = [
  { key: 'fulltime',  label: 'ประจำ / เต็มเวลา',              icon: 'briefcase-outline'            as const, color: '#2563EB' },
  { key: 'parttime',  label: 'พาร์ทไทม์ / ชั่วคราว',          icon: 'time-outline'                 as const, color: '#7C3AED' },
  { key: 'weekend',   label: 'เฉพาะวันหยุด / เสาร์-อาทิตย์',  icon: 'calendar-outline'             as const, color: '#059669' },
  { key: 'flexible',  label: 'ยืดหยุ่น / รับทุกรูปแบบ',       icon: 'options-outline'              as const, color: '#D97706' },
];

const USER_CARE_TYPES = [
  { key: 'elderly',   label: 'ดูแลผู้สูงอายุ — ทั่วไป',        icon: 'people-outline'               as const, color: '#0EA5E9' },
  { key: 'bedridden', label: 'ดูแลผู้ป่วยติดเตียง',             icon: 'bed-outline'                  as const, color: '#EF4444' },
  { key: 'postsurg',  label: 'ดูแลหลังผ่าตัด / พักฟื้น',       icon: 'medkit-outline'               as const, color: '#8B5CF6' },
  { key: 'child',     label: 'เลี้ยงดูเด็ก / ดูแลเด็กป่วย',    icon: 'happy-outline'                as const, color: '#F59E0B' },
  { key: 'terminal',  label: 'ดูแลผู้ป่วยระยะสุดท้าย',         icon: 'heart-outline'                as const, color: '#EC4899' },
  { key: 'other',     label: 'อื่นๆ',                           icon: 'ellipsis-horizontal-outline'  as const, color: '#6B7280' },
];

const HOSPITAL_URGENCY = [
  { key: 'now',   label: 'ต้องการเดี๋ยวนี้ — เร่งด่วน',   icon: 'flash-outline'      as const, color: '#EF4444' },
  { key: 'week',  label: 'ภายใน 1 สัปดาห์',              icon: 'calendar-outline'   as const, color: '#F59E0B' },
  { key: 'month', label: 'ภายใน 1 เดือน',                icon: 'hourglass-outline'  as const, color: '#0EA5E9' },
  { key: 'plan',  label: 'วางแผนล่วงหน้า',               icon: 'clipboard-outline'  as const, color: '#10B981' },
];

const STEPS = [
  { title: 'คุณเป็นบุคลากรประเภทไหน?', subtitle: 'เลือกได้หลายประเภท เราจะแนะนำงานให้ตรงมากขึ้น' },
  { title: 'คุณอยู่จังหวัดไหน?',       subtitle: 'จะแสดงในโปรไฟล์และใช้ค้นหางานใกล้บ้าน' },
  { title: '',                           subtitle: '' },
];

export default function OnboardingSurveyScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();
  const role = (user as any)?.role ?? 'nurse';

  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [provinceQuery, setProvinceQuery] = useState('');
  const [selectedStep3, setSelectedStep3] = useState<string[]>([]);

  const filteredProvinces = useMemo(() => {
    if (!provinceQuery.trim()) return [];
    const q = provinceQuery.trim().toLowerCase();
    return ALL_PROVINCES.filter(p => p.toLowerCase().includes(q));
  }, [provinceQuery]);

  const step3Config = useMemo(() => {
    if (role === 'nurse')    return { title: 'รูปแบบการทำงานที่คุณต้องการ?',     subtitle: 'เลือกได้หลายรูปแบบ — ช่วยให้เราแนะนำงานที่เหมาะสม',            options: NURSE_WORK_STYLES,  single: false };
    if (role === 'hospital') return { title: 'ความเร่งด่วนในการหาบุคลากร?',      subtitle: 'ช่วยให้พยาบาลที่พร้อมทำงานตอบรับได้เร็วขึ้น',                  options: HOSPITAL_URGENCY,   single: true  };
    return                          { title: 'คุณต้องการดูแลแบบไหน?',            subtitle: 'เลือกได้หลายประเภท — เราจะหาผู้ดูแลที่เหมาะกับคุณ',            options: USER_CARE_TYPES,    single: false };
  }, [role]);

  const goToStep = (s: number) => {
    setStep(s);
    Animated.timing(progress, { toValue: s / (STEPS.length - 1), duration: 300, useNativeDriver: false }).start();
  };

  const toggleType   = (key: string) => setSelectedTypes(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const toggleStep3  = (key: string) => {
    if (step3Config.single) { setSelectedStep3([key]); return; }
    setSelectedStep3(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const finishSurvey = async () => {
    const updates: Record<string, any> = {
      onboardingCompleted: true,
      staffTypes: selectedTypes,
      staffType: selectedTypes[0] ?? null,
      location: { province: selectedProvince, district: '' },
    };
    if (role === 'nurse')    updates.workStyle     = selectedStep3;
    if (role === 'user')     updates.careTypes     = selectedStep3;
    if (role === 'hospital') updates.hiringUrgency = selectedStep3[0] ?? null;
    try { await updateUser(updates); } catch { /* silent */ }
    navigation.reset({ index: 0, routes: [{ name: 'Main' as any }] });
  };

  const skipAll = () => {
    updateUser({ onboardingCompleted: true }).catch(() => {});
    navigation.reset({ index: 0, routes: [{ name: 'Main' as any }] });
  };

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['33%', '100%'] });

  const renderStep = () => {
    if (step === 0) {
      return (
        <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
          {STAFF_TYPES.map(t => {
            const active = selectedTypes.includes(t.code);
            return (
              <TouchableOpacity key={t.code} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleType(t.code)} activeOpacity={0.8}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t.nameTH} ({t.shortName})</Text>
                {active && <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      );
    }

    if (step === 1) {
      return (
        <View style={{ flex: 1 }}>
          {selectedProvince ? (
            <View style={styles.selectedTag}>
              <Ionicons name="location" size={14} color="#7C3AED" />
              <Text style={styles.selectedTagText}>{selectedProvince}</Text>
              <TouchableOpacity onPress={() => setSelectedProvince('')}>
                <Ionicons name="close-circle" size={16} color="#7C3AED" />
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={COLORS.textLight} style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="ค้นหาจังหวัด..."
              placeholderTextColor={COLORS.textLight}
              value={provinceQuery}
              onChangeText={setProvinceQuery}
              autoCorrect={false}
            />
            {provinceQuery.length > 0 && (
              <TouchableOpacity onPress={() => setProvinceQuery('')}>
                <Ionicons name="close-circle" size={16} color={COLORS.textLight} />
              </TouchableOpacity>
            )}
          </View>
          {provinceQuery.length === 0 && (
            <View>
              <Text style={styles.sectionLabel}>จังหวัดยอดนิยม</Text>
              <View style={styles.chipRow}>
                {POPULAR_PROVINCES.map(p => (
                  <TouchableOpacity key={p} style={[styles.chip, selectedProvince === p && styles.chipActive]} onPress={() => setSelectedProvince(p)} activeOpacity={0.8}>
                    <Text style={[styles.chipText, selectedProvince === p && styles.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionLabel}>ทั้งหมด</Text>
            </View>
          )}
          <FlatList
            data={provinceQuery.length > 0 ? filteredProvinces : ALL_PROVINCES}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={[styles.listRow, selectedProvince === item && styles.listRowActive]} onPress={() => { setSelectedProvince(item); setProvinceQuery(''); }}>
                <Ionicons name={selectedProvince === item ? 'radio-button-on' : 'radio-button-off'} size={18} color={selectedProvince === item ? COLORS.primary : COLORS.textLight} />
                <Text style={[styles.listRowText, selectedProvince === item && styles.listRowTextActive]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
        {step3Config.options.map(opt => {
          const active = selectedStep3.includes(opt.key);
          return (
            <TouchableOpacity key={opt.key} style={[styles.optionCard, active && { borderColor: opt.color, backgroundColor: opt.color + '10' }]} onPress={() => toggleStep3(opt.key)} activeOpacity={0.8}>
              <View style={[styles.optionIcon, { backgroundColor: opt.color + '20' }]}>
                <Ionicons name={opt.icon} size={22} color={opt.color} />
              </View>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <View style={[styles.radio, active && { borderColor: opt.color }]}>
                {active && <View style={[styles.radioDot, { backgroundColor: opt.color }]} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const stepTitle    = step === 2 ? step3Config.title    : STEPS[step].title;
  const stepSubtitle = step === 2 ? step3Config.subtitle : STEPS[step].subtitle;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.stepCounter}>{step + 1} / {STEPS.length}</Text>
        <TouchableOpacity onPress={skipAll}><Text style={styles.skipAll}>ข้ามทั้งหมด</Text></TouchableOpacity>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressBar, { width: barWidth }]} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{stepTitle}</Text>
        <Text style={styles.subtitle}>{stepSubtitle}</Text>
      </View>
      <View style={{ flex: 1, paddingHorizontal: SPACING.md }}>
        {renderStep()}
      </View>
      <View style={styles.bottomBar}>
        {step > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => goToStep(step - 1)}>
            <Ionicons name="chevron-back" size={18} color={COLORS.text} />
            <Text style={styles.backText}>ย้อนกลับ</Text>
          </TouchableOpacity>
        ) : <View />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <TouchableOpacity style={styles.skipStepBtn} onPress={() => step < 2 ? goToStep(step + 1) : skipAll()}>
            <Text style={styles.skipStepText}>ข้ามขั้นตอนนี้</Text>
          </TouchableOpacity>
          <Button style={styles.nextBtn} onPress={step < 2 ? () => goToStep(step + 1) : finishSurvey}>
            {step < 2 ? 'ถัดไป' : 'เสร็จสิ้น'}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: COLORS.background },
  topBar:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  stepCounter:       { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '600' },
  skipAll:           { fontSize: FONT_SIZES.sm, color: COLORS.textLight },
  progressTrack:     { height: 4, backgroundColor: COLORS.border, marginHorizontal: SPACING.md, borderRadius: 2, marginTop: SPACING.sm },
  progressBar:       { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
  titleBlock:        { paddingHorizontal: SPACING.md, paddingTop: SPACING.lg, paddingBottom: SPACING.md },
  title:             { fontSize: FONT_SIZES.xl, fontWeight: '700', color: COLORS.text, lineHeight: 30 },
  subtitle:          { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginTop: 6, lineHeight: 20 },
  stepBody:          { paddingVertical: SPACING.sm, gap: 10 },
  chipRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  chip:              { paddingHorizontal: SPACING.md, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card, flexDirection: 'row', alignItems: 'center' },
  chipActive:        { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText:          { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  chipTextActive:    { color: '#FFF' },
  selectedTag:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#EDE9FE', borderRadius: 20, alignSelf: 'flex-start', marginBottom: 8 },
  selectedTagText:   { fontSize: 13, color: '#7C3AED', fontWeight: '600' },
  searchBox:         { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: BORDER_RADIUS.md, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: SPACING.sm, paddingVertical: 8, marginBottom: SPACING.sm },
  searchInput:       { flex: 1, fontSize: 14, color: COLORS.text },
  sectionLabel:      { fontSize: 11, fontWeight: '600', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  listRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border + '60' },
  listRowActive:     { backgroundColor: COLORS.primaryBackground },
  listRowText:       { fontSize: 14, color: COLORS.text },
  listRowTextActive: { color: COLORS.primary, fontWeight: '600' },
  optionCard:        { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, borderRadius: BORDER_RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.card },
  optionIcon:        { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md },
  optionLabel:       { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  radio:             { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioDot:          { width: 11, height: 11, borderRadius: 6 },
  bottomBar:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.background },
  backBtn:           { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:          { fontSize: 14, color: COLORS.text },
  skipStepBtn:       { marginRight: SPACING.sm },
  skipStepText:      { fontSize: 14, color: COLORS.textSecondary, fontWeight: '500' },
  nextBtn:           { minWidth: 100 },
});