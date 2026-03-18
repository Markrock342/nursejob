// ============================================
// ADMIN DASHBOARD - ศูนย์ควบคุมระบบ NurseGo
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Keyboard,
  Modal,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  BillingCycle,
  CampaignCode,
  CampaignCodeBenefitType,
  CampaignCodePackage,
  CampaignCodeRole,
  RootStackParamList,
  SubscriptionPlan,
  SubscriptionUsageFeature,
  UserAdminTag,
} from '../../types';
import {
  AdminBulkRoleResetResult,
  archiveBroadcastTemplate,
  bulkResetAccessUsageByRole,
  closePostsAndSuspendUserPosting,
  deleteScheduledBroadcastCampaign,
  getDashboardStats,
  getConversationsPage,
  getJobsPage,
  getUsersPage,
  searchUsers,
  updateUserStatus,
  verifyUser,
  updateUserRole,
  deleteUser,
  updateUserModeration,
  updateUserAccessRights,
  updateJobStatus,
  deleteJob,
  deleteConversation,
  resetUserAccessUsage,
  DashboardStats,
  AdminUser,
  AdminJob,
  AdminConversation,
  ExecutiveAnalyticsSummary,
  getExecutiveAnalyticsSummary,
  getRetentionMonitor,
  getBroadcastHistory,
  getBroadcastAnalytics,
  getFraudAlertCenter,
  listBroadcastTemplates,
  listScheduledBroadcastCampaigns,
  previewBroadcastAudience,
  recordBroadcastOpen,
  runCommunicationAutomation,
  runOperationalAction,
  saveBroadcastTemplate,
  scheduleBroadcastCampaign,
  sendBroadcastNotification,
  updateFraudAlertFlagStatus,
  updateFraudControls,
  AdminBroadcastPreviewResult,
  BroadcastAnalyticsSummary,
  BroadcastTemplateItem,
  FraudAlertCenterResult,
  RetentionMonitorSummary,
  ScheduledBroadcastCampaign,
} from '../../services/adminService';
import {
  CAMPAIGN_PACKAGE_OPTIONS,
  createCampaignCode,
  deleteCampaignCode,
  generateCampaignCode,
  getCampaignBenefitSummary,
  getCampaignPackageLabel,
  getAllCampaignCodes,
  normalizeCampaignCode,
  setCampaignCodeActive,
  updateCampaignCode,
} from '../../services/campaignCodeService';
import { getLaunchUsageLimitForRole } from '../../services/subscriptionService';
import {
  StickyAnnouncement,
  getStickyAnnouncementsAdmin,
  removeStickyAnnouncement,
  subscribeStickyAnnouncementsAdmin,
  toggleStickyAnnouncementActive,
  upsertStickyAnnouncement,
} from '../../services/announcementsService';
import { ALL_PROVINCES, POPULAR_PROVINCES, PROVINCES_BY_REGION, REGIONS } from '../../constants/locations';
import { COMMERCE_CONFIG, CommerceAccessStatus, getCommerceAccessStatus } from '../../services/commerceService';
import {
  OnboardingSurveyAdminSettings,
  getOnboardingSurveyAdminSettings,
  updateOnboardingSurveyEnabled,
} from '../../services/onboardingSurveyService';
import { Avatar } from '../../components/common';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Tab Type
// ============================================
type TabKey = 'overview' | 'traffic' | 'users' | 'jobs' | 'chats' | 'broadcast' | 'codes';

interface CodeFormState {
  code: string;
  title: string;
  description: string;
  benefitType: CampaignCodeBenefitType;
  benefitValue: string;
  maxUses: string;
  minSpend: string;
  expiresAt: string;
  allowedRoles: CampaignCodeRole[];
  allowedPackages: CampaignCodePackage[];
  firstPurchaseOnly: boolean;
  isActive: boolean;
}

const INITIAL_CODE_FORM: CodeFormState = {
  code: '',
  title: '',
  description: '',
  benefitType: 'percent_discount',
  benefitValue: '',
  maxUses: '',
  minSpend: '',
  expiresAt: '',
  allowedRoles: ['user', 'nurse', 'hospital'],
  allowedPackages: CAMPAIGN_PACKAGE_OPTIONS.map((item) => item.key),
  firstPurchaseOnly: false,
  isActive: true,
};

const CAMPAIGN_BENEFIT_OPTIONS: Array<{ key: CampaignCodeBenefitType; label: string; hint: string }> = [
  { key: 'percent_discount', label: 'ลด %', hint: 'เช่น ลด 10%' },
  { key: 'fixed_discount', label: 'ลดบาท', hint: 'เช่น ลด 50 บาท' },
  { key: 'free_urgent', label: 'ฟรีปุ่มด่วน', hint: 'ให้ใช้ฟรีปุ่มด่วน' },
  { key: 'free_post', label: 'ฟรีโพสต์', hint: 'ให้สิทธิ์โพสต์ฟรี' },
  { key: 'bonus_days', label: 'เพิ่มวันประกาศ', hint: 'เช่น +7 วัน' },
];

const CAMPAIGN_ROLE_OPTIONS: Array<{ key: CampaignCodeRole; label: string }> = [
  { key: 'user', label: 'ผู้ใช้ทั่วไป' },
  { key: 'nurse', label: 'พยาบาล' },
  { key: 'hospital', label: 'โรงพยาบาล' },
  { key: 'admin', label: 'ผู้ดูแลระบบ' },
];

const CAMPAIGN_PACKAGE_GROUPS: Array<{
  key: string;
  label: string;
  audiences: Array<'user' | 'nurse' | 'hospital' | 'both'>;
}> = [
  { key: 'user', label: 'แพ็กเกจผู้ใช้ทั่วไป', audiences: ['user'] },
  { key: 'nurse', label: 'แพ็กเกจพยาบาล', audiences: ['nurse'] },
  { key: 'hospital', label: 'แพ็กเกจโรงพยาบาล', audiences: ['hospital'] },
  { key: 'addons', label: 'บริการเสริม', audiences: ['both'] },
];

const USER_ADMIN_TAG_OPTIONS: UserAdminTag[] = ['RN', 'PN', 'NA', 'ANES', 'CLINIC', 'AGENCY'];
const ACCESS_USAGE_FEATURES: Array<{ key: SubscriptionUsageFeature; label: string }> = [
  { key: 'post_create', label: 'ลงประกาศ' },
  { key: 'job_application', label: 'สมัครงาน' },
  { key: 'chat_start', label: 'เริ่มแชต' },
  { key: 'urgent_post', label: 'ป้ายด่วน' },
  { key: 'extend_post', label: 'ต่ออายุโพสต์' },
  { key: 'boost_post', label: 'ดันโพสต์' },
];

const ROLE_PLAN_OPTIONS: Record<'user' | 'nurse' | 'hospital' | 'admin', SubscriptionPlan[]> = {
  user: ['free', 'premium'],
  nurse: ['free', 'premium', 'nurse_pro'],
  hospital: ['free', 'hospital_starter', 'hospital_pro', 'hospital_enterprise'],
  admin: ['free', 'hospital_starter', 'hospital_pro', 'hospital_enterprise'],
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: 'Free',
  premium: 'Premium',
  nurse_pro: 'Nurse Pro',
  hospital_starter: 'Starter',
  hospital_pro: 'Hospital Pro',
  hospital_enterprise: 'Enterprise',
};

const BILLING_OPTIONS: BillingCycle[] = ['monthly', 'annual'];

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'ภาพรวม', icon: 'grid-outline' },
  { key: 'traffic', label: 'พื้นที่/ทราฟฟิก', icon: 'pulse-outline' },
  { key: 'users', label: 'สมาชิก', icon: 'people-outline' },
  { key: 'jobs', label: 'งาน', icon: 'briefcase-outline' },
  { key: 'chats', label: 'ข้อความ', icon: 'chatbubbles-outline' },
  { key: 'broadcast', label: 'สื่อสาร', icon: 'megaphone-outline' },
  { key: 'codes', label: 'สิทธิพิเศษ', icon: 'pricetags-outline' },
];

function formatAnalyticsPercent(value?: number | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-';
  return `${Math.round(value * 100)}%`;
}

function getFeatureRecommendationTone(recommendation: 'price_candidate' | 'retain_and_optimize' | 'review_for_removal' | 'watchlist') {
  switch (recommendation) {
    case 'price_candidate':
      return {
        badge: styles.analyticsCheckStatusWarn,
        text: styles.analyticsCheckStatusTextWarn,
      };
    case 'retain_and_optimize':
      return {
        badge: styles.analyticsCheckStatusPass,
        text: styles.analyticsCheckStatusTextPass,
      };
    case 'review_for_removal':
      return {
        badge: styles.featureUsageBadgeMuted,
        text: styles.featureUsageBadgeMutedText,
      };
    default:
      return {
        badge: styles.featureUsageBadgeNeutral,
        text: styles.featureUsageBadgeNeutralText,
      };
  }
}

const ADMIN_PREVIEW_PAGE_SIZE = 12;
const ADMIN_TRAFFIC_PAGE_SIZE = 120;
const ADMIN_USERS_PAGE_SIZE = 30;
const ADMIN_JOBS_PAGE_SIZE = 30;
const ADMIN_CHATS_PAGE_SIZE = 30;

