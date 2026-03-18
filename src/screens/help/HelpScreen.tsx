// ============================================
// HELP / FAQ SCREEN - Production Ready
// ============================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useOnboardingSurveyEnabled } from '../../hooks/useOnboardingSurveyEnabled';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const FAQ_CATEGORIES: FAQCategory[] = [
  { id: 'general', title: 'ทั่วไป', icon: 'information-circle-outline' },
  { id: 'account', title: 'บัญชี', icon: 'person-outline' },
  { id: 'jobs', title: 'งาน', icon: 'briefcase-outline' },
  { id: 'applications', title: 'การสมัคร', icon: 'document-text-outline' },
  { id: 'hospital', title: 'โรงพยาบาล', icon: 'business-outline' },
  { id: 'payment', title: 'การชำระเงิน', icon: 'card-outline' },
];

const FAQ_DATA: FAQItem[] = [
  // General
  {
    id: '1',
    category: 'general',
    question: 'NurseGo คืออะไร?',
    answer: 'NurseGo เป็นแพลตฟอร์มหางานสำหรับพยาบาลและบุคลากรทางการแพทย์ ที่ช่วยเชื่อมต่อระหว่างพยาบาลที่กำลังหางานกับโรงพยาบาลและสถานพยาบาลที่ต้องการบุคลากร',
  },
  {
    id: '2',
    category: 'general',
    question: 'แอปนี้ใช้งานฟรีหรือไม่?',
    answer: 'ตอนนี้ NurseGo เปิดให้ใช้งานฟรีในช่วงทดลองใช้ฟรี โดยระบบจะดูแลสิทธิ์ของแต่ละบัญชีให้อัตโนมัติ และจะประกาศให้ทราบอีกครั้งเมื่อเปิดระบบชำระเงินอย่างเป็นทางการ',
  },
  {
    id: '3',
    category: 'general',
    question: 'รองรับการใช้งานบนอุปกรณ์อะไรบ้าง?',
    answer: 'แอป NurseGo รองรับทั้ง iOS และ Android รวมถึงสามารถใช้งานผ่านเว็บบราวเซอร์ได้ด้วย',
  },

  // Account
  {
    id: '4',
    category: 'account',
    question: 'จะสมัครสมาชิกได้อย่างไร?',
    answer: 'คุณสามารถสมัครสมาชิกได้โดยใช้อีเมล หรือเข้าสู่ระบบด้วย Google / Apple ID เพียงกดปุ่ม "สมัครสมาชิก" และทำตามขั้นตอน',
  },
  {
    id: '5',
    category: 'account',
    question: 'ลืมรหัสผ่านทำอย่างไร?',
    answer: 'กดปุ่ม "ลืมรหัสผ่าน" ที่หน้าเข้าสู่ระบบ แล้วกรอกอีเมลที่ใช้สมัคร ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณ',
  },
  {
    id: '6',
    category: 'account',
    question: 'จะแก้ไขข้อมูลโปรไฟล์ได้อย่างไร?',
    answer: 'ไปที่หน้า "โปรไฟล์" แล้วกด "แก้ไขโปรไฟล์" คุณสามารถแก้ไขชื่อ, รูปภาพ, ประวัติการศึกษา, ประสบการณ์ทำงาน และข้อมูลอื่นๆ ได้',
  },
  {
    id: '7',
    category: 'account',
    question: 'จะลบบัญชีได้อย่างไร?',
    answer: 'ไปที่ ตั้งค่า > บัญชี > ลบบัญชี การลบบัญชีจะเป็นการลบข้อมูลทั้งหมดของคุณอย่างถาวร รวมถึงประวัติการสมัครงานและการแชท',
  },

  // Jobs
  {
    id: '8',
    category: 'jobs',
    question: 'จะค้นหางานที่ตรงใจได้อย่างไร?',
    answer: 'ใช้ฟังก์ชันค้นหาและตัวกรองที่หน้าค้นหางาน คุณสามารถกรองตามประเภทงาน, เงินเดือน, ตำแหน่งที่ตั้ง, และอื่นๆ เพื่อหางานที่ตรงใจ',
  },
  {
    id: '9',
    category: 'jobs',
    question: 'บันทึกงานที่สนใจได้อย่างไร?',
    answer: 'กดไอคอนหัวใจ (❤️) ที่การ์ดงานหรือหน้ารายละเอียดงาน งานที่บันทึกจะแสดงในหน้า "รายการโปรด" ของคุณ',
  },
  {
    id: '10',
    category: 'jobs',
    question: 'งานที่แสดงมาจากไหน?',
    answer: 'งานทั้งหมดลงประกาศโดยโรงพยาบาลและสถานพยาบาลที่ผ่านการยืนยันตัวตนกับ NurseGo เรามีทีมงานตรวจสอบความถูกต้องของข้อมูลอยู่เสมอ',
  },

  // Applications
  {
    id: '11',
    category: 'applications',
    question: 'จะสมัครงานได้อย่างไร?',
    answer: 'เข้าดูรายละเอียดงานที่สนใจ แล้วกดปุ่ม "สมัครงาน" คุณสามารถใส่ข้อความแนะนำตัวเพิ่มเติมได้ โรงพยาบาลจะได้รับการแจ้งเตือนและสามารถดูโปรไฟล์ของคุณได้',
  },
  {
    id: '12',
    category: 'applications',
    question: 'จะดูสถานะการสมัครได้ที่ไหน?',
    answer: 'ไปที่หน้า "ใบสมัคร" คุณจะเห็นรายการงานที่สมัครทั้งหมด พร้อมสถานะการสมัคร เช่น รอดำเนินการ, กำลังพิจารณา, ผ่านการคัดเลือก เป็นต้น',
  },
  {
    id: '13',
    category: 'applications',
    question: 'สามารถยกเลิกการสมัครได้ไหม?',
    answer: 'ได้ คุณสามารถยกเลิกการสมัครได้ที่หน้ารายละเอียดใบสมัคร กดปุ่ม "ยกเลิกการสมัคร" การยกเลิกจะไม่สามารถกู้คืนได้',
  },
  {
    id: '14',
    category: 'applications',
    question: 'ต้องอัปโหลดเอกสารอะไรบ้าง?',
    answer: 'เอกสารที่แนะนำให้อัปโหลด ได้แก่ Resume, ใบอนุญาตประกอบวิชาชีพ, ประกาศนียบัตร, หลักฐานการศึกษา และบัตรประจำตัวประชาชน เอกสารเหล่านี้จะช่วยเพิ่มโอกาสในการได้รับการพิจารณา',
  },

  // Hospital
  {
    id: '15',
    category: 'hospital',
    question: 'โรงพยาบาลจะลงประกาศงานได้อย่างไร?',
    answer: 'สมัครสมาชิกในฐานะโรงพยาบาล ยืนยันตัวตนกับเอกสารที่จำเป็น จากนั้นไปที่ "ลงประกาศงาน" กรอกรายละเอียดงานและกด "เผยแพร่"',
  },
  {
    id: '16',
    category: 'hospital',
    question: 'จะดูผู้สมัครได้ที่ไหน?',
    answer: 'ไปที่ "จัดการผู้สมัคร" คุณจะเห็นรายการผู้สมัครทั้งหมดของงานที่ลงประกาศ สามารถดูโปรไฟล์, อัปเดตสถานะ, และแชทกับผู้สมัครได้',
  },
  {
    id: '17',
    category: 'hospital',
    question: 'รีวิวของโรงพยาบาลมีผลอย่างไร?',
    answer: 'รีวิวช่วยให้ผู้หางานเข้าใจวัฒนธรรมและสภาพแวดล้อมการทำงานของโรงพยาบาล รีวิวดีจะช่วยดึงดูดผู้สมัครคุณภาพ โรงพยาบาลสามารถตอบกลับรีวิวได้',
  },

  // Payment
  {
    id: '18',
    category: 'payment',
    question: 'โรงพยาบาลต้องจ่ายค่าธรรมเนียมอะไรบ้าง?',
    answer: 'ในช่วงทดลองใช้ฟรี ระบบยังไม่เรียกเก็บเงินจริง โรงพยาบาลและผู้ใช้งานจะได้รับสิทธิ์ตามสถานะบัญชีและการใช้งานที่ระบบเปิดให้ก่อน เมื่อเปิดระบบชำระเงินอย่างเป็นทางการ เราจะแจ้งแพ็กเกจและเงื่อนไขอีกครั้ง',
  },
  {
    id: '19',
    category: 'payment',
    question: 'ชำระเงินได้ทางช่องทางไหนบ้าง?',
    answer: 'ขณะนี้ยังไม่มีการเปิดรับชำระเงินจริงในแอป เมื่อเปิดระบบชำระเงินแล้ว เราจะแจ้งช่องทางที่รองรับให้ทราบอีกครั้ง',
  },
  {
    id: '20',
    category: 'payment',
    question: 'ขอใบเสร็จได้อย่างไร?',
    answer: 'ในช่วงที่ยังไม่เปิดเก็บเงินจริง ระบบจะยังไม่มีใบเสร็จหรือประวัติการชำระเงิน เมื่อเปิดใช้งานจริงแล้ว เราจะแจ้งขั้นตอนการรับเอกสารให้ทราบอีกครั้ง',
  },
];

