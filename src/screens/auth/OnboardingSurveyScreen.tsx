// ============================================
// ONBOARDING TIPS - role-aware, skippable, production-style
// ============================================

import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KittenButton as Button } from '../../components/common';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { STAFF_TYPES } from '../../constants/jobOptions';
import { POPULAR_PROVINCES, ALL_PROVINCES } from '../../constants/locations';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingSurvey'>;

interface Props {
  navigation: Nav;
}

type AppRole = 'nurse' | 'hospital' | 'user';

const NURSE_WORK_STYLES = [
  { key: 'fulltime', label: 'ประจำ / เต็มเวลา', icon: 'briefcase-outline' as const, color: '#2563EB' },
  { key: 'parttime', label: 'พาร์ทไทม์ / ชั่วคราว', icon: 'time-outline' as const, color: '#7C3AED' },
  { key: 'weekend', label: 'เฉพาะวันหยุด / เสาร์-อาทิตย์', icon: 'calendar-outline' as const, color: '#059669' },
  { key: 'flexible', label: 'ยืดหยุ่น / รับทุกรูปแบบ', icon: 'options-outline' as const, color: '#D97706' },
];

const USER_CARE_TYPES = [
  { key: 'elderly', label: 'ดูแลผู้สูงอายุทั่วไป', icon: 'people-outline' as const, color: '#0EA5E9' },
  { key: 'bedridden', label: 'ดูแลผู้ป่วยติดเตียง', icon: 'bed-outline' as const, color: '#EF4444' },
  { key: 'postsurg', label: 'ดูแลหลังผ่าตัด / พักฟื้น', icon: 'medkit-outline' as const, color: '#8B5CF6' },
  { key: 'child', label: 'ดูแลเด็ก / เด็กป่วย', icon: 'happy-outline' as const, color: '#F59E0B' },
  { key: 'terminal', label: 'ดูแลผู้ป่วยระยะท้าย', icon: 'heart-outline' as const, color: '#EC4899' },
  { key: 'other', label: 'อื่นๆ', icon: 'ellipsis-horizontal-outline' as const, color: '#6B7280' },
];

const HOSPITAL_URGENCY = [
  { key: 'now', label: 'เร่งด่วนมาก', icon: 'flash-outline' as const, color: '#EF4444' },
  { key: 'week', label: 'ภายใน 1 สัปดาห์', icon: 'calendar-outline' as const, color: '#F59E0B' },
  { key: 'month', label: 'ภายใน 1 เดือน', icon: 'hourglass-outline' as const, color: '#0EA5E9' },
  { key: 'plan', label: 'วางแผนล่วงหน้า', icon: 'clipboard-outline' as const, color: '#10B981' },
];

const STEP_META = [
  {
    title: 'เริ่มใช้งานให้เป็นในไม่กี่นาที',
    subtitle: 'สรุปให้ว่าบทบาทของคุณทำอะไรได้บ้าง และฟีเจอร์สำคัญอยู่ตรงไหน',
  },
  {
    title: 'ฟีเจอร์หลักอยู่ตรงไหน',
    subtitle: 'ดูทางลัดของแอปก่อนเข้าใช้งานจริง จะได้ไม่ต้องกดหาเองทีละหน้า',
  },
  {
    title: 'ปรับแอปให้ตรงกับคุณ',
    subtitle: 'เลือกข้อมูลพื้นฐานที่ช่วยให้ระบบแนะนำงานหรือผู้ดูแลได้แม่นขึ้น',
  },
];

