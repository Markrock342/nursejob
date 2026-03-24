// ============================================
// ADMIN SERVICE - จัดการระบบสำหรับ Admin
// ============================================

import {
  addDoc,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  startAfter,
  getCountFromServer,
  writeBatch,
  QueryDocumentSnapshot,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import { getDefaultLaunchUsageLimitsConfigSnapshot, LaunchUsageLimitsConfig, LaunchUsageRole } from './subscriptionService';
import { getAuthUid } from './security/authGuards';
import { BillingCycle, LegalConsentRecord, Subscription, SubscriptionPlan, SubscriptionUsageFeature, UserAdminTag } from '../types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ADMIN_AUDIT_LOGS_COLLECTION = 'admin_audit_logs';
const APP_CONFIG_COLLECTION = 'app_config';
const LAUNCH_USAGE_LIMITS_CONFIG_ID = 'launch_usage_limits';
const LAUNCH_USAGE_ROLES: LaunchUsageRole[] = ['user', 'nurse', 'hospital', 'admin'];
const LAUNCH_USAGE_FEATURES: SubscriptionUsageFeature[] = [
  'post_create',
  'job_application',
  'chat_start',
  'urgent_post',
  'extend_post',
  'boost_post',
];

async function withPermissionRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const code = error?.code || '';
    if (retries > 0 && code === 'permission-denied') {
      // Firebase token can be briefly unavailable right after sign-in.
      await wait(450);
      return withPermissionRetry(fn, retries - 1);
    }
    throw error;
  }
}

type AdminMutationName =
  | 'adminVerifyUser'
  | 'adminUpdateUserRole'
  | 'adminDeleteUser'
  | 'sendBroadcastNotification'
  | 'previewBroadcastAudience'
  | 'recordBroadcastOpen'
  | 'getBroadcastAnalytics'
  | 'saveBroadcastTemplate'
  | 'listBroadcastTemplates'
  | 'archiveBroadcastTemplate'
  | 'scheduleBroadcastCampaign'
  | 'listScheduledBroadcastCampaigns'
  | 'deleteScheduledBroadcastCampaign'
  | 'runCommunicationAutomation'
  | 'runOperationalAction'
  | 'getRetentionMonitor'
  | 'getFraudAlertCenter'
  | 'updateFraudControls'
  | 'updateFraudAlertFlagStatus';

async function callAdminMutation<T = void>(functionName: AdminMutationName, payload: Record<string, any>): Promise<T> {
  const fn = httpsCallable(getFunctions(), functionName);
  const result = await fn(payload);
  return (result.data as T) || (undefined as T);
}

// ============================================
// Types
// ============================================
export interface AdminUser {
  id: string;
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  phone?: string;
  province?: string;
  role: 'user' | 'nurse' | 'hospital' | 'admin'; // user = ผู้ใช้ทั่วไป, nurse = พยาบาล verified
  isAdmin: boolean;
  isActive: boolean;
  isVerified: boolean;
  licenseNumber?: string;
  orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency';
  staffType?: string;
  adminTags?: UserAdminTag[];
  adminWarningTag?: string;
  postingSuspended?: boolean;
  postingSuspendedReason?: string;
  subscriptionPlan?: SubscriptionPlan;
  billingCycle?: BillingCycle;
  subscriptionExpiresAt?: Date;
  subscriptionMonthlyUsage?: Partial<Record<SubscriptionUsageFeature, { periodKey: string; used: number }>>;
  postsToday?: number;
  lastPostDate?: string;
  freeUrgentUsed?: boolean;
  freeUrgentMonthReset?: string;
  legalConsent?: LegalConsentRecord;
  photoURL?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
}

export interface AdminUserAccessUpdate {
  plan?: SubscriptionPlan;
  billingCycle?: BillingCycle | null;
  expiresAt?: Date | null;
  monthlyUsage?: Partial<Record<SubscriptionUsageFeature, number>>;
  postsToday?: number;
  lastPostDate?: string | null;
  freeUrgentUsed?: boolean;
  freeUrgentMonthReset?: string | null;
}

export interface AdminBulkRoleResetResult {
  role: 'user' | 'nurse' | 'hospital' | 'admin';
  updatedCount: number;
}

export interface AdminPageResult<T> {
  items: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

async function logAdminAudit(action: string, targetType: string, payload: Record<string, any>): Promise<void> {
  try {
    const actorId = getAuthUid();
    await addDoc(collection(db, ADMIN_AUDIT_LOGS_COLLECTION), {
      actorId: actorId || 'unknown',
      action,
      targetType,
      payload,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[adminAudit] failed to write audit log', error);
  }
}

const USAGE_FEATURES: SubscriptionUsageFeature[] = [
  'post_create',
  'job_application',
  'chat_start',
  'urgent_post',
  'extend_post',
  'boost_post',
];

function sanitizeMonthlyUsage(
  monthlyUsage: AdminUserAccessUpdate['monthlyUsage'] | undefined,
  existing: Subscription['monthlyUsage'] | undefined,
): Subscription['monthlyUsage'] | undefined {
  if (!monthlyUsage) return existing;

  const next: NonNullable<Subscription['monthlyUsage']> = {
    ...(existing || {}),
  };
  const periodKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  USAGE_FEATURES.forEach((feature) => {
    const rawValue = monthlyUsage[feature];
    if (rawValue == null) return;
    next[feature] = {
      periodKey,
      used: Math.max(0, Math.floor(rawValue)),
    };
  });

  return next;
}

function sanitizeSubscriptionForFirestore(subscription: Subscription): Record<string, any> {
  function stripUndefined(obj: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => {
          if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && typeof value.toDate !== 'function') {
            return [key, stripUndefined(value)];
          }
          return [key, value];
        })
    );
  }
  return stripUndefined(subscription as Record<string, any>);
}

function mapLegalConsent(raw: any): LegalConsentRecord | undefined {
  if (!raw?.terms || !raw?.privacy) return undefined;

  const normalizeAcceptedAt = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (value instanceof Date) return value;
    return undefined;
  };

  const termsAcceptedAt = normalizeAcceptedAt(raw.terms.acceptedAt);
  const privacyAcceptedAt = normalizeAcceptedAt(raw.privacy.acceptedAt);
  if (!termsAcceptedAt || !privacyAcceptedAt) return undefined;

  return {
    terms: {
      version: String(raw.terms.version || ''),
      acceptedAt: termsAcceptedAt,
    },
    privacy: {
      version: String(raw.privacy.version || ''),
      acceptedAt: privacyAcceptedAt,
    },
    acceptedFrom: typeof raw.acceptedFrom === 'string' ? raw.acceptedFrom : undefined,
  };
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getLaunchUsageLimitsAdminDocRef() {
  return doc(db, APP_CONFIG_COLLECTION, LAUNCH_USAGE_LIMITS_CONFIG_ID);
}

