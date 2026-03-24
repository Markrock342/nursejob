// ============================================
// ONBOARDING TIPS - role-aware, skippable, production-style
// ============================================

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Alert,
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
import { trackEvent } from '../../services/analyticsService';
import { useI18n } from '../../i18n';

type Nav = NativeStackNavigationProp<RootStackParamList, 'OnboardingSurvey'>;

interface Props {
  navigation: Nav;
}

type AppRole = 'nurse' | 'hospital' | 'user';

const getNurseWorkStyles = (t: any) => [
  { key: 'fulltime', label: t('onboarding.workFulltime'), icon: 'briefcase-outline' as const, color: '#2563EB' },
  { key: 'parttime', label: t('onboarding.workParttime'), icon: 'time-outline' as const, color: '#7C3AED' },
  { key: 'weekend', label: t('onboarding.workWeekend'), icon: 'calendar-outline' as const, color: '#059669' },
  { key: 'flexible', label: t('onboarding.workFlexible'), icon: 'options-outline' as const, color: '#D97706' },
];

const getUserCareTypes = (t: any) => [
  { key: 'elderly', label: t('onboarding.careElderly'), icon: 'people-outline' as const, color: '#0EA5E9' },
  { key: 'bedridden', label: t('onboarding.careBedridden'), icon: 'bed-outline' as const, color: '#EF4444' },
  { key: 'postsurg', label: t('onboarding.carePostSurg'), icon: 'medkit-outline' as const, color: '#8B5CF6' },
  { key: 'child', label: t('onboarding.careChild'), icon: 'happy-outline' as const, color: '#F59E0B' },
  { key: 'terminal', label: t('onboarding.careTerminal'), icon: 'heart-outline' as const, color: '#EC4899' },
  { key: 'other', label: t('onboarding.careOther'), icon: 'ellipsis-horizontal-outline' as const, color: '#6B7280' },
];

const getHospitalUrgency = (t: any) => [
  { key: 'now', label: t('onboarding.urgencyNow'), icon: 'flash-outline' as const, color: '#EF4444' },
  { key: 'week', label: t('onboarding.urgencyWeek'), icon: 'calendar-outline' as const, color: '#F59E0B' },
  { key: 'month', label: t('onboarding.urgencyMonth'), icon: 'hourglass-outline' as const, color: '#0EA5E9' },
  { key: 'plan', label: t('onboarding.urgencyPlan'), icon: 'clipboard-outline' as const, color: '#10B981' },
];

const getStepMeta = (t: any) => [
  {
    title: t('onboarding.step1Title'),
    subtitle: t('onboarding.step1Subtitle'),
  },
  {
    title: t('onboarding.step2Title'),
    subtitle: t('onboarding.step2Subtitle'),
  },
  {
    title: t('onboarding.step3Title'),
    subtitle: t('onboarding.step3Subtitle'),
  },
];

