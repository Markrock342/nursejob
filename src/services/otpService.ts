// ============================================
// OTP SERVICE
// DEV (Expo Go): Cloud Function OTP — devCode logged to Metro console
// PRODUCTION (native APK): Cloud Function OTP — real SMS via Firebase
// ============================================

import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { isAuthUser } from './security/authGuards';

const _functions = getFunctions(getApp());

// ==========================================
// Phone Validation & Formatting
// ==========================================

export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('66')) cleaned = '66' + cleaned;
  return '+' + cleaned;
}

export function isValidThaiPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^0[689]\d{8}$/.test(cleaned);
}

// ==========================================
// sendOTP
// DEV  → Cloud Function sendCustomOTP (no real SMS; devCode printed to Metro)
// PROD → Cloud Function sendCustomOTP (real SMS)
// ==========================================

export async function sendOTP(
  phoneNumber: string,
  _unused?: any
): Promise<{ success: boolean; verificationId?: string; message?: string; error?: string; devCode?: string }> {
  try {
    if (!isValidThaiPhone(phoneNumber)) {
      return { success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
    }
    const formattedPhone = formatPhoneNumber(phoneNumber);

    // ── CLOUD FUNCTION OTP ──
    const sendFn = httpsCallable(_functions, 'sendCustomOTP');
    const result = await sendFn({ phone: formattedPhone });
    const data = result.data as any;
    if (data.devCode) {
      console.log(`[OTP DEV] รหัส OTP: ${data.devCode}`);
    }
    return {
      success: true,
      verificationId: formattedPhone,
      message: data.devCode ? 'OTP ถูกส่งแล้ว (dev)' : 'OTP ถูกส่งแล้ว',
      devCode: data.devCode,
    };
  } catch (error: any) {
    console.error('[OTP] sendOTP error:', error);
    const code: string = error.code || '';
    let errorMessage = 'ไม่สามารถส่ง OTP ได้';
    if (code === 'auth/invalid-phone-number' || code === 'functions/invalid-argument') errorMessage = 'เบอร์โทรศัพท์ไม่ถูกต้อง';
    else if (code === 'auth/too-many-requests' || code === 'functions/resource-exhausted') errorMessage = 'ส่ง OTP มากเกินไป กรุณารอสักครู่';
    else if (code === 'auth/quota-exceeded') errorMessage = 'เกินโควต้า SMS กรุณาลองใหม่ภายหลัง';
    else if (code === 'functions/failed-precondition') errorMessage = 'ระบบ OTP ฝั่งเซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SMS provider ถ้าทดสอบใน Expo Go ให้ใช้ Functions Emulator หรือทดสอบผ่าน native build';
    else if (code === 'functions/unavailable') errorMessage = 'ไม่สามารถเชื่อมต่อ Firebase Functions ได้';
    return { success: false, error: errorMessage };
  }
}

// ==========================================
// verifyOTP
// DEV  → Cloud Function verifyCustomOTP + signInWithCustomToken
// PROD → Cloud Function verifyCustomOTP + signInWithCustomToken
// ==========================================

export async function verifyOTP(
  verificationId: string,
  otpCode: string,
  opts?: { skipSignIn?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    // ── CLOUD FUNCTION VERIFY ──
    const verifyFn = httpsCallable(_functions, 'verifyCustomOTP');
    const result = await verifyFn({ phone: verificationId, code: otpCode });
    const data = result.data as any;
    if (!opts?.skipSignIn) {
      await signInWithCustomToken(auth, data.customToken);
    }
    return { success: true };
  } catch (error: any) {
    console.error('[OTP] verifyOTP error:', error);
    const code: string = error.code || '';
    let errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    if (code === 'auth/invalid-verification-code' || code === 'functions/not-found') errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    else if (code === 'auth/code-expired' || code === 'functions/deadline-exceeded') errorMessage = 'รหัส OTP หมดอายุ กรุณาขอใหม่';
    else if (code === 'auth/session-expired') errorMessage = 'หมดเวลา กรุณาขอรหัสใหม่';
    else if (code === 'functions/resource-exhausted') errorMessage = 'ลองรหัสผิดมากเกินไป กรุณาขอ OTP ใหม่';
    else if (code === 'functions/invalid-argument') errorMessage = error.message || 'รหัส OTP ไม่ถูกต้อง';
    else if (code === 'functions/unavailable') errorMessage = 'ไม่สามารถเชื่อมต่อ Firebase Functions ได้';
    return { success: false, error: errorMessage };
  }
}

// ==========================================
// updatePhoneVerifiedStatus — kept for compatibility
// ==========================================

export async function updatePhoneVerifiedStatus(userId: string): Promise<void> {
  try {
    if (!isAuthUser(userId)) return;

    await updateDoc(doc(db, 'users', userId), {
      phoneVerified: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating phone status:', error);
  }
}