function sanitizeLaunchUsageLimitsConfig(
  config?: Partial<LaunchUsageLimitsConfig> | null,
): LaunchUsageLimitsConfig {
  const defaults = getDefaultLaunchUsageLimitsConfigSnapshot();
  const next = getDefaultLaunchUsageLimitsConfigSnapshot();

  LAUNCH_USAGE_ROLES.forEach((role) => {
    LAUNCH_USAGE_FEATURES.forEach((feature) => {
      const candidate = config?.roles?.[role]?.[feature];
      if (typeof candidate === 'number' && Number.isFinite(candidate)) {
        next.roles[role][feature] = Math.max(0, Math.floor(candidate));
      }
    });
  });

  next.updatedAt = config?.updatedAt ?? defaults.updatedAt ?? null;
  next.updatedBy = config?.updatedBy ?? defaults.updatedBy ?? null;
  return next;
}

function mapLaunchUsageLimitsConfig(rawValue: unknown): LaunchUsageLimitsConfig {
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, any> : {};
  const updatedAtRaw = raw.updatedAt;

  return sanitizeLaunchUsageLimitsConfig({
    roles: raw.roles,
    updatedAt:
      updatedAtRaw instanceof Timestamp
        ? updatedAtRaw.toDate()
        : typeof updatedAtRaw?.toDate === 'function'
          ? updatedAtRaw.toDate()
          : updatedAtRaw instanceof Date
            ? updatedAtRaw
            : null,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  });
}

export async function getLaunchUsageLimitsAdminSettings(): Promise<LaunchUsageLimitsConfig> {
  const snapshot = await withPermissionRetry(() => getDoc(getLaunchUsageLimitsAdminDocRef()), 1);
  if (!snapshot.exists()) {
    return getDefaultLaunchUsageLimitsConfigSnapshot();
  }
  return mapLaunchUsageLimitsConfig(snapshot.data());
}

export function subscribeLaunchUsageLimitsAdminSettings(
  onChange: (config: LaunchUsageLimitsConfig) => void,
): Unsubscribe {
  return onSnapshot(
    getLaunchUsageLimitsAdminDocRef(),
    (snapshot) => {
      onChange(
        snapshot.exists()
          ? mapLaunchUsageLimitsConfig(snapshot.data())
          : getDefaultLaunchUsageLimitsConfigSnapshot(),
      );
    },
    (error) => {
      console.error('Error subscribing launch usage limits admin settings:', error);
      onChange(getDefaultLaunchUsageLimitsConfigSnapshot());
    },
  );
}

export async function updateLaunchUsageLimits(
  adminUserId: string,
  config: LaunchUsageLimitsConfig,
): Promise<LaunchUsageLimitsConfig> {
  const sanitized = sanitizeLaunchUsageLimitsConfig(config);
  await withPermissionRetry(() => setDoc(
    getLaunchUsageLimitsAdminDocRef(),
    {
      roles: sanitized.roles,
      updatedAt: serverTimestamp(),
      updatedBy: adminUserId,
    },
    { merge: true },
  ), 1);
  await logAdminAudit('update_launch_usage_limits', 'app_config', {
    configId: LAUNCH_USAGE_LIMITS_CONFIG_ID,
    roles: sanitized.roles,
    updatedBy: adminUserId,
  });
  return {
    ...sanitized,
    updatedAt: new Date(),
    updatedBy: adminUserId,
  };
}

export async function resetLaunchUsageLimitsAdminSettings(
  adminUserId: string,
): Promise<LaunchUsageLimitsConfig> {
  const defaults = getDefaultLaunchUsageLimitsConfigSnapshot();
  await withPermissionRetry(() => setDoc(
    getLaunchUsageLimitsAdminDocRef(),
    {
      roles: defaults.roles,
      updatedAt: serverTimestamp(),
      updatedBy: adminUserId,
    },
  ), 1);
  await logAdminAudit('reset_launch_usage_limits', 'app_config', {
    configId: LAUNCH_USAGE_LIMITS_CONFIG_ID,
    updatedBy: adminUserId,
  });
  return {
    ...defaults,
    updatedAt: new Date(),
    updatedBy: adminUserId,
  };
}

export interface AdminJob {
  id: string;
  title: string;
  posterName: string;
  posterId: string;
  status: 'active' | 'closed' | 'urgent';
  department: string;
  staffType?: string;
  shiftRate: number;
  province?: string;
  hospital?: string;
  shiftDate?: Date;
  shiftTime?: string;
  createdAt: Date;
  contactsCount: number;
  applicantsCount: number;
  viewsCount: number;
}

