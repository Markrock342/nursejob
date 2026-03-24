// ============================================
// SUBSCRIPTION SERVICE - Business Model
// ============================================

import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  collection,
  getCountFromServer,
  query,
  where,
  getDocs,
  onSnapshot,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Subscription, SubscriptionPlan, SUBSCRIPTION_PLANS, PRICING, BillingCycle, SubscriptionUsageFeature } from '../types';
import { applyEarlyAccessToSubscription, getCommerceAccessStatus } from './commerceService';
import { grantReferralReward } from './referralService';

const USERS_COLLECTION = 'users';
const JOBS_COLLECTION = 'shifts';
const APP_CONFIG_COLLECTION = 'app_config';
const LAUNCH_USAGE_LIMITS_CONFIG_ID = 'launch_usage_limits';

export type LaunchUsageRole = 'user' | 'nurse' | 'hospital' | 'admin';

export interface LaunchUsageLimitsConfig {
  roles: Record<LaunchUsageRole, Partial<Record<SubscriptionUsageFeature, number>>>;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

export const DEFAULT_LAUNCH_USAGE_LIMITS: Record<LaunchUsageRole, Partial<Record<SubscriptionUsageFeature, number>>> = {
  user: {
    post_create: 2,
    job_application: 5,
    chat_start: 5,
    urgent_post: 1,
    extend_post: 1,
    boost_post: 1,
  },
  nurse: {
    post_create: 5,
    job_application: 20,
    chat_start: 20,
    urgent_post: 2,
    extend_post: 2,
    boost_post: 2,
  },
  hospital: {
    post_create: 10,
    job_application: 0,
    chat_start: 40,
    urgent_post: 5,
    extend_post: 10,
    boost_post: 10,
  },
  admin: {
    post_create: 10,
    job_application: 0,
    chat_start: 40,
    urgent_post: 5,
    extend_post: 10,
    boost_post: 10,
  },
};

const LAUNCH_USAGE_FEATURES: SubscriptionUsageFeature[] = [
  'post_create',
  'job_application',
  'chat_start',
  'urgent_post',
  'extend_post',
  'boost_post',
];

let launchUsageLimitsCache: LaunchUsageLimitsConfig = {
  roles: {
    user: { ...DEFAULT_LAUNCH_USAGE_LIMITS.user },
    nurse: { ...DEFAULT_LAUNCH_USAGE_LIMITS.nurse },
    hospital: { ...DEFAULT_LAUNCH_USAGE_LIMITS.hospital },
    admin: { ...DEFAULT_LAUNCH_USAGE_LIMITS.admin },
  },
  updatedAt: null,
  updatedBy: null,
};
let launchUsageLimitsLoadPromise: Promise<LaunchUsageLimitsConfig> | null = null;
let launchUsageLimitsRuntimeUnsubscribe: Unsubscribe | null = null;

const LAUNCH_USAGE_LABELS: Record<SubscriptionUsageFeature, { label: string; description: string }> = {
  post_create: {
    label: 'ลงประกาศงาน',
    description: 'ใช้สำหรับโพสต์ประกาศใหม่',
  },
  job_application: {
    label: 'สมัครงานหรือแสดงความสนใจ',
    description: 'ใช้เมื่อกดสมัครหรือแสดงความสนใจกับประกาศ',
  },
  chat_start: {
    label: 'เริ่มแชตใหม่',
    description: 'ใช้ตอนเปิดห้องแชตใหม่ครั้งแรก',
  },
  urgent_post: {
    label: 'ติดป้ายด่วน',
    description: 'ช่วยให้ประกาศเด่นขึ้น',
  },
  extend_post: {
    label: 'ต่ออายุประกาศ',
    description: 'เพิ่มเวลาให้ประกาศแสดงต่อได้',
  },
  boost_post: {
    label: 'ดันโพสต์ขึ้นบน',
    description: 'พาประกาศกลับไปอยู่ลำดับบน ๆ อีกครั้ง',
  },
};

const LAUNCH_USAGE_ORDER: Record<string, SubscriptionUsageFeature[]> = {
  user: ['post_create', 'job_application', 'chat_start', 'urgent_post', 'extend_post', 'boost_post'],
  nurse: ['post_create', 'job_application', 'chat_start', 'urgent_post', 'extend_post', 'boost_post'],
  hospital: ['post_create', 'chat_start', 'urgent_post', 'extend_post', 'boost_post'],
  admin: ['post_create', 'chat_start', 'urgent_post', 'extend_post', 'boost_post'],
};

export interface LaunchQuotaDisplayItem {
  feature: SubscriptionUsageFeature;
  label: string;
  description: string;
  limit: number;
  used: number;
  remaining: number;
  statusText: string;
}

export interface LaunchQuotaSummary {
  title: string;
  subtitle: string;
  footnote: string;
  items: LaunchQuotaDisplayItem[];
}

function getMonthlyPeriodKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getLaunchUsageLimitsDocRef() {
  return doc(db, APP_CONFIG_COLLECTION, LAUNCH_USAGE_LIMITS_CONFIG_ID);
}

function resolveLaunchUsageRole(role: string | null | undefined): LaunchUsageRole {
  if (role === 'nurse' || role === 'hospital' || role === 'admin') {
    return role;
  }
  return 'user';
}

function cloneLaunchUsageRoleLimits(
  role: LaunchUsageRole,
  source?: Partial<Record<SubscriptionUsageFeature, number>>,
): Partial<Record<SubscriptionUsageFeature, number>> {
  return {
    ...DEFAULT_LAUNCH_USAGE_LIMITS[role],
    ...(source || {}),
  };
}

function cloneLaunchUsageLimitsConfig(config: LaunchUsageLimitsConfig): LaunchUsageLimitsConfig {
  return {
    roles: {
      user: cloneLaunchUsageRoleLimits('user', config.roles.user),
      nurse: cloneLaunchUsageRoleLimits('nurse', config.roles.nurse),
      hospital: cloneLaunchUsageRoleLimits('hospital', config.roles.hospital),
      admin: cloneLaunchUsageRoleLimits('admin', config.roles.admin),
    },
    updatedAt: config.updatedAt ?? null,
    updatedBy: config.updatedBy ?? null,
  };
}

export function getDefaultLaunchUsageLimitsConfigSnapshot(): LaunchUsageLimitsConfig {
  return cloneLaunchUsageLimitsConfig({
    roles: {
      user: DEFAULT_LAUNCH_USAGE_LIMITS.user,
      nurse: DEFAULT_LAUNCH_USAGE_LIMITS.nurse,
      hospital: DEFAULT_LAUNCH_USAGE_LIMITS.hospital,
      admin: DEFAULT_LAUNCH_USAGE_LIMITS.admin,
    },
    updatedAt: null,
    updatedBy: null,
  });
}

function normalizeLaunchUsageRoleLimits(
  role: LaunchUsageRole,
  rawValue: unknown,
): Partial<Record<SubscriptionUsageFeature, number>> {
  const normalized = cloneLaunchUsageRoleLimits(role);
  if (!rawValue || typeof rawValue !== 'object') {
    return normalized;
  }

  LAUNCH_USAGE_FEATURES.forEach((feature) => {
    const candidate = (rawValue as Partial<Record<SubscriptionUsageFeature, unknown>>)[feature];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      normalized[feature] = Math.max(0, Math.floor(candidate));
    }
  });

