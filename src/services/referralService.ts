// ============================================
// REFERRAL SERVICE
// แนะนำเพื่อน → ได้ Pro ฟรี 1 เดือน (ทั้งผู้แนะนำและผู้ถูกแนะนำ)
// ============================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ReferralInfo, ReferralRecord, SubscriptionPlan } from '../types';

const USERS_COL = 'users';
const REFERRALS_COL = 'referrals';

function getReferralRewardPlan(role?: string | null): SubscriptionPlan {
  if (role === 'hospital' || role === 'admin') return 'hospital_pro';
  if (role === 'nurse') return 'nurse_pro';
  return 'premium';
}

// ============================================
// GENERATE REFERRAL CODE
// รูปแบบ: NURSE-XXXXXX (6 chars จาก uid)
// ============================================
export function generateReferralCode(uid: string): string {
  const chars = uid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = chars.slice(0, 6).padEnd(6, '0');
  return `NURSEGO-${suffix}`;
}

// ============================================
// GET OR CREATE REFERRAL INFO FOR A USER
// ============================================
export async function getReferralInfo(uid: string): Promise<ReferralInfo> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COL, uid));
    if (!userDoc.exists()) throw new Error('User not found');

    const data = userDoc.data();

    // ถ้ายังไม่มี referralCode ให้สร้างและบันทึก
    if (!data.referralCode) {
      const code = generateReferralCode(uid);
      await updateDoc(doc(db, USERS_COL, uid), { referralCode: code });

      return {
        referralCode: code,
        referredCount: 0,
        rewardMonthsEarned: 0,
        rewardMonthsUsed: 0,
      };
    }

    // นับจำนวน referrals ที่ได้รับ reward แล้ว
    const q = query(
      collection(db, REFERRALS_COL),
      where('referrerUid', '==', uid),
      where('rewardGranted', '==', true)
    );
    const snap = await getDocs(q);
    const rewardMonthsEarned = snap.size;

    return {
      referralCode: data.referralCode,
      referredCount: data.referredCount || 0,
      rewardMonthsEarned,
      rewardMonthsUsed: data.referralRewardMonthsUsed || 0,
    };
  } catch (error) {
    console.error('[referralService] getReferralInfo error:', error);
    return {
      referralCode: generateReferralCode(uid),
      referredCount: 0,
      rewardMonthsEarned: 0,
      rewardMonthsUsed: 0,
    };
  }
}

// ============================================
// APPLY REFERRAL CODE AT REGISTRATION
// เรียกตอน user ใหม่กรอก referral code
// ============================================
export async function applyReferralCode(
  refereeUid: string,
  refereeEmail: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  try {
    const normalizedCode = code.trim().toUpperCase();

    // หา referrer จาก referralCode
    const q = query(
      collection(db, USERS_COL),
      where('referralCode', '==', normalizedCode)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      return { success: false, message: 'ไม่พบรหัสแนะนำนี้' };
    }

    const referrerDoc = snap.docs[0];
    const referrerUid = referrerDoc.id;

    // ห้ามใช้ code ของตัวเอง
    if (referrerUid === refereeUid) {
      return { success: false, message: 'ไม่สามารถใช้รหัสของตัวเองได้' };
    }

    // ตรวจว่า referee เคยใช้ code แล้วหรือยัง
    const existingQ = query(
      collection(db, REFERRALS_COL),
      where('refereeUid', '==', refereeUid)
    );
    const existingSnap = await getDocs(existingQ);
    if (!existingSnap.empty) {
      return { success: false, message: 'คุณใช้รหัสแนะนำไปแล้ว' };
    }

    // บันทึก referral record
    const referralId = `${referrerUid}_${refereeUid}`;
    await setDoc(doc(db, REFERRALS_COL, referralId), {
      referrerUid,
      refereeUid,
      refereeEmail,
      referralCode: normalizedCode,
      createdAt: serverTimestamp(),
      rewardGranted: false,
    } as Omit<ReferralRecord, 'id'>);

    // บันทึกว่า referee ถูกแนะนำโดยใคร
    await updateDoc(doc(db, USERS_COL, refereeUid), {
      referredBy: referrerUid,
      referredByCode: normalizedCode,
    });

    // increment counter ของ referrer
    await updateDoc(doc(db, USERS_COL, referrerUid), {
      referredCount: increment(1),
    });

    return { success: true, message: 'ใช้รหัสแนะนำสำเร็จ! คุณจะได้รับ Pro ฟรี 1 เดือนเมื่ออัพเกรด' };
  } catch (error) {
    console.error('[referralService] applyReferralCode error:', error);
    return { success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' };
  }
}

// ============================================
// GRANT REFERRAL REWARD
// เรียกเมื่อ referee upgrade เป็น paid plan
// → ผู้แนะนำได้สิทธิ์พรีเมียมฟรี 1 เดือนตามประเภทบัญชี
// ============================================
export async function grantReferralReward(refereeUid: string): Promise<void> {
  try {
    // หา referral record ที่ยังไม่ได้รับ reward
    const q = query(
      collection(db, REFERRALS_COL),
      where('refereeUid', '==', refereeUid),
      where('rewardGranted', '==', false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return; // ไม่มี referral หรือ reward ถูกให้ไปแล้ว

    const referralDoc = snap.docs[0];
    const referral = referralDoc.data() as ReferralRecord;
    const referrerUid = referral.referrerUid;

    // mark reward granted
    await updateDoc(doc(db, REFERRALS_COL, referralDoc.id), {
      rewardGranted: true,
      rewardGrantedAt: serverTimestamp(),
    });

    // เพิ่ม 1 เดือนฟรีให้ referrer
    // อ่าน subscription ปัจจุบันของ referrer
    const referrerDoc = await getDoc(doc(db, USERS_COL, referrerUid));
    if (!referrerDoc.exists()) return;

    const referrerData = referrerDoc.data();
    const sub = referrerData.subscription || {};

    let currentExpiry: Date;
    if (sub.expiresAt && typeof sub.expiresAt.toDate === 'function') {
      currentExpiry = sub.expiresAt.toDate();
    } else if (sub.expiresAt) {
      currentExpiry = new Date(sub.expiresAt);
    } else {
      currentExpiry = new Date();
    }

    // ถ้า expiry อยู่ในอดีต ให้เริ่มจากวันนี้
    if (currentExpiry < new Date()) currentExpiry = new Date();
    currentExpiry.setMonth(currentExpiry.getMonth() + 1);

    // ถ้า referrer ยังเป็น free → upgrade เป็นแผนพรีเมียมตามประเภทบัญชีฟรี 1 เดือน
    const newPlan = sub.plan === 'free' || !sub.plan
      ? getReferralRewardPlan(referrerData.role)
      : sub.plan;

    await updateDoc(doc(db, USERS_COL, referrerUid), {
      'subscription.plan': newPlan,
      'subscription.expiresAt': Timestamp.fromDate(currentExpiry),
      'subscription.billingCycle': 'monthly',
      referralRewardMonthsUsed: increment(1),
    });

    console.log(`[referralService] Reward granted: ${referrerUid} +1 month free`);
  } catch (error) {
    console.error('[referralService] grantReferralReward error:', error);
  }
}

// ============================================
// CHECK IF USER WAS REFERRED (for onboarding)
// ============================================
export async function getUserReferredBy(uid: string): Promise<string | null> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COL, uid));
    if (!userDoc.exists()) return null;
    return userDoc.data().referredBy || null;
  } catch {
    return null;
  }
}