export interface AdminConversation {
  id: string;
  participants: string[];
  participantDetails: { id: string; name: string; displayName?: string }[];
  jobTitle?: string;
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface DashboardStats {
  totalUsers: number;
  totalJobs: number;
  activeJobs: number;
  totalConversations: number;
  todayNewUsers: number;
  todayNewJobs: number;
  pendingVerifications?: number;
  pendingDocuments?: number;
}

export interface AdminPendingDocument {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhotoURL?: string;
  type: string;
  name: string;
  fileName: string;
  fileUrl: string;
  storagePath?: string;
  fileSize: number;
  mimeType: string;
  isVerified: boolean;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: Date;
  reviewedAt?: Date;
  updatedAt?: Date;
}

export interface ExecutiveAnalyticsSummary {
  generatedAt: string;
  generatedFrom?: string;
  freshness?: string | null;
  windows: {
    last7DaysStart: string;
    last30DaysStart: string;
  };
  overview: {
    dau: number;
    wau: number;
    mau: number;
    newUsers7d: number;
    activatedUsers7d: number;
    jobsPosted7d: number;
    jobsWithApplicants7d: number;
    uniqueApplicants7d: number;
    uniquePosters7d: number;
    applyClicks7d: number;
    applications7d: number;
    jobDetailViews7d: number;
    shareClicks7d: number;
    chatClicks7d: number;
    conversationStarts7d: number;
    notificationOpens7d: number;
    applicationRate: number;
    applyCompletionRate: number;
    chatStartRate: number;
    liquidityRate: number;
  };
  monetizationReadiness: {
    recommended: boolean;
    score: number;
    blockers: string[];
    checks: Array<{
      key: string;
      label: string;
      current: number;
      target: number;
      passed: boolean;
      unit: 'count' | 'ratio';
    }>;
  };
  featureUsage?: {
    trackedWindowDays: number;
    totalTrackedEvents7d: number;
    totalTrackedUsers7d: number;
    allFeatures: Array<{
      key: string;
      label: string;
      usageCount7d: number;
      uniqueUsers7d: number;
      shareOfTrackedEvents: number;
      avgUsagePerUser7d: number;
      conversionRate7d?: number | null;
      conversionLabel?: string | null;
      recommendation: 'price_candidate' | 'retain_and_optimize' | 'review_for_removal' | 'watchlist';
      recommendationLabel: string;
      businessNote: string;
      pricingModelHint: string;
    }>;
    topFeatures: Array<{
      key: string;
      label: string;
      usageCount7d: number;
      uniqueUsers7d: number;
      shareOfTrackedEvents: number;
      avgUsagePerUser7d: number;
      conversionRate7d?: number | null;
      conversionLabel?: string | null;
      recommendation: 'price_candidate' | 'retain_and_optimize' | 'review_for_removal' | 'watchlist';
      recommendationLabel: string;
      businessNote: string;
      pricingModelHint: string;
    }>;
    pricingCandidates: Array<{
      key: string;
      label: string;
      usageCount7d: number;
      uniqueUsers7d: number;
      shareOfTrackedEvents: number;
      avgUsagePerUser7d: number;
      conversionRate7d?: number | null;
      conversionLabel?: string | null;
      recommendation: 'price_candidate' | 'retain_and_optimize' | 'review_for_removal' | 'watchlist';
      recommendationLabel: string;
      businessNote: string;
      pricingModelHint: string;
    }>;
    lowUsageFeatures: Array<{
      key: string;
      label: string;
      usageCount7d: number;
      uniqueUsers7d: number;
      shareOfTrackedEvents: number;
      avgUsagePerUser7d: number;
      conversionRate7d?: number | null;
      conversionLabel?: string | null;
      recommendation: 'price_candidate' | 'retain_and_optimize' | 'review_for_removal' | 'watchlist';
      recommendationLabel: string;
      businessNote: string;
      pricingModelHint: string;
    }>;
  };
}

export interface RetentionMonitorCollectionItem {
  key: string;
  label: string;
  count: number;
  retentionDays: number;
}

export interface RetentionMonitorSummary {
  ok: boolean;
  generatedAt: string;
  collections: RetentionMonitorCollectionItem[];
}

export interface AdminBroadcastPayload {
  title: string;
  body: string;
  type: 'system' | 'promotion';
  targetRole: 'all' | 'user' | 'nurse' | 'hospital' | 'admin';
  targetProvince?: string;
  targetProvinces?: string[];
  targetStaffTypes?: string[];
  activeWithinDays?: number;
  neverPosted?: boolean;
  targetScreen?: string;
  targetParams?: Record<string, any>;
  templateKey?: string;
  campaignName?: string;
  variants?: Array<{ id?: string; title: string; body: string }>;
  onlyVerified: boolean;
  activeOnly: boolean;
}

export interface AdminBroadcastResult {
  ok: boolean;
  broadcastId?: string;
  sentCount: number;
  inAppCount: number;
  pushSentCount: number;
  pushFailedCount: number;
  breakdown?: AdminBroadcastAudienceBreakdown;
}

export interface AdminBroadcastAudienceBreakdown {
  roleBreakdown: Record<string, number>;
  provinceBreakdown: Array<{ key: string; count: number }>;
  staffTypeBreakdown: Array<{ key: string; count: number }>;
  verifiedCount: number;
  pushReadyCount: number;
}

export interface AdminBroadcastPreviewResult {
  ok: boolean;
  matchedCount: number;
  pushReadyCount: number;
  targetProvince?: string | null;
  targetProvinces?: string[];
  targetStaffTypes?: string[];
  activeWithinDays?: number;
  neverPosted?: boolean;
  breakdown?: AdminBroadcastAudienceBreakdown;
}

export interface AdminBroadcastHistoryItem {
  id: string;
  title: string;
  body: string;
  type: 'system' | 'promotion';
  targetRole: 'all' | 'user' | 'nurse' | 'hospital' | 'admin';
  targetProvince?: string | null;
  targetProvinces?: string[];
  targetStaffTypes?: string[];
  activeWithinDays?: number;
  neverPosted?: boolean;
  campaignName?: string;
  targetScreen?: string | null;
  templateKey?: string | null;
  openCount?: number;
  destinationOpenCounts?: Record<string, number>;
  variantStats?: Record<string, { title?: string; body?: string; sentCount?: number; openCount?: number }>;
  audienceBreakdown?: AdminBroadcastAudienceBreakdown;
  onlyVerified: boolean;
  activeOnly: boolean;
  sentCount: number;
  inAppCount: number;
  pushSentCount: number;
  pushFailedCount: number;
  createdBy?: string;
  createdAt?: Date;
}

export interface BroadcastTemplateItem {
  id: string;
  name: string;
  title: string;
  body: string;
  type: 'system' | 'promotion';
  targetScreen?: string | null;
  updatedAt?: Date;
}

export interface ScheduledBroadcastCampaign {
  id: string;
  title: string;
  body: string;
  type: 'system' | 'promotion';
  targetRole: 'all' | 'user' | 'nurse' | 'hospital' | 'admin';
  targetProvinces: string[];
  targetStaffTypes: string[];
  activeWithinDays: number;
  neverPosted: boolean;
  onlyVerified: boolean;
  activeOnly: boolean;
  targetScreen?: string | null;
  campaignName?: string | null;
  status: 'scheduled' | 'sent' | 'failed';
  scheduledAt?: Date;
  processedAt?: Date;
}

export interface BroadcastAnalyticsSummary {
  broadcastId: string;
  sentCount: number;
  inAppCount: number;
  pushSentCount: number;
  pushFailedCount: number;
  openCount: number;
  openRate: number;
  targetScreen?: string | null;
  destinationOpenCounts?: Record<string, number>;
  variantStats?: Record<string, { title?: string; body?: string; sentCount?: number; openCount?: number }>;
  conversions: {
    applyCount: number;
    postCount: number;
    purchaseCount: number;
  };
  openedUserCount: number;
}

export interface FraudAlertSummary {
  pendingFlags: number;
  recentScamReports: number;
  keywordCount: number;
  transferWarningTitle: string;
  transferWarningBody: string;
}

export interface FraudAlertFlag {
  id: string;
  type: string;
  conversationId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  matchedKeywords?: string[];
  textPreview?: string;
  status?: string;
  createdAt?: Date;
}

export interface FraudAlertCenterResult {
  ok: boolean;
  summary: FraudAlertSummary;
  config?: {
    blacklistKeywords: string[];
    transferWarningTitle: string;
    transferWarningBody: string;
  };
  flags: FraudAlertFlag[];
}

// ============================================
// Dashboard Stats
// ============================================
export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Run every count independently — one failure does not zero out the rest
  const safeCount = async (ref: any): Promise<number> => {
    try {
      const snap = await withPermissionRetry(() => getCountFromServer(ref), 1);
      return snap.data().count;
    } catch {
      return 0;
    }
  };

  const usersRef = collection(db, 'users');
  const jobsRef = collection(db, 'shifts');
  const conversationsRef = collection(db, 'conversations');

  const [totalUsers, todayNewUsers, totalJobs, activeJobs, todayNewJobs, totalConversations, pendingVerifications, pendingDocuments] =
    await Promise.all([
      safeCount(usersRef),
      safeCount(query(usersRef, where('createdAt', '>=', Timestamp.fromDate(today)))),
      safeCount(jobsRef),
      safeCount(query(jobsRef, where('status', '==', 'active'))),
      safeCount(query(jobsRef, where('createdAt', '>=', Timestamp.fromDate(today)))),
      safeCount(conversationsRef),
      safeCount(query(collection(db, 'verifications'), where('status', '==', 'pending'))),
      getPendingDocumentsCount(),
    ]);

  return {
    totalUsers,
    totalJobs,
    activeJobs,
    totalConversations,
    todayNewUsers,
    todayNewJobs,
    pendingVerifications,
    pendingDocuments,
  };
}