const ROLE_GUIDE: Record<AppRole, {
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  heroTitle: string;
  heroSubtitle: string;
  highlights: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; description: string }>;
  featureTips: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; description: string }>;
  setupTitle: string;
  setupSubtitle: string;
}> = {
  nurse: {
    badge: 'สำหรับพยาบาล',
    icon: 'medical-outline',
    heroTitle: 'หางานแทนเวร แชทไว และจัดการโปรไฟล์ได้ในที่เดียว',
    heroSubtitle: 'NurseGo จะพาคุณไปยังงานที่เหมาะกับความถนัด พื้นที่ และรูปแบบเวลาที่คุณต้องการ',
    highlights: [
      { icon: 'swap-horizontal-outline', title: 'หางานแทนเวร', description: 'ดูงานล่าสุด กรองตามจังหวัด แผนก หรือเปิดโหมดใกล้ฉันได้' },
      { icon: 'chatbubbles-outline', title: 'คุยกับผู้โพสต์ทันที', description: 'เริ่มแชทจากหน้าโพสต์และติดตามงานต่อได้จากแท็บข้อความ' },
      { icon: 'shield-checkmark-outline', title: 'เพิ่มความน่าเชื่อถือ', description: 'ยืนยันตัวตนและเติมโปรไฟล์ให้ครบ เพื่อให้ผู้จ้างตัดสินใจง่ายขึ้น' },
    ],
    featureTips: [
      { icon: 'home-outline', title: 'หน้าแรก', description: 'รวมงานใหม่ ฟิลเตอร์ และโหมดใกล้ฉัน' },
      { icon: 'add-circle-outline', title: 'โพสต์', description: 'สำหรับพยาบาลจะเห็น flow หาคนแทนเวรโดยอัตโนมัติ' },
      { icon: 'chatbubble-ellipses-outline', title: 'ข้อความ', description: 'รวมทุกห้องแชทที่คุยเรื่องงานไว้ที่เดียว' },
      { icon: 'person-outline', title: 'โปรไฟล์', description: 'ดูรีวิว ยืนยันตัวตน และเข้าหน้าประกาศของฉัน' },
    ],
    setupTitle: 'บอกเราว่าคุณรับงานแบบไหน',
    setupSubtitle: 'ข้อมูลนี้ช่วยให้แอปกรองงานได้แม่นขึ้นตั้งแต่ครั้งแรก',
  },
  hospital: {
    badge: 'สำหรับองค์กร',
    icon: 'business-outline',
    heroTitle: 'โพสต์รับสมัคร ดูผู้สมัคร และคุยกับผู้สมัครได้จาก flow เดียว',
    heroSubtitle: 'บทบาทองค์กรจะโฟกัสที่การลงประกาศงานจริง ดูรายชื่อผู้สนใจ และบริหารโพสต์ได้เร็ว',
    highlights: [
      { icon: 'briefcase-outline', title: 'ลงประกาศรับสมัคร', description: 'สร้างประกาศงานพร้อมเงินเดือน สวัสดิการ และข้อมูลติดต่อ' },
      { icon: 'people-outline', title: 'ดูผู้สมัคร / ผู้ติดต่อ', description: 'ติดตามคนที่สนใจจากหน้า Applicants และแยกตามประกาศได้' },
      { icon: 'chatbubbles-outline', title: 'คุยต่อได้ทันที', description: 'เปิดแชทกับผู้สมัครโดยไม่ต้องออกไปใช้แอปอื่น' },
    ],
    featureTips: [
      { icon: 'home-outline', title: 'หน้าแรก', description: 'ดูบอร์ดงานและฟีเจอร์แนะนำ แต่จุดหลักของคุณคือการโพสต์และจัดการผู้สมัคร' },
      { icon: 'add-circle-outline', title: 'โพสต์', description: 'แท็บนี้จะเปิด flow รับสมัครบุคลากรให้ตรงกับ role องค์กร' },
      { icon: 'chatbubble-ellipses-outline', title: 'ข้อความ', description: 'ใช้คุยกับผู้สมัครที่ติดต่อเข้ามา' },
      { icon: 'person-outline', title: 'โปรไฟล์', description: 'เข้าถึงประกาศของฉัน Applicants และข้อมูลองค์กร' },
    ],
    setupTitle: 'ตั้งค่าพื้นฐานขององค์กร',
    setupSubtitle: 'ระบุจังหวัดและระดับความเร่งด่วนเพื่อจัด flow การโพสต์ให้เหมาะกับคุณ',
  },
  user: {
    badge: 'สำหรับผู้ใช้งานทั่วไป',
    icon: 'heart-outline',
    heroTitle: 'ค้นหาผู้ดูแลที่เหมาะสม ดูโปรไฟล์ และติดต่อได้อย่างมั่นใจ',
    heroSubtitle: 'แอปจะช่วยให้คุณหาผู้ดูแลที่ตรงประเภทงานและพื้นที่ พร้อมดูโปรไฟล์และรีวิวประกอบการตัดสินใจ',
    highlights: [
      { icon: 'home-outline', title: 'ดูประกาศที่ตรงความต้องการ', description: 'เลือกงานดูแลผู้ป่วยและใช้ตัวกรองเพื่อหาคนที่เหมาะที่สุด' },
      { icon: 'person-circle-outline', title: 'ดูโปรไฟล์ก่อนตัดสินใจ', description: 'เช็กประสบการณ์ รีวิว และสถานะการยืนยันตัวตนได้ในหน้าโปรไฟล์' },
      { icon: 'call-outline', title: 'ติดต่อได้หลายทาง', description: 'โทร, LINE, หรือแชทในแอปตามช่องทางที่ผู้โพสต์เปิดไว้' },
    ],
    featureTips: [
      { icon: 'home-outline', title: 'หน้าแรก', description: 'ค้นหาโพสต์ดูแลผู้ป่วยและใช้ตัวกรองให้เจองานที่ตรงเร็วขึ้น' },
      { icon: 'add-circle-outline', title: 'โพสต์', description: 'ถ้าต้องการหาผู้ดูแลเอง แท็บนี้จะเปิด flow สำหรับคนทั่วไปโดยตรง' },
      { icon: 'chatbubble-ellipses-outline', title: 'ข้อความ', description: 'ติดตามการพูดคุยกับผู้ดูแลที่คุณสนใจ' },
      { icon: 'person-outline', title: 'โปรไฟล์', description: 'จัดการข้อมูลส่วนตัว รายการโปรด และการตั้งค่าต่าง ๆ' },
    ],
    setupTitle: 'บอกประเภทการดูแลที่คุณสนใจ',
    setupSubtitle: 'ข้อมูลพื้นฐานนี้ช่วยให้แอปแนะนำผู้ดูแลได้ตรงกับความต้องการมากขึ้น',
  },
};