// ============================================
// MAIN COMPONENT
// ============================================
export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { user: adminUser } = useAuth();

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [analyticsSummary, setAnalyticsSummary] = useState<ExecutiveAnalyticsSummary | null>(null);
  const [retentionMonitor, setRetentionMonitor] = useState<RetentionMonitorSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [userListItems, setUserListItems] = useState<AdminUser[]>([]);
  const [jobListItems, setJobListItems] = useState<AdminJob[]>([]);
  const [chatListItems, setChatListItems] = useState<AdminConversation[]>([]);
  const [codes, setCodes] = useState<CampaignCode[]>([]);
  const [commerceStatus, setCommerceStatus] = useState<CommerceAccessStatus | null>(null);
  const [onboardingSurveySettings, setOnboardingSurveySettings] = useState<OnboardingSurveyAdminSettings>({ surveyEnabled: true });
  const [broadcastHistory, setBroadcastHistory] = useState<Awaited<ReturnType<typeof getBroadcastHistory>>>([]);
  const [stickyAnnouncementItems, setStickyAnnouncementItems] = useState<StickyAnnouncement[]>([]);
  const [usersTabLoading, setUsersTabLoading] = useState(false);
  const [jobsTabLoading, setJobsTabLoading] = useState(false);
  const [chatsTabLoading, setChatsTabLoading] = useState(false);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [usersTabHasMore, setUsersTabHasMore] = useState(false);
  const [jobsTabHasMore, setJobsTabHasMore] = useState(false);
  const [chatsTabHasMore, setChatsTabHasMore] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<AdminUser[] | null>(null);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('all');
  const [jobProvinceFilter, setJobProvinceFilter] = useState<string>('all');
  const [trafficProvinceFilter, setTrafficProvinceFilter] = useState<string>('all');
  const [trafficTimeFilter, setTrafficTimeFilter] = useState<string>('all');
  const [codeSearch, setCodeSearch] = useState('');
  const [codeStatusFilter, setCodeStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastType, setBroadcastType] = useState<'system' | 'promotion'>('system');
  const [broadcastTargetRole, setBroadcastTargetRole] = useState<'all' | 'user' | 'nurse' | 'hospital' | 'admin'>('all');
  const [broadcastProvinceSearch, setBroadcastProvinceSearch] = useState('');
  const [broadcastTargetProvinces, setBroadcastTargetProvinces] = useState<string[]>([]);
  const [broadcastSelectedRegions, setBroadcastSelectedRegions] = useState<string[]>([]);
  const [broadcastOnlyVerified, setBroadcastOnlyVerified] = useState(false);
  const [broadcastActiveOnly, setBroadcastActiveOnly] = useState(true);
  const [broadcastTargetStaffTypes, setBroadcastTargetStaffTypes] = useState<string[]>([]);
  const [broadcastActiveWithinDays, setBroadcastActiveWithinDays] = useState('');
  const [broadcastNeverPosted, setBroadcastNeverPosted] = useState(false);
  const [broadcastTargetScreen, setBroadcastTargetScreen] = useState('');
  const [broadcastCampaignName, setBroadcastCampaignName] = useState('');
  const [broadcastScheduleAt, setBroadcastScheduleAt] = useState('');
  const [broadcastTemplateName, setBroadcastTemplateName] = useState('');
  const [broadcastAbEnabled, setBroadcastAbEnabled] = useState(false);
  const [broadcastVariantATitle, setBroadcastVariantATitle] = useState('');
  const [broadcastVariantABody, setBroadcastVariantABody] = useState('');
  const [broadcastVariantBTitle, setBroadcastVariantBTitle] = useState('');
  const [broadcastVariantBBody, setBroadcastVariantBBody] = useState('');
  const [previewingBroadcast, setPreviewingBroadcast] = useState(false);
  const [broadcastPreview, setBroadcastPreview] = useState<AdminBroadcastPreviewResult | null>(null);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [schedulingBroadcast, setSchedulingBroadcast] = useState(false);
  const [templates, setTemplates] = useState<BroadcastTemplateItem[]>([]);
  const [scheduledCampaigns, setScheduledCampaigns] = useState<ScheduledBroadcastCampaign[]>([]);
  const [selectedBroadcastAnalytics, setSelectedBroadcastAnalytics] = useState<BroadcastAnalyticsSummary | null>(null);
  const [loadingBroadcastAnalyticsId, setLoadingBroadcastAnalyticsId] = useState<string | null>(null);
  const [fraudCenter, setFraudCenter] = useState<FraudAlertCenterResult | null>(null);
  const [fraudKeywordInput, setFraudKeywordInput] = useState('');
  const [fraudWarningTitle, setFraudWarningTitle] = useState('');
  const [fraudWarningBody, setFraudWarningBody] = useState('');
  const [savingFraudControls, setSavingFraudControls] = useState(false);
  const [templateActionId, setTemplateActionId] = useState<string | null>(null);
  const [scheduledActionId, setScheduledActionId] = useState<string | null>(null);
  const [fraudFlagActionId, setFraudFlagActionId] = useState<string | null>(null);
  const [runningAutomationKey, setRunningAutomationKey] = useState<string | null>(null);
  const [runningActionKey, setRunningActionKey] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState<StickyAnnouncement>({
    id: '',
    title: '',
    body: '',
    severity: 'info',
    isActive: true,
    isPinned: true,
    targetScreens: ['all'],
    startsAt: null,
    endsAt: null,
  });
  const [announcementStartsAtInput, setAnnouncementStartsAtInput] = useState('');
  const [announcementEndsAtInput, setAnnouncementEndsAtInput] = useState('');
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [updatingOnboardingSurvey, setUpdatingOnboardingSurvey] = useState(false);

  // Modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [jobModalVisible, setJobModalVisible] = useState(false);
  const [selectedCode, setSelectedCode] = useState<CampaignCode | null>(null);
  const [codeModalVisible, setCodeModalVisible] = useState(false);
  const [codeForm, setCodeForm] = useState<CodeFormState>(INITIAL_CODE_FORM);
  const [savingCode, setSavingCode] = useState(false);
  const [moderationTagsDraft, setModerationTagsDraft] = useState<UserAdminTag[]>([]);
  const [warningTagDraft, setWarningTagDraft] = useState('');
  const [postingSuspendReasonDraft, setPostingSuspendReasonDraft] = useState('');
  const [savingModeration, setSavingModeration] = useState(false);
  const [accessPlanDraft, setAccessPlanDraft] = useState<SubscriptionPlan>('free');
  const [billingCycleDraft, setBillingCycleDraft] = useState<BillingCycle>('monthly');
  const [accessExpiresAtDraft, setAccessExpiresAtDraft] = useState('');
  const [postsTodayDraft, setPostsTodayDraft] = useState('0');
  const [freeUrgentUsedDraft, setFreeUrgentUsedDraft] = useState(false);
  const [usageDraft, setUsageDraft] = useState<Record<SubscriptionUsageFeature, string>>({
    post_create: '0',
    job_application: '0',
    chat_start: '0',
    urgent_post: '0',
    extend_post: '0',
    boost_post: '0',
  });
  const [savingAccessRights, setSavingAccessRights] = useState(false);
  const [resettingAccessRights, setResettingAccessRights] = useState(false);
  const [bulkRoleResetting, setBulkRoleResetting] = useState<string | null>(null);
  const usersCursorRef = useRef<any>(null);
  const jobsCursorRef = useRef<any>(null);
  const chatsCursorRef = useRef<any>(null);
  const usersTabLoadingRef = useRef(false);
  const jobsTabLoadingRef = useRef(false);
  const chatsTabLoadingRef = useRef(false);
  const trafficLoadingRef = useRef(false);

  // ============================================
  // Data Fetching
  // ============================================
  const loadUsersList = useCallback(async (reset: boolean = false) => {
    if (usersTabLoadingRef.current) return;

    try {
      usersTabLoadingRef.current = true;
      setUsersTabLoading(true);
      const result = await getUsersPage({
        limitCount: ADMIN_USERS_PAGE_SIZE,
        role: userRoleFilter === 'all' ? undefined : userRoleFilter as 'user' | 'nurse' | 'hospital' | 'admin',
        cursor: reset ? null : usersCursorRef.current,
      });

      usersCursorRef.current = result.lastDoc;
      setUsersTabHasMore(result.hasMore);
      setUserListItems((prev) => {
        if (reset) return result.items;
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
      });
    } catch (error) {
      console.error('Error loading users page:', error);
    } finally {
      usersTabLoadingRef.current = false;
      setUsersTabLoading(false);
    }
  }, [userRoleFilter]);

  const loadJobsList = useCallback(async (reset: boolean = false) => {
    if (jobsTabLoadingRef.current) return;

    try {
      jobsTabLoadingRef.current = true;
      setJobsTabLoading(true);
      const result = await getJobsPage({
        limitCount: ADMIN_JOBS_PAGE_SIZE,
        status: jobStatusFilter as 'active' | 'urgent' | 'closed' | 'all',
        province: jobProvinceFilter,
        cursor: reset ? null : jobsCursorRef.current,
      });

      jobsCursorRef.current = result.lastDoc;
      setJobsTabHasMore(result.hasMore);
      setJobListItems((prev) => {
        if (reset) return result.items;
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
      });
    } catch (error) {
      console.error('Error loading jobs page:', error);
    } finally {
      jobsTabLoadingRef.current = false;
      setJobsTabLoading(false);
    }
  }, [jobProvinceFilter, jobStatusFilter]);

  const loadChatsList = useCallback(async (reset: boolean = false) => {
    if (chatsTabLoadingRef.current) return;

    try {
      chatsTabLoadingRef.current = true;
      setChatsTabLoading(true);
      const result = await getConversationsPage({
        limitCount: ADMIN_CHATS_PAGE_SIZE,
        cursor: reset ? null : chatsCursorRef.current,
      });

      chatsCursorRef.current = result.lastDoc;
      setChatsTabHasMore(result.hasMore);
      setChatListItems((prev) => {
        if (reset) return result.items;
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...result.items.filter((item) => !seen.has(item.id))];
      });
    } catch (error) {
      console.error('Error loading chats page:', error);
    } finally {
      chatsTabLoadingRef.current = false;
      setChatsTabLoading(false);
    }
  }, []);

  const loadTrafficSnapshot = useCallback(async () => {
    if (trafficLoadingRef.current) return;

    try {
      trafficLoadingRef.current = true;
      setTrafficLoading(true);
      const [trafficUsersResult, trafficJobsResult] = await Promise.all([
        getUsersPage({ limitCount: ADMIN_TRAFFIC_PAGE_SIZE }),
        getJobsPage({ limitCount: ADMIN_TRAFFIC_PAGE_SIZE }),
      ]);
      setUsers(trafficUsersResult.items);
      setJobs(trafficJobsResult.items);
    } catch (error) {
      console.error('Error loading traffic snapshot:', error);
    } finally {
      trafficLoadingRef.current = false;
      setTrafficLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      const [s, analytics, usersPreview, jobsPreview, campaignCodes, commerce, history, onboardingSettings] = await Promise.all([
        getDashboardStats(),
        getExecutiveAnalyticsSummary(),
        getUsersPage({ limitCount: ADMIN_PREVIEW_PAGE_SIZE }),
        getJobsPage({ limitCount: ADMIN_PREVIEW_PAGE_SIZE }),
        getAllCampaignCodes(200),
        getCommerceAccessStatus(),
        getBroadcastHistory(25),
        getOnboardingSurveyAdminSettings(),
      ]);
      setStats(s);
      setAnalyticsSummary(analytics);
      setUsers(usersPreview.items);
      setJobs(jobsPreview.items);
      setCodes(campaignCodes);
      setCommerceStatus(commerce);
      setOnboardingSurveySettings(onboardingSettings);
      setBroadcastHistory(history);
      setLastRefreshedAt(new Date());

      // These may not be deployed yet — load independently so they don't block dashboard
      const [templateResult, scheduledResult, fraudResult, retentionResult] = await Promise.allSettled([
        listBroadcastTemplates(),
        listScheduledBroadcastCampaigns(),
        getFraudAlertCenter(),
        getRetentionMonitor(),
      ]);
      if (templateResult.status === 'fulfilled') setTemplates(templateResult.value);
      if (scheduledResult.status === 'fulfilled') setScheduledCampaigns(scheduledResult.value);
      if (fraudResult.status === 'fulfilled' && fraudResult.value) {
        const fraud = fraudResult.value;
        setFraudCenter(fraud);
        setFraudKeywordInput((fraud?.config?.blacklistKeywords || []).join(', '));
        setFraudWarningTitle(fraud?.config?.transferWarningTitle || fraud?.summary.transferWarningTitle || '');
        setFraudWarningBody(fraud?.config?.transferWarningBody || fraud?.summary.transferWarningBody || '');
      }
      if (retentionResult.status === 'fulfilled') setRetentionMonitor(retentionResult.value);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSetOnboardingSurveyEnabled = useCallback(async (surveyEnabled: boolean) => {
    if (!adminUser?.uid || updatingOnboardingSurvey || onboardingSurveySettings.surveyEnabled === surveyEnabled) {
      return;
    }

    try {
      setUpdatingOnboardingSurvey(true);
      await updateOnboardingSurveyEnabled(adminUser.uid, surveyEnabled);
      setOnboardingSurveySettings((prev) => ({
        ...prev,
        surveyEnabled,
        updatedBy: adminUser.uid,
        updatedAt: new Date(),
      }));
    } catch (error) {
      Alert.alert('บันทึกไม่สำเร็จ', 'ไม่สามารถอัปเดตการเปิดใช้คู่มือเริ่มต้นได้ กรุณาลองใหม่');
    } finally {
      setUpdatingOnboardingSurvey(false);
    }
  }, [adminUser?.uid, onboardingSurveySettings.surveyEnabled, updatingOnboardingSurvey]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const unsubscribe = subscribeStickyAnnouncementsAdmin(setStickyAnnouncementItems);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'users' && userSearch.trim().length < 2) {
      usersCursorRef.current = null;
      loadUsersList(true);
    }
  }, [activeTab, loadUsersList, userRoleFilter, userSearch]);

  useEffect(() => {
    if (activeTab === 'jobs') {
      jobsCursorRef.current = null;
      loadJobsList(true);
    }
  }, [activeTab, jobProvinceFilter, jobStatusFilter, loadJobsList]);

  useEffect(() => {
    if (activeTab === 'chats') {
      chatsCursorRef.current = null;
      loadChatsList(true);
    }
  }, [activeTab, loadChatsList]);

  useEffect(() => {
    if (
      (activeTab === 'traffic' || activeTab === 'broadcast')
      && (users.length < ADMIN_TRAFFIC_PAGE_SIZE || jobs.length < ADMIN_TRAFFIC_PAGE_SIZE)
    ) {
      loadTrafficSnapshot();
    }
  }, [activeTab, jobs.length, loadTrafficSnapshot, users.length]);

  useEffect(() => {
    if (activeTab !== 'users') return;

    const term = userSearch.trim();
    if (term.length < 2) {
      setUserSearchResults(null);
      setUserSearchLoading(false);
      return;
    }

    let cancelled = false;
    setUserSearchLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const result = await searchUsers(term);
        if (!cancelled) {
          setUserSearchResults(result);
        }
      } catch (error) {
        console.error('Error searching admin users:', error);
        if (!cancelled) {
          setUserSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setUserSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeTab, userSearch]);

  useEffect(() => {
    if (!selectedUser) return;
    setModerationTagsDraft(selectedUser.adminTags || []);
    setWarningTagDraft(selectedUser.adminWarningTag || '');
    setPostingSuspendReasonDraft(selectedUser.postingSuspendedReason || '');
    setAccessPlanDraft(selectedUser.subscriptionPlan || 'free');
    setBillingCycleDraft(selectedUser.billingCycle || 'monthly');
    setAccessExpiresAtDraft(
      selectedUser.subscriptionExpiresAt
        ? selectedUser.subscriptionExpiresAt.toISOString().slice(0, 10)
        : ''
    );
    setPostsTodayDraft(String(selectedUser.postsToday || 0));
    setFreeUrgentUsedDraft(selectedUser.freeUrgentUsed === true);
    setUsageDraft({
      post_create: String(selectedUser.subscriptionMonthlyUsage?.post_create?.used || 0),
      job_application: String(selectedUser.subscriptionMonthlyUsage?.job_application?.used || 0),
      chat_start: String(selectedUser.subscriptionMonthlyUsage?.chat_start?.used || 0),
      urgent_post: String(selectedUser.subscriptionMonthlyUsage?.urgent_post?.used || 0),
      extend_post: String(selectedUser.subscriptionMonthlyUsage?.extend_post?.used || 0),
      boost_post: String(selectedUser.subscriptionMonthlyUsage?.boost_post?.used || 0),
    });
  }, [selectedUser]);

  useEffect(() => {
    setBroadcastPreview(null);
  }, [
    broadcastTargetRole,
    broadcastTargetProvinces,
    broadcastOnlyVerified,
    broadcastActiveOnly,
    broadcastTargetStaffTypes,
    broadcastActiveWithinDays,
    broadcastNeverPosted,
  ]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll().finally(() => {
      if (activeTab === 'users' && userSearch.trim().length < 2) {
        usersCursorRef.current = null;
        loadUsersList(true);
      }
      if (activeTab === 'jobs') {
        jobsCursorRef.current = null;
        loadJobsList(true);
      }
      if (activeTab === 'chats') {
        chatsCursorRef.current = null;
        loadChatsList(true);
      }
      if (activeTab === 'traffic' || activeTab === 'broadcast') {
        loadTrafficSnapshot();
      }
    });
  }, [activeTab, fetchAll, loadChatsList, loadJobsList, loadTrafficSnapshot, loadUsersList, userSearch]);

  const patchUserLocally = useCallback((userId: string, patch: Partial<AdminUser>) => {
    setUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, ...patch } : item)));
    setUserListItems((prev) => prev.map((item) => (item.id === userId ? { ...item, ...patch } : item)));
    setUserSearchResults((prev) => prev?.map((item) => (item.id === userId ? { ...item, ...patch } : item)) || null);
    setSelectedUser((prev) => (prev?.id === userId ? { ...prev, ...patch } : prev));
  }, []);

  const patchJobLocally = useCallback((jobId: string, patch: Partial<AdminJob>) => {
    setJobs((prev) => prev.map((item) => (item.id === jobId ? { ...item, ...patch } : item)));
    setJobListItems((prev) => prev.map((item) => (item.id === jobId ? { ...item, ...patch } : item)));
    setSelectedJob((prev) => (prev?.id === jobId ? { ...prev, ...patch } : prev));
  }, []);

  // ============================================
  // User Actions
  // ============================================
  const handleToggleUserActive = async (user: AdminUser) => {
    const newStatus = !user.isActive;
    const action = newStatus ? 'เปิดใช้งาน' : 'ระงับ';
    Alert.alert(`${action}ผู้ใช้`, `ต้องการ${action} "${user.displayName}" ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: newStatus ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await updateUserStatus(user.id, newStatus);
            patchUserLocally(user.id, { isActive: newStatus });
            setUserModalVisible(false);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการได้');
          }
        },
      },
    ]);
  };

  const handleVerifyUser = async (user: AdminUser) => {
    const newVerified = !user.isVerified;
    const action = newVerified ? 'ยืนยันตัวตน' : 'ยกเลิกการยืนยัน';
    Alert.alert(action, `${action} "${user.displayName}" ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await verifyUser(user.id, newVerified);
            patchUserLocally(user.id, {
              isVerified: newVerified,
              role: newVerified ? 'nurse' : 'user',
            });
            setUserModalVisible(false);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการได้');
          }
        },
      },
    ]);
  };

  const handleChangeRole = async (user: AdminUser, role: 'user' | 'nurse' | 'hospital' | 'admin') => {
    if (user.role === role) return;
    const nextRoleLabel = role === 'user'
      ? 'ผู้ใช้ทั่วไป'
      : role === 'nurse'
        ? 'พยาบาล'
        : role === 'hospital'
          ? 'โรงพยาบาล'
          : 'ผู้ดูแลระบบ';
    Alert.alert('เปลี่ยนประเภทบัญชี', `เปลี่ยน "${user.displayName}" เป็น ${nextRoleLabel} ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await updateUserRole(user.id, role);
            patchUserLocally(user.id, { role, isAdmin: role === 'admin' });
            setUserModalVisible(false);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการได้');
          }
        },
      },
    ]);
  };

  const handleDeleteUser = async (user: AdminUser) => {
    Alert.alert('ลบผู้ใช้', `ลบ "${user.displayName}" ถาวร? ข้อมูลจะหายไปทั้งหมด`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(user.id);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setUserListItems((prev) => prev.filter((u) => u.id !== user.id));
            setUserSearchResults((prev) => prev?.filter((u) => u.id !== user.id) || null);
            setUserModalVisible(false);
          } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถลบได้'); }
        },
      },
    ]);
  };

  const toggleModerationTag = (tag: UserAdminTag) => {
    setModerationTagsDraft((prev) => (
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    ));
  };

  const handleSaveUserModeration = async () => {
    if (!selectedUser) return;

    setSavingModeration(true);
    try {
      const payload = {
        adminTags: moderationTagsDraft,
        adminWarningTag: warningTagDraft.trim() || null,
        postingSuspendedReason: postingSuspendReasonDraft.trim() || null,
      };

      await updateUserModeration(selectedUser.id, payload);
      patchUserLocally(selectedUser.id, {
        adminTags: moderationTagsDraft,
        adminWarningTag: payload.adminWarningTag || undefined,
        postingSuspendedReason: payload.postingSuspendedReason || undefined,
      });
      Alert.alert('บันทึกแล้ว', 'อัปเดตแท็กและป้ายเตือนเรียบร้อย');
    } catch (error: any) {
      Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถบันทึกข้อมูล moderation ได้');
    } finally {
      setSavingModeration(false);
    }
  };

  const handleTogglePostingSuspension = async (user: AdminUser) => {
    if (user.postingSuspended) {
      Alert.alert('ปลดระงับการโพสต์', `ต้องการปลดระงับการโพสต์ของ "${user.displayName}" ?`, [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ยืนยัน',
          onPress: async () => {
            try {
              await updateUserModeration(user.id, {
                postingSuspended: false,
                postingSuspendedReason: postingSuspendReasonDraft.trim() || null,
              });
              patchUserLocally(user.id, {
                postingSuspended: false,
                postingSuspendedReason: postingSuspendReasonDraft.trim() || undefined,
              });
            } catch (error: any) {
              Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถปลดระงับการโพสต์ได้');
            }
          },
        },
      ]);
      return;
    }

    Alert.alert('ปิดโพสต์และระงับการโพสต์', `ต้องการปิดโพสต์ทั้งหมดของ "${user.displayName}" และระงับการโพสต์ต่อหรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: 'destructive',
        onPress: async () => {
          try {
            const closedCount = await closePostsAndSuspendUserPosting(user.id, postingSuspendReasonDraft.trim() || null);
            patchUserLocally(user.id, {
              postingSuspended: true,
              postingSuspendedReason: postingSuspendReasonDraft.trim() || undefined,
            });
            await fetchAll();
            Alert.alert('ดำเนินการแล้ว', `ปิดโพสต์ ${closedCount} รายการ และระงับการโพสต์เรียบร้อย`);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถปิดโพสต์และระงับการโพสต์ได้');
          }
        },
      },
    ]);
  };

  const updateUsageDraftValue = (feature: SubscriptionUsageFeature, value: string) => {
    setUsageDraft((prev) => ({
      ...prev,
      [feature]: value.replace(/[^0-9]/g, ''),
    }));
  };

  const handleSaveUserAccessRights = async () => {
    if (!selectedUser) return;

    setSavingAccessRights(true);
    try {
      const expiresAt = accessExpiresAtDraft.trim()
        ? new Date(`${accessExpiresAtDraft.trim()}T23:59:59`)
        : null;
      if (expiresAt && Number.isNaN(expiresAt.getTime())) {
        throw new Error('รูปแบบวันหมดอายุต้องเป็น YYYY-MM-DD');
      }

      const monthlyUsage = ACCESS_USAGE_FEATURES.reduce((acc, item) => {
        acc[item.key] = Number(usageDraft[item.key] || '0');
        return acc;
      }, {} as Partial<Record<SubscriptionUsageFeature, number>>);

      await updateUserAccessRights(selectedUser.id, {
        plan: accessPlanDraft,
        billingCycle: billingCycleDraft,
        expiresAt,
        monthlyUsage,
        postsToday: Number(postsTodayDraft || '0'),
        freeUrgentUsed: freeUrgentUsedDraft,
      });

      patchUserLocally(selectedUser.id, {
        subscriptionPlan: accessPlanDraft,
        billingCycle: billingCycleDraft,
        subscriptionExpiresAt: expiresAt || undefined,
        postsToday: Number(postsTodayDraft || '0'),
        freeUrgentUsed: freeUrgentUsedDraft,
        subscriptionMonthlyUsage: ACCESS_USAGE_FEATURES.reduce((acc, item) => {
          acc[item.key] = {
            periodKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            used: Number(usageDraft[item.key] || '0'),
          };
          return acc;
        }, {} as NonNullable<AdminUser['subscriptionMonthlyUsage']>),
      });

      Alert.alert('บันทึกแล้ว', 'อัปเดตสิทธิ์และตัวเลขการใช้งานเรียบร้อย');
    } catch (error: any) {
      Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถบันทึกสิทธิ์การใช้งานได้');
    } finally {
      setSavingAccessRights(false);
    }
  };

  const handleResetUserAccessRights = async () => {
    if (!selectedUser) return;

    Alert.alert('รีเซ็ตสิทธิ์การใช้งาน', `รีเซ็ตตัวนับรายเดือนของ "${selectedUser.displayName}" ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'รีเซ็ต',
        onPress: async () => {
          setResettingAccessRights(true);
          try {
            await resetUserAccessUsage(selectedUser.id);
            patchUserLocally(selectedUser.id, {
              postsToday: 0,
              freeUrgentUsed: false,
              freeUrgentMonthReset: undefined,
              lastPostDate: undefined,
              subscriptionMonthlyUsage: ACCESS_USAGE_FEATURES.reduce((acc, item) => {
                acc[item.key] = {
                  periodKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                  used: 0,
                };
                return acc;
              }, {} as NonNullable<AdminUser['subscriptionMonthlyUsage']>),
            });
            setPostsTodayDraft('0');
            setFreeUrgentUsedDraft(false);
            setUsageDraft({
              post_create: '0',
              job_application: '0',
              chat_start: '0',
              urgent_post: '0',
              extend_post: '0',
              boost_post: '0',
            });
            Alert.alert('รีเซ็ตแล้ว', 'ล้างตัวนับสิทธิ์การใช้งานของบัญชีนี้เรียบร้อย');
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถรีเซ็ตสิทธิ์ได้');
          } finally {
            setResettingAccessRights(false);
          }
        },
      },
    ]);
  };

  const handleBulkResetRoleAccess = async (role: 'user' | 'nurse' | 'hospital' | 'admin') => {
    Alert.alert('รีเซ็ตตาม role', `รีเซ็ตตัวนับสิทธิ์การใช้งานของ role "${role}" ทั้งหมดใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'รีเซ็ตทั้งหมด',
        style: 'destructive',
        onPress: async () => {
          setBulkRoleResetting(role);
          try {
            const result: AdminBulkRoleResetResult = await bulkResetAccessUsageByRole(role);
            const zeroedUsage = ACCESS_USAGE_FEATURES.reduce((acc, feature) => {
              acc[feature.key] = {
                periodKey: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                used: 0,
              };
              return acc;
            }, {} as NonNullable<AdminUser['subscriptionMonthlyUsage']>);

            const applyResetPatch = (item: AdminUser) => (
              item.role !== role
                ? item
                : {
                    ...item,
                    postsToday: 0,
                    freeUrgentUsed: false,
                    freeUrgentMonthReset: undefined,
                    lastPostDate: undefined,
                    subscriptionMonthlyUsage: zeroedUsage,
                  }
            );

            setUsers((prev) => prev.map(applyResetPatch));
            setUserListItems((prev) => prev.map(applyResetPatch));
            setUserSearchResults((prev) => prev?.map(applyResetPatch) || null);
            setSelectedUser((prev) => (prev && prev.role === role ? applyResetPatch(prev) : prev));
            Alert.alert('สำเร็จ', `รีเซ็ตสิทธิ์การใช้งาน ${result.updatedCount} บัญชีใน role ${role}`);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถรีเซ็ตตาม role ได้');
          } finally {
            setBulkRoleResetting(null);
          }
        },
      },
    ]);
  };

  // ============================================
  // Job Actions
  // ============================================
  const handleChangeJobStatus = async (job: AdminJob, status: 'active' | 'closed' | 'urgent') => {
    try {
      await updateJobStatus(job.id, status);
      patchJobLocally(job.id, { status });
      setJobModalVisible(false);
    } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้'); }
  };

  const handleDeleteJob = async (job: AdminJob) => {
    Alert.alert('ลบงาน', `ลบ "${job.title}" ถาวร?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteJob(job.id);
            setJobs((prev) => prev.filter((j) => j.id !== job.id));
            setJobListItems((prev) => prev.filter((j) => j.id !== job.id));
            setJobModalVisible(false);
          } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถลบได้'); }
        },
      },
    ]);
  };

  // ============================================
  // Chat Actions
  // ============================================
  const handleDeleteChat = async (chat: AdminConversation) => {
    Alert.alert('ลบการสนทนา', `ลบแชทนี้และข้อความทั้งหมดถาวร?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteConversation(chat.id);
            setChatListItems((prev) => prev.filter((c) => c.id !== chat.id));
          } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถลบได้'); }
        },
      },
    ]);
  };

  // ============================================
  // Filtered Data
  // ============================================
  const filteredUsers = useMemo(() => {
    const baseItems = userSearch.trim().length >= 2 && userSearchResults ? userSearchResults : userListItems;
    return baseItems.filter((user) => userRoleFilter === 'all' || user.role === userRoleFilter);
  }, [userListItems, userRoleFilter, userSearch, userSearchResults]);

  const filteredJobs = jobListItems;

  const filteredCodes = codes.filter((item) => {
    const term = codeSearch.trim().toLowerCase();
    const matchesSearch = !term
      || item.code.toLowerCase().includes(term)
      || item.title.toLowerCase().includes(term)
      || item.description?.toLowerCase().includes(term);
    const matchesStatus = codeStatusFilter === 'all'
      || (codeStatusFilter === 'active' ? item.isActive : !item.isActive);
    return matchesSearch && matchesStatus;
  });

  const availableBroadcastStaffTypes = Array.from(
    new Set(users.map((item) => item.staffType?.trim()).filter((item): item is string => Boolean(item)))
  ).sort((left, right) => left.localeCompare(right));
  const availableJobProvinces = Array.from(
    new Set(jobs.map((item) => item.province?.trim()).filter((item): item is string => Boolean(item)))
  ).sort((left, right) => left.localeCompare(right));
  const getJobTimeBucketLabel = (job: AdminJob) => {
    const hour = job.createdAt?.getHours?.() ?? 0;
    if (hour < 6) return 'ดึก 00:00-05:59';
    if (hour < 12) return 'เช้า 06:00-11:59';
    if (hour < 18) return 'บ่าย 12:00-17:59';
    return 'เย็น 18:00-23:59';
  };
  const activeTabConfig = TABS.find((tab) => tab.key === activeTab) || TABS[0];
  const adminDisplayName = adminUser?.displayName?.trim().split(/\s+/)[0] || 'ทีมงาน';
  const headerSummaryItems = [
    {
      label: 'รอตรวจ',
      value: stats ? ((stats.pendingVerifications || 0) + (stats.pendingDocuments || 0)).toLocaleString() : '-',
    },
    {
      label: 'งานเปิดรับ',
      value: stats ? stats.activeJobs.toLocaleString() : '-',
    },
    {
      label: 'สมาชิกใหม่วันนี้',
      value: stats ? stats.todayNewUsers.toLocaleString() : '-',
    },
  ];
  const quickActionItems = [
    {
      key: 'verification',
      icon: 'shield-checkmark-outline',
      label: 'ตรวจเอกสาร',
      color: COLORS.accent,
      badge: stats ? ((stats.pendingVerifications || 0) + (stats.pendingDocuments || 0)) : undefined,
      onPress: () => navigation.navigate('AdminVerification'),
    },
    {
      key: 'reports',
      icon: 'flag-outline',
      label: 'รายงาน',
      color: COLORS.error,
      onPress: () => navigation.navigate('AdminReports'),
    },
    {
      key: 'feedback',
      icon: 'chatbox-ellipses-outline',
      label: 'ข้อเสนอแนะ',
      color: COLORS.primary,
      onPress: () => navigation.navigate('AdminFeedback'),
    },
    {
      key: 'users',
      icon: 'people-outline',
      label: 'สมาชิก',
      color: '#7C3AED',
      onPress: () => setActiveTab('users'),
    },
  ];
  const openUsersByProvince = (province: string, role?: 'nurse' | 'hospital' | 'user' | 'admin') => {
    setUserSearch(province);
    if (role) setUserRoleFilter(role);
    setActiveTab('users');
  };
  const openJobsByProvince = (province: string) => {
    setJobProvinceFilter(province);
    setActiveTab('jobs');
  };
  const trafficJobs = jobs.filter((job) => {
    const matchProvince = trafficProvinceFilter === 'all' || job.province === trafficProvinceFilter;
    const matchTime = trafficTimeFilter === 'all' || getJobTimeBucketLabel(job) === trafficTimeFilter;
    return matchProvince && matchTime;
  });
  const trafficNurseUsers = users.filter((user) => (
    user.role === 'nurse' && (trafficProvinceFilter === 'all' || user.province === trafficProvinceFilter)
  ));
  const nurseByProvince = Array.from(
    trafficNurseUsers.reduce((map, user) => {
      if (!user.province) return map;
      map.set(user.province, (map.get(user.province) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([province, count]) => ({ province, count }))
    .sort((left, right) => right.count - left.count);
  const jobsByProvince = Array.from(
    trafficJobs.reduce((map, job) => {
      if (!job.province) return map;
      map.set(job.province, (map.get(job.province) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([province, count]) => ({ province, count }))
    .sort((left, right) => right.count - left.count);
  const provinceScopedJobs = jobs.filter((job) => trafficProvinceFilter === 'all' || job.province === trafficProvinceFilter);
  const postingTimeBuckets = Array.from(
    provinceScopedJobs.reduce((map, job) => {
      const label = getJobTimeBucketLabel(job);
      map.set(label, (map.get(label) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
  const jobsByWeekday = Array.from(
    trafficJobs.reduce((map, job) => {
      const weekday = job.createdAt?.toLocaleDateString('th-TH', { weekday: 'short' }) || '-';
      map.set(weekday, (map.get(weekday) || 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
  const demandBalanceRows = jobsByProvince.slice(0, 8).map((item) => {
    const nurseCount = nurseByProvince.find((entry) => entry.province === item.province)?.count || 0;
    return {
      province: item.province,
      jobsCount: item.count,
      nurseCount,
      pressure: nurseCount > 0 ? item.count / nurseCount : item.count,
    };
  }).sort((left, right) => right.pressure - left.pressure);
  const regionSummaries = REGIONS.map((region) => {
    const provinces = [...(PROVINCES_BY_REGION as Record<string, readonly string[]>)[region]];
    const nurses = trafficNurseUsers.filter((user) => user.province && provinces.includes(user.province)).length;
    const jobsCount = trafficJobs.filter((job) => job.province && provinces.includes(job.province)).length;
    return { region, nurses, jobsCount };
  }).filter((item) => item.nurses > 0 || item.jobsCount > 0);

  // ============================================
  // Helpers
  // ============================================
  const formatDate = (d?: Date) => {
    if (!d) return '-';
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const formatDateTime = (d?: Date) => {
    if (!d) return '-';
    return d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseDateInput = (value: string): Date | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = new Date(`${trimmed}T23:59:59`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const parseDateTimeInput = (value: string): Date | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Admin input is always Asia/Bangkok — append +07:00 if no timezone specified
    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    const withTz = /[+-]\d{2}:?\d{2}$|Z$/i.test(normalized) ? normalized : `${normalized}+07:00`;
    const parsed = new Date(withTz);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const toggleAnnouncementTargetScreen = (target: StickyAnnouncement['targetScreens'][number]) => {
    setAnnouncementDraft((prev) => {
      if (target === 'all') {
        return { ...prev, targetScreens: ['all'] };
      }

      const currentTargets = prev.targetScreens.includes('all')
        ? []
        : prev.targetScreens.filter((item) => item !== 'all');

      const nextTargets = currentTargets.includes(target)
        ? currentTargets.filter((item) => item !== target)
        : [...currentTargets, target];

      return {
        ...prev,
        targetScreens: nextTargets.length > 0 ? nextTargets : ['all'],
      };
    });
  };

  const formatAnnouncementTargetScreens = (targetScreens: StickyAnnouncement['targetScreens']) => {
    if (targetScreens.includes('all')) return 'ทุกหน้า';

    const labelMap: Record<Exclude<StickyAnnouncement['targetScreens'][number], 'all'>, string> = {
      home: 'Home',
      notifications: 'Notifications',
      chat: 'Chat',
    };

    return targetScreens.map((item) => labelMap[item as keyof typeof labelMap] || item).join(', ');
  };

  const resetAnnouncementDraft = () => {
    setAnnouncementDraft({
      id: '',
      title: '',
      body: '',
      severity: 'info',
      isActive: true,
      isPinned: true,
      targetScreens: ['all'],
      startsAt: null,
      endsAt: null,
    });
    setAnnouncementStartsAtInput('');
    setAnnouncementEndsAtInput('');
  };

  const editAnnouncement = (item: StickyAnnouncement) => {
    setAnnouncementDraft(item);
    setAnnouncementStartsAtInput(item.startsAt ? item.startsAt.toISOString().slice(0, 10) : '');
    setAnnouncementEndsAtInput(item.endsAt ? item.endsAt.toISOString().slice(0, 10) : '');
  };

  const saveAnnouncement = async () => {
    if (!announcementDraft.title.trim() || !announcementDraft.body.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและข้อความประกาศ');
      return;
    }
    try {
      setSavingAnnouncement(true);
      await upsertStickyAnnouncement({
        ...announcementDraft,
        id: announcementDraft.id || `announcement_${Date.now()}`,
        title: announcementDraft.title.trim(),
        body: announcementDraft.body.trim(),
        targetScreens: announcementDraft.targetScreens.length > 0 ? announcementDraft.targetScreens : ['all'],
        startsAt: parseDateInput(announcementStartsAtInput),
        endsAt: parseDateInput(announcementEndsAtInput),
        createdBy: adminUser?.uid,
      });
      resetAnnouncementDraft();
      setStickyAnnouncementItems(await getStickyAnnouncementsAdmin());
      Alert.alert('บันทึกสำเร็จ', 'อัปเดตประกาศด่วนเรียบร้อยแล้ว');
    } catch (error: any) {
      Alert.alert('บันทึกไม่สำเร็จ', error?.message || 'ไม่สามารถบันทึกประกาศได้');
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleDeleteAnnouncement = (item: StickyAnnouncement) => {
    Alert.alert('ลบประกาศ', `ต้องการลบ "${item.title}" ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await removeStickyAnnouncement(item.id);
          if (announcementDraft.id === item.id) resetAnnouncementDraft();
        },
      },
    ]);
  };

  const getCampaignBenefitLabel = (item: CampaignCode | CodeFormState) => {
    return getCampaignBenefitSummary(item.benefitType, Number((item as any).benefitValue || 0));
  };

  const getCampaignBenefitBadge = (benefitType: CampaignCodeBenefitType) => {
    switch (benefitType) {
      case 'percent_discount': return { label: 'ลด %', color: COLORS.success, bg: COLORS.successLight };
      case 'fixed_discount': return { label: 'ลดบาท', color: COLORS.accent, bg: COLORS.warningLight };
      case 'free_urgent': return { label: 'ฟรีด่วน', color: COLORS.error, bg: COLORS.errorLight };
      case 'free_post': return { label: 'ฟรีโพสต์', color: '#7C3AED', bg: '#F3E8FF' };
      case 'bonus_days': return { label: 'เพิ่มวัน', color: COLORS.primary, bg: COLORS.primaryBackground };
      default: return { label: benefitType, color: COLORS.textSecondary, bg: COLORS.backgroundSecondary };
    }
  };

  const getCampaignStatusBadge = (isActive: boolean) => {
    return isActive
      ? { label: 'ใช้งานอยู่', color: COLORS.success, bg: COLORS.successLight }
      : { label: 'ปิดอยู่', color: COLORS.textSecondary, bg: COLORS.backgroundSecondary };
  };

  const openCreateCodeModal = () => {
    setSelectedCode(null);
    setCodeForm({ ...INITIAL_CODE_FORM, code: generateCampaignCode() });
    setCodeModalVisible(true);
  };

  const openEditCodeModal = (item: CampaignCode) => {
    const expiresAt = item.rule.expiresAt
      ? ('toDate' in (item.rule.expiresAt as any) ? (item.rule.expiresAt as any).toDate() : item.rule.expiresAt)
      : null;
    setSelectedCode(item);
    setCodeForm({
      code: item.code,
      title: item.title,
      description: item.description || '',
      benefitType: item.benefitType,
      benefitValue: String(item.benefitValue || ''),
      maxUses: item.rule.maxUses == null ? '' : String(item.rule.maxUses),
      minSpend: String(item.rule.minSpend || ''),
      expiresAt: expiresAt ? expiresAt.toISOString().slice(0, 10) : '',
      allowedRoles: item.rule.allowedRoles,
      allowedPackages: item.rule.allowedPackages,
      firstPurchaseOnly: item.rule.firstPurchaseOnly,
      isActive: item.isActive,
    });
    setCodeModalVisible(true);
  };

  const toggleAllowedRole = (role: CampaignCodeRole) => {
    setCodeForm((prev) => ({
      ...prev,
      allowedRoles: prev.allowedRoles.includes(role)
        ? prev.allowedRoles.filter((item) => item !== role)
        : [...prev.allowedRoles, role],
    }));
  };

  const toggleAllowedPackage = (packageKey: CampaignCodePackage) => {
    setCodeForm((prev) => ({
      ...prev,
      allowedPackages: prev.allowedPackages.includes(packageKey)
        ? prev.allowedPackages.filter((item) => item !== packageKey)
        : [...prev.allowedPackages, packageKey],
    }));
  };

  const handleSaveCode = async () => {
    const normalizedCode = normalizeCampaignCode(codeForm.code);
    const title = codeForm.title.trim();
    const benefitValue = parseInt(codeForm.benefitValue || '0', 10);
    const minSpend = parseInt(codeForm.minSpend || '0', 10);
    const maxUses = codeForm.maxUses.trim() ? parseInt(codeForm.maxUses, 10) : null;
    const expiresAt = parseDateInput(codeForm.expiresAt);

    if (!normalizedCode) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุรหัสโค้ด');
      return;
    }
    if (!title) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุชื่อโค้ด');
      return;
    }
    if (Number.isNaN(benefitValue) || benefitValue <= 0) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุค่าผลประโยชน์ให้ถูกต้อง');
      return;
    }
    if (codeForm.allowedRoles.length === 0) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกอย่างน้อย 1 ประเภทบัญชีที่ใช้โค้ดได้');
      return;
    }
    if (codeForm.allowedPackages.length === 0) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาเลือกอย่างน้อย 1 แพ็กเกจที่ใช้โค้ดได้');
      return;
    }
    if (codeForm.expiresAt.trim() && !expiresAt) {
      Alert.alert('รูปแบบวันที่ไม่ถูกต้อง', 'กรุณากรอกวันหมดอายุเป็น YYYY-MM-DD');
      return;
    }

    setSavingCode(true);
    try {
      const payload = {
        code: normalizedCode,
        title,
        description: codeForm.description,
        benefitType: codeForm.benefitType,
        benefitValue,
        isActive: codeForm.isActive,
        allowedRoles: codeForm.allowedRoles,
        allowedPackages: codeForm.allowedPackages,
        firstPurchaseOnly: codeForm.firstPurchaseOnly,
        minSpend: Number.isNaN(minSpend) ? 0 : minSpend,
        maxUses: maxUses == null || Number.isNaN(maxUses) ? null : maxUses,
        expiresAt,
      };

      if (selectedCode) {
        await updateCampaignCode(selectedCode.code, payload);
        setCodes((prev) => prev.map((item) => (
          item.code === selectedCode.code
            ? {
                ...item,
                code: selectedCode.code,
                title: payload.title,
                description: payload.description,
                benefitType: payload.benefitType,
                benefitValue: payload.benefitValue,
                isActive: payload.isActive,
                rule: {
                  allowedRoles: payload.allowedRoles,
                  allowedPackages: payload.allowedPackages,
                  firstPurchaseOnly: payload.firstPurchaseOnly,
                  minSpend: payload.minSpend,
                  maxUses: payload.maxUses,
                  expiresAt: payload.expiresAt,
                },
                updatedAt: new Date(),
              }
            : item
        )));
      } else {
        const created = await createCampaignCode(payload);
        setCodes((prev) => [created, ...prev]);
      }

      setCodeModalVisible(false);
      setSelectedCode(null);
      setCodeForm(INITIAL_CODE_FORM);
    } catch (error: any) {
      Alert.alert('ไม่สามารถบันทึกโค้ดได้', error?.message || 'กรุณาลองใหม่');
    } finally {
      setSavingCode(false);
    }
  };

  const handleToggleCodeActive = async (item: CampaignCode) => {
    const nextActive = !item.isActive;
    try {
      await setCampaignCodeActive(item.code, nextActive);
      setCodes((prev) => prev.map((code) => code.code === item.code ? { ...code, isActive: nextActive, updatedAt: new Date() } : code));
      if (selectedCode?.code === item.code) {
        setSelectedCode({ ...item, isActive: nextActive });
        setCodeForm((prev) => ({ ...prev, isActive: nextActive }));
      }
    } catch (error: any) {
      Alert.alert('ไม่สามารถเปลี่ยนสถานะโค้ดได้', error?.message || 'กรุณาลองใหม่');
    }
  };

  const handleDeleteCode = async (item: CampaignCode) => {
    Alert.alert('ลบโค้ด', `ต้องการลบโค้ด ${item.code} ถาวรหรือไม่`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCampaignCode(item.code);
            setCodes((prev) => prev.filter((code) => code.code !== item.code));
            setCodeModalVisible(false);
            setSelectedCode(null);
          } catch (error: any) {
            Alert.alert('ไม่สามารถลบโค้ดได้', error?.message || 'กรุณาลองใหม่');
          }
        },
      },
    ]);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return { label: 'ผู้ดูแลระบบ', color: COLORS.error, bg: COLORS.errorLight };
      case 'nurse': return { label: 'พยาบาล', color: COLORS.primary, bg: COLORS.primaryBackground };
      case 'hospital': return { label: 'โรงพยาบาล', color: '#7C3AED', bg: '#F3E8FF' };
      default: return { label: 'ผู้ใช้', color: COLORS.textSecondary, bg: COLORS.backgroundSecondary };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { label: 'เปิดรับ', color: COLORS.success, bg: COLORS.successLight };
      case 'urgent': return { label: 'ด่วน', color: COLORS.error, bg: COLORS.errorLight };
      case 'closed': return { label: 'ปิดแล้ว', color: COLORS.textLight, bg: COLORS.backgroundSecondary };
      default: return { label: status, color: COLORS.textSecondary, bg: COLORS.backgroundSecondary };
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* ====== HEADER ====== */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={styles.headerTopTextWrap}>
            <Text style={styles.headerTopLabel}>พื้นที่ผู้ดูแล</Text>
            <Text style={styles.headerTopSubLabel}>ภาพรวมการดูแลระบบ</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerHeroCard}>
          <View style={styles.headerHeroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerEyebrow}>สวัสดี {adminDisplayName}</Text>
              <Text style={styles.headerTitle}>ศูนย์ดูแลแอปที่อ่านง่ายและทำงานต่อได้ทันที</Text>
              <Text style={styles.headerSubtitle}>
                เริ่มจากงานค้างที่ต้องดูวันนี้ แล้วค่อยกดไปยังสมาชิก งาน ข้อความ หรือการสื่อสารได้จากด้านล่าง
              </Text>
            </View>
            <View style={styles.headerStatusPill}>
              <Ionicons name={activeTabConfig.icon as any} size={16} color={COLORS.primary} />
              <Text style={styles.headerStatusPillText}>{activeTabConfig.label}</Text>
            </View>
          </View>

          <View style={styles.headerSummaryRow}>
            {headerSummaryItems.map((item) => (
              <View key={item.label} style={styles.headerSummaryCard}>
                <Text style={styles.headerSummaryValue}>{item.value}</Text>
                <Text style={styles.headerSummaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ====== TABS ====== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? COLORS.primary : COLORS.textLight}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ====== CONTENT ====== */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          activeTab === 'overview' && styles.contentContainerWithFab,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'traffic' && renderTraffic()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'chats' && renderChats()}
        {activeTab === 'broadcast' && renderBroadcast()}
        {activeTab === 'codes' && renderCodes()}
      </ScrollView>

      {activeTab === 'overview' && (
        <View pointerEvents="box-none" style={[styles.fabDockWrap, { bottom: Math.max(insets.bottom, 16) + 8 }]}> 
          <View style={styles.fabDock}>
            {quickActionItems.map((item) => (
              <FloatingQuickAction
                key={item.key}
                icon={item.icon}
                label={item.label}
                color={item.color}
                badge={item.badge}
                onPress={item.onPress}
              />
            ))}
          </View>
        </View>
      )}

      {/* ====== MODALS ====== */}
      {renderUserModal()}
      {renderJobModal()}
      {renderCodeModal()}
    </View>
  );

  // ============================================
  // TAB: OVERVIEW
  // ============================================
  function renderOverview() {
    if (!stats) return null;

    const pendingReviewCount = (stats.pendingVerifications || 0) + (stats.pendingDocuments || 0);
    const urgentJobsCount = jobs.filter((job) => job.status === 'urgent').length;
    const activeUsersCount = users.filter((user) => user.isActive).length;
    const analyticsSourceLabel = analyticsSummary?.generatedFrom === 'live_query'
      ? 'ดึงจากข้อมูลล่าสุด'
      : analyticsSummary?.generatedFrom === 'cached_snapshot'
        ? 'ใช้ข้อมูลสรุปล่าสุดที่บันทึกไว้'
        : analyticsSummary?.generatedFrom || '-';
    const analyticsOverview = {
      dau: analyticsSummary?.overview?.dau ?? 0,
      wau: analyticsSummary?.overview?.wau ?? 0,
      mau: analyticsSummary?.overview?.mau ?? 0,
      newUsers7d: analyticsSummary?.overview?.newUsers7d ?? 0,
      activatedUsers7d: analyticsSummary?.overview?.activatedUsers7d ?? 0,
      jobsPosted7d: analyticsSummary?.overview?.jobsPosted7d ?? 0,
      jobsWithApplicants7d: analyticsSummary?.overview?.jobsWithApplicants7d ?? 0,
      uniqueApplicants7d: analyticsSummary?.overview?.uniqueApplicants7d ?? 0,
      uniquePosters7d: analyticsSummary?.overview?.uniquePosters7d ?? 0,
      applyClicks7d: analyticsSummary?.overview?.applyClicks7d ?? 0,
      applications7d: analyticsSummary?.overview?.applications7d ?? 0,
      jobDetailViews7d: analyticsSummary?.overview?.jobDetailViews7d ?? 0,
      shareClicks7d: analyticsSummary?.overview?.shareClicks7d ?? 0,
      chatClicks7d: analyticsSummary?.overview?.chatClicks7d ?? 0,
      conversationStarts7d: analyticsSummary?.overview?.conversationStarts7d ?? 0,
      notificationOpens7d: analyticsSummary?.overview?.notificationOpens7d ?? 0,
      applicationRate: analyticsSummary?.overview?.applicationRate ?? 0,
      applyCompletionRate: analyticsSummary?.overview?.applyCompletionRate ?? 0,
      chatStartRate: analyticsSummary?.overview?.chatStartRate ?? 0,
      liquidityRate: analyticsSummary?.overview?.liquidityRate ?? 0,
    };
    const monetizationReadiness = analyticsSummary?.monetizationReadiness ?? {
      recommended: false,
      score: 0,
      blockers: [] as string[],
      checks: [] as Array<{
        key: string;
        label: string;
        current: number;
        target: number;
        passed: boolean;
        unit: 'count' | 'ratio';
      }>,
    };
    const featureUsageSummary = analyticsSummary?.featureUsage ?? {
      trackedWindowDays: 7,
      totalTrackedEvents7d: 0,
      totalTrackedUsers7d: 0,
      allFeatures: [] as NonNullable<ExecutiveAnalyticsSummary['featureUsage']>['allFeatures'],
      topFeatures: [] as NonNullable<ExecutiveAnalyticsSummary['featureUsage']>['topFeatures'],
      pricingCandidates: [] as NonNullable<ExecutiveAnalyticsSummary['featureUsage']>['pricingCandidates'],
      lowUsageFeatures: [] as NonNullable<ExecutiveAnalyticsSummary['featureUsage']>['lowUsageFeatures'],
    };
    const remainingUsers = commerceStatus?.totalUsers != null
      ? Math.max(COMMERCE_CONFIG.freeAccessMaxUsers - commerceStatus.totalUsers, 0)
      : null;
    const thresholdReasonLabel = commerceStatus?.thresholdReason === 'users'
      ? 'ครบจำนวนบัญชีที่เข้าเกณฑ์'
      : commerceStatus?.thresholdReason === 'time'
        ? 'ครบกำหนดเวลา'
        : 'ยังไม่ถึงเงื่อนไข';
    const overrideLabel = commerceStatus?.overrideMode === 'enabled'
      ? 'บังคับเปิดระบบเก็บเงินจริง'
      : commerceStatus?.overrideMode === 'disabled'
        ? 'บังคับให้ใช้ฟรีต่อ'
        : 'โหมดอัตโนมัติ';
    const commercePanelTitle = commerceStatus?.monetizationEnabled
      ? 'ระบบชำระเงินจริงเริ่มทำงานแล้ว'
      : commerceStatus?.billingActivationBlocked
        ? 'รอช่องทางชำระเงินจริงพร้อมใช้งาน'
        : commerceStatus?.transitionReviewRequired
          ? 'ถึงเกณฑ์ทบทวนการเปิดชำระเงินแล้ว'
          : 'แอปยังอยู่ในช่วงให้ใช้งานฟรี';
    const commerceBadgeLabel = commerceStatus?.monetizationEnabled
      ? 'เปิดชำระเงิน'
      : commerceStatus?.transitionReviewRequired
        ? 'รออนุมัติ'
        : 'ใช้งานฟรี';
    const commerceBadgeColor = commerceStatus?.monetizationEnabled
      ? COLORS.error
      : commerceStatus?.transitionReviewRequired
        ? COLORS.warning
        : COLORS.success;
    const commerceBadgeBg = commerceStatus?.monetizationEnabled
      ? COLORS.errorLight
      : commerceStatus?.transitionReviewRequired
        ? COLORS.warningLight
        : COLORS.successLight;
    const priorityCards = [
      {
        key: 'verify',
        icon: 'shield-checkmark-outline',
        title: 'ตรวจเอกสารและยืนยันตัวตน',
        value: pendingReviewCount > 0 ? `${pendingReviewCount.toLocaleString()} รายการ` : 'ไม่มีค้างตอนนี้',
        detail: `${stats.pendingVerifications || 0} ยืนยันตัวตน · ${stats.pendingDocuments || 0} เอกสาร`,
        actionLabel: 'ไปหน้าตรวจสอบ',
        accent: COLORS.accent,
        onPress: () => navigation.navigate('AdminVerification'),
      },
      {
        key: 'jobs',
        icon: 'briefcase-outline',
        title: 'ดูประกาศงานที่กำลังเปิดรับ',
        value: `${stats.activeJobs.toLocaleString()} งาน`,
        detail: urgentJobsCount > 0 ? `มีงานด่วน ${urgentJobsCount.toLocaleString()} งาน` : 'ยังไม่มีงานด่วนในตอนนี้',
        actionLabel: 'ไปหน้าจัดการงาน',
        accent: '#A16207',
        onPress: () => setActiveTab('jobs'),
      },
      {
        key: 'reports',
        icon: 'flag-outline',
        title: 'เช็กรายงานและข้อเสนอแนะ',
        value: 'ดูเรื่องที่ต้องตอบกลับ',
        detail: 'รวมรายงานปัญหาและความเห็นจากผู้ใช้ไว้ในจุดเดียว',
        actionLabel: 'เปิดหน้ารายงาน',
        accent: COLORS.error,
        onPress: () => navigation.navigate('AdminReports'),
      },
      {
        key: 'broadcast',
        icon: 'megaphone-outline',
        title: 'ส่งประกาศหรือเตรียมข้อความล่วงหน้า',
        value: scheduledCampaigns.length > 0 ? `${scheduledCampaigns.length.toLocaleString()} รายการรอส่ง` : 'พร้อมส่งประกาศ',
        detail: templates.length > 0 ? `มีข้อความสำเร็จรูป ${templates.length.toLocaleString()} แบบ` : 'ยังไม่ได้บันทึกข้อความสำเร็จรูป',
        actionLabel: 'ไปหน้าสื่อสาร',
        accent: COLORS.primary,
        onPress: () => setActiveTab('broadcast'),
      },
    ];
    const insightItems = [
      { label: 'สมาชิกที่กำลังใช้งาน', value: `${activeUsersCount.toLocaleString()} คน` },
      { label: 'ข้อความทั้งหมดในระบบ', value: `${stats.totalConversations.toLocaleString()} ห้อง` },
      { label: 'สมาชิกใหม่วันนี้', value: `${stats.todayNewUsers.toLocaleString()} คน` },
      { label: 'ประกาศงานทั้งหมด', value: `${stats.totalJobs.toLocaleString()} งาน` },
    ];
    const compactOverviewGroups = [
      {
        key: 'users',
        title: 'สัดส่วนสมาชิก',
        items: (['nurse', 'hospital', 'admin', 'user'] as const).map((role) => {
          const count = users.filter((u) => u.role === role).length;
          const badge = getRoleBadge(role);
          const pct = users.length > 0 ? (count / users.length) * 100 : 0;
          return { key: role, label: badge.label, count, color: badge.color, pct };
        }),
      },
      {
        key: 'jobs',
        title: 'สัดส่วนงาน',
        items: (['active', 'urgent', 'closed'] as const).map((status) => {
          const count = jobs.filter((j) => j.status === status).length;
          const badge = getStatusBadge(status);
          const pct = jobs.length > 0 ? (count / jobs.length) * 100 : 0;
          return { key: status, label: badge.label, count, color: badge.color, pct };
        }),
      },
    ];

    return (
      <View style={styles.overviewPage}>
        <View style={styles.overviewHeroCard}>
          <View style={styles.overviewHeroHeader}>
            <View>
              <Text style={styles.overviewEyebrow}>เริ่มงานวันนี้</Text>
              <Text style={styles.overviewHeroTitle}>ดูจุดสำคัญก่อน แล้วค่อยลงรายละเอียด</Text>
            </View>
            <View style={styles.overviewHeroBadge}>
              <Ionicons name="sparkles-outline" size={14} color={COLORS.primary} />
              <Text style={styles.overviewHeroBadgeText}>{lastRefreshedAt ? `อัปเดต ${formatDateTime(lastRefreshedAt)}` : 'พร้อมใช้งาน'}</Text>
            </View>
          </View>

          <View style={styles.priorityGrid}>
            {priorityCards.map((card) => (
              <TouchableOpacity
                key={card.key}
                style={styles.priorityCard}
                onPress={card.onPress}
                activeOpacity={0.85}
              >
                <View style={[styles.priorityIconWrap, { backgroundColor: `${card.accent}18` }]}>
                  <Ionicons name={card.icon as any} size={20} color={card.accent} />
                </View>
                <Text style={styles.priorityTitle}>{card.title}</Text>
                <Text style={styles.priorityValue}>{card.value}</Text>
                <Text style={styles.priorityDetail}>{card.detail}</Text>
                <View style={styles.priorityFooter}>
                  <Text style={[styles.priorityActionText, { color: card.accent }]}>{card.actionLabel}</Text>
                  <Ionicons name="arrow-forward" size={14} color={card.accent} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>ภาพรวมที่อ่านในไม่กี่วินาที</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            label="สมาชิกทั้งหมด"
            value={stats.totalUsers}
            color={COLORS.primary}
            sub={`+${stats.todayNewUsers} วันนี้`}
          />
          <StatCard
            icon="briefcase"
            label="ประกาศงาน"
            value={stats.totalJobs}
            color="#B7791F"
            sub={`${stats.activeJobs} เปิดรับ`}
          />
          <StatCard
            icon="shield-checkmark"
            label="รอตรวจสอบ"
            value={pendingReviewCount}
            color={COLORS.accent}
            sub={`${stats.pendingVerifications || 0} ยืนยัน · ${stats.pendingDocuments || 0} เอกสาร`}
          />
          <StatCard
            icon="chatbubbles"
            label="ห้องข้อความ"
            value={stats.totalConversations}
            color={COLORS.secondary}
            sub="ทั้งหมดในระบบ"
          />
        </View>

        <Text style={styles.sectionTitle}>สรุปสั้น ๆ สำหรับคนที่เข้ามาช่วยดูระบบ</Text>
        <View style={styles.insightGrid}>
          {insightItems.map((item) => (
            <View key={item.label} style={styles.insightCard}>
              <Text style={styles.insightValue}>{item.value}</Text>
              <Text style={styles.insightLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>พื้นที่และช่วงเวลาที่น่าสนใจ</Text>
        <View style={styles.trafficTeaserCard}>
          <View style={styles.trafficTeaserHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trafficTeaserTitle}>ดูแบบลึกในแท็บพื้นที่/ทราฟฟิก</Text>
              <Text style={styles.trafficTeaserSubtitle}>
                เช็กจังหวัดที่มีพยาบาลเยอะ งานเยอะ จังหวัดที่งานเริ่มแน่น และช่วงเวลาที่คนปล่อยงานมากได้ในหน้าเดียว
              </Text>
            </View>
            <TouchableOpacity style={styles.trafficTeaserButton} onPress={() => setActiveTab('traffic')}>
              <Text style={styles.trafficTeaserButtonText}>เปิดดู</Text>
              <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.trafficTeaserStats}>
            <View style={styles.trafficTeaserStatCard}>
              <Text style={styles.trafficTeaserStatValue}>{nurseByProvince[0]?.province || '-'}</Text>
              <Text style={styles.trafficTeaserStatLabel}>พยาบาลเด่น</Text>
            </View>
            <View style={styles.trafficTeaserStatCard}>
              <Text style={styles.trafficTeaserStatValue}>{jobsByProvince[0]?.province || '-'}</Text>
              <Text style={styles.trafficTeaserStatLabel}>งานเด่น</Text>
            </View>
            <View style={styles.trafficTeaserStatCard}>
              <Text style={styles.trafficTeaserStatValue}>{postingTimeBuckets[0]?.label.split(' ')[0] || '-'}</Text>
              <Text style={styles.trafficTeaserStatLabel}>ช่วงเวลาพีค</Text>
            </View>
          </View>
        </View>

        {commerceStatus && (
          <>
            <Text style={styles.sectionTitle}>สถานะการเปิดชำระเงิน</Text>
            <View style={styles.commercePanel}>
              <View style={styles.commercePanelHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commercePanelTitle}>{commercePanelTitle}</Text>
                  <Text style={styles.commercePanelSubtitle}>
                    {commerceStatus.monetizationEnabled
                      ? `สถานะปัจจุบันเปิดระบบชำระเงินจริงแล้ว โดยเหตุผลล่าสุดคือ ${thresholdReasonLabel}`
                      : commerceStatus.billingActivationBlocked
                        ? 'ผู้ดูแลเลือกเปิดชำระเงินจริงแล้ว แต่ระบบยังรอช่องทางชำระเงินจริงพร้อมใช้งานก่อน'
                        : commerceStatus.transitionReviewRequired
                          ? commerceStatus.billingProviderReady
                            ? `ถึงเงื่อนไข ${thresholdReasonLabel} แล้ว ระบบยังใช้ฟรีต่อจนกว่าผู้ดูแลจะอนุมัติเปิดชำระเงินจริง`
                            : `ถึงเงื่อนไข ${thresholdReasonLabel} แล้ว แต่ระบบยังใช้ฟรีต่อจนกว่าช่องทางชำระเงินจริงจะพร้อมและผู้ดูแลอนุมัติ`
                          : `ใช้ฟรีถึง ${formatDate(commerceStatus.freeAccessEndsAt)} หรือครบ ${COMMERCE_CONFIG.freeAccessMaxUsers.toLocaleString()} บัญชีที่เข้าเกณฑ์ใช้งาน แล้วระบบจะเปลี่ยนเป็นสถานะรอพิจารณาการเปิดชำระเงิน`}
                  </Text>
                </View>
                <Badge
                  label={commerceBadgeLabel}
                  color={commerceBadgeColor}
                  bg={commerceBadgeBg}
                />
              </View>

              <View style={styles.commerceStatsRow}>
                <View style={styles.commerceStatBox}>
                  <Text style={styles.commerceStatLabel}>บัญชีที่เข้าเกณฑ์ launch</Text>
                  <Text style={styles.commerceStatValue}>{commerceStatus.totalUsers != null ? commerceStatus.totalUsers.toLocaleString() : '-'}</Text>
                  <Text style={styles.commerceStatHint}>นับเฉพาะบัญชี active ที่เป็นกลุ่มใช้งานหลัก เกณฑ์ {COMMERCE_CONFIG.freeAccessMaxUsers.toLocaleString()} บัญชี</Text>
                </View>
                <View style={styles.commerceStatBox}>
                  <Text style={styles.commerceStatLabel}>วันสิ้นสุดช่วงใช้ฟรี</Text>
                  <Text style={styles.commerceStatValue}>{formatDate(commerceStatus.freeAccessEndsAt)}</Text>
                  <Text style={styles.commerceStatHint}>เริ่มนับจาก {formatDate(COMMERCE_CONFIG.freeAccessStartDate)}</Text>
                </View>
                <View style={styles.commerceStatBox}>
                  <Text style={styles.commerceStatLabel}>คงเหลือก่อนถึงเกณฑ์</Text>
                  <Text style={styles.commerceStatValue}>{remainingUsers != null ? remainingUsers.toLocaleString() : '-'}</Text>
                  <Text style={styles.commerceStatHint}>คำนวณจากบัญชีที่เข้าเกณฑ์ launch</Text>
                </View>
              </View>

              <View style={styles.commerceMetaRow}>
                <View style={styles.commerceMetaPill}>
                  <Text style={styles.commerceMetaLabel}>โหมดปัจจุบัน</Text>
                  <Text style={styles.commerceMetaValue}>{overrideLabel}</Text>
                </View>
                <View style={styles.commerceMetaPill}>
                  <Text style={styles.commerceMetaLabel}>เหตุผลที่ใช้ตัดสินใจ</Text>
                  <Text style={styles.commerceMetaValue}>{thresholdReasonLabel}</Text>
                </View>
                <View style={styles.commerceMetaPill}>
                  <Text style={styles.commerceMetaLabel}>สถานะการทบทวน</Text>
                  <Text style={styles.commerceMetaValue}>
                    {commerceStatus.monetizationEnabled
                      ? 'เปิดชำระเงินจริงแล้ว'
                      : commerceStatus.transitionReviewRequired
                        ? 'ถึงเกณฑ์และรอผู้ดูแลอนุมัติ'
                        : 'ยังอยู่ในช่วงทดลองตลาด'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}

        {analyticsSummary && (
          <>
            <Text style={styles.sectionTitle}>การใช้งาน 7 วันล่าสุด</Text>
            <View style={styles.statsGrid}>
              <StatCard
                icon="pulse"
                label="ผู้ใช้ต่อวัน"
                value={analyticsOverview.dau}
                color={COLORS.primary}
                sub={`ผู้ใช้ต่อสัปดาห์ ${analyticsOverview.wau}`}
              />
              <StatCard
                icon="calendar"
                label="ผู้ใช้ต่อเดือน"
                value={analyticsOverview.mau}
                color={COLORS.secondary}
                sub={`ใหม่ ${analyticsOverview.newUsers7d}`}
              />
              <StatCard
                icon="git-network"
                label="กดสมัครงาน"
                value={`${Math.round(analyticsOverview.applicationRate * 100)}%`}
                color={COLORS.accent}
                sub={`${analyticsOverview.applications7d} ใบสมัคร`}
              />
              <StatCard
                icon="chatbubble-ellipses"
                label="เริ่มคุยในแชท"
                value={`${Math.round(analyticsOverview.chatStartRate * 100)}%`}
                color="#1D7A72"
                sub={`${analyticsOverview.chatClicks7d} คลิกแชท`}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>ที่มาของข้อมูล</Text>
                <Text style={styles.breakdownCountWide}>{analyticsSourceLabel}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>อัปเดตล่าสุด</Text>
                <Text style={styles.breakdownCountWide}>{analyticsSummary.freshness ? formatDateTime(new Date(analyticsSummary.freshness)) : '-'}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>คนเปิดดูรายละเอียดงาน</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.jobDetailViews7d.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>ประกาศงานใหม่</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.jobsPosted7d.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>กดแชร์ประกาศงาน</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.shareClicks7d.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>เปิดจากการแจ้งเตือน</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.notificationOpens7d.toLocaleString()}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>ฟีเจอร์ที่คนใช้จริงใน 7 วันล่าสุด</Text>
            <View style={styles.card}>
              <View style={styles.featureUsageSummaryRow}>
                <View style={styles.featureUsageSummaryBox}>
                  <Text style={styles.featureUsageSummaryValue}>{featureUsageSummary.totalTrackedEvents7d.toLocaleString()}</Text>
                  <Text style={styles.featureUsageSummaryLabel}>event ที่ใช้วัดฟีเจอร์</Text>
                </View>
                <View style={styles.featureUsageSummaryBox}>
                  <Text style={styles.featureUsageSummaryValue}>{featureUsageSummary.totalTrackedUsers7d.toLocaleString()}</Text>
                  <Text style={styles.featureUsageSummaryLabel}>ผู้ใช้ที่แตะฟีเจอร์เหล่านี้</Text>
                </View>
              </View>

              {featureUsageSummary.topFeatures.length > 0 ? featureUsageSummary.topFeatures.map((item, index) => {
                const tone = getFeatureRecommendationTone(item.recommendation);
                return (
                  <View key={item.key} style={styles.featureUsageRow}>
                    <View style={styles.featureUsageRankWrap}>
                      <Text style={styles.featureUsageRankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.featureUsageBody}>
                      <View style={styles.featureUsageTitleRow}>
                        <Text style={styles.featureUsageLabel}>{item.label}</Text>
                        <View style={[styles.featureUsageBadge, tone.badge]}>
                          <Text style={[styles.featureUsageBadgeText, tone.text]}>{item.recommendationLabel}</Text>
                        </View>
                      </View>
                      <Text style={styles.featureUsageMeta}>
                        {item.usageCount7d.toLocaleString()} ครั้ง · {item.uniqueUsers7d.toLocaleString()} คน · share {formatAnalyticsPercent(item.shareOfTrackedEvents)}
                      </Text>
                      {item.conversionLabel ? (
                        <Text style={styles.featureUsageConversion}>
                          {item.conversionLabel} {formatAnalyticsPercent(item.conversionRate7d)}
                        </Text>
                      ) : null}
                      <Text style={styles.featureUsageNote}>{item.businessNote}</Text>
                    </View>
                  </View>
                );
              }) : (
                <Text style={styles.analyticsBlockersText}>ยังไม่มี event usage เพียงพอสำหรับจัดอันดับฟีเจอร์</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>ฟีเจอร์ที่น่าทดลองคิดเงินหรือจำกัดโควตาก่อน</Text>
            <View style={styles.card}>
              {featureUsageSummary.pricingCandidates.length > 0 ? featureUsageSummary.pricingCandidates.map((item) => (
                <View key={item.key} style={styles.featureFocusRow}>
                  <View style={styles.featureFocusHeaderRow}>
                    <Text style={styles.featureFocusTitle}>{item.label}</Text>
                    <Text style={styles.featureFocusCount}>{item.usageCount7d.toLocaleString()} ครั้ง</Text>
                  </View>
                  <Text style={styles.featureFocusMeta}>{item.uniqueUsers7d.toLocaleString()} คนใช้ · share {formatAnalyticsPercent(item.shareOfTrackedEvents)}</Text>
                  <Text style={styles.featureUsageNote}>{item.pricingModelHint}</Text>
                  <Text style={styles.featureUsageConversion}>{item.businessNote}</Text>
                </View>
              )) : (
                <Text style={styles.analyticsBlockersText}>ตอนนี้ยังไม่มีฟีเจอร์ที่ usage ชัดพอสำหรับทดลองคิดเงิน ควรรอ data เพิ่มอีกเล็กน้อย</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>ฟีเจอร์ที่ควรทบทวนก่อนลงทุนเพิ่ม</Text>
            <View style={styles.card}>
              {featureUsageSummary.lowUsageFeatures.length > 0 ? featureUsageSummary.lowUsageFeatures.map((item) => (
                <View key={item.key} style={styles.featureFocusRow}>
                  <View style={styles.featureFocusHeaderRow}>
                    <Text style={styles.featureFocusTitle}>{item.label}</Text>
                    <Text style={styles.featureFocusCount}>{item.usageCount7d.toLocaleString()} ครั้ง</Text>
                  </View>
                  <Text style={styles.featureFocusMeta}>{item.uniqueUsers7d.toLocaleString()} คนใช้ · share {formatAnalyticsPercent(item.shareOfTrackedEvents)}</Text>
                  <Text style={styles.featureUsageNote}>{item.businessNote}</Text>
                </View>
              )) : (
                <Text style={styles.analyticsBlockersText}>ยังไม่มีฟีเจอร์ที่ต่ำผิดปกติ ทุกฟีเจอร์ที่วัดอยู่ยังมีการใช้งานพอสมควร</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>สัญญาณธุรกิจ 7 วันล่าสุด</Text>
            <View style={styles.statsGrid}>
              <StatCard
                icon="rocket"
                label="เปิดใช้งานสำเร็จ"
                value={analyticsOverview.activatedUsers7d}
                color="#7C3AED"
                sub={`ผู้ใช้ใหม่ ${analyticsOverview.newUsers7d}`}
              />
              <StatCard
                icon="briefcase"
                label="งานที่มีผู้สมัคร"
                value={analyticsOverview.jobsWithApplicants7d}
                color="#B45309"
                sub={`จาก ${analyticsOverview.jobsPosted7d} งานใหม่`}
              />
              <StatCard
                icon="water"
                label="Liquidity"
                value={`${Math.round(analyticsOverview.liquidityRate * 100)}%`}
                color="#0F766E"
                sub={`ผู้สมัครไม่ซ้ำ ${analyticsOverview.uniqueApplicants7d}`}
              />
              <StatCard
                icon="checkmark-done"
                label="Apply completion"
                value={`${Math.round(analyticsOverview.applyCompletionRate * 100)}%`}
                color="#2563EB"
                sub={`กดสมัคร ${analyticsOverview.applyClicks7d}`}
              />
            </View>

            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>ผู้โพสต์งานไม่ซ้ำ</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.uniquePosters7d.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>ผู้สมัครไม่ซ้ำ</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.uniqueApplicants7d.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>ห้องแชทที่เริ่มคุยจริง</Text>
                <Text style={styles.breakdownCountWide}>{analyticsOverview.conversationStarts7d.toLocaleString()}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>ความพร้อมเปิดชำระเงินจริง</Text>
                <View style={[styles.analyticsCheckStatus, monetizationReadiness.recommended ? styles.analyticsCheckStatusPass : styles.analyticsCheckStatusWarn]}>
                  <Text style={[styles.analyticsCheckStatusText, monetizationReadiness.recommended ? styles.analyticsCheckStatusTextPass : styles.analyticsCheckStatusTextWarn]}>
                    {monetizationReadiness.recommended
                      ? `พร้อม ${Math.round(monetizationReadiness.score * 100)}%`
                      : `ยังไม่พร้อม ${Math.round(monetizationReadiness.score * 100)}%`}
                  </Text>
                </View>
              </View>
              {monetizationReadiness.checks.map((check) => (
                <View key={check.key} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabelWide}>{check.label}</Text>
                  <View style={[styles.analyticsCheckStatus, check.passed ? styles.analyticsCheckStatusPass : styles.analyticsCheckStatusWarn]}>
                    <Text style={[styles.analyticsCheckStatusText, check.passed ? styles.analyticsCheckStatusTextPass : styles.analyticsCheckStatusTextWarn]}>
                      {check.unit === 'ratio'
                        ? `${Math.round(check.current * 100)}% / ${Math.round(check.target * 100)}%`
                        : `${check.current.toLocaleString()} / ${check.target.toLocaleString()}`}
                    </Text>
                  </View>
                </View>
              ))}
              {monetizationReadiness.blockers.length > 0 && (
                <Text style={styles.analyticsBlockersText}>
                  ยังต้องเร่ง: {monetizationReadiness.blockers.join(' • ')}
                </Text>
              )}
            </View>
          </>
        )}

        {retentionMonitor && (
          <>
            <Text style={styles.sectionTitle}>การกลับมาใช้งาน</Text>
            <View style={styles.card}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelWide}>อัปเดตเมื่อ</Text>
                <Text style={styles.breakdownCountWide}>{formatDateTime(new Date(retentionMonitor.generatedAt))}</Text>
              </View>
              {retentionMonitor.collections.map((item) => (
                <View key={item.key} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabelWide}>{item.label}</Text>
                  <Text style={styles.breakdownCountWide}>{item.count.toLocaleString()} คน · {item.retentionDays} วัน</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.overviewCompactGrid}>
          {compactOverviewGroups.map((group) => (
            <View key={group.key} style={styles.overviewCompactCard}>
              <Text style={styles.overviewCompactTitle}>{group.title}</Text>
              {group.items.map((item) => (
                <View key={item.key} style={styles.breakdownRow}>
                  <View style={[styles.roleDot, { backgroundColor: item.color }]} />
                  <Text style={styles.breakdownLabel}>{item.label}</Text>
                  <View style={styles.breakdownBarBg}>
                    <View style={[styles.breakdownBarFill, { width: `${item.pct}%`, backgroundColor: item.color }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{item.count}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Recent Users */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitleCompact}>สมาชิกที่เพิ่งเข้ามา</Text>
            <Text style={styles.sectionSubtitle}>เปิดดูต่อได้ทันทีถ้าต้องช่วยตรวจสอบหรือแก้ปัญหา</Text>
          </View>
          <TouchableOpacity style={styles.sectionLinkBtn} onPress={() => setActiveTab('users')}>
            <Text style={styles.sectionLinkText}>ดูทั้งหมด</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        {users.slice(0, 3).map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.listItem}
            onPress={() => { setSelectedUser(u); setUserModalVisible(true); }}
          >
            <Avatar uri={u.photoURL} name={u.displayName} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.listItemTitle}>{u.displayName}</Text>
              <Text style={styles.listItemSub}>{u.email}</Text>
            </View>
            <Badge {...getRoleBadge(u.role)} />
          </TouchableOpacity>
        ))}
        {/* Recent Jobs */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.sectionTitleCompact}>ประกาศงานล่าสุด</Text>
            <Text style={styles.sectionSubtitle}>ใช้ดูความเคลื่อนไหวล่าสุดและกดเข้าไปจัดการต่อได้เลย</Text>
          </View>
          <TouchableOpacity style={styles.sectionLinkBtn} onPress={() => setActiveTab('jobs')}>
            <Text style={styles.sectionLinkText}>ดูทั้งหมด</Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        {jobs.slice(0, 3).map((j) => (
          <TouchableOpacity
            key={j.id}
            style={styles.listItem}
            onPress={() => { setSelectedJob(j); setJobModalVisible(true); }}
          >
            <View style={[styles.avatar, { backgroundColor: getStatusBadge(j.status).bg }]}>
              <Ionicons name="briefcase" size={18} color={getStatusBadge(j.status).color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{j.title}</Text>
              <Text style={styles.listItemSub}>{j.posterName} · {formatDate(j.createdAt)}</Text>
            </View>
            <Badge {...getStatusBadge(j.status)} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 12 }} />
      </View>
    );
  }

  function renderTraffic() {
    const topNurseProvinces = nurseByProvince.slice(0, 8);
    const topJobProvinces = jobsByProvince.slice(0, 8);
    const hasTrafficFilters = trafficProvinceFilter !== 'all' || trafficTimeFilter !== 'all';

    return (
      <View>
        <View style={styles.trafficHeroCard}>
          <View style={styles.trafficHeroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trafficHeroTitle}>พื้นที่และทราฟฟิกการใช้งาน</Text>
              <Text style={styles.trafficHeroSubtitle}>
                ใช้ดูว่าพื้นที่ไหนคนสมัครเยอะ งานเยอะ หรือช่วงเวลาไหนคนเริ่มปล่อยงานมากขึ้น ข้อมูลชุดนี้สดตามการรีเฟรชของหน้า
              </Text>
            </View>
            <TouchableOpacity style={styles.trafficHeroButton} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
              <Text style={styles.trafficHeroButtonText}>รีเฟรช</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.trafficHeroMetaRow}>
            <Text style={styles.trafficHeroMetaText}>อัปเดตล่าสุด {lastRefreshedAt ? formatDateTime(lastRefreshedAt) : '-'}</Text>
            <Text style={styles.trafficHeroMetaText}>งานที่กำลังดู {trafficJobs.length.toLocaleString()} งาน</Text>
          </View>
          {trafficLoading ? (
            <View style={styles.inlineLoadingRow}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.inlineLoadingText}>กำลังอัปเดตข้อมูลพื้นที่และทราฟฟิก...</Text>
            </View>
          ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRowCompact}>
            {[{ key: 'all', label: 'ทุกจังหวัด' }, ...availableJobProvinces.slice(0, 12).map((province) => ({ key: province, label: province }))].map((item) => {
              const active = trafficProvinceFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setTrafficProvinceFilter(item.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRowCompact}>
            {[{ key: 'all', label: 'ทุกช่วงเวลา' }, ...postingTimeBuckets.map((item) => ({ key: item.label, label: item.label.split(' ')[0] }))].map((item) => {
              const active = trafficTimeFilter === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setTrafficTimeFilter(item.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.trafficResetRow}>
            <TouchableOpacity
              style={[styles.trafficResetButton, trafficTimeFilter === 'all' && styles.trafficResetButtonDisabled]}
              onPress={() => setTrafficTimeFilter('all')}
              disabled={trafficTimeFilter === 'all'}
            >
              <Ionicons name="time-outline" size={14} color={trafficTimeFilter === 'all' ? COLORS.textLight : COLORS.primary} />
              <Text style={[styles.trafficResetButtonText, trafficTimeFilter === 'all' && styles.trafficResetButtonTextDisabled]}>ล้างช่วงเวลา</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.trafficResetButton, !hasTrafficFilters && styles.trafficResetButtonDisabled]}
              onPress={() => {
                setTrafficProvinceFilter('all');
                setTrafficTimeFilter('all');
              }}
              disabled={!hasTrafficFilters}
            >
              <Ionicons name="close-circle-outline" size={14} color={!hasTrafficFilters ? COLORS.textLight : COLORS.error} />
              <Text style={[styles.trafficResetButtonText, !hasTrafficFilters ? styles.trafficResetButtonTextDisabled : styles.trafficResetButtonTextDanger]}>ล้างทั้งหมด</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.areaInsightsGrid}>
          <View style={styles.areaInsightCard}>
            <View style={styles.areaInsightHeader}>
              <Text style={styles.areaInsightTitle}>จังหวัดที่พยาบาลเยอะ</Text>
              <Text style={styles.areaInsightCaption}>กดดูรายชื่อได้</Text>
            </View>
            {topNurseProvinces.length > 0 ? topNurseProvinces.map((item) => (
              <TouchableOpacity
                key={item.province}
                style={styles.areaInsightRow}
                onPress={() => openUsersByProvince(item.province, 'nurse')}
                activeOpacity={0.75}
              >
                <Text style={styles.areaInsightLabel}>{item.province}</Text>
                <View style={styles.areaInsightRowRight}>
                  <Text style={styles.areaInsightValue}>{item.count.toLocaleString()} คน</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            )) : <Text style={styles.areaInsightEmpty}>ยังไม่มีข้อมูลจังหวัดของพยาบาลมากพอ</Text>}
          </View>

          <View style={styles.areaInsightCard}>
            <View style={styles.areaInsightHeader}>
              <Text style={styles.areaInsightTitle}>จังหวัดที่งานเยอะ</Text>
              <Text style={styles.areaInsightCaption}>กดไปหน้ารายการงาน</Text>
            </View>
            {topJobProvinces.length > 0 ? topJobProvinces.map((item) => (
              <TouchableOpacity
                key={item.province}
                style={styles.areaInsightRow}
                onPress={() => openJobsByProvince(item.province)}
                activeOpacity={0.75}
              >
                <Text style={styles.areaInsightLabel}>{item.province}</Text>
                <View style={styles.areaInsightRowRight}>
                  <Text style={styles.areaInsightValue}>{item.count.toLocaleString()} งาน</Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
                </View>
              </TouchableOpacity>
            )) : <Text style={styles.areaInsightEmpty}>ยังไม่มีข้อมูลจังหวัดของงานมากพอ</Text>}
          </View>

          <View style={styles.areaInsightCardWide}>
            <View style={styles.areaInsightHeader}>
              <Text style={styles.areaInsightTitle}>ช่วงเวลาที่คนปล่อยงานเยอะ</Text>
              <Text style={styles.areaInsightCaption}>เรียงจากมากไปน้อย</Text>
            </View>
            <View style={styles.timeInsightWrap}>
              {postingTimeBuckets.slice(0, 4).map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.timeInsightChip, trafficTimeFilter === item.label && styles.timeInsightChipActive]}
                  onPress={() => setTrafficTimeFilter(item.label)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.timeInsightRank}>#{index + 1}</Text>
                  <Text style={styles.timeInsightLabel}>{item.label}</Text>
                  <Text style={styles.timeInsightValue}>{item.count.toLocaleString()} งาน</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.areaInsightCardWide}>
            <View style={styles.areaInsightHeader}>
              <Text style={styles.areaInsightTitle}>วันไหนปล่อยงานเยอะ</Text>
              <Text style={styles.areaInsightCaption}>ดูแนวโน้มรายวัน</Text>
            </View>
            <View style={styles.timeInsightWrap}>
              {jobsByWeekday.slice(0, 7).map((item, index) => (
                <View key={item.label} style={styles.timeInsightChip}>
                  <Text style={styles.timeInsightRank}>#{index + 1}</Text>
                  <Text style={styles.timeInsightLabel}>{item.label}</Text>
                  <Text style={styles.timeInsightValue}>{item.count.toLocaleString()} งาน</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.areaInsightCardWide}>
            <View style={styles.areaInsightHeader}>
              <Text style={styles.areaInsightTitle}>พื้นที่ที่งานเริ่มแน่น</Text>
              <Text style={styles.areaInsightCaption}>เทียบจำนวนงานกับพยาบาลในจังหวัดเดียวกัน</Text>
            </View>
            <View style={styles.areaBalanceWrap}>
              {demandBalanceRows.slice(0, 6).map((item) => (
                <TouchableOpacity
                  key={item.province}
                  style={styles.areaBalanceRow}
                  onPress={() => openJobsByProvince(item.province)}
                  activeOpacity={0.75}
                >
                  <View>
                    <Text style={styles.areaBalanceProvince}>{item.province}</Text>
                    <Text style={styles.areaBalanceMeta}>งาน {item.jobsCount.toLocaleString()} · พยาบาล {item.nurseCount.toLocaleString()}</Text>
                  </View>
                  <Text style={styles.areaBalancePressure}>{item.pressure.toFixed(2)}x</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.areaInsightCardWide}>
            <View style={styles.areaInsightHeader}>
              <Text style={styles.areaInsightTitle}>ภาพรวมตามภาค</Text>
              <Text style={styles.areaInsightCaption}>ดูสมดุลพยาบาลกับงานแบบเร็ว ๆ</Text>
            </View>
            <View style={styles.regionSummaryWrap}>
              {regionSummaries.map((item) => (
                <View key={item.region} style={styles.regionSummaryRow}>
                  <Text style={styles.regionSummaryLabel}>{item.region}</Text>
                  <View style={styles.regionSummaryBars}>
                    <View style={[styles.regionSummaryBar, { backgroundColor: COLORS.primaryBackground }]}> 
                      <Text style={styles.regionSummaryBarText}>พยาบาล {item.nurses.toLocaleString()}</Text>
                    </View>
                    <View style={[styles.regionSummaryBar, { backgroundColor: COLORS.warningLight }]}> 
                      <Text style={styles.regionSummaryBarText}>งาน {item.jobsCount.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ height: 24 }} />
      </View>
    );
  }

  // ============================================
  // TAB: USERS
  // ============================================
  function renderUsers() {
    return (
      <View>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
            placeholderTextColor={COLORS.textLight}
            value={userSearch}
            onChangeText={setUserSearch}
          />
          {userSearch.length > 0 && (
            <TouchableOpacity onPress={() => setUserSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[{ key: 'all', label: 'ทั้งหมด' }, { key: 'nurse', label: 'พยาบาล' }, { key: 'hospital', label: 'โรงพยาบาล' }, { key: 'admin', label: 'Admin' }, { key: 'user', label: 'ผู้ใช้ทั่วไป' }].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setUserRoleFilter(f.key)}
              style={[styles.filterChip, userRoleFilter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, userRoleFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>
          {userSearch.trim().length >= 2
            ? `ค้นหาเจอ ${filteredUsers.length} คน`
            : `แสดง ${filteredUsers.length} คนในหน้านี้`}
        </Text>

        {userSearchLoading ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.inlineLoadingText}>กำลังค้นหาบัญชี...</Text>
          </View>
        ) : null}

        {userRoleFilter !== 'all' && (
          <TouchableOpacity
            style={[styles.bulkResetCard, bulkRoleResetting === userRoleFilter && { opacity: 0.6 }]}
            onPress={() => handleBulkResetRoleAccess(userRoleFilter as 'user' | 'nurse' | 'hospital' | 'admin')}
            disabled={bulkRoleResetting === userRoleFilter}
          >
            {bulkRoleResetting === userRoleFilter ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : (
              <Ionicons name="refresh-circle-outline" size={20} color={COLORS.accent} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.bulkResetTitle}>รีเซ็ตสิทธิ์รายเดือนตาม role ที่เลือก</Text>
              <Text style={styles.bulkResetSub}>ล้าง monthly usage, postsToday และ free urgent ของ role {userRoleFilter}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* User List */}
        {filteredUsers.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.userCard}
            onPress={() => { setSelectedUser(u); setUserModalVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.userCardHeader}>
              <Avatar uri={u.photoURL} name={u.displayName} size={40} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.userCardName} numberOfLines={1}>{u.displayName}</Text>
                  {u.isVerified && (
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.verified} />
                  )}
                  {!u.isActive && (
                    <View style={styles.suspendedChip}>
                      <Text style={styles.suspendedChipText}>ระงับ</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userCardEmail} numberOfLines={1}>{u.email}</Text>
              </View>
              <Badge {...getRoleBadge(u.role)} />
            </View>
            <View style={styles.userCardFooter}>
              <View style={styles.userCardMeta}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textLight} />
                <Text style={styles.userCardMetaText}>สมัคร {formatDate(u.createdAt)}</Text>
              </View>
              {u.phone && (
                <View style={styles.userCardMeta}>
                  <Ionicons name="call-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.userCardMetaText}>{u.phone}</Text>
                </View>
              )}
              {u.licenseNumber && (
                <View style={styles.userCardMeta}>
                  <Ionicons name="document-text-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.userCardMetaText}>{u.licenseNumber}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {filteredUsers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ไม่พบผู้ใช้ที่ตรงเงื่อนไข</Text>
          </View>
        )}

        {userSearch.trim().length < 2 && usersTabLoading && filteredUsers.length > 0 ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.inlineLoadingText}>กำลังโหลดสมาชิกเพิ่ม...</Text>
          </View>
        ) : null}

        {userSearch.trim().length < 2 && usersTabHasMore ? (
          <TouchableOpacity
            style={[styles.loadMoreButton, usersTabLoading && { opacity: 0.6 }]}
            onPress={() => loadUsersList(false)}
            disabled={usersTabLoading}
          >
            {usersTabLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.loadMoreButtonText}>โหลดสมาชิกเพิ่ม</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  // ============================================
  // TAB: JOBS
  // ============================================
  function renderJobs() {
    return (
      <View>
        {/* Status Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[{ key: 'all', label: 'ทั้งหมด' }, { key: 'active', label: 'เปิดรับ' }, { key: 'urgent', label: 'ด่วน' }, { key: 'closed', label: 'ปิดแล้ว' }].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setJobStatusFilter(f.key)}
              style={[styles.filterChip, jobStatusFilter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, jobStatusFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRowCompact}>
          {[{ key: 'all', label: 'ทุกจังหวัด' }, ...availableJobProvinces.slice(0, 12).map((province) => ({ key: province, label: province }))].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setJobProvinceFilter(f.key)}
              style={[styles.filterChip, jobProvinceFilter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, jobProvinceFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>
          แสดง {filteredJobs.length} งานในหน้านี้
        </Text>

        {/* Jobs List */}
        {filteredJobs.map((j) => (
          <TouchableOpacity
            key={j.id}
            style={styles.jobCard}
            onPress={() => { setSelectedJob(j); setJobModalVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.jobCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobCardTitle} numberOfLines={1}>{j.title}</Text>
                <Text style={styles.jobCardPoster}>{j.posterName}</Text>
              </View>
              <Badge {...getStatusBadge(j.status)} />
            </View>

            <View style={styles.jobCardBody}>
              {j.department ? (
                <View style={styles.jobCardTag}>
                  <Ionicons name="medical-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobCardTagText}>{j.department}</Text>
                </View>
              ) : null}
              {j.province ? (
                <View style={styles.jobCardTag}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobCardTagText}>{j.province}</Text>
                </View>
              ) : null}
              {j.shiftRate > 0 && (
                <View style={styles.jobCardTag}>
                  <Ionicons name="cash-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobCardTagText}>฿{j.shiftRate.toLocaleString()}</Text>
                </View>
              )}
            </View>

            <View style={styles.jobCardFooter}>
              <Text style={styles.jobCardFooterText}>
                {formatDate(j.createdAt)}
                {j.shiftDate ? ` · กะ ${formatDate(j.shiftDate)}` : ''}
                {j.shiftTime ? ` ${j.shiftTime}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={styles.jobCardStat}>
                  <Ionicons name="eye-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.jobCardStatText}>{j.viewsCount}</Text>
                </View>
                <View style={styles.jobCardStat}>
                  <Ionicons name="people-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.jobCardStatText}>{j.applicantsCount}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ไม่พบงานที่ตรงเงื่อนไข</Text>
          </View>
        )}

        {jobsTabLoading && filteredJobs.length > 0 ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.inlineLoadingText}>กำลังโหลดงานเพิ่ม...</Text>
          </View>
        ) : null}

        {jobsTabHasMore ? (
          <TouchableOpacity
            style={[styles.loadMoreButton, jobsTabLoading && { opacity: 0.6 }]}
            onPress={() => loadJobsList(false)}
            disabled={jobsTabLoading}
          >
            {jobsTabLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.loadMoreButtonText}>โหลดงานเพิ่ม</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  // ============================================
  // TAB: CHATS
  // ============================================
  function renderChats() {
    return (
      <View>
        <Text style={styles.resultCount}>{chatListItems.length} การสนทนาในหน้านี้</Text>

        {chatListItems.map((c) => {
          const names = c.participantDetails?.map((p) => p.displayName || p.name).join(' ↔ ') || c.participants.join(', ');
          return (
            <View key={c.id} style={styles.chatCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatParticipants} numberOfLines={1}>{names}</Text>
                {c.jobTitle && (
                  <Text style={styles.chatJob} numberOfLines={1}>
                    <Ionicons name="briefcase-outline" size={11} color={COLORS.textLight} /> {c.jobTitle}
                  </Text>
                )}
                <Text style={styles.chatLastMsg} numberOfLines={1}>{c.lastMessage || '(ไม่มีข้อความ)'}</Text>
                <Text style={styles.chatTime}>{formatDateTime(c.lastMessageAt)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteChat(c)}
                style={styles.chatDeleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          );
        })}

        {chatListItems.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ยังไม่มีการสนทนา</Text>
          </View>
        )}

        {chatsTabLoading && chatListItems.length > 0 ? (
          <View style={styles.inlineLoadingRow}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.inlineLoadingText}>กำลังโหลดแชตเพิ่ม...</Text>
          </View>
        ) : null}

        {chatsTabHasMore ? (
          <TouchableOpacity
            style={[styles.loadMoreButton, chatsTabLoading && { opacity: 0.6 }]}
            onPress={() => loadChatsList(false)}
            disabled={chatsTabLoading}
          >
            {chatsTabLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.loadMoreButtonText}>โหลดแชตเพิ่ม</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  function renderCodes() {
    const activeCodes = codes.filter((item) => item.isActive).length;
    const expiredCodes = codes.filter((item) => item.rule.expiresAt && item.rule.expiresAt < new Date()).length;

    return (
      <View>
        <View style={styles.codesHeroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.codesHeroTitle}>จัดการโค้ดสิทธิพิเศษ</Text>
            <Text style={styles.codesHeroSub}>สร้างโค้ดโปรโมชัน กำหนดสิทธิประโยชน์และเงื่อนไขได้จากหน้าเดียว</Text>
          </View>
          <TouchableOpacity style={styles.codesHeroButton} onPress={openCreateCodeModal}>
            <Ionicons name="add" size={18} color={COLORS.white} />
            <Text style={styles.codesHeroButtonText}>สร้างโค้ด</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <StatCard icon="pricetags" label="โค้ดทั้งหมด" value={codes.length} color={COLORS.primary} sub="ในระบบ" />
          <StatCard icon="checkmark-circle" label="กำลังใช้งาน" value={activeCodes} color={COLORS.success} sub="เปิดอยู่" />
          <StatCard icon="time" label="หมดอายุแล้ว" value={expiredCodes} color={COLORS.accent} sub="สิ้นสุดแล้ว" />
          <StatCard icon="gift" label="ถูกใช้รวม" value={codes.reduce((sum, item) => sum + item.usedCount, 0)} color={COLORS.secondary} sub="ครั้ง" />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาโค้ดหรือชื่อแคมเปญ..."
            placeholderTextColor={COLORS.textLight}
            value={codeSearch}
            onChangeText={setCodeSearch}
          />
          {codeSearch.length > 0 && (
            <TouchableOpacity onPress={() => setCodeSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[
            { key: 'all', label: 'ทั้งหมด' },
            { key: 'active', label: 'ใช้งานอยู่' },
            { key: 'inactive', label: 'ปิดอยู่' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setCodeStatusFilter(filter.key as 'all' | 'active' | 'inactive')}
              style={[styles.filterChip, codeStatusFilter === filter.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, codeStatusFilter === filter.key && styles.filterChipTextActive]}>{filter.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>แสดง {filteredCodes.length} จาก {codes.length} โค้ด</Text>

        {filteredCodes.map((item) => {
          const statusBadge = getCampaignStatusBadge(item.isActive);
          const benefitBadge = getCampaignBenefitBadge(item.benefitType);
          const expired = Boolean(item.rule.expiresAt && item.rule.expiresAt < new Date());
          return (
            <TouchableOpacity key={item.code} style={styles.codeCard} onPress={() => openEditCodeModal(item)} activeOpacity={0.75}>
              <View style={styles.codeCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.codeValue}>{item.code}</Text>
                  <Text style={styles.codeTitle}>{item.title}</Text>
                  {item.description ? <Text style={styles.codeDescription} numberOfLines={2}>{item.description}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Badge {...statusBadge} />
                  <Badge {...benefitBadge} />
                </View>
              </View>

              <View style={styles.codeMetaRow}>
                <View style={styles.codeMetaChip}>
                  <Ionicons name="gift-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.codeMetaText}>{getCampaignBenefitLabel(item)}</Text>
                </View>
                <View style={styles.codeMetaChip}>
                  <Ionicons name="people-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.codeMetaText}>{item.rule.allowedRoles.map((role) => CAMPAIGN_ROLE_OPTIONS.find((option) => option.key === role)?.label || role).join(', ')}</Text>
                </View>
              </View>

              <View style={styles.codeMetaRow}>
                <View style={styles.codeMetaChip}>
                  <Ionicons name="albums-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.codeMetaText}>
                    {item.rule.allowedPackages.slice(0, 2).map((packageKey) => getCampaignPackageLabel(packageKey)).join(', ')}
                    {item.rule.allowedPackages.length > 2 ? ` +${item.rule.allowedPackages.length - 2}` : ''}
                  </Text>
                </View>
              </View>

              <View style={styles.codeFooter}>
                <Text style={styles.codeFooterText}>ใช้แล้ว {item.usedCount}{item.rule.maxUses != null ? ` / ${item.rule.maxUses}` : ''}</Text>
                <Text style={styles.codeFooterText}>
                  {expired ? 'หมดอายุแล้ว' : item.rule.expiresAt ? `หมดอายุ ${formatDate(item.rule.expiresAt as Date)}` : 'ไม่จำกัดวันหมดอายุ'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {filteredCodes.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="pricetags-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ยังไม่มีโค้ดที่ตรงเงื่อนไข</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  function getBroadcastRoleLabel(role: 'all' | 'user' | 'nurse' | 'hospital' | 'admin') {
    return role === 'all'
      ? 'ทุกประเภทบัญชี'
      : role === 'user'
        ? 'ผู้ใช้ทั่วไป'
        : role === 'nurse'
          ? 'พยาบาล'
          : role === 'hospital'
            ? 'โรงพยาบาล'
            : 'ผู้ดูแลระบบ';
  }

    const toggleBroadcastProvince = (province: string) => {
      setBroadcastTargetProvinces((prev) => (
        prev.includes(province) ? prev.filter((item) => item !== province) : [...prev, province]
      ));
    };

    const toggleBroadcastRegion = (region: string) => {
      const regionProvinces = [...(PROVINCES_BY_REGION as Record<string, readonly string[]>)[region]];
      const regionSelected = regionProvinces.every((province) => broadcastTargetProvinces.includes(province));

      setBroadcastTargetProvinces((prev) => {
        if (regionSelected) {
          return prev.filter((province) => !regionProvinces.includes(province));
        }
        return [...new Set([...prev, ...regionProvinces])];
      });

      setBroadcastSelectedRegions((prev) => (
        regionSelected ? prev.filter((item) => item !== region) : [...new Set([...prev, region])]
      ));
    };

    const fillBroadcastFormFromHistory = (item: (typeof broadcastHistory)[number]) => {
      setBroadcastTitle(item.title || '');
      setBroadcastBody(item.body || '');
      setBroadcastType(item.type === 'promotion' ? 'promotion' : 'system');
      setBroadcastTargetRole(item.targetRole || 'all');
      setBroadcastTargetProvinces(item.targetProvinces || []);
      setBroadcastTargetStaffTypes(item.targetStaffTypes || []);
      setBroadcastActiveWithinDays(item.activeWithinDays ? String(item.activeWithinDays) : '');
      setBroadcastNeverPosted(item.neverPosted === true);
      setBroadcastTargetScreen(item.targetScreen || '');
      setBroadcastCampaignName(item.campaignName || '');
      setBroadcastSelectedRegions(
        REGIONS.filter((region) => {
          const regionProvinces = [...(PROVINCES_BY_REGION as Record<string, readonly string[]>)[region]];
          return regionProvinces.every((province) => (item.targetProvinces || []).includes(province));
        })
      );
      setBroadcastOnlyVerified(item.onlyVerified === true);
      setBroadcastActiveOnly(item.activeOnly !== false);
      setBroadcastProvinceSearch('');
      setBroadcastPreview(null);
      setBroadcastAbEnabled(Boolean(item.variantStats && Object.keys(item.variantStats).length >= 2));
      const variants = Object.entries(item.variantStats || {});
      setBroadcastVariantATitle(String(variants[0]?.[1]?.title || ''));
      setBroadcastVariantABody(String(variants[0]?.[1]?.body || ''));
      setBroadcastVariantBTitle(String(variants[1]?.[1]?.title || ''));
      setBroadcastVariantBBody(String(variants[1]?.[1]?.body || ''));
    };

    const buildBroadcastVariants = () => {
      if (!broadcastAbEnabled) return [];
      const variants = [
        { id: 'A', title: broadcastVariantATitle.trim(), body: broadcastVariantABody.trim() },
        { id: 'B', title: broadcastVariantBTitle.trim(), body: broadcastVariantBBody.trim() },
      ].filter((item) => item.title && item.body);
      return variants.length === 2 ? variants : [];
    };

    const resetBroadcastComposer = () => {
      setBroadcastTitle('');
      setBroadcastBody('');
      setBroadcastTargetProvinces([]);
      setBroadcastSelectedRegions([]);
      setBroadcastProvinceSearch('');
      setBroadcastPreview(null);
      setBroadcastTargetStaffTypes([]);
      setBroadcastActiveWithinDays('');
      setBroadcastNeverPosted(false);
      setBroadcastTargetScreen('');
      setBroadcastCampaignName('');
      setBroadcastScheduleAt('');
      setBroadcastAbEnabled(false);
      setBroadcastVariantATitle('');
      setBroadcastVariantABody('');
      setBroadcastVariantBTitle('');
      setBroadcastVariantBBody('');
    };

    const applyTemplateToComposer = (item: BroadcastTemplateItem) => {
      setBroadcastTitle(item.title || '');
      setBroadcastBody(item.body || '');
      setBroadcastType(item.type === 'promotion' ? 'promotion' : 'system');
      setBroadcastTargetScreen(item.targetScreen || '');
      setBroadcastTemplateName(item.name || '');
    };

    async function saveCurrentTemplate() {
      if (!broadcastTemplateName.trim() || !broadcastTitle.trim() || !broadcastBody.trim()) {
        Alert.alert('ข้อมูลไม่ครบ', 'กรุณาระบุชื่อข้อความสำเร็จรูป หัวข้อ และข้อความ');
        return;
      }

      try {
        setSavingTemplate(true);
        await saveBroadcastTemplate({
          name: broadcastTemplateName.trim(),
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          type: broadcastType,
          targetScreen: broadcastTargetScreen.trim() || undefined,
        });
        setTemplates(await listBroadcastTemplates());
        Alert.alert('บันทึกแล้ว', 'เพิ่มข้อความสำเร็จรูปเรียบร้อย');
      } catch (error: any) {
        Alert.alert('บันทึกไม่สำเร็จ', error?.message || 'ไม่สามารถบันทึกข้อความสำเร็จรูปได้');
      } finally {
        setSavingTemplate(false);
      }
    }

    async function loadBroadcastAnalyticsForItem(item: (typeof broadcastHistory)[number]) {
      try {
        setLoadingBroadcastAnalyticsId(item.id);
        const analytics = await getBroadcastAnalytics(item.id);
        setSelectedBroadcastAnalytics(analytics);
      } finally {
        setLoadingBroadcastAnalyticsId(null);
      }
    }

    async function saveFraudControlSettings() {
      try {
        setSavingFraudControls(true);
        await updateFraudControls({
          blacklistKeywords: fraudKeywordInput.split(',').map((item) => item.trim()).filter(Boolean),
          transferWarningTitle: fraudWarningTitle.trim(),
          transferWarningBody: fraudWarningBody.trim(),
        });
        const refreshed = await getFraudAlertCenter();
        setFraudCenter(refreshed);
        Alert.alert('บันทึกแล้ว', 'อัปเดตการป้องกันความเสี่ยงเรียบร้อย');
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถบันทึกการป้องกันความเสี่ยงได้');
      } finally {
        setSavingFraudControls(false);
      }
    }

    async function handleArchiveTemplate(item: BroadcastTemplateItem) {
      try {
        setTemplateActionId(item.id);
        await archiveBroadcastTemplate(item.id);
        setTemplates(await listBroadcastTemplates());
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถเก็บข้อความสำเร็จรูปเข้าคลังได้');
      } finally {
        setTemplateActionId(null);
      }
    }

    async function handleDeleteScheduledCampaign(item: ScheduledBroadcastCampaign) {
      try {
        setScheduledActionId(item.id);
        await deleteScheduledBroadcastCampaign(item.id);
        setScheduledCampaigns(await listScheduledBroadcastCampaigns());
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถลบรายการที่ตั้งเวลาไว้ได้');
      } finally {
        setScheduledActionId(null);
      }
    }

    async function handleUpdateFraudFlag(itemId: string, status: 'resolved' | 'dismissed') {
      try {
        setFraudFlagActionId(itemId);
        await updateFraudAlertFlagStatus(itemId, status);
        const refreshed = await getFraudAlertCenter();
        setFraudCenter(refreshed);
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถอัปเดต fraud flag ได้');
      } finally {
        setFraudFlagActionId(null);
      }
    }

    async function handleRunAutomationRule(ruleKey: string, label: string) {
      try {
        setRunningAutomationKey(ruleKey);
        const result = await runCommunicationAutomation(ruleKey);
        Alert.alert('ดำเนินการแล้ว', `${label}: จัดการไปแล้ว ${result.affectedCount.toLocaleString()} รายการ`);
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถเริ่มการทำงานอัตโนมัติได้');
      } finally {
        setRunningAutomationKey(null);
      }
    }

    async function handleRunOperationalAction(actionKey: string, label: string) {
      try {
        setRunningActionKey(actionKey);
        const result = await runOperationalAction(actionKey);
        Alert.alert('ดำเนินการแล้ว', `${label}: จัดการไปแล้ว ${result.affectedCount.toLocaleString()} รายการ`);
        await fetchAll();
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการคำสั่งนี้ได้');
      } finally {
        setRunningActionKey(null);
      }
    }

    async function handleScheduleBroadcast() {
      const scheduledAt = parseDateTimeInput(broadcastScheduleAt);
      if (!broadcastTitle.trim() || !broadcastBody.trim() || !scheduledAt) {
        Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อ ข้อความ และเวลาที่ต้องการตั้งส่ง เป็น YYYY-MM-DD HH:mm');
        return;
      }

      try {
        setSchedulingBroadcast(true);
        await scheduleBroadcastCampaign({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          type: broadcastType,
          targetRole: broadcastTargetRole,
          targetProvinces: broadcastTargetProvinces,
          targetStaffTypes: broadcastTargetStaffTypes,
          activeWithinDays: Number(broadcastActiveWithinDays || 0),
          neverPosted: broadcastNeverPosted,
          targetScreen: broadcastTargetScreen.trim() || undefined,
          campaignName: broadcastCampaignName.trim() || undefined,
          templateKey: broadcastTemplateName.trim() || undefined,
          variants: buildBroadcastVariants(),
          onlyVerified: broadcastOnlyVerified,
          activeOnly: broadcastActiveOnly,
          scheduledAt: scheduledAt.toISOString(),
        });
        setScheduledCampaigns(await listScheduledBroadcastCampaigns());
        Alert.alert('ตั้งเวลาแล้ว', 'บันทึกรายการส่งตามเวลาเรียบร้อย');
      } catch (error: any) {
        Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถตั้งเวลาแคมเปญได้');
      } finally {
        setSchedulingBroadcast(false);
      }
    }

    async function performBroadcastSend(customPayload?: {
      title: string;
      body: string;
      type: 'system' | 'promotion';
      targetRole: 'all' | 'user' | 'nurse' | 'hospital' | 'admin';
      targetProvinces?: string[];
      targetStaffTypes?: string[];
      activeWithinDays?: number;
      neverPosted?: boolean;
      targetScreen?: string;
      campaignName?: string;
      templateKey?: string;
      variants?: Array<{ id?: string; title: string; body: string }>;
      onlyVerified: boolean;
      activeOnly: boolean;
    }) {
      const payload = customPayload || {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        type: broadcastType,
        targetRole: broadcastTargetRole,
        targetProvinces: broadcastTargetProvinces,
        targetStaffTypes: broadcastTargetStaffTypes,
        activeWithinDays: Number(broadcastActiveWithinDays || 0),
        neverPosted: broadcastNeverPosted,
        targetScreen: broadcastTargetScreen.trim(),
        campaignName: broadcastCampaignName.trim(),
        templateKey: broadcastTemplateName.trim(),
        variants: buildBroadcastVariants(),
        onlyVerified: broadcastOnlyVerified,
        activeOnly: broadcastActiveOnly,
      };

      if (!payload.title.trim() || !payload.body.trim()) {
        Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและข้อความ');
        return;
      }

      try {
        setSendingBroadcast(true);
        const result = await sendBroadcastNotification(payload);
        Alert.alert(
          'ส่งสำเร็จ',
          `สร้างการแจ้งเตือน ${result.inAppCount.toLocaleString()} รายการ\nส่ง Push สำเร็จ ${result.pushSentCount.toLocaleString()} รายการ${result.pushFailedCount > 0 ? `\nส่งไม่สำเร็จ ${result.pushFailedCount.toLocaleString()} รายการ` : ''}${result.breakdown?.pushReadyCount != null ? `\nพร้อมรับ Push ${result.breakdown.pushReadyCount.toLocaleString()} ราย` : ''}`
        );
        if (!customPayload) {
          resetBroadcastComposer();
        }
        const [history, analytics] = await Promise.all([
          getBroadcastHistory(25),
          result.broadcastId ? getBroadcastAnalytics(result.broadcastId) : Promise.resolve(null),
        ]);
        setBroadcastHistory(history);
        if (analytics) setSelectedBroadcastAnalytics(analytics);
      } catch (error: any) {
        Alert.alert('ส่งไม่สำเร็จ', error?.message || 'ไม่สามารถส่งประกาศได้');
      } finally {
        setSendingBroadcast(false);
      }
    }

    async function handlePreviewBroadcast() {
      try {
        setPreviewingBroadcast(true);
        const result = await previewBroadcastAudience({
          targetRole: broadcastTargetRole,
          targetProvinces: broadcastTargetProvinces,
          targetStaffTypes: broadcastTargetStaffTypes,
          activeWithinDays: Number(broadcastActiveWithinDays || 0),
          neverPosted: broadcastNeverPosted,
          onlyVerified: broadcastOnlyVerified,
          activeOnly: broadcastActiveOnly,
        });
        setBroadcastPreview(result);
      } catch (error: any) {
        Alert.alert('ดูตัวอย่างไม่สำเร็จ', error?.message || 'ไม่สามารถคำนวณกลุ่มเป้าหมายได้');
      } finally {
        setPreviewingBroadcast(false);
      }
    }

    function handleResendBroadcast(item: (typeof broadcastHistory)[number]) {
      const provinceSummary = item.targetProvinces?.length
        ? ` ${item.targetProvinces.length} จังหวัด`
        : item.targetProvince
          ? ` จังหวัด${item.targetProvince}`
          : '';
      Alert.alert(
        'ส่งซ้ำจากประวัติ',
        `ต้องการส่ง "${item.title || 'ไม่มีหัวข้อ'}" ไปยัง ${getBroadcastRoleLabel(item.targetRole)}${provinceSummary} อีกครั้งใช่หรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          {
            text: 'ส่งซ้ำ',
            onPress: () => performBroadcastSend({
              title: item.title || '',
              body: item.body || '',
              type: item.type === 'promotion' ? 'promotion' : 'system',
              targetRole: item.targetRole,
              targetProvinces: item.targetProvinces || [],
              targetStaffTypes: item.targetStaffTypes || [],
              activeWithinDays: item.activeWithinDays || 0,
              neverPosted: item.neverPosted === true,
              targetScreen: item.targetScreen || undefined,
              campaignName: item.campaignName || undefined,
              templateKey: item.templateKey || undefined,
              variants: item.variantStats
                ? Object.entries(item.variantStats)
                    .map(([id, v]) => ({ id, title: (v as any)?.title || '', body: (v as any)?.body || '' }))
                    .filter((v) => v.title && v.body)
                : undefined,
              onlyVerified: item.onlyVerified === true,
              activeOnly: item.activeOnly !== false,
            }),
          },
        ]
      );
    }

  function handleSendBroadcast() {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและข้อความ');
      return;
    }

    Keyboard.dismiss();
    const targetLabel = getBroadcastRoleLabel(broadcastTargetRole);
      const provinceLabel = broadcastTargetProvinces.length > 0 ? ` ${broadcastTargetProvinces.length} จังหวัด` : '';
      const staffTypeLabel = broadcastTargetStaffTypes.length > 0 ? ` ${broadcastTargetStaffTypes.length} กลุ่มวิชาชีพ` : '';

    Alert.alert(
      'ยืนยันการส่งประกาศ',
      `ต้องการส่งไปยัง ${targetLabel}${provinceLabel}${staffTypeLabel}${broadcastOnlyVerified ? ' เฉพาะที่ยืนยันแล้ว' : ''}${broadcastActiveOnly ? ' และเฉพาะบัญชีที่กำลังใช้งาน' : ''}${broadcastNeverPosted ? ' และยังไม่เคยโพสต์' : ''} ใช่หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        { text: 'ส่งเลย', onPress: () => { void performBroadcastSend(); } },
      ]
    );
  }

  function renderBroadcast() {
    const provinceQuery = broadcastProvinceSearch.trim();
    const provinceOptions = provinceQuery
      ? ALL_PROVINCES.filter((province) => province.includes(provinceQuery)).slice(0, 12)
      : [...POPULAR_PROVINCES];

    return (
      <View>
        <View style={styles.broadcastHeroCard}>
          <View style={styles.broadcastHeroIcon}>
            <Ionicons name="megaphone-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.broadcastHeroTitle}>ส่งประกาศถึงหลายบัญชี</Text>
            <Text style={styles.broadcastHeroSub}>
              ส่งประกาศ โปรโมชัน หรือข่าวสำคัญจากหน้าผู้ดูแลไปยังหลายบัญชีได้ในครั้งเดียว พร้อมสร้างการแจ้งเตือนในแอปให้อัตโนมัติ
            </Text>
          </View>
        </View>

        <View style={styles.broadcastCard}>
          <Text style={styles.modalSectionTitle}>ประเภทข้อความ</Text>
          <View style={styles.broadcastChipRow}>
            {[
              { key: 'system', label: 'ประกาศระบบ', icon: 'notifications-outline' },
              { key: 'promotion', label: 'โปรโมชั่น', icon: 'gift-outline' },
            ].map((item) => {
              const active = broadcastType === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setBroadcastType(item.key as 'system' | 'promotion')}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Ionicons name={item.icon as any} size={14} color={active ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.modalSectionTitle}>หัวข้อ</Text>
          <TextInput
            style={styles.formInput}
            placeholder="เช่น ประกาศแจ้งปิดปรับปรุงระบบชั่วคราว"
            placeholderTextColor={COLORS.textLight}
            value={broadcastTitle}
            onChangeText={setBroadcastTitle}
            maxLength={80}
          />

          <Text style={styles.modalSectionTitle}>ข้อความ</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            placeholder="พิมพ์รายละเอียดที่จะส่งเป็น push notification"
            placeholderTextColor={COLORS.textLight}
            value={broadcastBody}
            onChangeText={setBroadcastBody}
            multiline
            textAlignVertical="top"
            maxLength={240}
          />

          <Text style={styles.modalSectionTitle}>ชื่อแคมเปญ / ข้อความสำเร็จรูป / หน้าปลายทาง</Text>
          <View style={styles.codeInputRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="ชื่อแคมเปญ เช่น ชวนกลับมาใช้งาน 7 วัน"
              placeholderTextColor={COLORS.textLight}
              value={broadcastCampaignName}
              onChangeText={setBroadcastCampaignName}
            />
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="หน้าปลายทาง เช่น Notifications"
              placeholderTextColor={COLORS.textLight}
              value={broadcastTargetScreen}
              onChangeText={setBroadcastTargetScreen}
            />
          </View>
          <View style={styles.codeInputRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="ชื่อข้อความสำเร็จรูปใหม่"
              placeholderTextColor={COLORS.textLight}
              value={broadcastTemplateName}
              onChangeText={setBroadcastTemplateName}
            />
            <TouchableOpacity
              style={[styles.broadcastHistoryGhostButton, { flex: 1, justifyContent: 'center' }]}
              onPress={saveCurrentTemplate}
              activeOpacity={0.8}
              disabled={savingTemplate}
            >
              {savingTemplate ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="bookmark-outline" size={16} color={COLORS.primary} />}
              <Text style={styles.broadcastHistoryGhostButtonText}>บันทึกเป็นข้อความสำเร็จรูป</Text>
            </TouchableOpacity>
          </View>

          {templates.length > 0 ? (
            <>
              <Text style={styles.modalSectionTitle}>คลังข้อความสำเร็จรูป</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {templates.slice(0, 10).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => applyTemplateToComposer(item)}
                    style={styles.broadcastTemplateChip}
                  >
                    <Text style={styles.broadcastTemplateChipTitle}>{item.name}</Text>
                    <Text style={styles.broadcastTemplateChipSubtitle} numberOfLines={1}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {templates.slice(0, 5).map((item) => (
                <View key={item.id} style={styles.broadcastHistoryCard}>
                  <View style={styles.codeCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.codeTitle}>{item.name}</Text>
                      <Text style={styles.codeDescription} numberOfLines={2}>{item.title}</Text>
                    </View>
                  </View>
                  <View style={styles.broadcastHistoryActionRow}>
                    <TouchableOpacity
                      style={styles.broadcastHistoryGhostButton}
                      onPress={() => applyTemplateToComposer(item)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.broadcastHistoryGhostButtonText}>นำมาใช้</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.broadcastHistoryPrimaryButton}
                      onPress={() => handleArchiveTemplate(item)}
                      activeOpacity={0.8}
                      disabled={templateActionId === item.id}
                    >
                      {templateActionId === item.id ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="archive-outline" size={16} color={COLORS.white} />}
                      <Text style={styles.broadcastHistoryPrimaryButtonText}>เก็บเข้าคลัง</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </>
          ) : null}

          <Text style={styles.modalSectionTitle}>กลุ่มเป้าหมาย</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {[
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'user', label: 'ผู้ใช้ทั่วไป' },
              { key: 'nurse', label: 'พยาบาล' },
              { key: 'hospital', label: 'โรงพยาบาล' },
                { key: 'admin', label: 'ผู้ดูแลระบบ' },
            ].map((item) => {
              const active = broadcastTargetRole === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setBroadcastTargetRole(item.key as 'all' | 'user' | 'nurse' | 'hospital' | 'admin')}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.modalSectionTitle}>เลือกตามภาค</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {REGIONS.map((region) => {
              const active = broadcastSelectedRegions.includes(region);
              return (
                <TouchableOpacity
                  key={region}
                  onPress={() => toggleBroadcastRegion(region)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{region}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.modalSectionTitle}>เลือกหลายจังหวัด</Text>
          <TextInput
            style={styles.formInput}
            placeholder="ค้นหาจังหวัด แล้วแตะเพื่อเพิ่มหลายจังหวัด"
            placeholderTextColor={COLORS.textLight}
            value={broadcastProvinceSearch}
            onChangeText={setBroadcastProvinceSearch}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
            {provinceOptions.map((province) => {
              const active = broadcastTargetProvinces.includes(province);
              return (
                <TouchableOpacity
                  key={province}
                  onPress={() => toggleBroadcastProvince(province)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{province}</Text>
                </TouchableOpacity>
              );
            })}
            {broadcastTargetProvinces.length > 0 ? (
              <TouchableOpacity
                onPress={() => {
                  setBroadcastTargetProvinces([]);
                  setBroadcastSelectedRegions([]);
                }}
                style={styles.filterChip}
              >
                <Text style={styles.filterChipText}>ล้างทั้งหมด</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>

          {broadcastTargetProvinces.length > 0 ? (
            <View style={styles.broadcastSelectedWrap}>
              {broadcastTargetProvinces.map((province) => (
                <TouchableOpacity
                  key={province}
                  onPress={() => toggleBroadcastProvince(province)}
                  style={styles.broadcastSelectedChip}
                >
                  <Text style={styles.broadcastSelectedChipText}>{province}</Text>
                  <Ionicons name="close" size={14} color={COLORS.primary} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {availableBroadcastStaffTypes.length > 0 ? (
            <>
              <Text style={styles.modalSectionTitle}>Audience Builder ขั้นสูง</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {availableBroadcastStaffTypes.slice(0, 16).map((staffType) => {
                  const active = broadcastTargetStaffTypes.includes(staffType);
                  return (
                    <TouchableOpacity
                      key={staffType}
                      onPress={() => setBroadcastTargetStaffTypes((prev) => (
                        prev.includes(staffType) ? prev.filter((item) => item !== staffType) : [...prev, staffType]
                      ))}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{staffType}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.codeInputRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="active ภายในกี่วัน เช่น 7"
                  placeholderTextColor={COLORS.textLight}
                  value={broadcastActiveWithinDays}
                  onChangeText={setBroadcastActiveWithinDays}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  onPress={() => setBroadcastNeverPosted((prev) => !prev)}
                  style={[styles.filterChip, broadcastNeverPosted && styles.filterChipActive, { alignSelf: 'center', marginTop: 6 }]}
                >
                  <Text style={[styles.filterChipText, broadcastNeverPosted && styles.filterChipTextActive]}>ยังไม่เคยโพสต์งาน</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          <Text style={styles.modalSectionTitle}>A/B Test Push</Text>
          <View style={styles.broadcastChipRow}>
            <TouchableOpacity
              onPress={() => setBroadcastAbEnabled((prev) => !prev)}
              style={[styles.filterChip, broadcastAbEnabled && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, broadcastAbEnabled && styles.filterChipTextActive]}>เปิดใช้ A/B 2 เวอร์ชัน</Text>
            </TouchableOpacity>
          </View>
          {broadcastAbEnabled ? (
            <>
              <View style={styles.codeInputRow}>
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="Variant A title"
                  placeholderTextColor={COLORS.textLight}
                  value={broadcastVariantATitle}
                  onChangeText={setBroadcastVariantATitle}
                />
                <TextInput
                  style={[styles.formInput, { flex: 1 }]}
                  placeholder="Variant B title"
                  placeholderTextColor={COLORS.textLight}
                  value={broadcastVariantBTitle}
                  onChangeText={setBroadcastVariantBTitle}
                />
              </View>
              <View style={styles.codeInputRow}>
                <TextInput
                  style={[styles.formInput, styles.formTextArea, { flex: 1, minHeight: 96 }]}
                  placeholder="Variant A body"
                  placeholderTextColor={COLORS.textLight}
                  value={broadcastVariantABody}
                  onChangeText={setBroadcastVariantABody}
                  multiline
                />
                <TextInput
                  style={[styles.formInput, styles.formTextArea, { flex: 1, minHeight: 96 }]}
                  placeholder="Variant B body"
                  placeholderTextColor={COLORS.textLight}
                  value={broadcastVariantBBody}
                  onChangeText={setBroadcastVariantBBody}
                  multiline
                />
              </View>
            </>
          ) : null}

          <Text style={styles.modalSectionTitle}>เงื่อนไขเพิ่มเติม</Text>
          <View style={styles.broadcastChipRow}>
            <TouchableOpacity
              onPress={() => {
                setBroadcastActiveOnly((prev) => !prev);
                setBroadcastPreview(null);
              }}
              style={[styles.filterChip, broadcastActiveOnly && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, broadcastActiveOnly && styles.filterChipTextActive]}>เฉพาะบัญชี Active</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setBroadcastOnlyVerified((prev) => !prev);
                setBroadcastPreview(null);
              }}
              style={[styles.filterChip, broadcastOnlyVerified && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, broadcastOnlyVerified && styles.filterChipTextActive]}>เฉพาะ Verified</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.broadcastActionRow}>
            <TouchableOpacity
              style={styles.broadcastPreviewButton}
              onPress={handlePreviewBroadcast}
              disabled={previewingBroadcast}
              activeOpacity={0.8}
            >
              {previewingBroadcast ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="eye-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.broadcastPreviewButtonText}>Preview จำนวนคน</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.broadcastSendButton, sendingBroadcast && styles.broadcastSendButtonDisabled]}
              onPress={handleSendBroadcast}
              disabled={sendingBroadcast}
              activeOpacity={0.8}
            >
              {sendingBroadcast ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color={COLORS.white} />
                  <Text style={styles.broadcastSendButtonText}>ส่ง Broadcast</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {broadcastPreview ? (
            <View style={styles.broadcastPreviewCard}>
              <View style={styles.broadcastPreviewStat}>
                <Text style={styles.broadcastPreviewValue}>{broadcastPreview.matchedCount.toLocaleString()}</Text>
                <Text style={styles.broadcastPreviewLabel}>ผู้ใช้ที่เข้าเงื่อนไข</Text>
              </View>
              <View style={styles.broadcastPreviewDivider} />
              <View style={styles.broadcastPreviewStat}>
                <Text style={styles.broadcastPreviewValue}>{broadcastPreview.pushReadyCount.toLocaleString()}</Text>
                <Text style={styles.broadcastPreviewLabel}>พร้อมรับ Push</Text>
              </View>
            </View>
          ) : null}

          {broadcastPreview?.breakdown ? (
            <View style={styles.broadcastInsightCard}>
              <Text style={styles.broadcastInsightTitle}>Segment Preview Dashboard</Text>
              <Text style={styles.broadcastInsightText}>Verified {broadcastPreview.breakdown.verifiedCount.toLocaleString()} ราย | Push-ready {broadcastPreview.breakdown.pushReadyCount.toLocaleString()} ราย</Text>
              <Text style={styles.broadcastInsightText}>จังหวัดเด่น: {broadcastPreview.breakdown.provinceBreakdown.slice(0, 3).map((item) => `${item.key} (${item.count})`).join(', ') || '-'}</Text>
              <Text style={styles.broadcastInsightText}>สายงานเด่น: {broadcastPreview.breakdown.staffTypeBreakdown.slice(0, 3).map((item) => `${item.key} (${item.count})`).join(', ') || '-'}</Text>
            </View>
          ) : null}

          <Text style={styles.modalSectionTitle}>Campaign / Promo Scheduler</Text>
          <View style={styles.codeInputRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="YYYY-MM-DD HH:mm"
              placeholderTextColor={COLORS.textLight}
              value={broadcastScheduleAt}
              onChangeText={setBroadcastScheduleAt}
            />
            <TouchableOpacity
              style={[styles.broadcastHistoryPrimaryButton, { flex: 1, justifyContent: 'center' }]}
              onPress={handleScheduleBroadcast}
              activeOpacity={0.8}
              disabled={schedulingBroadcast}
            >
              {schedulingBroadcast ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="calendar-outline" size={16} color={COLORS.white} />}
              <Text style={styles.broadcastHistoryPrimaryButtonText}>ตั้งเวลาแคมเปญ</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.broadcastHintBox}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.broadcastHintText}>
              ระบบจะสร้าง in-app notification ให้ทุกคนในกลุ่มเป้าหมาย และจะส่ง push ให้เฉพาะบัญชีที่มี token พร้อมใช้งานแล้ว
            </Text>
          </View>
        </View>

        {scheduledCampaigns.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Scheduled Campaigns</Text>
            {scheduledCampaigns.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.broadcastHistoryCard}>
                <View style={styles.codeCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeTitle}>{item.campaignName || item.title}</Text>
                    <Text style={styles.codeDescription} numberOfLines={2}>{item.body}</Text>
                  </View>
                  <Badge
                    label={item.status.toUpperCase()}
                    color={item.status === 'sent' ? COLORS.success : item.status === 'failed' ? COLORS.error : COLORS.primary}
                    bg={item.status === 'sent' ? COLORS.successLight : item.status === 'failed' ? COLORS.errorLight : COLORS.primaryBackground}
                  />
                </View>
                <View style={styles.broadcastHistoryStatsRow}>
                  <Text style={styles.codeFooterText}>{getBroadcastRoleLabel(item.targetRole)}</Text>
                  <Text style={styles.codeFooterText}>schedule {formatDateTime(item.scheduledAt)}</Text>
                  <Text style={styles.codeFooterText}>{item.targetProvinces.length > 0 ? `${item.targetProvinces.length} จังหวัด` : 'ทุกจังหวัด'}</Text>
                </View>
                <View style={styles.broadcastHistoryActionRow}>
                  <TouchableOpacity
                    style={styles.broadcastHistoryPrimaryButton}
                    onPress={() => handleDeleteScheduledCampaign(item)}
                    activeOpacity={0.8}
                    disabled={scheduledActionId === item.id}
                  >
                    {scheduledActionId === item.id ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="trash-outline" size={16} color={COLORS.white} />}
                    <Text style={styles.broadcastHistoryPrimaryButtonText}>ลบแคมเปญ</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Re-engagement Automation</Text>
        <View style={styles.broadcastOpsGrid}>
          {[
            { key: 'inactive7d', label: 'Inactive 7d', hint: 'ปลุกผู้ใช้ที่หายไป' },
            { key: 'applicantNoChat', label: 'Applicant No Chat', hint: 'เตือนคนสมัครให้เริ่มแชท' },
            { key: 'postNoApplicants', label: 'Post No Applicants', hint: 'เตือนโพสต์ที่ยังไม่มีคนสมัคร' },
            { key: 'unreadChat', label: 'Unread Chat', hint: 'ดันแชทค้างอ่านกลับมา' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.broadcastOpsCard}
              onPress={() => handleRunAutomationRule(item.key, item.label)}
              activeOpacity={0.85}
              disabled={runningAutomationKey === item.key}
            >
              {runningAutomationKey === item.key ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="sparkles-outline" size={18} color={COLORS.primary} />}
              <Text style={styles.broadcastOpsTitle}>{item.label}</Text>
              <Text style={styles.broadcastOpsHint}>{item.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>One-tap Operational Actions</Text>
        <View style={styles.broadcastOpsGrid}>
          {[
            { key: 'close_expired_jobs_now', label: 'Close Expired Jobs', hint: 'ปิดโพสต์หมดอายุทันที' },
            { key: 'remind_pending_documents', label: 'Pending Docs', hint: 'เตือนผู้ใช้ที่เอกสารค้าง' },
            { key: 'remind_enable_nearby_alert', label: 'Enable Nearby Alert', hint: 'ดัน opt-in แจ้งเตือนงานใกล้ตัว' },
            { key: 'remind_incomplete_hospital_profiles', label: 'Hospital Profiles', hint: 'เตือนโปรไฟล์องค์กรไม่ครบ' },
          ].map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.broadcastOpsCard}
              onPress={() => handleRunOperationalAction(item.key, item.label)}
              activeOpacity={0.85}
              disabled={runningActionKey === item.key}
            >
              {runningActionKey === item.key ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="flash-outline" size={18} color={COLORS.primary} />}
              <Text style={styles.broadcastOpsTitle}>{item.label}</Text>
              <Text style={styles.broadcastOpsHint}>{item.hint}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Onboarding Survey</Text>
        <View style={styles.broadcastCard}>
          <Text style={styles.modalSectionTitle}>สถานะคู่มือเริ่มต้นใช้งาน</Text>
          <Text style={styles.broadcastHintText}>
            ใช้เปิดหรือปิด flow แบบสำรวจเริ่มต้นหลังสมัครและลิงก์ "ดูคู่มือ" ในหน้าหลักต่าง ๆ ของแอป
          </Text>
          <View style={styles.broadcastChipRow}>
            <TouchableOpacity
              onPress={() => handleSetOnboardingSurveyEnabled(true)}
              style={[styles.filterChip, onboardingSurveySettings.surveyEnabled && styles.filterChipActive]}
              disabled={updatingOnboardingSurvey}
            >
              <Text style={[styles.filterChipText, onboardingSurveySettings.surveyEnabled && styles.filterChipTextActive]}>เปิดใช้งาน</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleSetOnboardingSurveyEnabled(false)}
              style={[styles.filterChip, !onboardingSurveySettings.surveyEnabled && styles.filterChipActive]}
              disabled={updatingOnboardingSurvey}
            >
              <Text style={[styles.filterChipText, !onboardingSurveySettings.surveyEnabled && styles.filterChipTextActive]}>ปิดชั่วคราว</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.broadcastPreviewCard}>
            <View style={styles.broadcastPreviewStat}>
              <Text style={styles.broadcastPreviewValue}>{onboardingSurveySettings.surveyEnabled ? 'ON' : 'OFF'}</Text>
              <Text style={styles.broadcastPreviewLabel}>สถานะปัจจุบัน</Text>
            </View>
            <View style={styles.broadcastPreviewDivider} />
            <View style={styles.broadcastPreviewStat}>
              <Text style={styles.broadcastPreviewValue}>{updatingOnboardingSurvey ? '...' : 'พร้อมใช้'}</Text>
              <Text style={styles.broadcastPreviewLabel}>อัปเดตทั้งแอปทันที</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Fraud / Scam Alert Center</Text>
        <View style={styles.broadcastCard}>
          <View style={styles.broadcastPreviewCard}>
            <View style={styles.broadcastPreviewStat}>
              <Text style={styles.broadcastPreviewValue}>{fraudCenter?.summary.pendingFlags?.toLocaleString?.() ?? 0}</Text>
              <Text style={styles.broadcastPreviewLabel}>Pending Flags</Text>
            </View>
            <View style={styles.broadcastPreviewDivider} />
            <View style={styles.broadcastPreviewStat}>
              <Text style={styles.broadcastPreviewValue}>{fraudCenter?.summary.recentScamReports?.toLocaleString?.() ?? 0}</Text>
              <Text style={styles.broadcastPreviewLabel}>Scam Reports</Text>
            </View>
          </View>
          <Text style={styles.modalSectionTitle}>Blacklist Keywords</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            placeholder="คั่นด้วย comma เช่น โอนก่อน, line ส่วนตัว, telegram"
            placeholderTextColor={COLORS.textLight}
            value={fraudKeywordInput}
            onChangeText={setFraudKeywordInput}
            multiline
          />
          <Text style={styles.modalSectionTitle}>Warning Copy</Text>
          <TextInput
            style={styles.formInput}
            placeholder="หัวข้อคำเตือน"
            placeholderTextColor={COLORS.textLight}
            value={fraudWarningTitle}
            onChangeText={setFraudWarningTitle}
          />
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            placeholder="ข้อความเตือนเรื่องมิจฉาชีพ"
            placeholderTextColor={COLORS.textLight}
            value={fraudWarningBody}
            onChangeText={setFraudWarningBody}
            multiline
          />
          <TouchableOpacity
            style={styles.broadcastHistoryPrimaryButton}
            onPress={saveFraudControlSettings}
            activeOpacity={0.8}
            disabled={savingFraudControls}
          >
            {savingFraudControls ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.white} />}
            <Text style={styles.broadcastHistoryPrimaryButtonText}>บันทึก Fraud Controls</Text>
          </TouchableOpacity>
          {fraudCenter?.flags?.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.broadcastFlagRow}>
              <Text style={styles.broadcastFlagTitle}>{item.senderName || item.senderId || 'Unknown sender'}</Text>
              <Text style={styles.broadcastFlagText} numberOfLines={2}>{item.textPreview || '-'}</Text>
              <Text style={styles.broadcastFlagMeta}>{(item.matchedKeywords || []).join(', ') || 'no keyword'}</Text>
              <View style={styles.broadcastHistoryActionRow}>
                <TouchableOpacity
                  style={styles.broadcastHistoryGhostButton}
                  onPress={() => handleUpdateFraudFlag(item.id, 'dismissed')}
                  activeOpacity={0.8}
                  disabled={fraudFlagActionId === item.id}
                >
                  <Ionicons name="close-circle-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.broadcastHistoryGhostButtonText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.broadcastHistoryPrimaryButton}
                  onPress={() => handleUpdateFraudFlag(item.id, 'resolved')}
                  activeOpacity={0.8}
                  disabled={fraudFlagActionId === item.id}
                >
                  {fraudFlagActionId === item.id ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="checkmark-done-outline" size={16} color={COLORS.white} />}
                  <Text style={styles.broadcastHistoryPrimaryButtonText}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Sticky Announcement</Text>
        <View style={styles.broadcastCard}>
          <Text style={styles.modalSectionTitle}>หัวข้อประกาศ</Text>
          <TextInput
            style={styles.formInput}
            placeholder="เช่น แจ้งปิดปรับปรุงระบบ"
            placeholderTextColor={COLORS.textLight}
            value={announcementDraft.title}
            onChangeText={(text) => setAnnouncementDraft((prev) => ({ ...prev, title: text }))}
          />

          <Text style={styles.modalSectionTitle}>รายละเอียด</Text>
          <TextInput
            style={[styles.formInput, styles.formTextArea]}
            placeholder="ข้อความประกาศที่จะปักบนหน้า Home หรือ Notifications"
            placeholderTextColor={COLORS.textLight}
            value={announcementDraft.body}
            onChangeText={(text) => setAnnouncementDraft((prev) => ({ ...prev, body: text }))}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.modalSectionTitle}>ระดับความสำคัญ</Text>
          <View style={styles.broadcastChipRow}>
            {[
              { key: 'info', label: 'ข้อมูลทั่วไป' },
              { key: 'warning', label: 'คำเตือน' },
              { key: 'critical', label: 'เร่งด่วนมาก' },
              { key: 'success', label: 'ข่าวดี' },
            ].map((item) => {
              const active = announcementDraft.severity === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setAnnouncementDraft((prev) => ({ ...prev, severity: item.key as StickyAnnouncement['severity'] }))}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.modalSectionTitle}>แสดงบนหน้าไหน</Text>
          <View style={styles.broadcastChipRow}>
            {[
              { key: 'all', label: 'ทุกหน้า' },
              { key: 'home', label: 'Home' },
              { key: 'notifications', label: 'Notifications' },
              { key: 'chat', label: 'Chat' },
            ].map((item) => {
              const active = announcementDraft.targetScreens.includes(item.key as any);
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => toggleAnnouncementTargetScreen(item.key as StickyAnnouncement['targetScreens'][number])}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.modalSectionTitle}>ช่วงเวลาแสดงผล</Text>
          <View style={styles.codeInputRow}>
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="เริ่ม (YYYY-MM-DD)"
              placeholderTextColor={COLORS.textLight}
              value={announcementStartsAtInput}
              onChangeText={setAnnouncementStartsAtInput}
            />
            <TextInput
              style={[styles.formInput, { flex: 1 }]}
              placeholder="สิ้นสุด (YYYY-MM-DD)"
              placeholderTextColor={COLORS.textLight}
              value={announcementEndsAtInput}
              onChangeText={setAnnouncementEndsAtInput}
            />
          </View>

          <View style={styles.broadcastChipRow}>
            <TouchableOpacity
              onPress={() => setAnnouncementDraft((prev) => ({ ...prev, isPinned: !prev.isPinned }))}
              style={[styles.filterChip, announcementDraft.isPinned && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, announcementDraft.isPinned && styles.filterChipTextActive]}>ปักหมุด</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setAnnouncementDraft((prev) => ({ ...prev, isActive: !prev.isActive }))}
              style={[styles.filterChip, announcementDraft.isActive && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, announcementDraft.isActive && styles.filterChipTextActive]}>เปิดใช้งาน</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.broadcastHistoryActionRow}>
            <TouchableOpacity style={styles.broadcastHistoryGhostButton} onPress={resetAnnouncementDraft} activeOpacity={0.8}>
              <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
              <Text style={styles.broadcastHistoryGhostButtonText}>ล้างฟอร์ม</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.broadcastHistoryPrimaryButton} onPress={saveAnnouncement} activeOpacity={0.8}>
              {savingAnnouncement ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="save-outline" size={16} color={COLORS.white} />}
              <Text style={styles.broadcastHistoryPrimaryButtonText}>{announcementDraft.id ? 'อัปเดตประกาศ' : 'สร้างประกาศ'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionTitle}>รายการประกาศด่วน</Text>
        {stickyAnnouncementItems.map((item) => (
          <View key={item.id} style={styles.broadcastHistoryCard}>
            <View style={styles.codeCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codeTitle}>{item.title}</Text>
                <Text style={styles.codeDescription} numberOfLines={2}>{item.body}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge
                  label={item.isActive ? 'LIVE' : 'DRAFT'}
                  color={item.isActive ? COLORS.success : COLORS.textSecondary}
                  bg={item.isActive ? COLORS.successLight : COLORS.backgroundSecondary}
                />
              </View>
            </View>
            <View style={styles.codeMetaRow}>
              <View style={styles.codeMetaChip}>
                <Ionicons name="pin-outline" size={12} color={COLORS.primary} />
                <Text style={styles.codeMetaText}>{item.isPinned ? 'Pinned' : 'Normal'}</Text>
              </View>
              <View style={styles.codeMetaChip}>
                <Ionicons name="albums-outline" size={12} color={COLORS.primary} />
                <Text style={styles.codeMetaText}>{formatAnnouncementTargetScreens(item.targetScreens)}</Text>
              </View>
              <View style={styles.codeMetaChip}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
                <Text style={styles.codeMetaText}>
                  {item.startsAt ? formatDate(item.startsAt) : 'ทันที'} - {item.endsAt ? formatDate(item.endsAt) : 'ไม่จำกัด'}
                </Text>
              </View>
            </View>
            <View style={styles.broadcastHistoryActionRow}>
              <TouchableOpacity style={styles.broadcastHistoryGhostButton} onPress={() => editAnnouncement(item)} activeOpacity={0.8}>
                <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                <Text style={styles.broadcastHistoryGhostButtonText}>แก้ไข</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.broadcastHistoryGhostButton}
                onPress={() => toggleStickyAnnouncementActive(item.id, !item.isActive)}
                activeOpacity={0.8}
              >
                <Ionicons name={item.isActive ? 'pause-outline' : 'play-outline'} size={16} color={COLORS.primary} />
                <Text style={styles.broadcastHistoryGhostButtonText}>{item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.broadcastHistoryPrimaryButton} onPress={() => handleDeleteAnnouncement(item)} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={16} color={COLORS.white} />
                <Text style={styles.broadcastHistoryPrimaryButtonText}>ลบ</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        {stickyAnnouncementItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ยังไม่มี Sticky Announcement</Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>ประวัติ Broadcast ล่าสุด</Text>
        {broadcastHistory.map((item) => (
          <View key={item.id} style={styles.broadcastHistoryCard}>
            <View style={styles.codeCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.codeTitle}>{item.title || 'ไม่มีหัวข้อ'}</Text>
                <Text style={styles.codeDescription} numberOfLines={2}>{item.body || '-'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Badge
                  label={item.type === 'promotion' ? 'PROMOTION' : 'SYSTEM'}
                  color={item.type === 'promotion' ? COLORS.accent : COLORS.primary}
                  bg={item.type === 'promotion' ? COLORS.warningLight : COLORS.primaryBackground}
                />
              </View>
            </View>

            <View style={styles.codeMetaRow}>
              <View style={styles.codeMetaChip}>
                <Ionicons name="people-outline" size={12} color={COLORS.primary} />
                <Text style={styles.codeMetaText}>{getBroadcastRoleLabel(item.targetRole)}</Text>
              </View>
              {item.targetProvince ? (
                <View style={styles.codeMetaChip}>
                  <Ionicons name="location-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.codeMetaText}>
                    {item.targetProvinces && item.targetProvinces.length > 1
                      ? `${item.targetProvinces.length} จังหวัด`
                      : item.targetProvince}
                  </Text>
                </View>
              ) : null}
              {item.onlyVerified ? (
                <View style={styles.codeMetaChip}>
                  <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.primary} />
                  <Text style={styles.codeMetaText}>Verified</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.broadcastHistoryStatsRow}>
              <Text style={styles.codeFooterText}>in-app {item.inAppCount?.toLocaleString?.() ?? 0}</Text>
              <Text style={styles.codeFooterText}>push สำเร็จ {item.pushSentCount?.toLocaleString?.() ?? 0}</Text>
              <Text style={styles.codeFooterText}>push fail {item.pushFailedCount?.toLocaleString?.() ?? 0}</Text>
              <Text style={styles.codeFooterText}>{formatDateTime(item.createdAt)}</Text>
            </View>

            <View style={styles.broadcastHistoryActionRow}>
              <TouchableOpacity
                style={styles.broadcastHistoryGhostButton}
                onPress={() => fillBroadcastFormFromHistory(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                <Text style={styles.broadcastHistoryGhostButtonText}>ใช้ค่าเดิม</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.broadcastHistoryPrimaryButton}
                onPress={() => handleResendBroadcast(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="reload-outline" size={16} color={COLORS.white} />
                <Text style={styles.broadcastHistoryPrimaryButtonText}>ส่งซ้ำ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.broadcastHistoryGhostButton}
                onPress={() => loadBroadcastAnalyticsForItem(item)}
                activeOpacity={0.8}
              >
                {loadingBroadcastAnalyticsId === item.id ? <ActivityIndicator color={COLORS.primary} /> : <Ionicons name="bar-chart-outline" size={16} color={COLORS.primary} />}
                <Text style={styles.broadcastHistoryGhostButtonText}>Analytics</Text>
              </TouchableOpacity>
            </View>
            {selectedBroadcastAnalytics?.broadcastId === item.id ? (
              <View style={styles.broadcastInsightCard}>
                <Text style={styles.broadcastInsightTitle}>Broadcast Analytics</Text>
                <Text style={styles.broadcastInsightText}>Open rate {(selectedBroadcastAnalytics.openRate * 100).toFixed(1)}% | opens {selectedBroadcastAnalytics.openCount.toLocaleString()}</Text>
                <Text style={styles.broadcastInsightText}>Conversions: apply {selectedBroadcastAnalytics.conversions.applyCount} | post {selectedBroadcastAnalytics.conversions.postCount} | purchase {selectedBroadcastAnalytics.conversions.purchaseCount}</Text>
                <Text style={styles.broadcastInsightText}>Destination opens: {Object.entries(selectedBroadcastAnalytics.destinationOpenCounts || {}).map(([key, value]) => `${key} (${value})`).join(', ') || '-'}</Text>
                <Text style={styles.broadcastInsightText}>A/B stats: {Object.entries(selectedBroadcastAnalytics.variantStats || {}).map(([key, value]) => `${key} sent ${value.sentCount || 0} / open ${value.openCount || 0}`).join(', ') || '-'}</Text>
              </View>
            ) : null}
          </View>
        ))}
        {broadcastHistory.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ยังไม่มีประวัติ Broadcast</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ============================================
  // MODAL: USER DETAIL
  // ============================================
  function renderUserModal() {
    if (!selectedUser) return null;
    const u = selectedUser;
    const badge = getRoleBadge(u.role);

    return (
      <Modal visible={userModalVisible} transparent animationType="slide" onRequestClose={() => setUserModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            {/* Header */}
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ข้อมูลผู้ใช้</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Profile */}
              <View style={styles.modalProfileRow}>
                <Avatar uri={u.photoURL} name={u.displayName} size={72} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalProfileName}>{u.displayName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Badge {...badge} />
                    {u.isVerified && (
                      <View style={[styles.miniChip, { backgroundColor: COLORS.successLight }]}>
                        <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                        <Text style={[styles.miniChipText, { color: COLORS.success }]}>ยืนยันแล้ว</Text>
                      </View>
                    )}
                    {!u.isActive && (
                      <View style={[styles.miniChip, { backgroundColor: COLORS.errorLight }]}>
                        <Text style={[styles.miniChipText, { color: COLORS.error }]}>ระงับแล้ว</Text>
                      </View>
                    )}
                    {u.postingSuspended && (
                      <View style={[styles.miniChip, { backgroundColor: '#FEF3C7' }]}> 
                        <Text style={[styles.miniChipText, { color: '#92400E' }]}>ห้ามโพสต์</Text>
                      </View>
                    )}
                    {u.adminWarningTag ? (
                      <View style={[styles.miniChip, { backgroundColor: COLORS.errorLight }]}> 
                        <Text style={[styles.miniChipText, { color: COLORS.error }]}>{u.adminWarningTag}</Text>
                      </View>
                    ) : null}
                  </View>
                  {u.adminTags?.length ? (
                    <View style={styles.miniChipWrap}>
                      {u.adminTags.map((tag) => (
                        <View key={tag} style={[styles.miniChip, { backgroundColor: '#E0E7FF' }]}> 
                          <Text style={[styles.miniChipText, { color: '#4338CA' }]}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Info Rows */}
              <View style={styles.infoSection}>
                <InfoRow icon="mail-outline" label="อีเมล" value={u.email} />
                <InfoRow icon="call-outline" label="โทรศัพท์" value={u.phone || '-'} />
                <InfoRow icon="document-text-outline" label="เลขใบอนุญาต" value={u.licenseNumber || '-'} />
                <InfoRow icon="calendar-outline" label="สมัครเมื่อ" value={formatDate(u.createdAt)} />
                <InfoRow icon="time-outline" label="เข้าใช้ล่าสุด" value={formatDateTime(u.lastLoginAt)} />
                <InfoRow icon="finger-print-outline" label="UID" value={u.uid} mono />
              </View>

              <Text style={styles.modalSectionTitle}>หลักฐานการยอมรับเงื่อนไข</Text>
              <View style={styles.infoSection}>
                <InfoRow
                  icon="document-text-outline"
                  label="Terms accepted"
                  value={u.legalConsent?.terms?.acceptedAt ? formatDateTime(u.legalConsent.terms.acceptedAt as Date) : '-'}
                />
                <InfoRow
                  icon="shield-checkmark-outline"
                  label="Terms version"
                  value={u.legalConsent?.terms?.version || '-'}
                />
                <InfoRow
                  icon="document-text-outline"
                  label="Privacy accepted"
                  value={u.legalConsent?.privacy?.acceptedAt ? formatDateTime(u.legalConsent.privacy.acceptedAt as Date) : '-'}
                />
                <InfoRow
                  icon="shield-outline"
                  label="Privacy version"
                  value={u.legalConsent?.privacy?.version || '-'}
                />
                <InfoRow
                  icon="navigate-outline"
                  label="Accepted from"
                  value={u.legalConsent?.acceptedFrom || '-'}
                />
              </View>

              <Text style={styles.modalSectionTitle}>สิทธิ์การใช้งาน</Text>
              <View style={styles.infoSection}>
                <InfoRow icon="ribbon-outline" label="แพ็กเกจปัจจุบัน" value={PLAN_LABELS[u.subscriptionPlan || 'free']} />
                <InfoRow icon="repeat-outline" label="รอบบิล" value={u.billingCycle === 'annual' ? 'Annual' : 'Monthly'} />
                <InfoRow icon="hourglass-outline" label="หมดอายุ" value={u.subscriptionExpiresAt ? formatDate(u.subscriptionExpiresAt) : '-'} />
                <InfoRow icon="stats-chart-outline" label="โพสต์วันนี้" value={String(u.postsToday || 0)} />
              </View>

              <View style={styles.roleGrid}>
                {ROLE_PLAN_OPTIONS[u.role].map((plan) => {
                  const active = accessPlanDraft === plan;
                  return (
                    <TouchableOpacity
                      key={plan}
                      style={[styles.roleBtn, { borderColor: COLORS.secondary }, active && { backgroundColor: COLORS.primaryBackground }]}
                      onPress={() => setAccessPlanDraft(plan)}
                    >
                      <Text style={[styles.roleBtnText, { color: COLORS.secondary }]}>{PLAN_LABELS[plan]}</Text>
                      {active && <Ionicons name="checkmark" size={14} color={COLORS.secondary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.roleGrid}>
                {BILLING_OPTIONS.map((cycle) => {
                  const active = billingCycleDraft === cycle;
                  return (
                    <TouchableOpacity
                      key={cycle}
                      style={[styles.roleBtn, { borderColor: COLORS.primary }, active && { backgroundColor: COLORS.primaryBackground }]}
                      onPress={() => setBillingCycleDraft(cycle)}
                    >
                      <Text style={[styles.roleBtnText, { color: COLORS.primary }]}>{cycle === 'annual' ? 'Annual' : 'Monthly'}</Text>
                      {active && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.moderationInput}
                placeholder="วันหมดอายุ YYYY-MM-DD"
                placeholderTextColor={COLORS.textLight}
                value={accessExpiresAtDraft}
                onChangeText={setAccessExpiresAtDraft}
                autoCapitalize="none"
              />

              {ACCESS_USAGE_FEATURES.map((item) => {
                const usageLimit = getLaunchUsageLimitForRole(selectedUser.role, item.key);
                const usedCount = Number(usageDraft[item.key] || '0');
                const limitText = usageLimit == null
                  ? 'ไม่จำกัด'
                  : `${usedCount}/${usageLimit} ครั้งต่อเดือน`;

                return (
                  <View key={item.key} style={styles.accessFieldRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accessFieldLabel}>{item.label}</Text>
                      <Text style={styles.accessFieldHint}>ใช้แล้ว {limitText}</Text>
                    </View>
                    <TextInput
                      style={styles.accessFieldInput}
                      value={usageDraft[item.key]}
                      onChangeText={(value) => updateUsageDraftValue(item.key, value)}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={COLORS.textLight}
                    />
                  </View>
                );
              })}

              <View style={styles.accessFieldRow}>
                <Text style={styles.accessFieldLabel}>โพสต์วันนี้</Text>
                <TextInput
                  style={styles.accessFieldInput}
                  value={postsTodayDraft}
                  onChangeText={(value) => setPostsTodayDraft(value.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.textLight}
                />
              </View>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: freeUrgentUsedDraft ? COLORS.warningLight : COLORS.successLight, marginBottom: 10 }]}
                onPress={() => setFreeUrgentUsedDraft((prev) => !prev)}
              >
                <Ionicons
                  name={freeUrgentUsedDraft ? 'checkmark-circle-outline' : 'ellipse-outline'}
                  size={20}
                  color={freeUrgentUsedDraft ? COLORS.accent : COLORS.success}
                />
                <Text style={[styles.actionBtnText, { color: freeUrgentUsedDraft ? COLORS.accent : COLORS.success }]}>free urgent ใช้ไปแล้ว</Text>
              </TouchableOpacity>

              <View style={styles.actionList}>
                <TouchableOpacity
                  style={[styles.saveModerationBtn, savingAccessRights && { opacity: 0.6 }]}
                  onPress={handleSaveUserAccessRights}
                  disabled={savingAccessRights}
                >
                  {savingAccessRights ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveModerationBtnText}>บันทึกสิทธิ์การใช้งาน</Text>}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.warningLight }, resettingAccessRights && { opacity: 0.6 }]}
                  onPress={handleResetUserAccessRights}
                  disabled={resettingAccessRights}
                >
                  {resettingAccessRights ? (
                    <ActivityIndicator color={COLORS.accent} />
                  ) : (
                    <Ionicons name="refresh-outline" size={20} color={COLORS.accent} />
                  )}
                  <Text style={[styles.actionBtnText, { color: COLORS.accent }]}>รีเซ็ตตัวนับการใช้งานบัญชีนี้</Text>
                </TouchableOpacity>
              </View>

              {/* Role Change */}
              <Text style={styles.modalSectionTitle}>เปลี่ยน Role</Text>
              <View style={styles.roleGrid}>
                {(['user', 'nurse', 'hospital', 'admin'] as const).map((role) => {
                  const rb = getRoleBadge(role);
                  const isCurrentRole = u.role === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleBtn,
                        { borderColor: rb.color },
                        isCurrentRole && { backgroundColor: rb.bg },
                      ]}
                      onPress={() => handleChangeRole(u, role)}
                      disabled={isCurrentRole}
                    >
                      <Text style={[styles.roleBtnText, { color: rb.color }]}>{rb.label}</Text>
                      {isCurrentRole && <Ionicons name="checkmark" size={14} color={rb.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.modalSectionTitle}>แท็กสำหรับแสดงบนผู้โพสต์</Text>
              <View style={styles.moderationTagWrap}>
                {USER_ADMIN_TAG_OPTIONS.map((tag) => {
                  const active = moderationTagsDraft.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[styles.moderationTagChip, active && styles.moderationTagChipActive]}
                      onPress={() => toggleModerationTag(tag)}
                    >
                      <Text style={[styles.moderationTagChipText, active && styles.moderationTagChipTextActive]}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.moderationInput}
                placeholder="ป้ายเตือนสีแดง เช่น ควรระวัง / ตรวจสอบก่อนโอน"
                placeholderTextColor={COLORS.textLight}
                value={warningTagDraft}
                onChangeText={setWarningTagDraft}
                maxLength={36}
              />

              <TextInput
                style={[styles.moderationInput, styles.moderationTextarea]}
                placeholder="เหตุผลระงับการโพสต์ หรือโน้ตภายในสำหรับทีมงาน"
                placeholderTextColor={COLORS.textLight}
                value={postingSuspendReasonDraft}
                onChangeText={setPostingSuspendReasonDraft}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveModerationBtn, savingModeration && { opacity: 0.6 }]}
                onPress={handleSaveUserModeration}
                disabled={savingModeration}
              >
                {savingModeration ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveModerationBtnText}>บันทึกแท็ก / ป้ายเตือน</Text>}
              </TouchableOpacity>

              {/* Actions */}
              <Text style={styles.modalSectionTitle}>การดำเนินการ</Text>
              <View style={styles.actionList}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: u.isVerified ? COLORS.warningLight : COLORS.successLight }]}
                  onPress={() => handleVerifyUser(u)}
                >
                  <Ionicons name={u.isVerified ? 'close-circle-outline' : 'shield-checkmark-outline'} size={20} color={u.isVerified ? COLORS.accent : COLORS.success} />
                  <Text style={[styles.actionBtnText, { color: u.isVerified ? COLORS.accent : COLORS.success }]}>
                    {u.isVerified ? 'ยกเลิกยืนยัน' : 'ยืนยันตัวตน'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: u.isActive ? COLORS.warningLight : COLORS.successLight }]}
                  onPress={() => handleToggleUserActive(u)}
                >
                  <Ionicons name={u.isActive ? 'ban-outline' : 'checkmark-circle-outline'} size={20} color={u.isActive ? COLORS.accent : COLORS.success} />
                  <Text style={[styles.actionBtnText, { color: u.isActive ? COLORS.accent : COLORS.success }]}>
                    {u.isActive ? 'ระงับผู้ใช้' : 'เปิดใช้งาน'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: u.postingSuspended ? COLORS.successLight : '#FEF3C7' }]}
                  onPress={() => handleTogglePostingSuspension(u)}
                >
                  <Ionicons name={u.postingSuspended ? 'play-circle-outline' : 'pause-circle-outline'} size={20} color={u.postingSuspended ? COLORS.success : '#B45309'} />
                  <Text style={[styles.actionBtnText, { color: u.postingSuspended ? COLORS.success : '#B45309' }]}> 
                    {u.postingSuspended ? 'ปลดระงับการโพสต์' : 'ปิดโพสต์ทั้งหมด + ระงับการโพสต์'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.errorLight }]}
                  onPress={() => handleDeleteUser(u)}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  <Text style={[styles.actionBtnText, { color: COLORS.error }]}>ลบผู้ใช้ถาวร</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ============================================
  // MODAL: JOB DETAIL
  // ============================================
  function renderJobModal() {
    if (!selectedJob) return null;
    const j = selectedJob;
    const badge = getStatusBadge(j.status);

    return (
      <Modal visible={jobModalVisible} transparent animationType="slide" onRequestClose={() => setJobModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดงาน</Text>
              <TouchableOpacity onPress={() => setJobModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.jobModalHeaderRow}>
                <Text style={styles.jobModalTitle}>{j.title}</Text>
                <Badge {...badge} />
              </View>

              <View style={styles.infoSection}>
                <InfoRow icon="person-outline" label="ผู้ประกาศ" value={j.posterName} />
                <InfoRow icon="medical-outline" label="แผนก" value={j.department || '-'} />
                <InfoRow icon="people-outline" label="ประเภท" value={j.staffType || '-'} />
                <InfoRow icon="location-outline" label="จังหวัด" value={j.province || '-'} />
                <InfoRow icon="business-outline" label="สถานที่" value={j.hospital || '-'} />
                <InfoRow icon="cash-outline" label="ค่าตอบแทน" value={j.shiftRate > 0 ? `฿${j.shiftRate.toLocaleString()}` : '-'} />
                <InfoRow icon="calendar-outline" label="วันกะ" value={j.shiftDate ? formatDate(j.shiftDate) : '-'} />
                <InfoRow icon="time-outline" label="เวลากะ" value={j.shiftTime || '-'} />
                <InfoRow icon="create-outline" label="ประกาศเมื่อ" value={formatDate(j.createdAt)} />
              </View>

              {/* Stats */}
              <View style={styles.jobModalStats}>
                <View style={styles.jobModalStatItem}>
                  <Ionicons name="eye" size={20} color={COLORS.primary} />
                  <Text style={styles.jobModalStatValue}>{j.viewsCount}</Text>
                  <Text style={styles.jobModalStatLabel}>เข้าชม</Text>
                </View>
                <View style={styles.jobModalStatItem}>
                  <Ionicons name="people" size={20} color="#7C3AED" />
                  <Text style={styles.jobModalStatValue}>{j.applicantsCount}</Text>
                  <Text style={styles.jobModalStatLabel}>สมัคร</Text>
                </View>
                <View style={styles.jobModalStatItem}>
                  <Ionicons name="chatbubble" size={20} color={COLORS.secondary} />
                  <Text style={styles.jobModalStatValue}>{j.contactsCount}</Text>
                  <Text style={styles.jobModalStatLabel}>ติดต่อ</Text>
                </View>
              </View>

              {/* Status Change */}
              <Text style={styles.modalSectionTitle}>เปลี่ยนสถานะ</Text>
              <View style={styles.roleGrid}>
                {(['active', 'urgent', 'closed'] as const).map((status) => {
                  const sb = getStatusBadge(status);
                  const isCurrent = j.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.roleBtn, { borderColor: sb.color }, isCurrent && { backgroundColor: sb.bg }]}
                      onPress={() => handleChangeJobStatus(j, status)}
                      disabled={isCurrent}
                    >
                      <Text style={[styles.roleBtnText, { color: sb.color }]}>{sb.label}</Text>
                      {isCurrent && <Ionicons name="checkmark" size={14} color={sb.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.errorLight, marginTop: 16 }]}
                onPress={() => handleDeleteJob(j)}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                <Text style={[styles.actionBtnText, { color: COLORS.error }]}>ลบงานถาวร</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  function renderCodeModal() {
    return (
      <Modal visible={codeModalVisible} transparent animationType="slide" onRequestClose={() => setCodeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}> 
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedCode ? 'แก้ไขโค้ด' : 'สร้างโค้ดใหม่'}</Text>
              <TouchableOpacity onPress={() => setCodeModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalSectionTitle}>รหัสโค้ด</Text>
              <View style={styles.codeInputRow}>
                <TextInput
                  style={[styles.formInput, styles.codeInput, selectedCode && styles.formInputDisabled]}
                  value={codeForm.code}
                  onChangeText={(value) => setCodeForm((prev) => ({ ...prev, code: normalizeCampaignCode(value) }))}
                  placeholder="เช่น SUMMER50"
                  placeholderTextColor={COLORS.textLight}
                  editable={!selectedCode}
                  autoCapitalize="characters"
                />
                {!selectedCode && (
                  <TouchableOpacity
                    style={styles.generateCodeBtn}
                    onPress={() => setCodeForm((prev) => ({ ...prev, code: generateCampaignCode() }))}
                  >
                    <Ionicons name="sparkles-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.generateCodeText}>สุ่ม</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.modalSectionTitle}>ข้อมูลแคมเปญ</Text>
              <TextInput
                style={styles.formInput}
                value={codeForm.title}
                onChangeText={(value) => setCodeForm((prev) => ({ ...prev, title: value }))}
                placeholder="ชื่อแคมเปญ"
                placeholderTextColor={COLORS.textLight}
              />
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={codeForm.description}
                onChangeText={(value) => setCodeForm((prev) => ({ ...prev, description: value }))}
                placeholder="คำอธิบายเพิ่มเติม"
                placeholderTextColor={COLORS.textLight}
                multiline
              />

              <Text style={styles.modalSectionTitle}>Benefit</Text>
              <View style={styles.optionGrid}>
                {CAMPAIGN_BENEFIT_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.optionCard, codeForm.benefitType === option.key && styles.optionCardActive]}
                    onPress={() => setCodeForm((prev) => ({ ...prev, benefitType: option.key }))}
                  >
                    <Text style={[styles.optionCardTitle, codeForm.benefitType === option.key && styles.optionCardTitleActive]}>{option.label}</Text>
                    <Text style={styles.optionCardSub}>{option.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inlineFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ค่า benefit</Text>
                  <TextInput
                    style={styles.formInput}
                    value={codeForm.benefitValue}
                    onChangeText={(value) => setCodeForm((prev) => ({ ...prev, benefitValue: value.replace(/[^0-9]/g, '') }))}
                    placeholder="เช่น 10 หรือ 50"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ขั้นต่ำ (บาท)</Text>
                  <TextInput
                    style={styles.formInput}
                    value={codeForm.minSpend}
                    onChangeText={(value) => setCodeForm((prev) => ({ ...prev, minSpend: value.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.modalSectionTitle}>กติกาโค้ด</Text>
              <View style={styles.inlineFields}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>จำนวนสิทธิ์สูงสุด</Text>
                  <TextInput
                    style={styles.formInput}
                    value={codeForm.maxUses}
                    onChangeText={(value) => setCodeForm((prev) => ({ ...prev, maxUses: value.replace(/[^0-9]/g, '') }))}
                    placeholder="ไม่จำกัด"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>วันหมดอายุ</Text>
                  <TextInput
                    style={styles.formInput}
                    value={codeForm.expiresAt}
                    onChangeText={(value) => setCodeForm((prev) => ({ ...prev, expiresAt: value }))}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={COLORS.textLight}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>อนุญาตให้ประเภทบัญชีใดใช้ได้บ้าง</Text>
              <View style={styles.roleGrid}>
                {CAMPAIGN_ROLE_OPTIONS.map((role) => {
                  const active = codeForm.allowedRoles.includes(role.key);
                  return (
                    <TouchableOpacity
                      key={role.key}
                      style={[styles.roleBtn, { borderColor: COLORS.primary }, active && { backgroundColor: COLORS.primaryBackground }]}
                      onPress={() => toggleAllowedRole(role.key)}
                    >
                      <Text style={[styles.roleBtnText, { color: COLORS.primary }]}>{role.label}</Text>
                      {active && <Ionicons name="checkmark" size={14} color={COLORS.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>ใช้ได้กับแพ็กเกจ / บริการไหนบ้าง</Text>
              {CAMPAIGN_PACKAGE_GROUPS.map((group) => {
                const packages = CAMPAIGN_PACKAGE_OPTIONS.filter((pkg) => group.audiences.includes(pkg.audience));
                if (packages.length === 0) return null;

                return (
                  <View key={group.key} style={styles.packageGroupSection}>
                    <Text style={styles.packageGroupTitle}>{group.label}</Text>
                    <View style={styles.roleGrid}>
                      {packages.map((pkg) => {
                        const active = codeForm.allowedPackages.includes(pkg.key);
                        return (
                          <TouchableOpacity
                            key={pkg.key}
                            style={[styles.roleBtn, { borderColor: COLORS.accent }, active && { backgroundColor: COLORS.warningLight }]}
                            onPress={() => toggleAllowedPackage(pkg.key)}
                          >
                            <Text style={[styles.roleBtnText, { color: COLORS.accent }]}>{pkg.label}</Text>
                            {active && <Ionicons name="checkmark" size={14} color={COLORS.accent} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}

              <View style={styles.toggleStack}>
                <TouchableOpacity
                  style={[styles.toggleCard, codeForm.firstPurchaseOnly && styles.toggleCardActive]}
                  onPress={() => setCodeForm((prev) => ({ ...prev, firstPurchaseOnly: !prev.firstPurchaseOnly }))}
                >
                  <Ionicons name={codeForm.firstPurchaseOnly ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={codeForm.firstPurchaseOnly ? COLORS.primary : COLORS.textLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleCardTitle}>ใช้ได้เฉพาะครั้งแรก</Text>
                    <Text style={styles.toggleCardSub}>เหมาะกับโค้ดต้อนรับผู้ใช้ใหม่หรือชวนกลับมาใช้งาน</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleCard, codeForm.isActive && styles.toggleCardActive]}
                  onPress={() => setCodeForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
                >
                  <Ionicons name={codeForm.isActive ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={codeForm.isActive ? COLORS.success : COLORS.textLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.toggleCardTitle}>เปิดใช้งานทันที</Text>
                    <Text style={styles.toggleCardSub}>ถ้าปิดไว้ admin จะสร้าง draft code ก่อน</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {selectedCode && (
                <>
                  <Text style={styles.modalSectionTitle}>การดำเนินการ</Text>
                  <View style={styles.actionList}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: selectedCode.isActive ? COLORS.warningLight : COLORS.successLight }]}
                      onPress={() => handleToggleCodeActive(selectedCode)}
                    >
                      <Ionicons
                        name={selectedCode.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                        size={20}
                        color={selectedCode.isActive ? COLORS.accent : COLORS.success}
                      />
                      <Text style={[styles.actionBtnText, { color: selectedCode.isActive ? COLORS.accent : COLORS.success }]}>
                        {selectedCode.isActive ? 'ปิดการใช้งานโค้ด' : 'เปิดการใช้งานโค้ด'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: COLORS.errorLight }]}
                      onPress={() => handleDeleteCode(selectedCode)}
                    >
                      <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                      <Text style={[styles.actionBtnText, { color: COLORS.error }]}>ลบโค้ดถาวร</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <TouchableOpacity style={[styles.saveCodeBtn, savingCode && { opacity: 0.6 }]} onPress={handleSaveCode} disabled={savingCode}>
                {savingCode ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveCodeBtnText}>{selectedCode ? 'บันทึกการแก้ไข' : 'สร้างโค้ด'}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatCard({ icon, label, value, color, sub }: {
  icon: string; label: string; value: number | string; color: string; sub: string;
}) {
  return (
    <View style={[styles.statCard, { borderTopWidth: 4, borderTopColor: color }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{typeof value === 'number' ? value.toLocaleString() : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statSub, { color }]}>{sub}</Text>
    </View>
  );
}

function FloatingQuickAction({ icon, label, color, badge, onPress }: {
  icon: string; label: string; color: string; badge?: number; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  };

  return (
    <TouchableOpacity
      style={styles.quickActionBtn}
      onPress={onPress}
      onPressIn={() => animateTo(0.93)}
      onPressOut={() => animateTo(1)}
      activeOpacity={1}
    >
      <Animated.View style={[styles.quickActionFab, { shadowColor: color, transform: [{ scale }] }]}> 
        <View style={[styles.quickActionFabCore, { backgroundColor: color }]}> 
          <View style={[styles.quickActionIcon, { backgroundColor: color + '22' }]}>
            <Ionicons name={icon as any} size={24} color={COLORS.white} />
          </View>
        </View>
        {badge != null && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, mono }: {
  icon: string; label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon as any} size={16} color={COLORS.textLight} />
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoRowValue, mono && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4EFE8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },

  // Header
  header: {
    backgroundColor: '#F4EFE8',
    paddingBottom: SPACING.sm,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.08)',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.08)',
  },
  headerTopTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTopLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  headerTopSubLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  headerHeroCard: {
    marginHorizontal: SPACING.lg,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    gap: 16,
    ...SHADOWS.sm,
  },
  headerHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerEyebrow: {
    fontSize: FONT_SIZES.xs + 1,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 24,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  headerStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryBackground,
  },
  headerStatusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  headerSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  headerSummaryCard: {
    flex: 1,
    backgroundColor: '#F7F3EB',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  headerSummaryValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSummaryLabel: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingTop: 4,
    paddingBottom: 2,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.08)',
  },
  tabActive: {
    backgroundColor: COLORS.primaryBackground,
    borderColor: 'rgba(17,94,89,0.12)',
  },
  tabLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  contentContainerWithFab: {
    paddingBottom: 124,
  },
  overviewPage: {
    gap: 2,
  },
  overviewHeroCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 28,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    marginBottom: 2,
    ...SHADOWS.sm,
  },
  overviewHeroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  overviewEyebrow: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  overviewHeroTitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.md + 1,
    fontWeight: '700',
    color: COLORS.text,
  },
  overviewHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  overviewHeroBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  overviewHeroSubtitle: {
    marginTop: 8,
    fontSize: FONT_SIZES.xs + 1,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  priorityCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10 - 36) / 2,
    backgroundColor: '#F8F4ED',
    borderRadius: 22,
    padding: 12,
    gap: 6,
  },
  priorityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityTitle: {
    fontSize: FONT_SIZES.xs + 1,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 18,
  },
  priorityValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  priorityDetail: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
    color: COLORS.textSecondary,
    minHeight: 30,
  },
  priorityFooter: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priorityActionText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },

  // Section
  sectionTitle: {
    fontSize: FONT_SIZES.md + 1,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 18,
    marginBottom: 8,
  },
  sectionTitleCompact: {
    fontSize: FONT_SIZES.md + 1,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    maxWidth: SCREEN_WIDTH * 0.62,
    lineHeight: 18,
  },
  sectionLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.08)',
  },
  sectionLinkText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  filterRowCompact: {
    marginTop: 6,
    marginBottom: 2,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10) / 2,
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    minHeight: 116,
    ...SHADOWS.sm,
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statSub: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    marginTop: 6,
  },
  insightGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  insightCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10) / 2,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.05)',
  },
  insightValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  insightLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  areaInsightsGrid: {
    gap: 10,
    marginTop: 2,
  },
  trafficTeaserCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  trafficTeaserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trafficTeaserTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  trafficTeaserSubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  trafficTeaserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: BORDER_RADIUS.full,
  },
  trafficTeaserButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.white,
  },
  trafficTeaserStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  trafficTeaserStatCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  trafficTeaserStatValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  trafficTeaserStatLabel: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  trafficHeroCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  trafficHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trafficHeroTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  trafficHeroSubtitle: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  trafficHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.primaryBackground,
  },
  trafficHeroButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  trafficHeroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  trafficHeroMetaText: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  trafficResetRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  trafficResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.backgroundSecondary,
  },
  trafficResetButtonDisabled: {
    opacity: 0.55,
  },
  trafficResetButtonText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.primary,
  },
  trafficResetButtonTextDisabled: {
    color: COLORS.textLight,
  },
  trafficResetButtonTextDanger: {
    color: COLORS.error,
  },
  areaInsightCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  areaInsightCardWide: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  areaInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  areaInsightTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  areaInsightCaption: {
    fontSize: 10,
    color: COLORS.textLight,
  },
  areaInsightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  areaInsightLabel: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
  },
  areaInsightRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  areaInsightValue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  areaInsightEmpty: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  timeInsightWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeInsightChip: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 24 - 8) / 2,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 16,
    padding: 10,
    gap: 4,
  },
  timeInsightChipActive: {
    backgroundColor: COLORS.primaryBackground,
    borderWidth: 1,
    borderColor: 'rgba(17,94,89,0.18)',
  },
  timeInsightRank: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  timeInsightLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: '600',
    lineHeight: 16,
  },
  timeInsightValue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  areaBalanceWrap: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    gap: 8,
  },
  areaBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  areaBalanceProvince: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '700',
  },
  areaBalanceMeta: {
    marginTop: 2,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  areaBalancePressure: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  regionSummaryWrap: {
    gap: 10,
  },
  regionSummaryRow: {
    gap: 6,
  },
  regionSummaryLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  regionSummaryBars: {
    flexDirection: 'row',
    gap: 8,
  },
  regionSummaryBar: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  regionSummaryBarText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: '600',
  },

  overviewCompactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  overviewCompactCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10) / 2,
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  overviewCompactTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },

  // Quick Actions
  fabDockWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  fabDock: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: 'rgba(255,253,248,0.96)',
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#1B2430',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },
  quickActionBtn: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  quickActionFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.64)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  quickActionFabCore: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13,
    maxWidth: 72,
  },
  quickActionBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: COLORS.error,
    borderRadius: 11,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFDF8',
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Card
  card: {
    backgroundColor: '#FFFDF8',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  commercePanel: {
    backgroundColor: '#FFFDF8',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  commercePanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  commercePanelTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  commercePanelSubtitle: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  commerceStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  commerceStatBox: {
    flex: 1,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: 10,
  },
  commerceStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  commerceStatValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  commerceStatHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  commerceMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commerceMetaPill: {
    backgroundColor: COLORS.primaryBackground,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commerceMetaLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  commerceMetaValue: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    fontWeight: '700',
  },

  // Breakdown Row
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  broadcastTemplateChip: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 10,
    minWidth: 150,
  },
  broadcastTemplateChipTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  broadcastTemplateChipSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  broadcastInsightCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  broadcastInsightTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  broadcastInsightText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  broadcastOpsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  broadcastOpsCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10) / 2,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    gap: 8,
    ...SHADOWS.sm,
  },
  broadcastOpsTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  broadcastOpsHint: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },
  broadcastFlagRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 12,
    gap: 4,
  },
  broadcastFlagTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  broadcastFlagText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  broadcastFlagMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    width: 80,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  breakdownLabelWide: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    paddingRight: 8,
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  breakdownCount: {
    width: 32,
    textAlign: 'right',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  breakdownCountWide: {
    maxWidth: '48%',
    textAlign: 'right',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
    lineHeight: 20,
  },
  analyticsCheckStatus: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  analyticsCheckStatusPass: {
    backgroundColor: COLORS.successLight,
  },
  analyticsCheckStatusWarn: {
    backgroundColor: COLORS.warningLight,
  },
  analyticsCheckStatusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  analyticsCheckStatusTextPass: {
    color: COLORS.success,
  },
  analyticsCheckStatusTextWarn: {
    color: COLORS.warning,
  },
  analyticsBlockersText: {
    marginTop: 8,
    fontSize: FONT_SIZES.xs + 1,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  featureUsageSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  featureUsageSummaryBox: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: COLORS.background,
  },
  featureUsageSummaryValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  featureUsageSummaryLabel: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  featureUsageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
  },
  featureUsageRankWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureUsageRankText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primary,
  },
  featureUsageBody: {
    flex: 1,
    gap: 4,
  },
  featureUsageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  featureUsageLabel: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureUsageMeta: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.textSecondary,
  },
  featureUsageConversion: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.primary,
    fontWeight: '600',
  },
  featureUsageNote: {
    fontSize: FONT_SIZES.xs + 1,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  featureUsageBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureUsageBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  featureUsageBadgeNeutral: {
    backgroundColor: COLORS.primaryBackground,
  },
  featureUsageBadgeNeutralText: {
    color: COLORS.primary,
  },
  featureUsageBadgeMuted: {
    backgroundColor: COLORS.background,
  },
  featureUsageBadgeMutedText: {
    color: COLORS.textSecondary,
  },
  featureFocusRow: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
    gap: 4,
  },
  featureFocusHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  featureFocusTitle: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureFocusCount: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  featureFocusMeta: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.textSecondary,
  },

  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 10,
    marginBottom: 6,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  listItemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  listItemSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },

  // Avatar
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLgText: {
    fontSize: 24,
    fontWeight: '700',
  },

  // See All Button
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  seeAllText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF8',
    borderRadius: 18,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    height: '100%',
  },

  // Filter
  filterRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  filterChip: {
    backgroundColor: '#FFFDF8',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.08)',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },

  resultCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginVertical: 10,
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  inlineLoadingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  loadMoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: COLORS.white,
  },
  loadMoreButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  bulkResetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.warningLight,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  bulkResetTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.accent,
  },
  bulkResetSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // User Card
  userCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userCardName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
  },
  userCardEmail: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  userCardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  userCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCardMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  suspendedChip: {
    backgroundColor: COLORS.errorLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  suspendedChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Job Card
  jobCard: {
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  jobCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  jobCardPoster: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  jobCardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  jobCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  jobCardTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  jobCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  jobCardFooterText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  jobCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  jobCardStatText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },

  // Chat Card
  chatCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFDF8',
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(12,35,64,0.06)',
    ...SHADOWS.sm,
  },
  chatParticipants: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  chatJob: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  chatLastMsg: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  chatTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 4,
  },
  chatDeleteBtn: {
    justifyContent: 'center',
    padding: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  modalProfileName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  miniChipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  miniChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },

  // Info Section
  infoSection: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoRowValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    maxWidth: '55%',
    textAlign: 'right',
  },

  // Modal Section
  modalSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  moderationTagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  moderationTagChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  moderationTagChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  moderationTagChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  moderationTagChipTextActive: {
    color: COLORS.white,
  },
  moderationInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginBottom: 10,
  },
  moderationTextarea: {
    minHeight: 82,
  },
  saveModerationBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  saveModerationBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  accessFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  accessFieldLabel: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  accessFieldHint: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  accessFieldInput: {
    width: 104,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: 'right',
  },

  // Role Grid
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  packageGroupSection: {
    marginBottom: 8,
  },
  packageGroupTitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginBottom: 8,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  roleBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },

  // Action List
  actionList: {
    gap: 8,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },

  // Job Modal
  jobModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  jobModalTitle: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  jobModalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 16,
    marginBottom: 20,
  },
  jobModalStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  jobModalStatValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  jobModalStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },

  // Code Tools
  codesHeroCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...SHADOWS.sm,
  },
  codesHeroTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  codesHeroSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  codesHeroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  codesHeroButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  broadcastHeroCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    ...SHADOWS.sm,
  },
  broadcastHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  broadcastHeroTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  broadcastHeroSub: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  broadcastCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: 16,
    ...SHADOWS.sm,
  },
  broadcastChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  broadcastSelectedWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  broadcastSelectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryBackground,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  broadcastSelectedChipText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  broadcastHintBox: {
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryBackground,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  broadcastHintText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.primaryDark,
    lineHeight: 20,
  },
  broadcastSendButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
  },
  broadcastSendButtonDisabled: {
    opacity: 0.7,
  },
  broadcastSendButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  broadcastActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  broadcastPreviewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 14,
  },
  broadcastPreviewButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  broadcastPreviewCard: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  broadcastPreviewStat: {
    flex: 1,
    alignItems: 'center',
  },
  broadcastPreviewValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  broadcastPreviewLabel: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  broadcastPreviewDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.border,
  },
  broadcastHistoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  broadcastHistoryStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  broadcastHistoryActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  broadcastHistoryGhostButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  broadcastHistoryGhostButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  broadcastHistoryPrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  broadcastHistoryPrimaryButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  codeCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  codeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  codeValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.primary,
  },
  codeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  codeDescription: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  codeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  codeMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryBackground,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  codeMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  codeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  codeFooterText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  codeInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  formInput: {
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: 12,
  },
  formInputDisabled: {
    opacity: 0.7,
  },
  formTextArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  codeInput: {
    flex: 1,
    marginBottom: 0,
  },
  generateCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  generateCodeText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.primary,
  },
  optionGrid: {
    gap: 8,
    marginBottom: 12,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    backgroundColor: COLORS.white,
  },
  optionCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryBackground,
  },
  optionCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionCardTitleActive: {
    color: COLORS.primary,
  },
  optionCardSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  toggleStack: {
    gap: 8,
    marginBottom: 18,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryBackground,
  },
  toggleCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  toggleCardSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  saveCodeBtn: {
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  saveCodeBtnText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});