async function getPendingDocumentsCount(): Promise<number> {
  try {
    const countSnap = await withPermissionRetry(
      () => getCountFromServer(query(collection(db, 'documents'), where('status', '==', 'pending'))),
      1,
    );
    return countSnap.data().count;
  } catch {
    try {
      const snapshot = await withPermissionRetry(() => getDocs(query(collection(db, 'documents'), limit(300))), 1);
      return snapshot.docs.filter((item) => {
        const data = item.data() || {};
        const status = data.status || (data.isVerified ? 'approved' : 'pending');
        return status === 'pending';
      }).length;
    } catch {
      return 0;
    }
  }
}

export async function getAllPendingDocuments(limitCount: number = 100): Promise<AdminPendingDocument[]> {
  try {
    let snapshot;
    try {
      const preferredQuery = query(
        collection(db, 'documents'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc'),
        limit(limitCount),
      );
      snapshot = await withPermissionRetry(() => getDocs(preferredQuery), 1);
    } catch {
      const fallbackQuery = query(collection(db, 'documents'), limit(limitCount));
      snapshot = await withPermissionRetry(() => getDocs(fallbackQuery), 1);
    }

    const documents = await Promise.all(
      snapshot.docs.map(async (documentSnap) => {
        const data = documentSnap.data();
        const status = (data.status || (data.isVerified ? 'approved' : 'pending')) as AdminPendingDocument['status'];
        if (status !== 'pending') return null;
        const userId = data.userId || '';
        let userName = 'ไม่ระบุชื่อ';
        let userEmail = '';
        let userPhotoURL: string | undefined;

        if (userId) {
          try {
            const userSnap = await withPermissionRetry(() => getDoc(doc(db, 'users', userId)), 1);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              userName = userData.displayName || userData.username || 'ไม่ระบุชื่อ';
              userEmail = userData.email || '';
              userPhotoURL = userData.photoURL;
            }
          } catch {
            // Ignore per-user enrichment failures and return the document anyway.
          }
        }

        return {
          id: documentSnap.id,
          userId,
          userName,
          userEmail,
          userPhotoURL,
          type: data.type || 'other',
          name: data.name || data.fileName || 'เอกสาร',
          fileName: data.fileName || '',
          fileUrl: data.fileUrl || '',
          storagePath: data.storagePath || undefined,
          fileSize: typeof data.fileSize === 'number' ? data.fileSize : 0,
          mimeType: data.mimeType || 'application/octet-stream',
          isVerified: Boolean(data.isVerified),
          status,
          rejectionReason: data.rejectionReason || undefined,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          reviewedAt: data.reviewedAt?.toDate?.(),
          updatedAt: data.updatedAt?.toDate?.(),
        } as AdminPendingDocument;
      })
    );

    return documents.filter(Boolean).sort((a, b) => b!.createdAt.getTime() - a!.createdAt.getTime()) as AdminPendingDocument[];
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getAllPendingDocuments] permission-denied');
      return [];
    }
    console.warn('Error getting pending documents:', error);
    return [];
  }
}

export async function getExecutiveAnalyticsSummary(): Promise<ExecutiveAnalyticsSummary | null> {
  try {
    const fn = httpsCallable(getFunctions(), 'getExecutiveAnalyticsSummary');
    const result = await fn();
    return (result.data || null) as ExecutiveAnalyticsSummary | null;
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getExecutiveAnalyticsSummary] permission-denied');
      return null;
    }
    console.warn('Error getting executive analytics summary:', error);
    return null;
  }
}

export async function getRetentionMonitor(): Promise<RetentionMonitorSummary | null> {
  try {
    const fn = httpsCallable(getFunctions(), 'getRetentionMonitor');
    const result = await fn();
    return (result.data || null) as RetentionMonitorSummary | null;
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getRetentionMonitor] permission-denied');
      return null;
    }
    console.warn('Error getting retention monitor:', error);
    return null;
  }
}

// ============================================
// User Management
// ============================================
export async function getAllUsers(limitCount: number = 50): Promise<AdminUser[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withPermissionRetry(() => getDocs(q), 1);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid || doc.id,
        email: data.email || '',
        username: data.username,
        displayName: data.displayName || 'ไม่ระบุชื่อ',
        phone: data.phone,
        province: data.province || data.location?.province || data.preferredProvince || '',
        role: data.role || 'nurse',
        isAdmin: data.isAdmin || false,
        isActive: data.isActive !== false, // default true
        isVerified: data.isVerified || false,
        licenseNumber: data.licenseNumber,
        orgType: data.orgType,
        staffType: data.staffType,
        adminTags: Array.isArray(data.adminTags) ? data.adminTags : [],
        adminWarningTag: typeof data.adminWarningTag === 'string' ? data.adminWarningTag : undefined,
        postingSuspended: data.postingSuspended === true,
        postingSuspendedReason: typeof data.postingSuspendedReason === 'string' ? data.postingSuspendedReason : undefined,
        subscriptionPlan: data.subscription?.plan,
        billingCycle: data.subscription?.billingCycle,
        subscriptionExpiresAt: data.subscription?.expiresAt?.toDate?.() || undefined,
        subscriptionMonthlyUsage: data.subscription?.monthlyUsage,
        postsToday: typeof data.subscription?.postsToday === 'number' ? data.subscription.postsToday : undefined,
        lastPostDate: typeof data.subscription?.lastPostDate === 'string' ? data.subscription.lastPostDate : undefined,
        freeUrgentUsed: data.subscription?.freeUrgentUsed === true,
        freeUrgentMonthReset: typeof data.subscription?.freeUrgentMonthReset === 'string' ? data.subscription.freeUrgentMonthReset : undefined,
        legalConsent: mapLegalConsent(data.legalConsent),
        photoURL: data.photoURL,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.(),
        lastLoginAt: data.lastLoginAt?.toDate?.(),
      };
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getAllUsers] permission-denied — auth token not ready');
      return [];
    }
    console.warn('Error getting users:', error);
    return [];
  }
}