  return normalized;
}

function normalizeLaunchUsageLimitsConfig(rawValue: unknown): LaunchUsageLimitsConfig {
  const raw = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, any> : {};
  const rawRoles = raw.roles && typeof raw.roles === 'object' ? raw.roles as Record<string, unknown> : {};
  const updatedAtRaw = raw.updatedAt;

  return {
    roles: {
      user: normalizeLaunchUsageRoleLimits('user', rawRoles.user),
      nurse: normalizeLaunchUsageRoleLimits('nurse', rawRoles.nurse),
      hospital: normalizeLaunchUsageRoleLimits('hospital', rawRoles.hospital),
      admin: normalizeLaunchUsageRoleLimits('admin', rawRoles.admin),
    },
    updatedAt:
      updatedAtRaw instanceof Timestamp
        ? updatedAtRaw.toDate()
        : typeof updatedAtRaw?.toDate === 'function'
          ? updatedAtRaw.toDate()
          : updatedAtRaw instanceof Date
            ? updatedAtRaw
            : null,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  };
}

function setLaunchUsageLimitsCache(config: LaunchUsageLimitsConfig): LaunchUsageLimitsConfig {
  launchUsageLimitsCache = cloneLaunchUsageLimitsConfig(config);
  return launchUsageLimitsCache;
}

