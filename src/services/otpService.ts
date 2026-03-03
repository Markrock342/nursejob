// ============================================
// OTP SERVICE - Firebase Phone Authentication (Real)
// ============================================

import { 
  PhoneAuthProvider,
  signInWithCredential,
  linkWithCredential,
  ApplicationVerifier,
} from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// ==========================================
// Phone OTP Functions (Real Firebase Phone Auth)
// ==========================================

/**
 * Format phone number to E.164 format for Thailand
 * Input: 0812345678 or 081-234-5678
 * Output: +66812345678
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!cleaned.startsWith('66')) cleaned = '66' + cleaned;
  return '+' + cleaned;
}

/**
 * Validate Thai phone number
 */
export function isValidThaiPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return /^0[689]\d{8}$/.test(cleaned);
}

/**
 * Send OTP via Firebase Phone Auth (Real SMS)
 * recaptchaVerifier = FirebaseRecaptchaVerifierModal ref from expo-firebase-recaptcha
 * Returns verificationId to pass to OTPVerificationScreen
 */
export async function sendOTP(
  phoneNumber: string,
  recaptchaVerifier: ApplicationVerifier
): Promise<{ success: boolean; verificationId?: string; message?: string; error?: string }> {
  try {
    if (!isValidThaiPhone(phoneNumber)) {
      return { success: false, error: 'เบอร์โทรศัพท์ไม่ถูกต้อง' };
    }
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const provider = new PhoneAuthProvider(auth);
    const verificationId = await provider.verifyPhoneNumber(formattedPhone, recaptchaVerifier);
    return { success: true, verificationId, message: 'OTP ถูกส่งแล้ว' };
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    let errorMessage = 'ไม่สามารถส่ง OTP ได้';
    if (error.code === 'auth/invalid-phone-number') errorMessage = 'เบอร์โทรศัพท์ไม่ถูกต้อง';
    else if (error.code === 'auth/too-many-requests') errorMessage = 'ส่ง OTP มากเกินไป กรุณารอสักครู่';
    else if (error.code === 'auth/quota-exceeded') errorMessage = 'เกินโควต้าการส่ง SMS กรุณาลองใหม่ภายหลัง';
    else if (error.code === 'auth/captcha-check-failed') errorMessage = 'reCAPTCHA ล้มเหลว กรุณาลองใหม่';
    else if (error.code === 'auth/operation-not-allowed') errorMessage = 'Phone Auth ยังไม่รองรับบน Expo Go — กรุณา build ด้วย EAS (eas build) หรือใช้ Firebase Test Phone Number';
    return { success: false, error: errorMessage };
  }
}

/**
 * Verify OTP code with Firebase Phone Auth
 * Signs in (or links) the Firebase user with the phone credential
 */
export async function verifyOTP(
  verificationId: string,
  otpCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const credential = PhoneAuthProvider.credential(verificationId, otpCode);

    if (auth.currentUser) {
      // User already signed in with email — link phone to account
      await linkWithCredential(auth.currentUser, credential);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        phoneVerified: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      // New registration — sign in with phone first, email/password linked later
      await signInWithCredential(auth, credential);
    }
    return { success: true };
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    let errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    if (error.code === 'auth/invalid-verification-code') errorMessage = 'รหัส OTP ไม่ถูกต้อง';
    else if (error.code === 'auth/code-expired') errorMessage = 'รหัส OTP หมดอายุ กรุณาขอใหม่';
    else if (error.code === 'auth/credential-already-in-use') errorMessage = 'เบอร์นี้ถูกใช้งานแล้ว';
    return { success: false, error: errorMessage };
  }
}

/**
 * Update phone verified status in Firestore
 */
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
