// ============================================
// OTP SERVICE - Cloud Function based (no reCAPTCHA)
// Uses Firebase Admin custom tokens via Cloud Functions.
// signInWithCustomToken() requires NO ApplicationVerifier.
// ============================================

import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

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
// sendOTP — calls Cloud Function sendCustomOTP
// Returns verificationId = formatted phone (+66...)
// devCode is returned by the CF while SMS is not wired yet
// ==========================================

export async function sendOTP(
  phoneNumber: string,
  _unused?: any
): Promise<{ success: boolean; verificationId?: string; devCode?: string; message?: string; error?: string }> {
  try {
    if (!isValidThaiPhone(phoneNumber)) {
      return { success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
    }
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const sendFn = httpsCallable(_functions, 'sendCustomOTP');
    const result = await sendFn({ phone: formattedPhone });
    const data = result.data as any;
    return {
      success: true,
      verificationId: formattedPhone, // phone acts as the session key
      devCode: data.devCode,
      message: 'OTP ถูกส่งแล้ว',
    };
  } catch (error: any) {
    console.error('[OTP] sendOTP error:', error);
    const code = error.code || '';
    let errorMessage = 'ไม่สามารถส่ง OTP ได้';
    if (code === 'functions/invalid-argument') errorMessage = 'เบอร์โทรศัพท์ไม่ถูกต้อง';
    else if (code === 'functions/resource-exhausted') errorMessage = 'ส่ง OTP มากเกินไป กรุณารอสักครู่';
    else if (code === 'functions/unavailable') errorMessage = 'เซิร์ฟเวอร์ไม่พร้อมใช้งาน กรุณาลองใหม่';
    return { success: false, error: errorMessage };
  }
}

// ==========================================
// verifyOTP — calls Cloud Function verifyCustomOTP
// On success: calls signInWithCustomToken (unless skipSignIn = true)
// skipSignIn = true  →  verification only (profile phone update)
// skipSignIn = false →  full sign-in (default, for register/login)
// ==========================================

export async function verifyOTP(
  verificationId: string,
  otpCode: string,
  opts?: { skipSignIn?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const verifyFn = httpsCallable(_functions, 'verifyCustomOTP');
    const result = await verifyFn({ phone: verificationId, code: otpCode });
    const data = result.data as any;

    if (!opts?.skipSignIn) {
      // Signs in as the phone user — triggers onAuthStateChanged in AuthContext
      await signInWithCustomToken(auth, data.customToken);
    }
    return { success: true };
  } catch (error: any) {
    console.error('[OTP] verifyOTP error:', error);
    const code = error.code || '';
    let errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    if (code === 'functions/not-found') errorMessage = 'OTP ไม่พบหรือหมดอายุ กรุณาขอรหัสใหม่';
    else if (code === 'functions/deadline-exceeded') errorMessage = 'รหัส OTP หมดอายุ กรุณาขอรหัสใหม่';
    else if (code === 'functions/resource-exhausted') errorMessage = 'ลองรหัสผิดมากเกินไป กรุณาขอ OTP ใหม่';
    else if (code === 'functions/invalid-argument') errorMessage = error.message || 'รหัส OTP ไม่ถูกต้อง';
    return { success: false, error: errorMessage };
  }
}

// ==========================================
// updatePhoneVerifiedStatus — kept for compatibility
// ==========================================

export async function updatePhoneVerifiedStatus(userId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      phoneVerified: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating phone status:', error);
  }
}