function getLaunchFeatureLimitFromConfig(
  config: LaunchUsageLimitsConfig,
  role: string | null | undefined,
  feature: SubscriptionUsageFeature,
): number | null {
  const resolvedRole = resolveLaunchUsageRole(role);
  const roleLimits = config.roles[resolvedRole] || config.roles.user;
  const limit = roleLimits[feature];
  return typeof limit === 'number' ? limit : null;
}

function ensureLaunchUsageLimitsRuntimeSubscription(): void {
  if (launchUsageLimitsRuntimeUnsubscribe) return;

  launchUsageLimitsRuntimeUnsubscribe = onSnapshot(
    getLaunchUsageLimitsDocRef(),
    (snapshot) => {
      const nextConfig = snapshot.exists()
        ? normalizeLaunchUsageLimitsConfig(snapshot.data())
        : getDefaultLaunchUsageLimitsConfigSnapshot();
      setLaunchUsageLimitsCache(nextConfig);
    },
    (error) => {
      console.warn('[subscriptionService] launch quota subscription failed', error);
      launchUsageLimitsRuntimeUnsubscribe = null;
    },
  );
}

export function getCachedLaunchUsageLimitsConfig(): LaunchUsageLimitsConfig {
  ensureLaunchUsageLimitsRuntimeSubscription();
  return cloneLaunchUsageLimitsConfig(launchUsageLimitsCache);
}

export async function getLaunchUsageLimitsConfig(): Promise<LaunchUsageLimitsConfig> {
  ensureLaunchUsageLimitsRuntimeSubscription();

  if (!launchUsageLimitsLoadPromise) {
    launchUsageLimitsLoadPromise = getDoc(getLaunchUsageLimitsDocRef())
      .then((snapshot) => {
        const nextConfig = snapshot.exists()
          ? normalizeLaunchUsageLimitsConfig(snapshot.data())
          : getDefaultLaunchUsageLimitsConfigSnapshot();
        return setLaunchUsageLimitsCache(nextConfig);
      })
      .catch((error) => {
        console.warn('[subscriptionService] failed to load launch quota config', error);
        return getCachedLaunchUsageLimitsConfig();
      })
      .finally(() => {
        launchUsageLimitsLoadPromise = null;
      });
  }

  return launchUsageLimitsLoadPromise;
}

export function subscribeLaunchUsageLimitsConfig(
  onChange: (config: LaunchUsageLimitsConfig) => void,
): Unsubscribe {
  return onSnapshot(
    getLaunchUsageLimitsDocRef(),
    (snapshot) => {
      const nextConfig = snapshot.exists()
        ? normalizeLaunchUsageLimitsConfig(snapshot.data())
        : getDefaultLaunchUsageLimitsConfigSnapshot();
      onChange(setLaunchUsageLimitsCache(nextConfig));
    },
    (error) => {
      console.warn('[subscriptionService] failed to subscribe launch quota config', error);
      onChange(getCachedLaunchUsageLimitsConfig());
    },
  );
}

function getLaunchFeatureLimit(role: string | null | undefined, feature: SubscriptionUsageFeature): number | null {
  return getLaunchFeatureLimitFromConfig(getCachedLaunchUsageLimitsConfig(), role, feature);
}

export function getLaunchUsageLimitForRole(
  role: string | null | undefined,
  feature: SubscriptionUsageFeature,
): number | null {
  return getLaunchFeatureLimit(role, feature);
}

