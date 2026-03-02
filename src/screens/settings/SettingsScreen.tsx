// ============================================
// SETTINGS SCREEN - Production Ready
// ============================================

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme, ThemeMode } from '../../context/ThemeContext';
import { deleteUserAccount, updateUserPrivacy } from '../../services/authService';
import { getUserSubscription, getSubscriptionStatusDisplay, upgradeToPremium } from '../../services/subscriptionService';
import { Subscription, SUBSCRIPTION_PLANS } from '../../types';
import { ConfirmModal, SuccessModal, ErrorModal } from '../../components/common';

interface Settings {
  notifications: {
    pushEnabled: boolean;
    newJobs: boolean;
    messages: boolean;
    applications: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showOnlineStatus: boolean;
  };
  preferences: {
    language: 'th' | 'en';
    theme: 'light' | 'dark' | 'system';
  };
}

const defaultSettings: Settings = {
  notifications: {
    pushEnabled: true,
    newJobs: true,
    messages: true,
    applications: true,
    marketing: false,
  },
  privacy: {
    profileVisible: true,
    showOnlineStatus: true,
  },
  preferences: {
    language: 'th',
    theme: 'light',
  },
};

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { themeMode, setThemeMode, colors, isDark } = useTheme();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  
  // Subscription state
  const [subscription, setSubscription] = useState<Subscription>({ plan: 'free' });
  
  // Modal states
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    if (!user?.uid) return;
    const sub = await getUserSubscription(user.uid);
    setSubscription(sub);
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('settings');
      if (saved) {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const updateNotification = (key: keyof Settings['notifications'], value: boolean) => {
    const newSettings = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    };
    saveSettings(newSettings);
  };

  const updatePrivacy = async (key: keyof Settings['privacy'], value: boolean) => {
    const newSettings = {
      ...settings,
      privacy: { ...settings.privacy, [key]: value },
    };
    saveSettings(newSettings);
    
    // บันทึกไป Firestore ด้วย
    if (user?.uid) {
      try {
        await updateUserPrivacy(user.uid, {
          profileVisible: newSettings.privacy.profileVisible,
          showOnlineStatus: newSettings.privacy.showOnlineStatus,
        });
      } catch (error) {
        console.error('Error saving privacy to Firestore:', error);
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header with Back Button */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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
            return (
              <View style={[
                styles.subscriptionCard,
                subscription.plan === 'premium' && styles.subscriptionCardPremium
              ]}>
                <View style={styles.subscriptionInfo}>
                  <Text style={styles.subscriptionPlan}>{status.planName}</Text>
                  <Text style={styles.subscriptionStatus}>{status.statusText}</Text>
                  {status.expiresText && (
                    <Text style={styles.subscriptionExpires}>{status.expiresText}</Text>
                  )}
                </View>
                {subscription.plan === 'free' ? (
                  <TouchableOpacity
                    style={styles.upgradeBtn}
                    onPress={() => {
                      Alert.alert(
                        '👑 อัพเกรดเป็น Premium',
                        '฿199/เดือน\n\n✓ โพสต์ได้ไม่จำกัด\n✓ โพสต์อยู่ 30 วัน\n✓ ไม่มีโฆษณา',
                        [
                          { text: 'ยกเลิก', style: 'cancel' },
                          { 
                            text: 'อัพเกรด', 
                            onPress: () => {
                              Alert.alert('💳 ชำระเงิน', 'ระบบชำระเงินกำลังพัฒนา\nติดต่อ admin เพื่ออัพเกรด');
                            }
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.upgradeBtnText}>อัพเกรด</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                  </View>
                )}
              </View>
            );
          })()}
          
          {/* Plan Details */}
            <View style={styles.planDetails}>
            <View style={styles.planDetailRow}>
              <Text style={styles.planDetailLabel}>โพสต์ต่อวัน</Text>
              <Text style={styles.planDetailValue}>
                {subscription.plan === 'premium' ? 'ไม่จำกัด' : '2 ครั้ง'}
              </Text>
            </View>
            <View style={styles.planDetailRow}>
              <Text style={styles.planDetailLabel}>อายุโพสต์</Text>
                <Text style={styles.planDetailValue}>
                  {(() => {
                    const planKey = (subscription?.plan as keyof typeof SUBSCRIPTION_PLANS) || 'free';
                    return SUBSCRIPTION_PLANS[planKey]?.postExpiryDays ?? SUBSCRIPTION_PLANS.free.postExpiryDays;
                  })()} วัน
                </Text>
            </View>
          </View>
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
            subtitle="แจ้งเตือนเมื่อมีการอัพเดทใบสมัคร"
            value={settings.notifications.applications}
            onValueChange={(v) => updateNotification('applications', v)}
          />
          <SettingRow
            icon="megaphone"
            title="โปรโมชั่น"
            subtitle="รับข่าวสารและโปรโมชั่น"
            value={settings.notifications.marketing}
            onValueChange={(v) => updateNotification('marketing', v)}
          />
          <SettingRow
            icon="location"
            title="งานใกล้ฉัน"
            subtitle="แจ้งเตือนเมื่อมีคนโพสต์งานในรัศมีที่กำหนด"
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
            subtitle="support@nursego.app"
            onPress={() => Linking.openURL('mailto:support@nursego.app')}
            showArrow
          />
        </View>

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
              <Ionicons name="sunny" size={24} color={themeMode === 'light' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.themeOptionText,
                { color: colors.text },
                themeMode === 'light' && { color: colors.primary },
              ]}>
                สว่าง
              </Text>
              {themeMode === 'light' && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
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
              <Ionicons name="moon" size={24} color={themeMode === 'dark' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.themeOptionText,
                { color: colors.text },
                themeMode === 'dark' && { color: colors.primary },
              ]}>
                มืด
              </Text>
              {themeMode === 'dark' && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
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
              <Ionicons name="phone-portrait" size={24} color={themeMode === 'system' ? colors.primary : colors.textSecondary} />
              <Text style={[
                styles.themeOptionText,
                { color: colors.text },
                themeMode === 'system' && { color: colors.primary },
              ]}>
                ตามระบบ
              </Text>
              {themeMode === 'system' && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
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

const styles = StyleSheet.create({
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

  // Subscription Styles
  subscriptionSection: {
    padding: SPACING.md,
    paddingBottom: 0,
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
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
