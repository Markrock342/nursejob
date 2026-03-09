// ============================================
// OTP SERVICE — Firebase Phone Authentication
// ใช้ @react-native-firebase/auth ส่ง SMS ผ่าน Google โดยตรง
// แล้ว sync กลับมา JS SDK ผ่าน exchangeToken Cloud Function
// ============================================

import { signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { isAuthUser } from './security/authGuards';
import nativeAuth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

const _functions = getFunctions(getApp());

// เก็บ confirmation result ไว้ใช้ตอน verify
let _confirmationResult: FirebaseAuthTypes.ConfirmationResult | null = null;

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
// sendOTP — Firebase Phone Auth (Google ส่ง SMS ให้)
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

    // ── Firebase Phone Auth — Google ส่ง SMS เอง ──
    const confirmation = await nativeAuth().signInWithPhoneNumber(formattedPhone);
    _confirmationResult = confirmation;

    return {
      success: true,
      verificationId: confirmation.verificationId ?? undefined,
      message: 'OTP ถูกส่งแล้ว',
    };
  } catch (error: any) {
    console.error('[OTP] sendOTP error:', error);
    const code: string = error.code || '';
    let errorMessage = 'ไม่สามารถส่ง OTP ได้';
    if (code === 'auth/invalid-phone-number') errorMessage = 'เบอร์โทรศัพท์ไม่ถูกต้อง';
    else if (code === 'auth/too-many-requests') errorMessage = 'ส่ง OTP มากเกินไป กรุณารอสักครู่';
    else if (code === 'auth/quota-exceeded') errorMessage = 'เกินโควต้า SMS กรุณาลองใหม่ภายหลัง';
    else if (code === 'auth/missing-client-identifier') errorMessage = 'ไม่สามารถยืนยันแอปได้ กรุณาลองใหม่';
    else if (code === 'auth/app-not-authorized') errorMessage = 'แอปยังไม่ได้รับอนุญาตให้ใช้ Firebase Auth';
    return { success: false, error: errorMessage };
  }
}

// ==========================================
// verifyOTP — ยืนยัน OTP + sync กลับ JS SDK
// ==========================================

export async function verifyOTP(
  verificationId: string,
  otpCode: string,
  opts?: { skipSignIn?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!_confirmationResult) {
      return { success: false, error: 'เซสชัน OTP หมดอายุ กรุณาขอรหัสใหม่' };
    }

    // ── ยืนยัน OTP ผ่าน native Firebase Auth ──
    const userCredential = await _confirmationResult.confirm(otpCode);
    _confirmationResult = null; // ใช้แล้วเคลียร์

    if (!opts?.skipSignIn && userCredential?.user) {
      // ── sync native auth → JS SDK auth ──
      // ดึง idToken จาก native แล้วแลก customToken ผ่าน exchangeToken Cloud Function
      const idToken = await userCredential.user.getIdToken();
      const exchangeFn = httpsCallable(_functions, 'exchangeToken');
      const result = await exchangeFn({ idToken });
      const data = result.data as any;
      await signInWithCustomToken(auth, data.customToken);
    }

    return { success: true };
  } catch (error: any) {
    console.error('[OTP] verifyOTP error:', error);
    _confirmationResult = null;
    const code: string = error.code || '';
    let errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    if (code === 'auth/invalid-verification-code') errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    else if (code === 'auth/code-expired') errorMessage = 'รหัส OTP หมดอายุ กรุณาขอใหม่';
    else if (code === 'auth/session-expired') errorMessage = 'หมดเวลา กรุณาขอรหัสใหม่';
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
