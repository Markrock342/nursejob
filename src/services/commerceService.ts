import Constants from 'expo-constants';
import { collection, doc, getCountFromServer, getDoc, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Subscription, SubscriptionPlan } from '../types';

const extra = Constants.expoConfig?.extra || {};

function parsePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseStartDate(value: unknown): Date {
  const parsed = new Date(String(value || '2026-03-09'));
  if (Number.isNaN(parsed.getTime())) {
    return new Date('2026-03-09T00:00:00.000Z');
  }
  return parsed;
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export const COMMERCE_CONFIG = {
  freeAccessStartDate: parseStartDate(
    extra.commerceFreeAccessStartDate || process.env.EXPO_PUBLIC_COMMERCE_FREE_ACCESS_START_DATE || '2026-03-09'
  ),
  freeAccessMonths: parsePositiveNumber(
    extra.commerceFreeAccessMonths || process.env.EXPO_PUBLIC_COMMERCE_FREE_ACCESS_MONTHS || '3',
    3,
  ),
  freeAccessMaxUsers: parsePositiveNumber(
    extra.commerceFreeAccessMaxUsers || process.env.EXPO_PUBLIC_COMMERCE_FREE_ACCESS_MAX_USERS || '1000',
    1000,
  ),
  billingProviderReady: parseBoolean(
    extra.commerceBillingProviderReady ?? process.env.EXPO_PUBLIC_COMMERCE_BILLING_PROVIDER_READY ?? 'false',
    false,
  ),
} as const;

const APP_CONFIG_COLLECTION = 'app_config';
const COMMERCE_CONFIG_DOC = 'commerce';

export type CommerceMonetizationMode = 'auto' | 'enabled' | 'disabled';

export interface CommerceAdminSettings {
  monetizationMode: CommerceMonetizationMode;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

export interface CommerceAccessStatus {
  freeAccessEnabled: boolean;
  monetizationEnabled: boolean;
  totalUsers: number | null;
  freeAccessEndsAt: Date;
  thresholdReason: 'time' | 'users' | null;
  overrideMode: CommerceMonetizationMode;
  thresholdReached: boolean;
  transitionReviewRequired: boolean;
  billingProviderReady: boolean;
  billingActivationBlocked: boolean;
}

export function getEarlyAccessPlanForRole(role?: string | null): SubscriptionPlan {
  if (role === 'hospital' || role === 'admin') return 'hospital_pro';
  if (role === 'nurse') return 'nurse_pro';
  return 'premium';
}

export function applyEarlyAccessToSubscription(
  subscription: Subscription,
  role?: string | null,
  commerceStatus?: CommerceAccessStatus | null,
): Subscription {
  if (!commerceStatus?.freeAccessEnabled) {
    return subscription;
  }

  const effectivePlan = getEarlyAccessPlanForRole(role);
  return {
    ...subscription,
    sourcePlan: subscription.plan,
    plan: effectivePlan,
    billingCycle: subscription.billingCycle || 'monthly',
    isEarlyAccess: true,
  };
}

export function getFreeAccessEndsAt(): Date {
  return addMonths(COMMERCE_CONFIG.freeAccessStartDate, COMMERCE_CONFIG.freeAccessMonths);
}

export function getCommerceEntryTitle(commerceStatus?: CommerceAccessStatus | null): string {
  return commerceStatus?.freeAccessEnabled ? 'สิทธิ์และบริการในบัญชี' : 'สิทธิ์และแพ็กเกจ';
}

export function getCommerceEntrySubtitle(commerceStatus?: CommerceAccessStatus | null): string {
  return commerceStatus?.freeAccessEnabled ? 'ดูฟีเจอร์ที่พร้อมใช้ในบัญชีนี้และบริการที่ระบบเปิดให้แล้ว' : 'ดูแพ็กเกจและบริการเสริมที่ช่วยให้ใช้งานได้คล่องขึ้น';
}

async function getLaunchEligibleUserCount(): Promise<number | null> {
  try {
    const qualifiedUsersQuery = query(
      collection(db, 'users'),
      where('isAdmin', '==', false),
      where('isActive', '==', true),
      where('onboardingCompleted', '==', true),
      where('role', 'in', ['user', 'nurse', 'hospital']),
    );
    const snap = await getCountFromServer(qualifiedUsersQuery);
    return snap.data().count;
  } catch (error) {
    try {
      const activeEligibleUsersQuery = query(
        collection(db, 'users'),
        where('isAdmin', '==', false),
        where('isActive', '==', true),
        where('role', 'in', ['user', 'nurse', 'hospital']),
      );
      const activeEligibleSnap = await getCountFromServer(activeEligibleUsersQuery);
      return activeEligibleSnap.data().count;
    } catch (activeEligibleError) {
      try {
      const eligibleUsersQuery = query(
        collection(db, 'users'),
        where('isAdmin', '==', false),
        where('role', 'in', ['user', 'nurse', 'hospital']),
      );
      const eligibleSnap = await getCountFromServer(eligibleUsersQuery);
      return eligibleSnap.data().count;
      } catch (eligibleError) {
        try {
          const fallbackQuery = query(
            collection(db, 'users'),
            where('isAdmin', '==', false),
          );
          const fallbackSnap = await getCountFromServer(fallbackQuery);
          return fallbackSnap.data().count;
        } catch (fallbackError) {
          console.warn('[commerceService] unable to load launch-eligible user count, using date gate only');
          return null;
        }
      }
    }
  }
}

export async function getCommerceAdminSettings(): Promise<CommerceAdminSettings> {
  try {
    const configDoc = await getDoc(doc(db, APP_CONFIG_COLLECTION, COMMERCE_CONFIG_DOC));
    if (!configDoc.exists()) {
      return { monetizationMode: 'auto' };
    }

    const data = configDoc.data();
    const monetizationMode: CommerceMonetizationMode = ['auto', 'enabled', 'disabled'].includes(data?.monetizationMode)
      ? data.monetizationMode
      : 'auto';

    return {
      monetizationMode,
      updatedAt: typeof data?.updatedAt?.toDate === 'function' ? data.updatedAt.toDate() : null,
      updatedBy: data?.updatedBy || null,
    };
  } catch (error) {
    console.warn('[commerceService] unable to load commerce admin settings, falling back to auto');
    return { monetizationMode: 'auto' };
  }
}

export async function updateCommerceMonetizationMode(
  updatedBy: string,
  monetizationMode: CommerceMonetizationMode,
): Promise<void> {
  await setDoc(
    doc(db, APP_CONFIG_COLLECTION, COMMERCE_CONFIG_DOC),
    {
      monetizationMode,
      updatedBy,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function resolveCommerceAccess(
  now: Date,
  totalUsers: number | null = null,
  overrideMode: CommerceMonetizationMode = 'auto',
): CommerceAccessStatus {
  const freeAccessEndsAt = getFreeAccessEndsAt();
  const reachedTimeLimit = now >= freeAccessEndsAt;
  const reachedUserLimit = totalUsers != null && totalUsers >= COMMERCE_CONFIG.freeAccessMaxUsers;
  const thresholdReached = reachedTimeLimit || reachedUserLimit;
  const transitionReviewRequired = overrideMode === 'auto' && thresholdReached;
  const monetizationRequested = overrideMode === 'enabled';
  const monetizationEnabled = COMMERCE_CONFIG.billingProviderReady && monetizationRequested;

  return {
    freeAccessEnabled: !monetizationEnabled,
    monetizationEnabled,
    totalUsers,
    freeAccessEndsAt,
    thresholdReason: reachedUserLimit ? 'users' : reachedTimeLimit ? 'time' : null,
    overrideMode,
    thresholdReached,
    transitionReviewRequired,
    billingProviderReady: COMMERCE_CONFIG.billingProviderReady,
    billingActivationBlocked: monetizationRequested && !COMMERCE_CONFIG.billingProviderReady,
  };
}

export async function getCommerceAccessStatus(): Promise<CommerceAccessStatus> {
  const adminSettings = await getCommerceAdminSettings();
  const totalUsers = await getLaunchEligibleUserCount();

  return resolveCommerceAccess(new Date(), totalUsers, adminSettings.monetizationMode);
}