export function getLaunchUsageLimitsForRole(
  role: string | null | undefined,
): Partial<Record<SubscriptionUsageFeature, number>> {
  const resolvedRole = resolveLaunchUsageRole(role);
  return { ...getCachedLaunchUsageLimitsConfig().roles[resolvedRole] };
}

function getCurrentFeatureUsage(subscription: Subscription | undefined, feature: SubscriptionUsageFeature, periodKey: string): number {
  const usage = subscription?.monthlyUsage?.[feature];
  if (!usage || usage.periodKey !== periodKey) return 0;
  return usage.used || 0;
}

function getLaunchQuotaIntro(role: string | null | undefined): Pick<LaunchQuotaSummary, 'title' | 'subtitle' | 'footnote'> {
  switch (role) {
    case 'nurse':
      return {
        title: 'บัญชีนี้ทำอะไรได้บ้าง',
        subtitle: 'คุณใช้งานสมัครงาน คุยต่อ และจัดการประกาศได้ตามโควตารายเดือนของบัญชีพยาบาล',
        footnote: 'แต่ละรายการจะรีเซ็ตใหม่ทุกต้นเดือน',
      };
    case 'hospital':
    case 'admin':
      return {
        title: 'บัญชีนี้ทำอะไรได้บ้าง',
        subtitle: 'คุณลงประกาศ คุยกับผู้สมัคร และใช้บริการเสริมได้ตามโควตารายเดือนของบัญชีองค์กร',
        footnote: 'แต่ละรายการจะรีเซ็ตใหม่ทุกต้นเดือน',
      };
    default:
      return {
        title: 'บัญชีนี้ทำอะไรได้บ้าง',
        subtitle: 'คุณใช้งานฟีเจอร์หลักและบริการเสริมได้ตามโควตารายเดือนของบัญชีนี้',
        footnote: 'แต่ละรายการจะรีเซ็ตใหม่ทุกต้นเดือน',
      };
  }
}

function getLaunchUsageStatusText(used: number, limit: number, remaining: number): string {
  if (used <= 0) {
    return `ยังไม่ได้ใช้เดือนนี้ • ใช้ได้ ${limit} ครั้ง`;
  }
  if (remaining > 0) {
    return `ใช้ไปแล้ว ${used}/${limit} ครั้ง • เหลือ ${remaining} ครั้ง`;
  }
  return `ใช้ครบ ${limit} ครั้งแล้วในเดือนนี้`;
}

async function getRawUserSubscriptionState(userId: string): Promise<{
  role: string | null;
  subscription: Subscription;
  commerceStatus: Awaited<ReturnType<typeof getCommerceAccessStatus>>;
}> {
  const [userDoc, commerceStatus] = await Promise.all([
    getDoc(doc(db, USERS_COLLECTION, userId)),
    getCommerceAccessStatus(),
  ]);

  const data = userDoc.exists() ? userDoc.data() : {};
  return {
    role: (data?.role as string | null | undefined) || null,
    subscription: (data?.subscription as Subscription | undefined) || { plan: 'free' },
    commerceStatus,
  };
}

export async function getFeatureUsageStatus(userId: string, feature: SubscriptionUsageFeature): Promise<{
  canUse: boolean;
  remaining: number | null;
  limit: number | null;
  used: number;
  reason?: string;
}> {
  try {
    const launchUsageLimitsConfig = await getLaunchUsageLimitsConfig();
    const { role, subscription, commerceStatus } = await getRawUserSubscriptionState(userId);
    if (!commerceStatus.freeAccessEnabled) {
      return { canUse: true, remaining: null, limit: null, used: 0 };
    }

    const limit = getLaunchFeatureLimitFromConfig(launchUsageLimitsConfig, role, feature);
    if (limit == null) {
      return { canUse: true, remaining: null, limit: null, used: 0 };
    }

    const periodKey = getMonthlyPeriodKey();
    const used = getCurrentFeatureUsage(subscription, feature, periodKey);
    const remaining = Math.max(limit - used, 0);
    return {
      canUse: remaining > 0,
      remaining,
      limit,
      used,
      reason: remaining > 0 ? undefined : `คุณใช้สิทธิ์ ${limit} ครั้งครบแล้วในเดือนนี้`,
    };
  } catch (error) {
    console.error('Error checking feature usage:', error);
    return { canUse: true, remaining: null, limit: null, used: 0 };
  }
}