export async function getUsersPage(options?: {
  limitCount?: number;
  role?: 'user' | 'nurse' | 'hospital' | 'admin' | 'all';
  cursor?: QueryDocumentSnapshot | null;
}): Promise<AdminPageResult<AdminUser>> {
  const limitCount = options?.limitCount || 30;
  const role = options?.role || 'all';
  try {
    const usersRef = collection(db, 'users');
    const constraints: any[] = [];
    if (role !== 'all') {
      constraints.push(where('role', '==', role));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    if (options?.cursor) {
      constraints.push(startAfter(options.cursor));
    }
    constraints.push(limit(limitCount));

    const snapshot = await withPermissionRetry(() => getDocs(query(usersRef, ...constraints)), 1);
    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        uid: data.uid || docSnap.id,
        email: data.email || '',
        username: data.username,
        displayName: data.displayName || 'ไม่ระบุชื่อ',
        phone: data.phone,
        province: data.province || data.location?.province || data.preferredProvince || '',
        role: data.role || 'nurse',
        isAdmin: data.isAdmin || false,
        isActive: data.isActive !== false,
        isVerified: data.isVerified || false,
        licenseNumber: data.licenseNumber,
        orgType: data.orgType,
        staffType: data.staffType,
        adminTags: Array.isArray(data.adminTags) ? data.adminTags : [],
        adminWarningTag: typeof data.adminWarningTag === 'string' ? data.adminWarningTag : undefined,
        postingSuspended: data.postingSuspended === true,
        postingSuspendedReason: typeof data.postingSuspendedReason === 'string' ? data.postingSuspendedReason : undefined,
        subscriptionPlan: data.subscription?.plan,
        billingCycle: data.subscription?.billingCycle,
        subscriptionExpiresAt: data.subscription?.expiresAt?.toDate?.() || undefined,
        subscriptionMonthlyUsage: data.subscription?.monthlyUsage,
        postsToday: typeof data.subscription?.postsToday === 'number' ? data.subscription.postsToday : undefined,
        lastPostDate: typeof data.subscription?.lastPostDate === 'string' ? data.subscription.lastPostDate : undefined,
        freeUrgentUsed: data.subscription?.freeUrgentUsed === true,
        freeUrgentMonthReset: typeof data.subscription?.freeUrgentMonthReset === 'string' ? data.subscription.freeUrgentMonthReset : undefined,
        legalConsent: mapLegalConsent(data.legalConsent),
        photoURL: data.photoURL,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.(),
        lastLoginAt: data.lastLoginAt?.toDate?.(),
      } as AdminUser;
    });

    return {
      items,
      lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      hasMore: snapshot.docs.length === limitCount,
    };
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      return { items: [], lastDoc: null, hasMore: false };
    }
    console.warn('Error getting users page:', error);
    return { items: [], lastDoc: null, hasMore: false };
  }
}

export async function searchUsers(searchTerm: string): Promise<AdminUser[]> {
  try {
    // Firestore doesn't support full-text search, so we get all and filter
    const allUsers = await getAllUsers(200);
    const term = searchTerm.toLowerCase();
    
    return allUsers.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.displayName.toLowerCase().includes(term) ||
        user.username?.toLowerCase().includes(term) ||
        user.phone?.includes(term)
    );
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

export async function updateUserStatus(
  userId: string,
  isActive: boolean
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
    await logAdminAudit('update_user_status', 'user', {
      userId,
      isActive,
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw new Error('ไม่สามารถอัพเดทสถานะผู้ใช้ได้');
  }
}

function normalizeAdminTags(tags?: UserAdminTag[]): UserAdminTag[] {
  if (!Array.isArray(tags)) return [];
  const allowed = new Set<UserAdminTag>(['RN', 'PN', 'NA', 'ANES', 'CLINIC', 'AGENCY']);
  return [...new Set(tags.filter((tag): tag is UserAdminTag => allowed.has(tag)))];
}

export async function updateUserModeration(
  userId: string,
  updates: {
    adminTags?: UserAdminTag[];
    adminWarningTag?: string | null;
    postingSuspended?: boolean;
    postingSuspendedReason?: string | null;
  }
): Promise<void> {
  try {
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (updates.adminTags !== undefined) {
      payload.adminTags = normalizeAdminTags(updates.adminTags);
    }

    if (updates.adminWarningTag !== undefined) {
      const value = String(updates.adminWarningTag || '').trim();
      payload.adminWarningTag = value || null;
    }

    if (updates.postingSuspended !== undefined) {
      payload.postingSuspended = updates.postingSuspended;
    }

    if (updates.postingSuspendedReason !== undefined) {
      const value = String(updates.postingSuspendedReason || '').trim();
      payload.postingSuspendedReason = value || null;
    }

    await withPermissionRetry(() => updateDoc(doc(db, 'users', userId), payload), 1);
    await logAdminAudit('update_user_moderation', 'user', {
      userId,
      updates: {
        ...updates,
        adminTags: updates.adminTags !== undefined ? normalizeAdminTags(updates.adminTags) : undefined,
      },
    });
  } catch (error) {
    console.error('Error updating user moderation:', error);
    throw new Error('ไม่สามารถบันทึกแท็กหรือสถานะเตือนได้');
  }
}

export async function closeActivePostsByUser(userId: string): Promise<number> {
  try {
    const postsQuery = query(
      collection(db, 'shifts'),
      where('posterId', '==', userId),
      where('status', 'in', ['active', 'urgent']),
    );
    const snapshot = await getDocs(postsQuery);
    const activeDocs = snapshot.docs;

    await Promise.all(activeDocs.map((item) => updateDoc(item.ref, {
      status: 'closed',
      updatedAt: serverTimestamp(),
    })));

    return activeDocs.length;
  } catch (error) {
    console.error('Error closing active posts:', error);
    throw new Error('ไม่สามารถปิดโพสต์ของผู้ใช้นี้ได้');
  }
}

export async function closePostsAndSuspendUserPosting(userId: string, reason?: string | null): Promise<number> {
  const closedCount = await closeActivePostsByUser(userId);
  await updateUserModeration(userId, {
    postingSuspended: true,
    postingSuspendedReason: reason || null,
  });
  return closedCount;
}

export async function verifyUser(userId: string, isVerified: boolean): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    // ถ้า verify เป็น true = เปลี่ยน role เป็น 'nurse' (พยาบาล)
    // ถ้า verify เป็น false = เปลี่ยน role เป็น 'user' (ผู้ใช้ทั่วไป)
    const updateData: any = {
      isVerified,
      role: isVerified ? 'nurse' : 'user',
      updatedAt: serverTimestamp(),
    };
    
    await withPermissionRetry(() => updateDoc(userRef, updateData), 1);
    await logAdminAudit('verify_user', 'user', {
      userId,
      isVerified,
      role: updateData.role,
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      await callAdminMutation('adminVerifyUser', { userId, isVerified });
      await logAdminAudit('verify_user', 'user', {
        userId,
        isVerified,
        role: isVerified ? 'nurse' : 'user',
        via: 'function',
      });
      return;
    }
    console.error('Error verifying user:', error);
    throw new Error('ไม่สามารถยืนยันผู้ใช้ได้');
  }
}

export async function updateUserRole(
  userId: string,
  role: 'user' | 'nurse' | 'hospital' | 'admin'
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await withPermissionRetry(() => updateDoc(userRef, {
      role,
      isAdmin: role === 'admin',
      updatedAt: serverTimestamp(),
    }), 1);
    await logAdminAudit('update_user_role', 'user', {
      userId,
      role,
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      await callAdminMutation('adminUpdateUserRole', { userId, role });
      await logAdminAudit('update_user_role', 'user', {
        userId,
        role,
        via: 'function',
      });
      return;
    }
    console.error('Error updating user role:', error);
    throw new Error(`ไม่สามารถเปลี่ยนประเภทบัญชีได้ (${error?.code || 'unknown'})`);
  }
}

export async function updateUserAccessRights(
  userId: string,
  updates: AdminUserAccessUpdate,
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await withPermissionRetry(() => getDoc(userRef), 1);
    if (!userSnap.exists()) {
      throw new Error('ไม่พบบัญชีผู้ใช้');
    }

    const data = userSnap.data() || {};
    const currentSubscription = (data.subscription || { plan: 'free' }) as Subscription;
    const nextSubscription: Subscription = {
      ...currentSubscription,
      ...(updates.plan !== undefined ? { plan: updates.plan } : {}),
      ...(updates.billingCycle !== undefined ? { billingCycle: updates.billingCycle || undefined } : {}),
      ...(updates.expiresAt !== undefined ? { expiresAt: updates.expiresAt || undefined } : {}),
      ...(updates.postsToday !== undefined ? { postsToday: Math.max(0, Math.floor(updates.postsToday)) } : {}),
      ...(updates.lastPostDate !== undefined ? { lastPostDate: updates.lastPostDate || undefined } : {}),
      ...(updates.freeUrgentUsed !== undefined ? { freeUrgentUsed: updates.freeUrgentUsed } : {}),
      ...(updates.freeUrgentMonthReset !== undefined ? { freeUrgentMonthReset: updates.freeUrgentMonthReset || undefined } : {}),
      monthlyUsage: sanitizeMonthlyUsage(updates.monthlyUsage, currentSubscription.monthlyUsage),
    };
    const persistedSubscription = sanitizeSubscriptionForFirestore(nextSubscription);

    await withPermissionRetry(() => updateDoc(userRef, {
      subscription: persistedSubscription,
      updatedAt: serverTimestamp(),
    }), 1);
    await logAdminAudit('update_user_access_rights', 'user', {
      userId,
      updates: {
        ...updates,
        expiresAt: updates.expiresAt instanceof Date ? updates.expiresAt.toISOString() : updates.expiresAt ?? null,
      },
      nextSubscription: {
        plan: nextSubscription.plan,
        billingCycle: nextSubscription.billingCycle || null,
        expiresAt: nextSubscription.expiresAt instanceof Date ? nextSubscription.expiresAt.toISOString() : nextSubscription.expiresAt ?? null,
        monthlyUsage: nextSubscription.monthlyUsage || null,
        postsToday: nextSubscription.postsToday || 0,
        lastPostDate: nextSubscription.lastPostDate || null,
        freeUrgentUsed: nextSubscription.freeUrgentUsed === true,
        freeUrgentMonthReset: nextSubscription.freeUrgentMonthReset || null,
      },
    });
  } catch (error: any) {
    console.error('Error updating user access rights:', error);
    throw new Error(error?.message || 'ไม่สามารถอัปเดตสิทธิ์การใช้งานได้');
  }
}

