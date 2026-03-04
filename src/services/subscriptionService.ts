// ============================================
// SUBSCRIPTION SERVICE - Business Model
// ============================================

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Subscription, SubscriptionPlan, SUBSCRIPTION_PLANS, PRICING, BillingCycle } from '../types';
import { grantReferralReward } from './referralService';

const USERS_COLLECTION = 'users';
const JOBS_COLLECTION = 'jobs';

// ============================================
// GET USER SUBSCRIPTION
// ============================================
export async function getUserSubscription(userId: string): Promise<Subscription> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
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
            return { plan: 'free' };
          }
        }
        return subscription;
      }
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
// UPGRADE TO PREMIUM (legacy → nurse_pro)
// ============================================
export async function upgradeToPremium(userId: string): Promise<boolean> {
  return upgradePlan(userId, 'nurse_pro', 'monthly');
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
    const subscription = (await getUserSubscription(userId)) || { plan: 'free' as const };
    const planKey = subscription.plan;
    const planDef = (SUBSCRIPTION_PLANS as any)[planKey] || SUBSCRIPTION_PLANS.free;

    // Paid plans with unlimited posts
    if (planDef.maxPostsPerDay === null && !planDef.maxPostsPerMonth) {
      return { canPost: true, postsRemaining: null };
    }

    // Monthly limit (hospital_starter)
    if (planDef.maxPostsPerMonth) {
      // check monthly count from Firestore separately if needed — for now allow
      return { canPost: true, postsRemaining: planDef.maxPostsPerMonth };
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
    const subscription = await getUserSubscription(userId);
    
    // Unlimited plans don't need daily tracking
    if (subscription.plan !== 'free') return;

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
    premium:              { label: '👑 Premium',        color: '#FFD700' }, // legacy
  };

  const meta = planMeta[plan] || planMeta.free;
  const isPaid = plan !== 'free';

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
    const subscription = await getUserSubscription(userId);
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
    const subscription = await getUserSubscription(userId);
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
    subscription: PRICING.subscription,     // 89 THB/month
    extendPost: PRICING.extendPost,         // 19 THB per day
    extraPost: PRICING.extraPost,           // 19 THB per extra post
    urgentPost: PRICING.urgentPost,         // 49 THB to make urgent
  };
}