export async function getLaunchQuotaSummary(userId: string): Promise<LaunchQuotaSummary | null> {
  try {
    const launchUsageLimitsConfig = await getLaunchUsageLimitsConfig();
    const { role, subscription, commerceStatus } = await getRawUserSubscriptionState(userId);
    if (!commerceStatus.freeAccessEnabled) return null;

    const roleKey = role || 'user';
    const features = LAUNCH_USAGE_ORDER[roleKey] || LAUNCH_USAGE_ORDER.user;
    const periodKey = getMonthlyPeriodKey();
    const items = features
      .map((feature) => {
        const limit = getLaunchFeatureLimitFromConfig(launchUsageLimitsConfig, role, feature);
        if (!limit || limit <= 0) return null;
        const used = getCurrentFeatureUsage(subscription, feature, periodKey);
        const remaining = Math.max(limit - used, 0);
        const meta = LAUNCH_USAGE_LABELS[feature];

        return {
          feature,
          label: meta.label,
          description: meta.description,
          limit,
          used,
          remaining,
          statusText: getLaunchUsageStatusText(used, limit, remaining),
        } as LaunchQuotaDisplayItem;
      })
      .filter((item): item is LaunchQuotaDisplayItem => Boolean(item));

    return {
      ...getLaunchQuotaIntro(role),
      items,
    };
  } catch (error) {
    console.error('Error building launch quota summary:', error);
    return null;
  }
}

export async function consumeFeatureUsage(userId: string, feature: SubscriptionUsageFeature): Promise<void> {
  const launchUsageLimitsConfig = await getLaunchUsageLimitsConfig();
  const { commerceStatus } = await getRawUserSubscriptionState(userId);
  if (!commerceStatus.freeAccessEnabled) return;

  const userRef = doc(db, USERS_COLLECTION, userId);
  await runTransaction(db, async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists()) return;

    const data = userDoc.data() || {};
    const role = (data.role as string | null | undefined) || null;
    const subscription = (data.subscription as Subscription | undefined) || { plan: 'free' };
    const limit = getLaunchFeatureLimitFromConfig(launchUsageLimitsConfig, role, feature);
    if (limit == null) return;

    const periodKey = getMonthlyPeriodKey();
    const currentUsed = getCurrentFeatureUsage(subscription, feature, periodKey);
    const monthlyUsage = {
      ...(subscription.monthlyUsage || {}),
      [feature]: {
        periodKey,
        used: Math.min(currentUsed + 1, limit),
      },
    };

    transaction.update(userRef, {
      subscription: {
        ...subscription,
        monthlyUsage,
      },
      updatedAt: new Date(),
    });
  });
}

async function countUserPostsThisMonth(userId: string): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const q = query(
    collection(db, JOBS_COLLECTION),
    where('posterId', '==', userId),
    where('createdAt', '>=', startOfMonth),
    where('createdAt', '<', startOfNextMonth)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ============================================
// GET USER SUBSCRIPTION
// ============================================
export async function getUserSubscription(userId: string): Promise<Subscription> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    const commerceStatus = await getCommerceAccessStatus();
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      const subscription = data.subscription as Subscription | undefined;
      
      if (subscription) {
        // Check if paid plan has expired
        if (subscription.plan !== 'free' && subscription.expiresAt) {
          let expiresAt: Date;
          const expiresAtRaw: any = subscription.expiresAt;
          if (expiresAtRaw && typeof expiresAtRaw.toDate === 'function') {
            expiresAt = expiresAtRaw.toDate();
          } else if (expiresAtRaw) {
            expiresAt = new Date(expiresAtRaw);
          } else {
            expiresAt = new Date();
          }

          if (expiresAt < new Date()) {
            // Premium expired, revert to free
            await updateUserSubscription(userId, { plan: 'free' });
            return applyEarlyAccessToSubscription({ plan: 'free' }, data.role, commerceStatus);
          }
        }
        return applyEarlyAccessToSubscription(subscription, data.role, commerceStatus);
      }

      return applyEarlyAccessToSubscription({ plan: 'free' }, data.role, commerceStatus);
    }
    
    // Default to free plan
    return { plan: 'free' };
  } catch (error: any) {
    if (error?.code === 'permission-denied') return { plan: 'free' }; // auth not ready yet
    console.error('Error getting subscription:', error);
    return { plan: 'free' };
  }
}