const getRoleGuide = (t: any): Record<AppRole, {
  badge: string;
  icon: keyof typeof Ionicons.glyphMap;
  heroTitle: string;
  heroSubtitle: string;
  highlights: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; description: string }>;
  featureTips: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; description: string }>;
  setupTitle: string;
  setupSubtitle: string;
}> => ({
  nurse: {
    badge: t('onboarding.badgeNurse'),
    icon: 'medical-outline',
    heroTitle: t('onboarding.heroNurse'),
    heroSubtitle: t('onboarding.nurseHeroSubtitle'),
    highlights: [
      { icon: 'swap-horizontal-outline', title: t('onboarding.nurseHighlight1'), description: t('onboarding.nurseHighlightDesc1') },
      { icon: 'chatbubbles-outline', title: t('onboarding.nurseHighlight2'), description: t('onboarding.nurseHighlightDesc2') },
      { icon: 'shield-checkmark-outline', title: t('onboarding.nurseHighlight3'), description: t('onboarding.nurseHighlightDesc3') },
    ],
    featureTips: [
      { icon: 'home-outline', title: t('onboarding.nurseFeature1'), description: t('onboarding.nurseFeatureDesc1') },
      { icon: 'add-circle-outline', title: t('onboarding.nurseFeature2'), description: t('onboarding.nurseFeatureDesc2') },
      { icon: 'chatbubble-ellipses-outline', title: t('onboarding.nurseFeature3'), description: t('onboarding.nurseFeatureDesc3') },
      { icon: 'person-outline', title: t('onboarding.nurseFeature4'), description: t('onboarding.nurseFeatureDesc4') },
    ],
    setupTitle: t('onboarding.nurseSetupTitle'),
    setupSubtitle: t('onboarding.nurseSetupSubtitle'),
  },
  hospital: {
    badge: t('onboarding.badgeHospital'),
    icon: 'business-outline',
    heroTitle: t('onboarding.heroHospital'),
    heroSubtitle: t('onboarding.hospitalHeroSubtitle'),
    highlights: [
      { icon: 'briefcase-outline', title: t('onboarding.hospitalHighlightTitle1'), description: t('onboarding.hospitalHighlightDesc1') },
      { icon: 'people-outline', title: t('onboarding.hospitalHighlightTitle2'), description: t('onboarding.hospitalHighlightDesc2') },
      { icon: 'chatbubbles-outline', title: t('onboarding.hospitalHighlightTitle3'), description: t('onboarding.hospitalHighlightDesc3') },
    ],
    featureTips: [
      { icon: 'home-outline', title: t('onboarding.nurseFeature1'), description: t('onboarding.hospitalFeatureDesc1') },
      { icon: 'add-circle-outline', title: t('onboarding.nurseFeature2'), description: t('onboarding.hospitalFeatureDesc2') },
      { icon: 'chatbubble-ellipses-outline', title: t('onboarding.nurseFeature3'), description: t('onboarding.hospitalFeatureDesc3') },
      { icon: 'person-outline', title: t('onboarding.nurseFeature4'), description: t('onboarding.hospitalFeatureDesc4') },
    ],
    setupTitle: t('onboarding.hospitalSetupTitle'),
    setupSubtitle: t('onboarding.hospitalSetupSubtitle'),
  },
  user: {
    badge: t('onboarding.badgeUser'),
    icon: 'heart-outline',
    heroTitle: t('onboarding.userHeroTitle'),
    heroSubtitle: t('onboarding.userHeroSubtitle'),
    highlights: [
      { icon: 'home-outline', title: t('onboarding.userHighlightTitle1'), description: t('onboarding.userHighlightDesc1') },
      { icon: 'person-circle-outline', title: t('onboarding.userHighlightTitle2'), description: t('onboarding.userHighlightDesc2') },
      { icon: 'call-outline', title: t('onboarding.userHighlightTitle3'), description: t('onboarding.userHighlightDesc3') },
    ],
    featureTips: [
      { icon: 'home-outline', title: t('onboarding.nurseFeature1'), description: t('onboarding.userFeatureDesc1') },
      { icon: 'add-circle-outline', title: t('onboarding.nurseFeature2'), description: t('onboarding.userFeatureDesc2') },
      { icon: 'chatbubble-ellipses-outline', title: t('onboarding.nurseFeature3'), description: t('onboarding.userFeatureDesc3') },
      { icon: 'person-outline', title: t('onboarding.nurseFeature4'), description: t('onboarding.userFeatureDesc4') },
    ],
    setupTitle: t('onboarding.userSetupTitle'),
    setupSubtitle: t('onboarding.userSetupSubtitle'),
  },
});

function getRole(userRole?: string): AppRole {
  if (userRole === 'hospital') return 'hospital';
  if (userRole === 'user') return 'user';
  return 'nurse';
}