function getRole(userRole?: string): AppRole {
  if (userRole === 'hospital') return 'hospital';
  if (userRole === 'user') return 'user';
  return 'nurse';
}

export default function OnboardingSurveyScreen({ navigation }: Props) {
  const { user, updateUser } = useAuth();
  const { colors, isDark } = useTheme();
  const role = getRole(user?.role);
  const roleGuide = ROLE_GUIDE[role];

  const [step, setStep] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const [selectedTypes, setSelectedTypes] = useState<string[]>(() => {
    if (user?.staffTypes?.length) return user.staffTypes;
    if (user?.staffType) return [user.staffType];
    return [];
  });
  const [selectedProvince, setSelectedProvince] = useState(user?.location?.province || user?.preferredProvince || '');
  const [provinceQuery, setProvinceQuery] = useState('');
  const [selectedStep3, setSelectedStep3] = useState<string[]>(() => {
    if (role === 'nurse') return user?.workStyle || [];
    if (role === 'user') return user?.careTypes || [];
    return user?.hiringUrgency ? [user.hiringUrgency] : [];
  });

  const setupOptions = useMemo(() => {
    if (role === 'nurse') {
      return {
        single: false,
        options: NURSE_WORK_STYLES,
        label: 'รูปแบบงานที่คุณสนใจ',
      };
    }
    if (role === 'hospital') {
      return {
        single: true,
        options: HOSPITAL_URGENCY,
        label: 'ความเร่งด่วนในการหาคน',
      };
    }
    return {
      single: false,
      options: USER_CARE_TYPES,
      label: 'ประเภทการดูแลที่ต้องการ',
    };
  }, [role]);

  const filteredProvinces = useMemo(() => {
    const query = provinceQuery.trim().toLowerCase();
    if (!query) return ALL_PROVINCES;
    return ALL_PROVINCES.filter((province) => province.toLowerCase().includes(query));
  }, [provinceQuery]);

  const goToStep = (nextStep: number) => {
    setStep(nextStep);
    Animated.timing(progress, {
      toValue: nextStep / (STEP_META.length - 1),
      duration: 260,
      useNativeDriver: false,
    }).start();
  };

  const toggleStaffType = (code: string) => {
    setSelectedTypes((prev) => (
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    ));
  };

  const toggleStep3 = (key: string) => {
    if (setupOptions.single) {
      setSelectedStep3([key]);
      return;
    }
    setSelectedStep3((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ));
  };

  const finishSurvey = async () => {
    const updates: Record<string, any> = {
      onboardingCompleted: true,
    };

    if (selectedProvince) {
      updates.preferredProvince = selectedProvince;
      updates.location = {
        province: selectedProvince,
        district: user?.location?.district || '',
      };
    }

    if (role === 'nurse' && selectedTypes.length > 0) {
      updates.staffTypes = selectedTypes;
      updates.staffType = selectedTypes[0];
    }

    if (role === 'nurse' && selectedStep3.length > 0) {
      updates.workStyle = selectedStep3;
    }

    if (role === 'user' && selectedStep3.length > 0) {
      updates.careTypes = selectedStep3;
    }

    if (role === 'hospital' && selectedStep3.length > 0) {
      updates.hiringUrgency = selectedStep3[0];
    }

    try {
      await updateUser(updates);
    } catch (_) {}

    navigation.reset({ index: 0, routes: [{ name: 'Main' as any }] });
  };

  const skipAll = () => {
    updateUser({ onboardingCompleted: true }).catch(() => {});
    navigation.reset({ index: 0, routes: [{ name: 'Main' as any }] });
  };

  const skipStep = () => {
    if (step < STEP_META.length - 1) {
      goToStep(step + 1);
      return;
    }
    skipAll();
  };

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [`${100 / STEP_META.length}%`, '100%'],
  });

  const selectedSetupSummary = useMemo(() => {
    const items: string[] = [];
    if (selectedProvince) items.push(selectedProvince);
    if (role === 'nurse' && selectedTypes.length > 0) items.push(`${selectedTypes.length} ประเภทวิชาชีพ`);
    if (selectedStep3.length > 0) items.push(`${selectedStep3.length} ตัวเลือกที่สนใจ`);
    return items;
  }, [role, selectedProvince, selectedStep3.length, selectedTypes.length]);

  const renderIntroStep = () => (
    <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={[styles.heroBadge, { backgroundColor: colors.primaryBackground }]}> 
          <Ionicons name={roleGuide.icon} size={16} color={colors.primary} />
          <Text style={[styles.heroBadgeText, { color: colors.primary }]}>{roleGuide.badge}</Text>
        </View>

        <View style={[styles.heroIconWrap, { backgroundColor: colors.primaryBackground }]}> 
          <Ionicons name={roleGuide.icon} size={32} color={colors.primary} />
        </View>

        <Text style={[styles.heroTitle, { color: colors.text }]}>{roleGuide.heroTitle}</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{roleGuide.heroSubtitle}</Text>
      </View>

      {roleGuide.highlights.map((item) => (
        <View key={item.title} style={[styles.highlightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={[styles.highlightIconWrap, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name={item.icon} size={18} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.highlightTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.highlightDescription, { color: colors.textSecondary }]}>{item.description}</Text>
          </View>
        </View>
      ))}

      <View style={[styles.noticeCard, { backgroundColor: isDark ? colors.card : colors.backgroundSecondary }]}> 
        <Ionicons name="sparkles-outline" size={16} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>ทุกขั้นตอนข้ามได้ และกลับมาดูใหม่ได้จากหน้า Settings</Text>
      </View>
    </ScrollView>
  );

  const renderFeatureMapStep = () => (
    <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
      {roleGuide.featureTips.map((item) => (
        <View key={item.title} style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={[styles.featureIconWrap, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name={item.icon} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>{item.description}</Text>
          </View>
        </View>
      ))}

      <View style={[styles.quickActionsCard, { backgroundColor: colors.primaryBackground }]}> 
        <Text style={[styles.quickActionsTitle, { color: colors.primaryDark }]}>แนะนำให้ทำต่อหลังเข้าแอป</Text>
        <View style={styles.quickActionsList}>
          {role === 'nurse' && (
            <>
              <Text style={[styles.quickActionText, { color: colors.text }]}>1. เปิดงานใกล้ฉันเพื่อรับงานเร็วขึ้น</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>2. ยืนยันตัวตนเพื่อเพิ่มความน่าเชื่อถือ</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>3. เติมโปรไฟล์และรีวิวให้ครบ</Text>
            </>
          )}
          {role === 'hospital' && (
            <>
              <Text style={[styles.quickActionText, { color: colors.text }]}>1. เติมข้อมูลองค์กรในโปรไฟล์</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>2. สร้างประกาศแรกจากแท็บโพสต์</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>3. ติดตามผู้สมัครจาก Applicants และแชท</Text>
            </>
          )}
          {role === 'user' && (
            <>
              <Text style={[styles.quickActionText, { color: colors.text }]}>1. ค้นหาผู้ดูแลจากหน้าแรกก่อน</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>2. ดูโปรไฟล์และรีวิวก่อนติดต่อ</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>3. บันทึกประกาศที่สนใจไว้เปรียบเทียบ</Text>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );

  const renderSetupStep = () => (
    <ScrollView contentContainerStyle={styles.stepBody} showsVerticalScrollIndicator={false}>
      <View style={[styles.setupHeaderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.setupHeaderTitle, { color: colors.text }]}>{roleGuide.setupTitle}</Text>
        <Text style={[styles.setupHeaderSubtitle, { color: colors.textSecondary }]}>{roleGuide.setupSubtitle}</Text>

        {selectedSetupSummary.length > 0 && (
          <View style={styles.summaryRow}>
            {selectedSetupSummary.map((item) => (
              <View key={item} style={[styles.summaryChip, { backgroundColor: colors.primaryBackground }]}> 
                <Text style={[styles.summaryChipText, { color: colors.primary }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {role === 'nurse' && (
        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>ประเภทวิชาชีพของคุณ</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>เลือกได้หลายประเภท หากคุณรับงานได้มากกว่าหนึ่งสาย</Text>
          <View style={styles.chipRow}>
            {STAFF_TYPES.map((item) => {
              const active = selectedTypes.includes(item.code);
              return (
                <TouchableOpacity
                  key={item.code}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => toggleStaffType(item.code)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, { color: active ? colors.white : colors.text }]}>{item.shortName}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>จังหวัดที่ใช้งานบ่อย</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>ใช้สำหรับตั้งต้นการค้นหาและช่วยให้ผลลัพธ์ตรงพื้นที่มากขึ้น</Text>

        {selectedProvince ? (
          <View style={[styles.selectedTag, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={[styles.selectedTagText, { color: colors.primary }]}>{selectedProvince}</Text>
            <TouchableOpacity onPress={() => setSelectedProvince('')}>
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}> 
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="ค้นหาจังหวัด..."
            placeholderTextColor={colors.textMuted}
            value={provinceQuery}
            onChangeText={setProvinceQuery}
            autoCorrect={false}
          />
          {provinceQuery.length > 0 && (
            <TouchableOpacity onPress={() => setProvinceQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {!provinceQuery && (
          <View style={styles.chipRow}>
            {POPULAR_PROVINCES.map((province) => {
              const active = selectedProvince === province;
              return (
                <TouchableOpacity
                  key={province}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedProvince(province)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, { color: active ? colors.white : colors.text }]}>{province}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <ScrollView style={styles.provinceList} nestedScrollEnabled>
          {filteredProvinces.map((province) => {
            const active = selectedProvince === province;
            return (
              <TouchableOpacity
                key={province}
                style={[styles.listRow, { borderBottomColor: colors.borderLight }, active && { backgroundColor: colors.primaryBackground }]}
                onPress={() => {
                  setSelectedProvince(province);
                  setProvinceQuery('');
                }}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.listRowText, { color: active ? colors.primary : colors.text }]}>{province}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{setupOptions.label}</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>เลือกเฉพาะที่เกี่ยวกับคุณจริง ๆ เพื่อให้คำแนะนำที่แม่นขึ้น</Text>

        {setupOptions.options.map((item) => {
          const active = selectedStep3.includes(item.key);
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.optionCard,
                { backgroundColor: colors.background, borderColor: colors.border },
                active && { borderColor: item.color, backgroundColor: `${item.color}12` },
              ]}
              onPress={() => toggleStep3(item.key)}
              activeOpacity={0.85}
            >
              <View style={[styles.optionIcon, { backgroundColor: `${item.color}20` }]}> 
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{item.label}</Text>
              <View style={[styles.radio, { borderColor: active ? item.color : colors.border }]}> 
                {active ? <View style={[styles.radioDot, { backgroundColor: item.color }]} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderStep = () => {
    if (step === 0) return renderIntroStep();
    if (step === 1) return renderFeatureMapStep();
    return renderSetupStep();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <Text style={[styles.stepCounter, { color: colors.textSecondary }]}>{step + 1} / {STEP_META.length}</Text>
        <TouchableOpacity onPress={skipAll}>
          <Text style={[styles.skipAll, { color: colors.textMuted }]}>ข้ามทั้งหมด</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}> 
        <Animated.View style={[styles.progressBar, { backgroundColor: colors.primary, width: progressWidth }]} />
      </View>

      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text }]}>{STEP_META[step].title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{STEP_META[step].subtitle}</Text>
      </View>

      <View style={styles.contentWrap}>
        {renderStep()}
      </View>

      <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}> 
        {step > 0 ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => goToStep(step - 1)}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.backText, { color: colors.text }]}>ย้อนกลับ</Text>
          </TouchableOpacity>
        ) : <View />}

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.skipStepBtn} onPress={skipStep}>
            <Text style={[styles.skipStepText, { color: colors.textSecondary }]}>ข้ามขั้นตอนนี้</Text>
          </TouchableOpacity>
          <Button style={styles.nextBtn} onPress={step < STEP_META.length - 1 ? () => goToStep(step + 1) : finishSurvey}>
            {step < STEP_META.length - 1 ? 'ถัดไป' : 'เข้าแอปเลย'}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  stepCounter: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  skipAll: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  progressTrack: {
    height: 4,
    marginHorizontal: SPACING.md,
    borderRadius: 2,
    marginTop: SPACING.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  titleBlock: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    lineHeight: 30,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    marginTop: 6,
    lineHeight: 20,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  stepBody: {
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: SPACING.lg,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: SPACING.md,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 21,
    marginTop: SPACING.sm,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  highlightIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  highlightDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  featureIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  featureDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  quickActionsCard: {
    borderRadius: 20,
    padding: SPACING.md,
    marginTop: 2,
  },
  quickActionsTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  quickActionsList: {
    gap: 6,
  },
  quickActionText: {
    fontSize: 13,
    lineHeight: 19,
  },
  setupHeaderCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: SPACING.md,
  },
  setupHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  setupHeaderSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
  },
  summaryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: SPACING.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  selectedTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    marginBottom: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  provinceList: {
    maxHeight: 220,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    paddingHorizontal: 2,
  },
  listRowText: {
    fontSize: 14,
    flex: 1,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    marginTop: 8,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  skipStepBtn: {
    marginRight: SPACING.xs,
  },
  skipStepText: {
    fontSize: 14,
    fontWeight: '500',
  },
  nextBtn: {
    minWidth: 120,
  },
});