export async function resetUserAccessUsage(userId: string): Promise<void> {
  await updateUserAccessRights(userId, {
    monthlyUsage: {
      post_create: 0,
      job_application: 0,
      chat_start: 0,
      urgent_post: 0,
      extend_post: 0,
      boost_post: 0,
    },
    postsToday: 0,
    lastPostDate: null,
    freeUrgentUsed: false,
    freeUrgentMonthReset: null,
  });
  await logAdminAudit('reset_user_access_usage', 'user', {
    userId,
  });
}

export async function bulkResetAccessUsageByRole(
  role: 'user' | 'nurse' | 'hospital' | 'admin',
): Promise<AdminBulkRoleResetResult> {
  try {
    const snapshot = await withPermissionRetry(
      () => getDocs(query(collection(db, 'users'), where('role', '==', role))),
      1,
    );

    const chunks = chunkArray(snapshot.docs, 400);
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        const data = item.data() || {};
        const currentSubscription = (data.subscription || { plan: 'free' }) as Subscription;
        const nextSubscription: Subscription = {
          ...currentSubscription,
          monthlyUsage: sanitizeMonthlyUsage({
            post_create: 0,
            job_application: 0,
            chat_start: 0,
            urgent_post: 0,
            extend_post: 0,
            boost_post: 0,
          }, currentSubscription.monthlyUsage),
          postsToday: 0,
          lastPostDate: undefined,
          freeUrgentUsed: false,
          freeUrgentMonthReset: undefined,
        };

        batch.update(item.ref, {
          subscription: sanitizeSubscriptionForFirestore(nextSubscription),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    await logAdminAudit('bulk_reset_access_usage_by_role', 'role', {
      role,
      updatedCount: snapshot.size,
    });

    return {
      role,
      updatedCount: snapshot.size,
    };
  } catch (error: any) {
    console.error('Error bulk resetting access usage:', error);
    throw new Error(error?.message || 'ไม่สามารถรีเซ็ตสิทธิ์ตาม role ได้');
  }
}

export async function sendBroadcastNotification(
  payload: AdminBroadcastPayload
): Promise<AdminBroadcastResult> {
  try {
    return await callAdminMutation<AdminBroadcastResult>('sendBroadcastNotification', payload);
  } catch (error: any) {
    console.error('Error sending broadcast notification:', error);
    throw new Error(error?.message || 'ไม่สามารถส่ง Broadcast Notification ได้');
  }
}

export async function previewBroadcastAudience(
  payload: Omit<AdminBroadcastPayload, 'title' | 'body' | 'type'>
): Promise<AdminBroadcastPreviewResult> {
  try {
    return await callAdminMutation<AdminBroadcastPreviewResult>('previewBroadcastAudience', payload);
  } catch (error: any) {
    console.error('Error previewing broadcast audience:', error);
    throw new Error(error?.message || 'ไม่สามารถ preview กลุ่มเป้าหมายได้');
  }
}

export async function recordBroadcastOpen(payload: {
  broadcastId: string;
  variantId?: string;
  targetScreen?: string;
}): Promise<void> {
  try {
    await callAdminMutation('recordBroadcastOpen', payload);
  } catch (error: any) {
    console.error('Error recording broadcast open:', error);
  }
}

export async function getBroadcastAnalytics(broadcastId: string): Promise<BroadcastAnalyticsSummary | null> {
  try {
    const result = await callAdminMutation<{ ok: boolean; analytics: BroadcastAnalyticsSummary }>('getBroadcastAnalytics', { broadcastId });
    return result.analytics || null;
  } catch (error: any) {
    console.error('Error getting broadcast analytics:', error);
    return null;
  }
}

export async function saveBroadcastTemplate(payload: {
  templateId?: string;
  name: string;
  title: string;
  body: string;
  type: 'system' | 'promotion';
  targetScreen?: string;
}): Promise<string> {
  try {
    const result = await callAdminMutation<{ ok: boolean; templateId: string }>('saveBroadcastTemplate', payload);
    return result.templateId;
  } catch (error: any) {
    console.error('Error saving broadcast template:', error);
    throw new Error(error?.message || 'ไม่สามารถบันทึก Template ได้');
  }
}

export async function listBroadcastTemplates(): Promise<BroadcastTemplateItem[]> {
  try {
    const result = await callAdminMutation<{ ok: boolean; templates: any[] }>('listBroadcastTemplates', {});
    return (result.templates || []).map((item) => ({
      id: item.id,
      name: item.name || '',
      title: item.title || '',
      body: item.body || '',
      type: item.type === 'promotion' ? 'promotion' : 'system',
      targetScreen: item.targetScreen || null,
      updatedAt: item.updatedAt?.toDate?.() || undefined,
    }));
  } catch (error: any) {
    console.warn('[listBroadcastTemplates] not available yet:', error?.code || error?.message);
    return [];
  }
}

export async function archiveBroadcastTemplate(templateId: string): Promise<void> {
  try {
    await callAdminMutation('archiveBroadcastTemplate', { templateId });
  } catch (error: any) {
    console.error('Error archiving broadcast template:', error);
    throw new Error(error?.message || 'ไม่สามารถ archive template ได้');
  }
}

export async function scheduleBroadcastCampaign(payload: AdminBroadcastPayload & { scheduledAt: string }): Promise<string> {
  try {
    const result = await callAdminMutation<{ ok: boolean; campaignId: string }>('scheduleBroadcastCampaign', payload);
    return result.campaignId;
  } catch (error: any) {
    console.error('Error scheduling broadcast campaign:', error);
    throw new Error(error?.message || 'ไม่สามารถตั้งเวลาแคมเปญได้');
  }
}

export async function listScheduledBroadcastCampaigns(): Promise<ScheduledBroadcastCampaign[]> {
  try {
    const result = await callAdminMutation<{ ok: boolean; campaigns: any[] }>('listScheduledBroadcastCampaigns', {});
    return (result.campaigns || []).map((item) => ({
      id: item.id,
      title: item.title || '',
      body: item.body || '',
      type: item.type === 'promotion' ? 'promotion' : 'system',
      targetRole: item.targetRole || 'all',
      targetProvinces: Array.isArray(item.targetProvinces) ? item.targetProvinces : [],
      targetStaffTypes: Array.isArray(item.targetStaffTypes) ? item.targetStaffTypes : [],
      activeWithinDays: Number(item.activeWithinDays || 0),
      neverPosted: item.neverPosted === true,
      onlyVerified: item.onlyVerified === true,
      activeOnly: item.activeOnly !== false,
      targetScreen: item.targetScreen || null,
      campaignName: item.campaignName || null,
      status: item.status || 'scheduled',
      scheduledAt: item.scheduledAt?.toDate?.() || undefined,
      processedAt: item.processedAt?.toDate?.() || undefined,
    }));
  } catch (error: any) {
    console.warn('[listScheduledBroadcastCampaigns] not available yet:', error?.code || error?.message);
    return [];
  }
}

export async function deleteScheduledBroadcastCampaign(campaignId: string): Promise<void> {
  try {
    await callAdminMutation('deleteScheduledBroadcastCampaign', { campaignId });
  } catch (error: any) {
    console.error('Error deleting scheduled campaign:', error);
    throw new Error(error?.message || 'ไม่สามารถลบ scheduled campaign ได้');
  }
}

export async function runCommunicationAutomation(ruleKey: string): Promise<{ ruleKey: string; affectedCount: number }> {
  try {
    const result = await callAdminMutation<{ ok: boolean; result: { ruleKey: string; affectedCount: number } }>('runCommunicationAutomation', { ruleKey });
    return result.result;
  } catch (error: any) {
    console.error('Error running communication automation:', error);
    throw new Error(error?.message || 'ไม่สามารถรัน automation ได้');
  }
}

export async function runOperationalAction(actionKey: string): Promise<{ actionKey: string; affectedCount: number }> {
  try {
    const result = await callAdminMutation<{ ok: boolean; result: { actionKey: string; affectedCount: number } }>('runOperationalAction', { actionKey });
    return result.result;
  } catch (error: any) {
    console.error('Error running operational action:', error);
    throw new Error(error?.message || 'ไม่สามารถรัน action ได้');
  }
}

export async function getFraudAlertCenter(): Promise<FraudAlertCenterResult | null> {
  try {
    const result = await callAdminMutation<FraudAlertCenterResult>('getFraudAlertCenter', {});
    return {
      ...result,
      flags: (result.flags || []).map((item) => ({
        ...item,
        createdAt: (item as any).createdAt?.toDate?.() || undefined,
      })),
    };
  } catch (error: any) {
    console.warn('[getFraudAlertCenter] not available yet:', error?.code || error?.message);
    return null;
  }
}

export async function updateFraudControls(payload: {
  blacklistKeywords: string[];
  transferWarningTitle: string;
  transferWarningBody: string;
}): Promise<void> {
  try {
    await callAdminMutation('updateFraudControls', payload);
  } catch (error: any) {
    console.error('Error updating fraud controls:', error);
    throw new Error(error?.message || 'ไม่สามารถอัปเดต fraud controls ได้');
  }
}

export async function updateFraudAlertFlagStatus(
  flagId: string,
  status: 'resolved' | 'dismissed'
): Promise<void> {
  try {
    await callAdminMutation('updateFraudAlertFlagStatus', { flagId, status });
  } catch (error: any) {
    console.error('Error updating fraud alert flag status:', error);
    throw new Error(error?.message || 'ไม่สามารถอัปเดตสถานะ fraud flag ได้');
  }
}

export async function getBroadcastHistory(limitCount: number = 50): Promise<AdminBroadcastHistoryItem[]> {
  if (!getAuthUid()) return [];
  try {
    const q = query(collection(db, 'admin_broadcasts'), orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withPermissionRetry(() => getDocs(q), 1);
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        title: data.title || '',
        body: data.body || '',
        type: data.type === 'promotion' ? 'promotion' : 'system',
        targetRole: data.targetRole || 'all',
        targetProvince: data.targetProvince || null,
        targetProvinces: Array.isArray(data.targetProvinces)
          ? data.targetProvinces.filter((item: unknown): item is string => typeof item === 'string')
          : (data.targetProvince ? [data.targetProvince] : []),
        targetStaffTypes: Array.isArray(data.targetStaffTypes)
          ? data.targetStaffTypes.filter((item: unknown): item is string => typeof item === 'string')
          : [],
        activeWithinDays: typeof data.activeWithinDays === 'number' ? data.activeWithinDays : 0,
        neverPosted: data.neverPosted === true,
        campaignName: data.campaignName || undefined,
        targetScreen: data.targetScreen || null,
        templateKey: data.templateKey || null,
        openCount: typeof data.openCount === 'number' ? data.openCount : 0,
        destinationOpenCounts: data.destinationOpenCounts || {},
        variantStats: data.variantStats || {},
        audienceBreakdown: data.audienceBreakdown || undefined,
        onlyVerified: data.onlyVerified === true,
        activeOnly: data.activeOnly !== false,
        sentCount: typeof data.sentCount === 'number' ? data.sentCount : 0,
        inAppCount: typeof data.inAppCount === 'number' ? data.inAppCount : 0,
        pushSentCount: typeof data.pushSentCount === 'number' ? data.pushSentCount : 0,
        pushFailedCount: typeof data.pushFailedCount === 'number' ? data.pushFailedCount : 0,
        createdBy: data.createdBy || undefined,
        createdAt: data.createdAt?.toDate?.() || undefined,
      } as AdminBroadcastHistoryItem;
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      return [];
    }
    console.warn('Error getting broadcast history:', error);
    return [];
  }
}

export async function deleteUser(userId: string): Promise<void> {
  try {
    await callAdminMutation('adminDeleteUser', { userId });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new Error(error?.message || 'ไม่สามารถลบผู้ใช้ได้');
  }
}

export async function getUserById(userId: string): Promise<AdminUser | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snapshot = await getDoc(userRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      uid: data.uid || snapshot.id,
      email: data.email || '',
      username: data.username,
      displayName: data.displayName || 'ไม่ระบุชื่อ',
      phone: data.phone,
      role: data.role || 'nurse',
      isAdmin: data.isAdmin || false,
      isActive: data.isActive !== false,
      isVerified: data.isVerified || false,
      licenseNumber: data.licenseNumber,
      orgType: data.orgType,
      staffType: data.staffType,
      adminTags: Array.isArray(data.adminTags) ? data.adminTags : [],
      adminWarningTag: typeof data.adminWarningTag === 'string' ? data.adminWarningTag : undefined,
      postingSuspended: data.postingSuspended === true,
      postingSuspendedReason: typeof data.postingSuspendedReason === 'string' ? data.postingSuspendedReason : undefined,
      legalConsent: mapLegalConsent(data.legalConsent),
      photoURL: data.photoURL,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.(),
      lastLoginAt: data.lastLoginAt?.toDate?.(),
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// ============================================
// Job Management
// ============================================
export async function getAllJobs(limitCount: number = 50): Promise<AdminJob[]> {
  try {
    const jobsRef = collection(db, 'shifts');
    const q = query(jobsRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const loc = data.location || {};

      // Parse shiftDate safely (ternary precedence bug fix)
      let shiftDate: Date | undefined;
      if (data.shiftDate?.toDate) {
        shiftDate = data.shiftDate.toDate();
      } else if (Array.isArray(data.shiftDates) && data.shiftDates.length > 0) {
        try { shiftDate = new Date(data.shiftDates[0]); } catch (_) { /* skip */ }
      }

      return {
        id: docSnap.id,
        title: data.title || 'ไม่ระบุชื่อ',
        posterName: data.posterName || 'ไม่ระบุ',
        posterId: data.posterId || '',
        status: data.status || 'active',
        department: data.department || '',
        staffType: data.staffType,
        shiftRate: data.shiftRate || 0,
        province: data.province || loc.province || '',
        hospital: data.hospital || loc.hospital || '',
        shiftDate,
        shiftTime: data.shiftTime || (data.startTime && data.endTime ? `${data.startTime}-${data.endTime}` : ''),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        contactsCount: data.contactsCount || 0,
        applicantsCount: data.applicantsCount || 0,
        viewsCount: data.viewsCount || 0,
      };
    });
  } catch (error) {
    console.error('Error getting jobs:', error);
    return [];
  }
}

export async function getJobsPage(options?: {
  limitCount?: number;
  status?: 'active' | 'urgent' | 'closed' | 'all';
  province?: string | 'all';
  cursor?: QueryDocumentSnapshot | null;
}): Promise<AdminPageResult<AdminJob>> {
  try {
    const jobsRef = collection(db, 'shifts');
    const constraints: any[] = [];
    if (options?.status && options.status !== 'all') {
      constraints.push(where('status', '==', options.status));
    }
    if (options?.province && options.province !== 'all') {
      constraints.push(where('province', '==', options.province));
    }
    constraints.push(orderBy('createdAt', 'desc'));
    if (options?.cursor) {
      constraints.push(startAfter(options.cursor));
    }
    const pageSize = options?.limitCount || 30;
    constraints.push(limit(pageSize));
    const snapshot = await getDocs(query(jobsRef, ...constraints));

    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const loc = data.location || {};
      let shiftDate: Date | undefined;
      if (data.shiftDate?.toDate) {
        shiftDate = data.shiftDate.toDate();
      } else if (Array.isArray(data.shiftDates) && data.shiftDates.length > 0) {
        try { shiftDate = new Date(data.shiftDates[0]); } catch {}
      }

      return {
        id: docSnap.id,
        title: data.title || 'ไม่ระบุชื่อ',
        posterName: data.posterName || 'ไม่ระบุ',
        posterId: data.posterId || '',
        status: data.status || 'active',
        department: data.department || '',
        staffType: data.staffType,
        shiftRate: data.shiftRate || 0,
        province: data.province || loc.province || '',
        hospital: data.hospital || loc.hospital || '',
        shiftDate,
        shiftTime: data.shiftTime || (data.startTime && data.endTime ? `${data.startTime}-${data.endTime}` : ''),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        contactsCount: data.contactsCount || 0,
        applicantsCount: data.applicantsCount || 0,
        viewsCount: data.viewsCount || 0,
      } as AdminJob;
    });

    return {
      items,
      lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    console.error('Error getting jobs page:', error);
    return { items: [], lastDoc: null, hasMore: false };
  }
}

