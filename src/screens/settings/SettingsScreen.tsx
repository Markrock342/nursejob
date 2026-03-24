// ============================================
// SETTINGS SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useOnboardingSurveyEnabled } from '../../hooks/useOnboardingSurveyEnabled';
import { deleteUserAccount, updateUserPrivacy } from '../../services/authService';
import { clearPushTokenForUser } from '../../services/notificationService';
import { AppSettings, defaultAppSettings, loadAppSettings, mergeAppSettings, saveAppSettings } from '../../services/settingsService';
import { getLaunchQuotaSummary, getUserSubscription, getSubscriptionStatusDisplay, LaunchQuotaSummary, subscribeLaunchUsageLimitsConfig, upgradeToPremium } from '../../services/subscriptionService';
import { Subscription, SUBSCRIPTION_PLANS } from '../../types';
import {
  CommerceAccessStatus,
  CommerceAdminSettings,
  getCommerceAccessStatus,
  getCommerceAdminSettings,
  getCommerceEntrySubtitle,
  getCommerceEntryTitle,
  updateCommerceMonetizationMode,
} from '../../services/commerceService';
import { ConfirmModal, SuccessModal, ErrorModal } from '../../components/common';
import { useI18n, type LanguagePreference } from '../../i18n';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, logout, updateUser } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const { t, languagePreference, resolvedLanguage, setLanguagePreference } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  const { registerForNotifications, clearNotifications } = useNotifications();
  const headerBackground = colors.surface;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Subscription state
  const [subscription, setSubscription] = useState<Subscription>({ plan: 'free' });
  const [commerceStatus, setCommerceStatus] = useState<CommerceAccessStatus | null>(null);
  const [commerceAdminSettings, setCommerceAdminSettings] = useState<CommerceAdminSettings>({ monetizationMode: 'auto' });
  const [launchQuotaSummary, setLaunchQuotaSummary] = useState<LaunchQuotaSummary | null>(null);
  const [isUpdatingCommerceMode, setIsUpdatingCommerceMode] = useState(false);

  // Modal states
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  useEffect(() => {
    void loadSettings();
    void loadSubscription();
  }, [user?.uid, themeMode, languagePreference]);

  const resolvedLanguageLabel = resolvedLanguage === 'th'
    ? t('common.language.thai')
    : t('common.language.english');
  const languageSubtitle = languagePreference === 'system'
    ? t('common.language.systemWithResolved', { language: resolvedLanguageLabel })
    : languagePreference === 'th'
      ? t('common.language.thai')
      : t('common.language.english');

  const loadSubscription = async () => {
    if (!user?.uid) return;

    const [sub, commerce, adminSettings, quotaSummary] = await Promise.all([
      getUserSubscription(user.uid),
      getCommerceAccessStatus(),
      getCommerceAdminSettings(),
      getLaunchQuotaSummary(user.uid),
    ]);

    setSubscription(sub);
    setCommerceStatus(commerce);
    setCommerceAdminSettings(adminSettings);
    setLaunchQuotaSummary(quotaSummary);
  };

  useEffect(() => {
    if (!user?.uid) return undefined;

    const unsubscribe = subscribeLaunchUsageLimitsConfig(() => {
      void getLaunchQuotaSummary(user.uid)
        .then((summary) => setLaunchQuotaSummary(summary))
        .catch((error) => console.error('Error refreshing settings launch quota summary', error));
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const refreshCommerceState = async () => {
    const [commerce, adminSettings] = await Promise.all([
      getCommerceAccessStatus(),
      getCommerceAdminSettings(),
    ]);
    setCommerceStatus(commerce);
    setCommerceAdminSettings(adminSettings);
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await loadAppSettings();
      const nextSettings = mergeAppSettings({
        ...savedSettings,
        preferences: {
          ...savedSettings.preferences,
          theme: themeMode,
          language: languagePreference,
        },
        notifications: {
          ...savedSettings.notifications,
          ...(user?.notificationPreferences || {}),
        },
        privacy: {
          ...savedSettings.privacy,
          profileVisible: user?.privacy?.profileVisible ?? savedSettings.privacy.profileVisible,
          showOnlineStatus: user?.privacy?.showOnlineStatus ?? savedSettings.privacy.showOnlineStatus,
        },
      });
      setSettings(nextSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      const mergedSettings = mergeAppSettings(newSettings);
      await saveAppSettings(mergedSettings);
      setSettings(mergedSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  };

  const updateNotification = async (key: keyof AppSettings['notifications'], value: boolean) => {
    const previousSettings = settings;
    const newSettings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    };
    await saveSettings(newSettings);

    try {
      if (user?.uid) {
        await updateUser({
          notificationPreferences: newSettings.notifications,
        });
      }

      if (key === 'pushEnabled') {
        if (value) {
          await registerForNotifications();
        } else {
          await clearNotifications();
          if (user?.uid) {
            await clearPushTokenForUser(user.uid);
          }
        }
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      await saveSettings(previousSettings);
      setErrorMessage(t('settings.errors.notificationsSaveFailed'));
      setShowErrorModal(true);
    }
  };

  const updatePrivacy = async (key: keyof AppSettings['privacy'], value: boolean) => {
    const previousSettings = settings;
    const newSettings = {
      ...settings,
      privacy: { ...settings.privacy, [key]: value },
    };
    await saveSettings(newSettings);

    if (user?.uid) {
      try {
        await updateUserPrivacy(user.uid, {
          profileVisible: newSettings.privacy.profileVisible,
          showOnlineStatus: newSettings.privacy.showOnlineStatus,
        });
      } catch (error) {
        console.error('Error saving privacy to Firestore:', error);
        await saveSettings(previousSettings);
        setErrorMessage(t('settings.errors.privacySaveFailed'));
        setShowErrorModal(true);
      }
    }
  };

  const handleLanguageSelection = async (nextLanguage: LanguagePreference) => {
    const previousLanguage = settings.preferences.language;
    setSettings((current) => mergeAppSettings({
      ...current,
      preferences: {
        ...current.preferences,
        language: nextLanguage,
      },
    }));

    try {
      await setLanguagePreference(nextLanguage);
      setShowLanguageModal(false);
    } catch (error) {
      console.error('Error saving language preference:', error);
      setSettings((current) => mergeAppSettings({
        ...current,
        preferences: {
          ...current.preferences,
          language: previousLanguage,
        },
      }));
      setErrorMessage(t('settings.errors.languageSaveFailed'));
      setShowErrorModal(true);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    await logout();
    (navigation as any).reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const handleChangeCommerceMode = async (mode: CommerceAdminSettings['monetizationMode']) => {
    if (!user?.uid || isUpdatingCommerceMode) return;

    try {
      setIsUpdatingCommerceMode(true);
      await updateCommerceMonetizationMode(user.uid, mode);
      await refreshCommerceState();
      Alert.alert(t('settings.commerce.updatedTitle'), t('settings.commerce.updatedMessage'));
    } catch (error) {
      console.error('Error updating commerce mode:', error);
      Alert.alert(t('settings.errors.commerceUpdateFailedTitle'), t('settings.errors.commerceUpdateFailedMessage'));
    } finally {
      setIsUpdatingCommerceMode(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      setShowDeleteModal(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      setShowDeleteModal(false);
      setErrorMessage(error.message || t('settings.errors.deleteAccountFailed'));
      setShowErrorModal(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSuccessClose = async () => {
    setShowSuccessModal(false);
    await logout();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' as never }],
    });
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
  );

  const SettingRow = ({
    icon,
    title,
    subtitle,
    value,
    onValueChange,
    onPress,
    showArrow,
    destructive,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    onPress?: () => void;
    showArrow?: boolean;
    destructive?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
      onPress={onPress}
      disabled={Boolean(!onPress && !onValueChange)}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[
        styles.rowIcon, 
        { backgroundColor: destructive ? colors.errorLight : colors.primaryBackground },
      ]}>
        <Ionicons
          name={icon as any}
          size={20}
          color={destructive ? colors.error : colors.primary}
        />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: destructive ? colors.error : colors.text }]}>
          {title}
        </Text>
        {subtitle && <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
      </View>
      {onValueChange !== undefined && value !== undefined && (
        <Switch
          value={Boolean(value)}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={value ? colors.primary : colors.white}
        />
      )}
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
      {/* Header with Back Button */}
      <View style={[styles.header, { backgroundColor: headerBackground, borderBottomColor: colors.border }]}> 
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Subscription Card */}
        <View style={styles.subscriptionSection}>
          {(() => {
            const status = getSubscriptionStatusDisplay(subscription);
            const planKey = (subscription?.plan as keyof typeof SUBSCRIPTION_PLANS) || 'free';
            const postExpiryDays = SUBSCRIPTION_PLANS[planKey]?.postExpiryDays ?? SUBSCRIPTION_PLANS.free.postExpiryDays;

            return (
              <>
                <View
                  style={[
                    styles.subscriptionCard,
                    subscription.plan !== 'free' && styles.subscriptionCardPremium,
                  ]}
                >
                  <View style={styles.subscriptionInfo}>
                    <Text style={styles.subscriptionPlan}>{status.planName}</Text>
                    <Text style={styles.subscriptionStatus}>{status.statusText}</Text>
                    {status.expiresText ? (
                      <Text style={styles.subscriptionExpires}>{status.expiresText}</Text>
                    ) : null}
                    {commerceStatus?.freeAccessEnabled ? (
                      <Text style={styles.subscriptionExpires}>ช่วงเปิดตัวใช้งานได้โดยไม่เสียค่าใช้จ่าย แต่มีโควตารายเดือนตามประเภทบัญชี</Text>
                    ) : null}
                  </View>
                  {subscription.plan === 'free' && commerceStatus?.billingProviderReady ? (
                    <TouchableOpacity
                      style={styles.upgradeBtn}
                      onPress={() => (navigation as any).navigate('Shop')}
                    >
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.upgradeBtnText}>{'อัปเกรด'}</Text>
                    </TouchableOpacity>
                  ) : subscription.plan !== 'free' ? (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                    </View>
                  ) : null}
                </View>

                <View style={styles.planDetails}>
                  <View style={styles.planDetailRow}>
                    <Text style={styles.planDetailLabel}>โพสต์ต่อวัน</Text>
                    <Text style={styles.planDetailValue}>{commerceStatus?.freeAccessEnabled ? 'ตามโควตารายเดือน' : subscription.plan === 'free' ? '2 ครั้ง' : 'ไม่จำกัด'}</Text>
                  </View>
                  <View style={styles.planDetailRow}>
                    <Text style={styles.planDetailLabel}>อายุโพสต์</Text>
                    <Text style={styles.planDetailValue}>{postExpiryDays} วัน</Text>
                  </View>
                </View>

                {commerceStatus?.freeAccessEnabled && launchQuotaSummary && (
                  <View style={styles.launchQuotaCard}>
                    <Text style={styles.launchQuotaTitle}>{launchQuotaSummary.title}</Text>
                    <Text style={styles.launchQuotaSubtitle}>{launchQuotaSummary.subtitle}</Text>
                    {launchQuotaSummary.items.map((item) => (
                      <View key={item.feature} style={styles.launchQuotaRow}>
                        <View style={styles.launchQuotaContent}>
                          <Text style={styles.launchQuotaLabel}>{item.label}</Text>
                          <Text style={styles.launchQuotaMeta}>{item.description}</Text>
                        </View>
                        <Text style={styles.launchQuotaStatus}>{item.statusText}</Text>
                      </View>
                    ))}
                    <Text style={styles.launchQuotaFootnote}>{launchQuotaSummary.footnote}</Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* Notifications */}
        <SectionHeader title={t('settings.sections.notifications')} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <SettingRow
            icon="notifications"
            title={t('settings.rows.pushNotificationsTitle')}
            subtitle={t('settings.rows.pushNotificationsSubtitle')}
            value={settings.notifications.pushEnabled}
            onValueChange={(v) => updateNotification('pushEnabled', v)}
          />
          <SettingRow
            icon="briefcase"
            title={t('settings.rows.newJobsTitle')}
            subtitle={t('settings.rows.newJobsSubtitle')}
            value={settings.notifications.newJobs}
            onValueChange={(v) => updateNotification('newJobs', v)}
          />
          <SettingRow
            icon="chatbubble"
            title={t('settings.rows.messagesTitle')}
            subtitle={t('settings.rows.messagesSubtitle')}
            value={settings.notifications.messages}
            onValueChange={(v) => updateNotification('messages', v)}
          />
          <SettingRow
            icon="document-text"
            title={t('settings.rows.applicationsTitle')}
            subtitle={t('settings.rows.applicationsSubtitle')}
            value={settings.notifications.applications}
            onValueChange={(v) => updateNotification('applications', v)}
          />
          <SettingRow
            icon="megaphone"
            title={t('settings.rows.marketingTitle')}
            subtitle={t('settings.rows.marketingSubtitle')}
            value={settings.notifications.marketing}
            onValueChange={(v) => updateNotification('marketing', v)}
          />
          <SettingRow
            icon="location"
            title={t('settings.rows.nearbyJobsTitle')}
            subtitle={t('settings.rows.nearbyJobsSubtitle')}
            onPress={() => (navigation as any).navigate('NearbyJobAlert')}
            showArrow
          />
        </View>

        {/* Privacy */}
        <SectionHeader title={t('settings.sections.privacy')} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="eye"
            title={t('settings.rows.publicProfileTitle')}
            subtitle={t('settings.rows.publicProfileSubtitle')}
            value={settings.privacy.profileVisible}
            onValueChange={(v) => updatePrivacy('profileVisible', v)}
          />
          <SettingRow
            icon="radio-button-on"
            title={t('settings.rows.onlineStatusTitle')}
            subtitle={t('settings.rows.onlineStatusSubtitle')}
            value={settings.privacy.showOnlineStatus}
            onValueChange={(v) => updatePrivacy('showOnlineStatus', v)}
          />
        </View>

        {/* Theme */}
        <SectionHeader title={t('settings.sections.appearance')} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="language"
            title={t('settings.language.title')}
            subtitle={languageSubtitle}
            onPress={() => setShowLanguageModal(true)}
            showArrow
          />
          <SettingRow
            icon="color-palette"
            title={t('settings.theme.title')}
            subtitle={themeMode === 'light' ? t('common.theme.light') : themeMode === 'dark' ? t('common.theme.dark') : t('common.theme.system')}
            onPress={() => setShowThemeModal(true)}
            showArrow
          />
        </View>

        {/* Support */}
        <SectionHeader title={t('settings.sections.support')} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {commerceStatus?.billingProviderReady && (
            <SettingRow
              icon="sparkles-outline"
              title={getCommerceEntryTitle(commerceStatus)}
              subtitle={getCommerceEntrySubtitle(commerceStatus)}
              onPress={() => (navigation as any).navigate('Shop')}
              showArrow
            />
          )}
          {onboardingSurveyEnabled ? (
            <SettingRow
              icon="sparkles"
              title={t('settings.rows.quickGuideTitle')}
              subtitle={t('settings.rows.quickGuideSubtitle')}
              onPress={() => (navigation as any).navigate('OnboardingSurvey')}
              showArrow
            />
          ) : null}
          <SettingRow
            icon="help-circle"
            title={t('settings.rows.faqTitle')}
            onPress={() => (navigation as any).navigate('Help')}
            showArrow
          />
          <SettingRow
            icon="chatbox-ellipses"
            title={t('settings.rows.feedbackTitle')}
            subtitle={t('settings.rows.feedbackSubtitle')}
            onPress={() => (navigation as any).navigate('Feedback')}
            showArrow
          />
          <SettingRow
            icon="mail"
            title={t('settings.rows.contactTitle')}
            subtitle="support@nursego.co"
            onPress={() => Linking.openURL('mailto:support@nursego.co')}
            showArrow
          />
        </View>

        {user?.role === 'admin' && (
          <>
            <SectionHeader title={t('settings.sections.adminCommerce')} />
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}> 
                <View style={[styles.rowIcon, { backgroundColor: colors.primaryBackground }]}> 
                  <Ionicons name="hardware-chip" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{t('settings.commerce.currentStatus')}</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}> 
                    {commerceStatus?.monetizationEnabled
                      ? t('settings.commerce.billingEnabled')
                      : commerceStatus?.transitionReviewRequired
                        ? t('settings.commerce.billingReviewPending')
                        : t('settings.commerce.billingFreePhase')}
                    {commerceStatus?.overrideMode === 'auto' ? ` • ${t('settings.commerce.modeAuto')}` : commerceStatus?.overrideMode === 'enabled' ? ` • ${t('settings.commerce.modeForcedOn')}` : ` • ${t('settings.commerce.modeForcedOff')}`}
                    {commerceStatus?.billingActivationBlocked ? ` • ${t('settings.commerce.billingUnavailable')}` : ''}
                  </Text>
                </View>
              </View>
              {([
                {
                  mode: 'auto',
                  title: t('settings.commerce.autoTitle'),
                  subtitle: t('settings.commerce.autoSubtitle'),
                },
                {
                  mode: 'disabled',
                  title: t('settings.commerce.disabledTitle'),
                  subtitle: t('settings.commerce.disabledSubtitle'),
                },
                {
                  mode: 'enabled',
                  title: t('settings.commerce.enabledTitle'),
                  subtitle: t('settings.commerce.enabledSubtitle'),
                },
              ] as const).map((option) => {
                const isSelected = commerceAdminSettings.monetizationMode === option.mode;
                const isDisabled = option.mode === 'enabled' && !(commerceStatus?.billingProviderReady);
                return (
                  <TouchableOpacity
                    key={option.mode}
                    style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
                    onPress={() => handleChangeCommerceMode(option.mode)}
                    disabled={isUpdatingCommerceMode || isDisabled}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: isSelected ? colors.primaryBackground : colors.backgroundSecondary }]}> 
                      <Ionicons
                        name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={isSelected ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowTitle, { color: colors.text }]}>{option.title}</Text>
                      <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                        {isDisabled ? t('settings.commerce.enabledBlocked') : option.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Legal */}
        <SectionHeader title={t('settings.sections.legal')} />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="document"
            title={t('settings.rows.termsTitle')}
            onPress={() => (navigation as any).navigate('Terms')}
            showArrow
          />
          <SettingRow
            icon="shield-checkmark"
            title={t('settings.rows.privacyTitle')}
            onPress={() => (navigation as any).navigate('Privacy')}
            showArrow
          />
        </View>

        {/* Account */}
        {user && (
          <>
            <SectionHeader title={t('settings.sections.account')} />
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SettingRow
                icon="log-out"
                title={t('settings.rows.logoutTitle')}
                onPress={handleLogout}
                destructive
              />
              <SettingRow
                icon="trash"
                title={t('settings.rows.deleteAccountTitle')}
                subtitle={t('settings.rows.deleteAccountSubtitle')}
                onPress={handleDeleteAccount}
                destructive
              />
            </View>
          </>
        )}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.primary }]}>NurseGo</Text>
          <Text style={[styles.appVersion, { color: colors.textSecondary }]}>{t('settings.appInfo.versionPrefix')} 1.0.0</Text>
          <Text style={[styles.copyright, { color: colors.textMuted }]}>© 2025 NurseGo Thailand</Text>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      {showLanguageModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModal, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.themeModalTitle, { color: colors.text }]}>{t('settings.language.pickerTitle')}</Text>

            {([
              { key: 'system', icon: 'phone-portrait-outline', label: t('common.language.system') },
              { key: 'th', icon: 'language-outline', label: t('common.language.thai') },
              { key: 'en', icon: 'globe-outline', label: t('common.language.english') },
            ] as const).map((option) => {
              const isSelected = languagePreference === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.themeOption,
                    { backgroundColor: colors.background },
                    isSelected && [styles.themeOptionSelected, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }],
                  ]}
                  onPress={() => handleLanguageSelection(option.key)}
                >
                  <Ionicons name={option.icon as any} size={24} color={isSelected ? colors.primary : colors.textSecondary} />
                  <Text
                    style={[
                      styles.themeOptionText,
                      { color: colors.text },
                      isSelected && styles.themeOptionTextSelected,
                    ]}
                  >
                    {option.key === 'system' ? `${option.label} (${resolvedLanguageLabel})` : option.label}
                  </Text>
                  {isSelected ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.themeModalClose}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={[styles.themeModalCloseText, { color: colors.textSecondary }]}>{t('settings.modals.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Theme Selection Modal */}
      {showThemeModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModal, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.themeModalTitle, { color: colors.text }]}>{t('common.theme.title')}</Text>

            <TouchableOpacity
              style={[
                styles.themeOption,
                { backgroundColor: colors.background },
                themeMode === 'light' && [styles.themeOptionSelected, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }],
              ]}
              onPress={() => {
                setThemeMode('light');
                setShowThemeModal(false);
              }}
            >
              <Ionicons name="sunny-outline" size={24} color={themeMode === 'light' ? colors.primary : colors.textSecondary} />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: colors.text },
                  themeMode === 'light' && styles.themeOptionTextSelected,
                ]}
              >
                {t('common.theme.light')}
              </Text>
              {themeMode === 'light' ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                { backgroundColor: colors.background },
                themeMode === 'dark' && [styles.themeOptionSelected, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }],
              ]}
              onPress={() => {
                setThemeMode('dark');
                setShowThemeModal(false);
              }}
            >
              <Ionicons name="moon-outline" size={24} color={themeMode === 'dark' ? colors.primary : colors.textSecondary} />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: colors.text },
                  themeMode === 'dark' && styles.themeOptionTextSelected,
                ]}
              >
                {t('common.theme.dark')}
              </Text>
              {themeMode === 'dark' ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                { backgroundColor: colors.background },
                themeMode === 'system' && [styles.themeOptionSelected, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }],
              ]}
              onPress={() => {
                setThemeMode('system');
                setShowThemeModal(false);
              }}
            >
              <Ionicons name="phone-portrait-outline" size={24} color={themeMode === 'system' ? colors.primary : colors.textSecondary} />
              <Text
                style={[
                  styles.themeOptionText,
                  { color: colors.text },
                  themeMode === 'system' && styles.themeOptionTextSelected,
                ]}
              >
                {t('common.theme.system')}
              </Text>
              {themeMode === 'system' ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.themeModalClose}
              onPress={() => setShowThemeModal(false)}
            >
              <Text style={[styles.themeModalCloseText, { color: colors.textSecondary }]}>{t('settings.modals.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Logout Confirm Modal */}
      <ConfirmModal
        visible={showLogoutModal}
        title={t('settings.modals.logoutTitle')}
        message={t('settings.modals.logoutMessage')}
        confirmText={t('common.actions.logout')}
        cancelText={t('common.actions.cancel')}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
        type="warning"
      />

      {/* Delete Account Confirm Modal */}
      <ConfirmModal
        visible={showDeleteModal}
        title={t('settings.modals.deleteAccountTitle')}
        message={t('settings.modals.deleteAccountMessage')}
        confirmText={isDeleting ? t('settings.modals.deleteAccountLoading') : t('settings.modals.deleteAccountConfirm')}
        cancelText={t('common.actions.cancel')}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title="สำเร็จ"
        message="ลบบัญชีเรียบร้อยแล้ว"
        onClose={handleSuccessClose}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title="เกิดข้อผิดพลาด"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  sectionHeader: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.sm,
  },
  section: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: COLORS.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  rowIconDestructive: {
    backgroundColor: COLORS.errorLight,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  rowTitleDestructive: {
    color: COLORS.error,
  },
  rowSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  appInfo: {
    alignItems: 'center',
    padding: SPACING.xl,
    paddingBottom: 100,
  },
  appName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  appVersion: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.xs,
  },
  backIcon: {
    fontSize: FONT_SIZES.xl,
    color: COLORS.primary,
    marginRight: SPACING.xs,
  },
  backText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  copyright: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  quickActionSection: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.md,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  quickActionSubtitle: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },

  // Subscription Styles
  subscriptionSection: {
    padding: SPACING.md,
    paddingBottom: 0,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subscriptionCardPremium: {
    backgroundColor: '#1a1a2e',
    borderColor: '#FFD700',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionPlan: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  subscriptionStatus: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subscriptionExpires: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: 6,
  },
  upgradeBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#FFF',
  },
  premiumBadge: {
    padding: SPACING.xs,
  },
  planDetails: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  planDetailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  planDetailValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  launchQuotaCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  launchQuotaTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  launchQuotaSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  launchQuotaRow: {
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  launchQuotaContent: {
    marginBottom: 4,
  },
  launchQuotaLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  launchQuotaMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  launchQuotaStatus: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    lineHeight: 18,
  },
  launchQuotaFootnote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  
  // Theme Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  themeModal: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    width: '80%',
    maxWidth: 320,
    ...SHADOWS.medium,
  },
  themeModalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  themeOptionSelected: {
    backgroundColor: COLORS.primaryBackground,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  themeOptionText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginLeft: SPACING.md,
  },
  themeOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  themeModalClose: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  themeModalCloseText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
});