const FAQItemComponent = ({ item, isExpanded, onToggle }: {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.faqItem}>
    <TouchableOpacity style={styles.faqQuestion} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.faqQuestionText}>{item.question}</Text>
      <Ionicons
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={colors.textSecondary}
      />
    </TouchableOpacity>
    {isExpanded && (
      <View style={styles.faqAnswer}>
        <Text style={styles.faqAnswerText}>{item.answer}</Text>
      </View>
    )}
  </View>
);
};

export default function HelpScreen() {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  const headerBackground = colors.surface;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFAQs = FAQ_DATA.filter((item) => {
    const matchesSearch = searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleContactSupport = () => {
    Linking.openURL('mailto:support@nursego.co?subject=ขอความช่วยเหลือ');
  };

  const handleCall = () => {
    Linking.openURL('tel:021234567');
  };

  const handleLineOA = () => {
    Linking.openURL('https://line.me/R/ti/p/@nursego');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ช่วยเหลือ</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="ค้นหาคำถาม..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textMuted}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          <TouchableOpacity
            style={[styles.categoryPill, !selectedCategory && styles.categoryPillActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              ทั้งหมด
            </Text>
          </TouchableOpacity>
          {FAQ_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, selectedCategory === cat.id && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon}
                size={16}
                color={selectedCategory === cat.id ? colors.white : colors.textSecondary}
              />
              <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
                {cat.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* FAQ List */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>คำถามที่พบบ่อย</Text>
          
          {filteredFAQs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>ไม่พบคำถามที่ตรงกับการค้นหา</Text>
            </View>
          ) : (
            filteredFAQs.map((item) => (
              <FAQItemComponent
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))
          )}
        </View>

        {/* Contact Support */}
        <View style={styles.contactSection}>
          <Text style={styles.sectionTitle}>ติดต่อเรา</Text>
          <Text style={styles.contactSubtitle}>
            ยังหาคำตอบไม่เจอ? ติดต่อทีมสนับสนุนของเรา
          </Text>

          <View style={styles.contactOptions}>
            <TouchableOpacity style={styles.contactCard} onPress={handleContactSupport}>
              <View style={[styles.contactIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="mail-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.contactLabel}>อีเมล</Text>
              <Text style={styles.contactValue}>support@nursego.co</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
              <View style={[styles.contactIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="call-outline" size={24} color={colors.success} />
              </View>
              <Text style={styles.contactLabel}>โทรศัพท์</Text>
              <Text style={styles.contactValue}>02-123-4567</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleLineOA}>
              <View style={[styles.contactIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="chatbubble-outline" size={24} color="#00B900" />
              </View>
              <Text style={styles.contactLabel}>Line OA</Text>
              <Text style={styles.contactValue}>@nursego</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.officeHours}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text style={styles.officeHoursText}>
              เวลาทำการ: จันทร์ - ศุกร์ 9:00 - 18:00 น.
            </Text>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinksSection}>
          <Text style={styles.sectionTitle}>ลิงก์ที่เกี่ยวข้อง</Text>

          {onboardingSurveyEnabled ? (
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => (navigation as any).navigate('OnboardingSurvey')}
            >
              <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
              <Text style={[styles.quickLinkText, { color: colors.text }]}>ดูคู่มือเริ่มต้นใช้งาน</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => (navigation as any).navigate('Terms')}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickLinkText}>ข้อกำหนดการใช้งาน</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => (navigation as any).navigate('Privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickLinkText}>นโยบายความเป็นส่วนตัว</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => Linking.openURL('https://nursego.co/about')}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickLinkText}>เกี่ยวกับเรา</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  categoriesContainer: {
    marginBottom: SPACING.md,
  },
  categoriesContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.full,
    marginRight: SPACING.sm,
    gap: 6,
    ...SHADOWS.sm,
  },
  categoryPillActive: {
    backgroundColor: COLORS.primary,
  },
  categoryText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  categoryTextActive: {
    color: COLORS.white,
    fontWeight: '500',
  },
  faqSection: {
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  faqItem: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
    marginRight: SPACING.sm,
  },
  faqAnswer: {
    padding: SPACING.md,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  faqAnswerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textMuted,
  },
  contactSection: {
    padding: SPACING.md,
  },
  contactSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  contactOptions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  contactCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    ...SHADOWS.sm,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  contactLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  contactValue: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
    textAlign: 'center',
  },
  officeHours: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  officeHoursText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  quickLinksSection: {
    padding: SPACING.md,
  },
  quickLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  quickLinkText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
  bottomSpace: {
    height: 40,
  },
});