// ============================================
// UPDATE USER SUBSCRIPTION
// ============================================
export async function updateUserSubscription(
  userId: string,
  subscription: Partial<Subscription>
): Promise<void> {
  try {
    // Remove any undefined values from the subscription object to avoid
    // Firestore rejecting the write (updateDoc doesn't accept undefined values).
    const sanitize = (obj: Partial<Subscription>) => {
      const out: any = {};
      for (const key of Object.keys(obj)) {
        if (key === 'isEarlyAccess' || key === 'sourcePlan') continue;
        const v = (obj as any)[key];
        if (v !== undefined) out[key] = v;
      }
      return out;
    };

    const cleanSubscription = sanitize(subscription);

    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      subscription: cleanSubscription,
      updatedAt: new Date(),
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

// ============================================
// UPGRADE TO PREMIUM (legacy helper, now role-aware)
// ============================================
export async function upgradeToPremium(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    const role = userDoc.exists() ? userDoc.data().role : null;
    const targetPlan: SubscriptionPlan = role === 'hospital' || role === 'admin'
      ? 'hospital_pro'
      : role === 'nurse'
        ? 'nurse_pro'
        : 'premium';

    return upgradePlan(userId, targetPlan, 'monthly');
  } catch (error) {
    console.error('Error resolving premium upgrade plan:', error);
    return upgradePlan(userId, 'premium', 'monthly');
  }
}

// ============================================
// UPGRADE TO ANY PLAN
// ============================================
export async function upgradePlan(
  userId: string,
  plan: SubscriptionPlan,
  billingCycle: BillingCycle = 'monthly'
): Promise<boolean> {
  try {
    const startedAt = new Date();
    const expiresAt = new Date();
    // annual = 12 months, monthly = 1 month
    const months = billingCycle === 'annual' ? 12 : 1;
    expiresAt.setMonth(expiresAt.getMonth() + months);

    await updateUserSubscription(userId, {
      plan,
      billingCycle,
      startedAt,
      expiresAt,
      postsToday: 0,
    });

    // Grant referral reward to whoever referred this user
    try { await grantReferralReward(userId); } catch {}

    return true;
  } catch (error) {
    console.error('Error upgrading plan:', error);
    return false;
  }
}

// ============================================
// CHECK IF USER CAN POST TODAY
// ============================================
export async function canUserPostToday(userId: string): Promise<{
  canPost: boolean;
  postsRemaining: number | null;
  reason?: string;
  canPayForExtra?: boolean;
}> {
  try {
    const launchUsage = await getFeatureUsageStatus(userId, 'post_create');
    if (launchUsage.limit != null) {
      return {
        canPost: launchUsage.canUse,
        postsRemaining: launchUsage.remaining,
        reason: launchUsage.canUse ? undefined : `คุณโพสต์ครบ ${launchUsage.limit} ครั้งแล้วในเดือนนี้`,
        canPayForExtra: !launchUsage.canUse,
      };
    }

    const subscription = (await getUserSubscription(userId)) || { plan: 'free' as const };
    const planKey = subscription.plan;
    const planDef = (SUBSCRIPTION_PLANS as any)[planKey] || SUBSCRIPTION_PLANS.free;

    // Paid plans with unlimited posts
    if (planDef.maxPostsPerDay === null && !planDef.maxPostsPerMonth) {
      return { canPost: true, postsRemaining: null };
    }

    // Monthly limit (hospital_starter)
    if (planDef.maxPostsPerMonth) {
      const postsThisMonth = await countUserPostsThisMonth(userId);
      const postsRemaining = Math.max(0, planDef.maxPostsPerMonth - postsThisMonth);
      if (postsRemaining <= 0) {
        return {
          canPost: false,
          postsRemaining: 0,
          reason: `คุณลงประกาศครบ ${planDef.maxPostsPerMonth} ครั้งแล้วในเดือนนี้`,
        };
      }
      return { canPost: true, postsRemaining };
    }

    // Free: daily limit
    const today = new Date().toISOString().split('T')[0];
    if (subscription.lastPostDate !== today) {
      return { canPost: true, postsRemaining: planDef.maxPostsPerDay ?? 2 };
    }
    const postsToday = subscription.postsToday || 0;
    const maxPosts = planDef.maxPostsPerDay ?? 2;
    const postsRemaining = maxPosts - postsToday;
    if (postsRemaining <= 0) {
      return { canPost: false, postsRemaining: 0, reason: `คุณโพสต์ครบ ${maxPosts} ครั้งแล้ววันนี้`, canPayForExtra: true };
    }
    return { canPost: true, postsRemaining };
  } catch (error) {
    console.error('Error checking post limit:', error);
    return { canPost: true, postsRemaining: 2 };
  }
}

// ============================================
// INCREMENT POST COUNT
// ============================================
export async function incrementPostCount(userId: string): Promise<void> {
  try {
    const launchUsage = await getFeatureUsageStatus(userId, 'post_create');
    if (launchUsage.limit != null) {
      await consumeFeatureUsage(userId, 'post_create');
      return;
    }

    const subscription = await getUserSubscription(userId);
    
    // Unlimited plans don't need daily tracking
    if (subscription.plan !== 'free' || subscription.isEarlyAccess) return;

    const today = new Date().toISOString().split('T')[0];
    
    // Reset if new day, otherwise increment
    const newCount = subscription.lastPostDate === today 
      ? (subscription.postsToday || 0) + 1 
      : 1;

    await updateUserSubscription(userId, {
      ...subscription,
      postsToday: newCount,
      lastPostDate: today,
    });
  } catch (error) {
    console.error('Error incrementing post count:', error);
  }
}

// ============================================
// GET POST EXPIRY DATE
// ============================================
export function getPostExpiryDate(plan: SubscriptionPlan | string): Date {
  const planKey = (plan as keyof typeof SUBSCRIPTION_PLANS) || 'free';
  const expiryDays = SUBSCRIPTION_PLANS[planKey]?.postExpiryDays ?? SUBSCRIPTION_PLANS.free.postExpiryDays;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiryDays);
  return expiresAt;
}

