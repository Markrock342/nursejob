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
import { getLaunchQuotaSummary, getUserSubscription, getSubscriptionStatusDisplay, LaunchQuotaSummary, upgradeToPremium } from '../../services/subscriptionService';
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

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, logout, updateUser } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
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

  useEffect(() => {
    void loadSettings();
    void loadSubscription();
  }, [user?.uid, themeMode]);

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
      setErrorMessage('บันทึกการตั้งค่าการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
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
        setErrorMessage('บันทึกค่าความเป็นส่วนตัวไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        setShowErrorModal(true);
      }
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
      Alert.alert('อัปเดตแล้ว', 'บันทึกโหมดการเปิดชำระเงินเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error updating commerce mode:', error);
      Alert.alert('อัปเดตไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
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
      setErrorMessage(error.message || 'ไม่สามารถลบบัญชีได้ กรุณาลองใหม่');
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>ตั้งค่า</Text>
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
                  {subscription.plan === 'free' ? (
                    <TouchableOpacity
                      style={styles.upgradeBtn}
                      onPress={() => (navigation as any).navigate('Shop')}
                    >
                      <Ionicons name="star" size={16} color="#FFD700" />
                      <Text style={styles.upgradeBtnText}>{commerceStatus?.freeAccessEnabled ? 'ดูสิทธิ์ที่พร้อมใช้' : 'อัปเกรด'}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.premiumBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                    </View>
                  )}
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
        <SectionHeader title="การแจ้งเตือน" />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <SettingRow
            icon="notifications"
            title="การแจ้งเตือน Push"
            subtitle="เปิด/ปิดการแจ้งเตือนทั้งหมด"
            value={settings.notifications.pushEnabled}
            onValueChange={(v) => updateNotification('pushEnabled', v)}
          />
          <SettingRow
            icon="briefcase"
            title="งานใหม่"
            subtitle="แจ้งเตือนเมื่อมีงานที่ตรงกับความสนใจ"
            value={settings.notifications.newJobs}
            onValueChange={(v) => updateNotification('newJobs', v)}
          />
          <SettingRow
            icon="chatbubble"
            title="ข้อความ"
            subtitle="แจ้งเตือนเมื่อได้รับข้อความใหม่"
            value={settings.notifications.messages}
            onValueChange={(v) => updateNotification('messages', v)}
          />
          <SettingRow
            icon="document-text"
            title="สถานะการสมัคร"
            subtitle="แจ้งเตือนเมื่อมีการอัปเดตใบสมัคร"
            value={settings.notifications.applications}
            onValueChange={(v) => updateNotification('applications', v)}
          />
          <SettingRow
            icon="megaphone"
            title="โปรโมชั่น"
            subtitle="รับข่าวสารและโปรโมชัน"
            value={settings.notifications.marketing}
            onValueChange={(v) => updateNotification('marketing', v)}
          />
          <SettingRow
            icon="location"
            title="งานใกล้คุณ"
            subtitle="รับแจ้งเตือนงานใกล้คุณได้รวดเร็วตามรัศมีที่ตั้งไว้"
            onPress={() => (navigation as any).navigate('NearbyJobAlert')}
            showArrow
          />
        </View>

        {/* Privacy */}
        <SectionHeader title="ความเป็นส่วนตัว" />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="eye"
            title="โปรไฟล์สาธารณะ"
            subtitle="อนุญาตให้โรงพยาบาลดูโปรไฟล์ของคุณ"
            value={settings.privacy.profileVisible}
            onValueChange={(v) => updatePrivacy('profileVisible', v)}
          />
          <SettingRow
            icon="radio-button-on"
            title="แสดงสถานะออนไลน์"
            subtitle="ให้ผู้อื่นเห็นว่าคุณออนไลน์อยู่"
            value={settings.privacy.showOnlineStatus}
            onValueChange={(v) => updatePrivacy('showOnlineStatus', v)}
          />
        </View>

        {/* Theme */}
        <SectionHeader title="ธีมและการแสดงผล" />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="color-palette"
            title="ธีม"
            subtitle={themeMode === 'light' ? 'สว่าง' : themeMode === 'dark' ? 'มืด' : 'ตามระบบ'}
            onPress={() => setShowThemeModal(true)}
            showArrow
          />
        </View>

        {/* Support */}
        <SectionHeader title="ช่วยเหลือและสนับสนุน" />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="sparkles-outline"
            title={getCommerceEntryTitle(commerceStatus)}
            subtitle={getCommerceEntrySubtitle(commerceStatus)}
            onPress={() => (navigation as any).navigate('Shop')}
            showArrow
          />
          {onboardingSurveyEnabled ? (
            <SettingRow
              icon="sparkles"
              title="คู่มือใช้งานแบบเร็ว"
              subtitle="ดูภาพรวมฟีเจอร์สำคัญและขั้นตอนใช้งานที่ช่วยให้ใช้งานได้คล่องขึ้น"
              onPress={() => (navigation as any).navigate('OnboardingSurvey')}
              showArrow
            />
          ) : null}
          <SettingRow
            icon="help-circle"
            title="คำถามที่พบบ่อย"
            onPress={() => (navigation as any).navigate('Help')}
            showArrow
          />
          <SettingRow
            icon="chatbox-ellipses"
            title="ส่ง Feedback / รีวิว"
            subtitle="บอกเราว่าคุณคิดอย่างไร"
            onPress={() => (navigation as any).navigate('Feedback')}
            showArrow
          />
          <SettingRow
            icon="mail"
            title="ติดต่อเรา"
            subtitle="support@nursego.co"
            onPress={() => Linking.openURL('mailto:support@nursego.co')}
            showArrow
          />
        </View>

        {user?.role === 'admin' && (
          <>
            <SectionHeader title="ผู้ดูแลระบบ: การเปิดชำระเงิน" />
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}> 
                <View style={[styles.rowIcon, { backgroundColor: colors.primaryBackground }]}> 
                  <Ionicons name="hardware-chip" size={20} color={colors.primary} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>สถานะปัจจุบัน</Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}> 
                    {commerceStatus?.monetizationEnabled
                      ? 'เปิดระบบชำระเงินจริง'
                      : commerceStatus?.transitionReviewRequired
                        ? 'ถึงเกณฑ์ทบทวนและรออนุมัติ'
                        : 'ช่วงใช้ฟรี'}
                    {commerceStatus?.overrideMode === 'auto' ? ' • อัตโนมัติ' : commerceStatus?.overrideMode === 'enabled' ? ' • บังคับเปิด' : ' • บังคับปิด'}
                    {commerceStatus?.billingActivationBlocked ? ' • ระบบชำระเงินยังไม่พร้อม' : ''}
                  </Text>
                </View>
              </View>
              {([
                {
                  mode: 'auto',
                  title: 'อัตโนมัติตามเงื่อนไขระบบ',
                  subtitle: 'ใช้ฟรีต่อ และให้ระบบเตือนเมื่อถึงเวลาทบทวนการเปิดชำระเงิน',
                },
                {
                  mode: 'disabled',
                  title: 'บังคับใช้ฟรีต่อ',
                  subtitle: 'ยังไม่เปิดชำระเงินจริง แม้ระบบจะถึงเงื่อนไขแล้ว',
                },
                {
                  mode: 'enabled',
                  title: 'บังคับเปิดชำระเงิน',
                  subtitle: 'เปิดใช้ได้ต่อเมื่อระบบชำระเงินพร้อมใช้งานแล้ว',
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
                        {isDisabled ? 'ยังใช้งานไม่ได้จนกว่าช่องทางชำระเงินจริงจะพร้อมใช้งาน' : option.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Legal */}
        <SectionHeader title="ข้อมูลทางกฎหมาย" />
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingRow
            icon="document"
            title="เงื่อนไขการใช้งาน"
            onPress={() => (navigation as any).navigate('Terms')}
            showArrow
          />
          <SettingRow
            icon="shield-checkmark"
            title="นโยบายความเป็นส่วนตัว"
            onPress={() => (navigation as any).navigate('Privacy')}
            showArrow
          />
        </View>

        {/* Account */}
        {user && (
          <>
            <SectionHeader title="บัญชี" />
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SettingRow
                icon="log-out"
                title="ออกจากระบบ"
                onPress={handleLogout}
                destructive
              />
              <SettingRow
                icon="trash"
                title="ลบบัญชี"
                subtitle="ลบข้อมูลทั้งหมดอย่างถาวร"
                onPress={handleDeleteAccount}
                destructive
              />
            </View>
          </>
        )}

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={[styles.appName, { color: colors.primary }]}>NurseGo</Text>
          <Text style={[styles.appVersion, { color: colors.textSecondary }]}>เวอร์ชัน 1.0.0</Text>
          <Text style={[styles.copyright, { color: colors.textMuted }]}>© 2025 NurseGo Thailand</Text>
        </View>
      </ScrollView>

      {/* Theme Selection Modal */}
      {showThemeModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModal, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.themeModalTitle, { color: colors.text }]}>เลือกธีม</Text>

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
                สว่าง
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
                มืด
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
                ตามระบบ
              </Text>
              {themeMode === 'system' ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.themeModalClose}
              onPress={() => setShowThemeModal(false)}
            >
              <Text style={[styles.themeModalCloseText, { color: colors.textSecondary }]}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Logout Confirm Modal */}
      <ConfirmModal
        visible={showLogoutModal}
        title="ออกจากระบบ"
        message="คุณต้องการออกจากระบบหรือไม่?"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
        type="warning"
      />

      {/* Delete Account Confirm Modal */}
      <ConfirmModal
        visible={showDeleteModal}
        title="ลบบัญชี"
        message="การดำเนินการนี้ไม่สามารถย้อนกลับได้ ข้อมูลทั้งหมดจะถูกลบอย่างถาวร คุณแน่ใจหรือไม่?"
        confirmText={isDeleting ? 'กำลังลบ...' : 'ลบบัญชี'}
        cancelText="ยกเลิก"
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
