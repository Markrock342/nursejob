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
import { useI18n } from '../../i18n';

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

const getFaqCategories = (t: any): FAQCategory[] => [
  { id: 'general', title: t('help.catGeneral'), icon: 'information-circle-outline' },
  { id: 'account', title: t('help.catAccount'), icon: 'person-outline' },
  { id: 'jobs', title: t('help.catJobs'), icon: 'briefcase-outline' },
  { id: 'applications', title: t('help.catApplications'), icon: 'document-text-outline' },
  { id: 'hospital', title: t('help.catHospital'), icon: 'business-outline' },
  { id: 'payment', title: t('help.catPayment'), icon: 'card-outline' },
];

const getFaqData = (t: any): FAQItem[] => [
  // General
  {
    id: '1',
    category: 'general',
    question: t('help.faq1Q'),
    answer: t('help.faqAnswer1'),
  },
  {
    id: '2',
    category: 'general',
    question: t('help.faq2Q'),
    answer: t('help.faqAnswer2'),
  },
  {
    id: '3',
    category: 'general',
    question: t('help.faq3Q'),
    answer: t('help.faqAnswer3'),
  },

  // Account
  {
    id: '4',
    category: 'account',
    question: t('help.faq4Q'),
    answer: t('help.faqAnswer4'),
  },
  {
    id: '5',
    category: 'account',
    question: t('help.faq5Q'),
    answer: t('help.faqAnswer5'),
  },
  {
    id: '6',
    category: 'account',
    question: t('help.faq6Q'),
    answer: t('help.faqAnswer6'),
  },
  {
    id: '7',
    category: 'account',
    question: t('help.faq7Q'),
    answer: t('help.faqAnswer7'),
  },

  // Jobs
  {
    id: '8',
    category: 'jobs',
    question: t('help.faq8Q'),
    answer: t('help.faqAnswer8'),
  },
  {
    id: '9',
    category: 'jobs',
    question: t('help.faq9Q'),
    answer: t('help.faqAnswer9'),
  },
  {
    id: '10',
    category: 'jobs',
    question: t('help.faq10Q'),
    answer: t('help.faqAnswer10'),
  },

  // Applications
  {
    id: '11',
    category: 'applications',
    question: t('help.faq11Q'),
    answer: t('help.faqAnswer11'),
  },
  {
    id: '12',
    category: 'applications',
    question: t('help.faq12Q'),
    answer: t('help.faqAnswer12'),
  },
  {
    id: '13',
    category: 'applications',
    question: t('help.faq13Q'),
    answer: t('help.faqAnswer13'),
  },
  {
    id: '14',
    category: 'applications',
    question: t('help.faq14Q'),
    answer: t('help.faqAnswer14'),
  },

  // Hospital
  {
    id: '15',
    category: 'hospital',
    question: t('help.faq15Q'),
    answer: t('help.faqAnswer15'),
  },
  {
    id: '16',
    category: 'hospital',
    question: t('help.faq16Q'),
    answer: t('help.faqAnswer16'),
  },
  {
    id: '17',
    category: 'hospital',
    question: t('help.faq17Q'),
    answer: t('help.faqAnswer17'),
  },

  // Payment
  {
    id: '18',
    category: 'payment',
    question: t('help.faq18Q'),
    answer: t('help.faqAnswer18'),
  },
  {
    id: '19',
    category: 'payment',
    question: t('help.faq19Q'),
    answer: t('help.faqAnswer19'),
  },
  {
    id: '20',
    category: 'payment',
    question: t('help.faq20Q'),
    answer: t('help.faqAnswer20'),
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
  const { t } = useI18n();
  const FAQ_CATEGORIES = useMemo(() => getFaqCategories(t), [t]);
  const FAQ_DATA = useMemo(() => getFaqData(t), [t]);
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
    Linking.openURL(`mailto:support@nursego.co?subject=${t('help.emailSubject')}`);
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
        <Text style={styles.headerTitle}>{t('help.headerTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('help.searchPlaceholder')}
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
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>{t('help.allTab')}</Text>
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
          <Text style={styles.sectionTitle}>{t('help.faqSectionTitle')}</Text>
          
          {filteredFAQs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyText}>{t('help.emptySearch')}</Text>
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
          <Text style={styles.sectionTitle}>{t('help.contactTitle')}</Text>
          <Text style={styles.contactSubtitle}>{t('help.contactSubtitle')}</Text>

          <View style={styles.contactOptions}>
            <TouchableOpacity style={styles.contactCard} onPress={handleContactSupport}>
              <View style={[styles.contactIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="mail-outline" size={24} color={colors.primary} />
              </View>
              <Text style={styles.contactLabel}>{t('help.contactEmail')}</Text>
              <Text style={styles.contactValue}>support@nursego.co</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
              <View style={[styles.contactIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="call-outline" size={24} color={colors.success} />
              </View>
              <Text style={styles.contactLabel}>{t('help.contactPhone')}</Text>
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
            <Text style={styles.officeHoursText}>{t('help.officeHours')}</Text>
          </View>
        </View>

        {/* Quick Links */}
        <View style={styles.quickLinksSection}>
          <Text style={styles.sectionTitle}>{t('help.quickLinksTitle')}</Text>

          {onboardingSurveyEnabled ? (
            <TouchableOpacity
              style={styles.quickLink}
              onPress={() => (navigation as any).navigate('OnboardingSurvey')}
            >
              <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
              <Text style={[styles.quickLinkText, { color: colors.text }]}>{t('help.onboardingGuideLink')}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
          
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => (navigation as any).navigate('Terms')}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickLinkText}>{t('help.termsLink')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => (navigation as any).navigate('Privacy')}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickLinkText}>{t('help.privacyLink')}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => Linking.openURL('https://nursego.co/about')}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.quickLinkText}>{t('help.aboutLink')}</Text>
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