// ============================================
// COUNT USER POSTS TODAY
// ============================================
export async function countUserPostsToday(userId: string): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(db, JOBS_COLLECTION),
      where('posterId', '==', userId),
      where('createdAt', '>=', today),
      where('createdAt', '<', tomorrow)
    );

    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error counting posts:', error);
    return 0;
  }
}

export async function getUserCreatedPostCount(userId: string): Promise<number> {
  try {
    const postsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('posterId', '==', userId)
    );
    const snapshot = await getCountFromServer(postsQuery);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error counting all user posts:', error);
    return 0;
  }
}

// ============================================
// GET SUBSCRIPTION STATUS DISPLAY
// ============================================
export function getSubscriptionStatusDisplay(subscription: Subscription): {
  planName: string;
  statusText: string;
  statusColor: string;
  expiresText?: string;
} {
  const plan = subscription?.plan;

  const planMeta: Record<string, { label: string; color: string }> = {
    free:                 { label: '🆓 ฟรี',          color: '#888' },
    nurse_pro:            { label: '👑 Nurse Pro',     color: '#FF8F00' },
    hospital_starter:     { label: '🏥 Starter',       color: '#0288D1' },
    hospital_pro:         { label: '🏥 Professional',  color: '#6A1B9A' },
    hospital_enterprise:  { label: '🏢 Enterprise',    color: '#1B5E20' },
    premium:              { label: '👑 Premium',        color: '#FFD700' },
  };

  const meta = planMeta[plan] || planMeta.free;
  const isPaid = plan !== 'free';

  if (subscription?.isEarlyAccess) {
    return {
      planName: meta.label,
      statusText: 'สิทธิ์ช่วงเปิดตัวแบบมีโควตารายเดือน',
      statusColor: meta.color,
      expiresText: 'ใช้งานฟีเจอร์หลักและบริการเสริมได้ แต่มีเพดานการใช้รายเดือนตามประเภทบัญชี',
    };
  }

  let expiresText: string | undefined;
  const expiresAt = subscription?.expiresAt;
  if (isPaid && expiresAt) {
    const expiresAtRaw: any = expiresAt;
    const expDate =
      expiresAtRaw instanceof Date
        ? expiresAtRaw
        : (typeof expiresAtRaw?.toDate === 'function'
            ? expiresAtRaw.toDate()
            : new Date(expiresAtRaw));
    const daysLeft = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expiresText = daysLeft > 0 ? `เหลืออีก ${daysLeft} วัน` : 'หมดอายุแล้ว';
  }

  return {
    planName: meta.label,
    statusText: isPaid ? 'สมาชิกพรีเมียม' : 'แพ็กเกจฟรี',
    statusColor: meta.color,
    expiresText,
  };
}