export default function OnboardingSurveyScreen({
  navigation }: Props) {
  const { t } = useI18n();
  const NURSE_WORK_STYLES = useMemo(() => getNurseWorkStyles(t), [t]);
  const USER_CARE_TYPES = useMemo(() => getUserCareTypes(t), [t]);
  const HOSPITAL_URGENCY = useMemo(() => getHospitalUrgency(t), [t]);
  const STEP_META = useMemo(() => getStepMeta(t), [t]);
  const ROLE_GUIDE = useMemo(() => getRoleGuide(t), [t]);
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

  useEffect(() => {
    trackEvent({
      eventName: 'onboarding_started',
      screenName: 'OnboardingSurvey',
      props: {
        role,
      },
    });
  }, [role]);

  useEffect(() => {
    trackEvent({
      eventName: 'screen_view',
      screenName: 'OnboardingSurvey',
      props: {
        role,
        step,
      },
    });
  }, [role, step]);

  const setupOptions = useMemo(() => {
    if (role === 'nurse') {
      return {
        single: false,
        options: NURSE_WORK_STYLES,
        label: t('onboarding.nurseSetupLabel'),
      };
    }
    if (role === 'hospital') {
      return {
        single: true,
        options: HOSPITAL_URGENCY,
        label: t('onboarding.hospitalSetupLabel'),
      };
    }
    return {
      single: false,
      options: USER_CARE_TYPES,
      label: t('onboarding.userSetupLabel'),
    };
  }, [role]);

  const filteredProvinces = useMemo(() => {
    const query = provinceQuery.trim().toLowerCase();
    if (!query) return ALL_PROVINCES;
    return ALL_PROVINCES.filter((province) => province.toLowerCase().includes(query));
  }, [provinceQuery]);

  const goToStep = (nextStep: number) => {
    trackEvent({
      eventName: 'onboarding_step_completed',
      screenName: 'OnboardingSurvey',
      props: {
        role,
        fromStep: step,
        toStep: nextStep,
        selectedTypesCount: selectedTypes.length,
        selectedSetupCount: selectedStep3.length,
        hasProvince: Boolean(selectedProvince),
      },
    });

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
    } catch (_) {
      Alert.alert(t('common.alerts.errorTitle'), t('common.alerts.saveErrorMessage'));
    }

    trackEvent({
      eventName: 'onboarding_completed',
      screenName: 'OnboardingSurvey',
      props: {
        role,
        selectedTypesCount: selectedTypes.length,
        selectedSetupCount: selectedStep3.length,
        hasProvince: Boolean(selectedProvince),
      },
    });

    navigation.reset({ index: 0, routes: [{ name: 'Main' as any }] });
  };

  const skipAll = () => {
    trackEvent({
      eventName: 'onboarding_completed',
      screenName: 'OnboardingSurvey',
      props: {
        role,
        skipped: true,
      },
    });

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
    if (role === 'nurse' && selectedTypes.length > 0) items.push(t('onboarding.selectedTypesCount').replace('{count}', String(selectedTypes.length)));
    if (selectedStep3.length > 0) items.push(t('onboarding.selectedOptionsCount').replace('{count}', String(selectedStep3.length)));
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
        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>{t('onboarding.skipNotice')}</Text>
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
        <Text style={[styles.quickActionsTitle, { color: colors.primaryDark }]}>{t('onboarding.quickActionsTitle')}</Text>
        <View style={styles.quickActionsList}>
          {role === 'nurse' && (
            <>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.nurseQuickAction1')}</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.nurseQuickAction2')}</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.nurseQuickAction3')}</Text>
            </>
          )}
          {role === 'hospital' && (
            <>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.hospitalQuickAction1')}</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.hospitalQuickAction2')}</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.hospitalQuickAction3')}</Text>
            </>
          )}
          {role === 'user' && (
            <>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.userQuickAction1')}</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.userQuickAction2')}</Text>
              <Text style={[styles.quickActionText, { color: colors.text }]}>{t('onboarding.userQuickAction3')}</Text>
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.staffTypeTitle')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('onboarding.multipleTypesHint')}</Text>
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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('onboarding.provinceTitle')}</Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('onboarding.locationHint')}</Text>

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
            placeholder={t('onboarding.provinceSearchPlaceholder')}
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
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('onboarding.interestHint')}</Text>

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
          <Text style={[styles.skipAll, { color: colors.textMuted }]}>{t('onboarding.skipAll')}</Text>
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
            <Text style={[styles.backText, { color: colors.text }]}>{t('onboarding.goBack')}</Text>
          </TouchableOpacity>
        ) : <View />}

        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.skipStepBtn} onPress={skipStep}>
            <Text style={[styles.skipStepText, { color: colors.textSecondary }]}>{t('onboarding.skipStep')}</Text>
          </TouchableOpacity>
          <Button style={styles.nextBtn} onPress={step < STEP_META.length - 1 ? () => goToStep(step + 1) : finishSurvey}>
            {step < STEP_META.length - 1 ? t('onboarding.next') : t('onboarding.enterApp')}
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