export async function updateJobStatus(
  jobId: string,
  status: 'active' | 'closed' | 'urgent'
): Promise<void> {
  try {
    const jobRef = doc(db, 'shifts', jobId);
    await updateDoc(jobRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    throw new Error('ไม่สามารถอัพเดทสถานะงานได้');
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  try {
    const jobRef = doc(db, 'shifts', jobId);
    await deleteDoc(jobRef);
  } catch (error) {
    console.error('Error deleting job:', error);
    throw new Error('ไม่สามารถลบงานได้');
  }
}

// ============================================
// Conversation Management (View All Chats)
// ============================================
export async function getAllConversations(
  limitCount: number = 50
): Promise<AdminConversation[]> {
  if (!getAuthUid()) return [];
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      orderBy('lastMessageAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        participants: data.participants || [],
        participantDetails: data.participantDetails || [],
        jobTitle: data.jobTitle,
        lastMessage: data.lastMessage || '',
        lastMessageAt: data.lastMessageAt?.toDate?.() || new Date(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getAllConversations] permission-denied — admin session not ready');
      return [];
    }
    console.warn('Error getting conversations:', error);
    return [];
  }
}

export async function getConversationsPage(options?: {
  limitCount?: number;
  cursor?: QueryDocumentSnapshot | null;
}): Promise<AdminPageResult<AdminConversation>> {
  if (!getAuthUid()) return { items: [], lastDoc: null, hasMore: false };
  try {
    const conversationsRef = collection(db, 'conversations');
    const pageSize = options?.limitCount || 30;
    const constraints: any[] = [orderBy('lastMessageAt', 'desc')];
    if (options?.cursor) {
      constraints.push(startAfter(options.cursor));
    }
    constraints.push(limit(pageSize));
    const snapshot = await getDocs(query(conversationsRef, ...constraints));

    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        participants: data.participants || [],
        participantDetails: data.participantDetails || [],
        jobTitle: data.jobTitle,
        lastMessage: data.lastMessage || '',
        lastMessageAt: data.lastMessageAt?.toDate?.() || new Date(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      } as AdminConversation;
    });

    return {
      items,
      lastDoc: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      return { items: [], lastDoc: null, hasMore: false };
    }
    console.warn('Error getting conversations page:', error);
    return { items: [], lastDoc: null, hasMore: false };
  }
}

export async function getConversationMessages(
  conversationId: string,
  limitCount: number = 100
): Promise<any[]> {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    }).reverse();
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    // Delete all messages first
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const deletePromises = messagesSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Delete conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    await deleteDoc(conversationRef);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw new Error('ไม่สามารถลบการสนทนาได้');
  }
}