// ============================================
// CHECK IF USER CAN USE FREE URGENT
// ============================================
export async function canUseFreeUrgent(userId: string): Promise<boolean> {
  try {
    const launchUsage = await getFeatureUsageStatus(userId, 'urgent_post');
    if (launchUsage.limit != null) return launchUsage.canUse;

    const subscription = await getUserSubscription(userId);
    if (subscription.isEarlyAccess) return true;
    const plan = subscription.plan;
    const planDef = (SUBSCRIPTION_PLANS as any)[plan];
    const urgentQuota: number = planDef?.urgentPerMonth ?? 0;
    if (urgentQuota === 0) return false;

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    // Reset tracking if new month
    if (subscription.freeUrgentMonthReset !== currentMonth) return true;
    return !subscription.freeUrgentUsed;
  } catch {
    return false;
  }
}

// ============================================
// MARK FREE URGENT AS USED
// ============================================
export async function markFreeUrgentUsed(userId: string): Promise<void> {
  try {
    const launchUsage = await getFeatureUsageStatus(userId, 'urgent_post');
    if (launchUsage.limit != null) {
      await consumeFeatureUsage(userId, 'urgent_post');
      return;
    }

    const subscription = await getUserSubscription(userId);
    if (subscription.isEarlyAccess) return;
    await updateUserSubscription(userId, {
      ...subscription,
      freeUrgentUsed: true,
    });
  } catch (error) {
    console.error('Error marking free urgent used:', error);
    throw error;
  }
}

// ============================================
// EXTEND POST EXPIRY (19 THB for 1 day)
// ============================================
export async function extendPostExpiry(postId: string, days: number = 1): Promise<Date> {
  try {
    const postDoc = await getDoc(doc(db, JOBS_COLLECTION, postId));
    
    if (!postDoc.exists()) {
      throw new Error('ไม่พบประกาศนี้');
    }
    
    const data = postDoc.data();
    let currentExpiry: Date;
    const expiresAtRaw = data.expiresAt;
    if (expiresAtRaw && typeof expiresAtRaw.toDate === 'function') {
      currentExpiry = expiresAtRaw.toDate();
    } else if (expiresAtRaw) {
      currentExpiry = new Date(expiresAtRaw);
    } else {
      currentExpiry = new Date();
    }

    // เพิ่มวันหมดอายุ
    const newExpiry = new Date(currentExpiry);
    newExpiry.setDate(newExpiry.getDate() + days);

    await updateDoc(doc(db, JOBS_COLLECTION, postId), {
      expiresAt: newExpiry,
      updatedAt: new Date(),
    });

    return newExpiry;
  } catch (error) {
    console.error('Error extending post:', error);
    throw error;
  }
}

// ============================================
// GET PRICING INFO
// ============================================
export function getPricingInfo() {
  return {
    subscription: PRICING.subscription,
    extendPost: PRICING.extendPost,
    extraPost: PRICING.extraPost,
    urgentPost: PRICING.urgentPost,
  };
}
