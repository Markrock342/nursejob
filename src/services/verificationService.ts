// ============================================
// VERIFICATION SERVICE - ตรวจสอบใบประกอบวิชาชีพ
// ============================================

import { db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp,
  addDoc
} from 'firebase/firestore';

const VERIFICATIONS_COLLECTION = 'verifications';
const USERS_COLLECTION = 'users';

// ============================================
// Types
// ============================================

export interface VerificationRequest {
  id?: string;
  userId: string;
  userName: string;
  firstName: string;
  lastName: string;
  userEmail: string;
  userPhone?: string;
  
  // License info
  licenseNumber: string;
  licenseType: 'nurse' | 'practical_nurse' | 'midwife' | 'other';
  licenseExpiry: Date;
  
  // Documents
  licenseDocumentUrl: string;
  idCardUrl?: string;
  selfieUrl?: string;
  
  // Status
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  
  // Timestamps
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

export interface UserVerificationStatus {
  isVerified: boolean;
  verifiedAt?: Date;
  licenseNumber?: string;
  licenseType?: string;
  licenseExpiry?: Date;
  pendingRequest?: boolean;
}

// ============================================
// License Type Labels
// ============================================

export const LICENSE_TYPES = [
  { value: 'nurse', label: 'พยาบาลวิชาชีพ (RN)' },
  { value: 'practical_nurse', label: 'พยาบาลเทคนิค (PN)' },
  { value: 'midwife', label: 'พยาบาลผดุงครรภ์' },
  { value: 'other', label: 'อื่นๆ' },
];

export function getLicenseTypeLabel(type: string): string {
  const found = LICENSE_TYPES.find(t => t.value === type);
  return found?.label || type;
}

// ============================================
// License Number Validation
// ============================================

/**
 * ตรวจสอบรูปแบบเลขใบอนุญาตวิชาชีพ
 * - RN (พยาบาลวิชาชีพ): ว.XXXXX หรือ ว.XXXXXX (5-6 หลัก)
 * - PN (พยาบาลเทคนิค): ผ.XXXXX หรือ ผ.XXXXXX (5-6 หลัก)
 * - ผดุงครรภ์: ผด.XXXXX
 * - ยอมรับรูปแบบเก่า: ตัวอักษร-ตัวเลข (เช่น RN-123456, PN-123456)
 */
export const LICENSE_PATTERNS: Record<string, { regex: RegExp; example: string; label: string }> = {
  nurse: {
    regex: /^(ว\.\d{5,6}|RN[- ]?\d{5,6})$/i,
    example: 'ว.12345 หรือ RN-123456',
    label: 'พยาบาลวิชาชีพ (RN)',
  },
  practical_nurse: {
    regex: /^(ผ\.\d{5,6}|PN[- ]?\d{5,6})$/i,
    example: 'ผ.12345 หรือ PN-123456',
    label: 'พยาบาลเทคนิค (PN)',
  },
  midwife: {
    regex: /^(ผด\.\d{5,6}|MW[- ]?\d{5,6})$/i,
    example: 'ผด.12345 หรือ MW-123456',
    label: 'พยาบาลผดุงครรภ์',
  },
  other: {
    regex: /^.{3,20}$/,
    example: 'ระบุเลขใบอนุญาต',
    label: 'อื่นๆ',
  },
};

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  normalizedNumber?: string;
}

export function validateLicenseNumber(
  licenseNumber: string,
  licenseType: string
): LicenseValidationResult {
  const trimmed = licenseNumber.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'กรุณากรอกเลขใบอนุญาต' };
  }

  const pattern = LICENSE_PATTERNS[licenseType];
  if (!pattern) {
    // Unknown type — just check length
    if (trimmed.length < 3 || trimmed.length > 20) {
      return { valid: false, error: 'เลขใบอนุญาตต้องมี 3-20 ตัวอักษร' };
    }
    return { valid: true, normalizedNumber: trimmed };
  }

  if (!pattern.regex.test(trimmed)) {
    return {
      valid: false,
      error: `รูปแบบไม่ถูกต้อง ตัวอย่าง: ${pattern.example}`,
    };
  }

  return { valid: true, normalizedNumber: trimmed };
}

// ============================================
// Submit Verification Request
// ============================================

export async function submitVerificationRequest(
  request: Omit<VerificationRequest, 'id' | 'status' | 'submittedAt'>
): Promise<string> {
  try {
    // Check if user already has pending request
    const existingRequest = await getPendingVerificationRequest(request.userId);
    if (existingRequest) {
      throw new Error('คุณมีคำขอที่รอการตรวจสอบอยู่แล้ว');
    }
    
    // Check if user is already verified
    const status = await getUserVerificationStatus(request.userId);
    if (status.isVerified) {
      throw new Error('บัญชีของคุณได้รับการยืนยันแล้ว');
    }
    
    const docRef = await addDoc(collection(db, VERIFICATIONS_COLLECTION), {
      ...request,
      status: 'pending',
      submittedAt: serverTimestamp(),
    });
    
    return docRef.id;
  } catch (error: any) {
    console.error('Error submitting verification request:', error);
    throw new Error(error.message || 'ไม่สามารถส่งคำขอยืนยันตัวตนได้');
  }
}

// ============================================
// Get User's Pending Request
// ============================================

export async function getPendingVerificationRequest(
  userId: string
): Promise<VerificationRequest | null> {
  try {
    const q = query(
      collection(db, VERIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      submittedAt: data.submittedAt?.toDate() || new Date(),
      licenseExpiry: data.licenseExpiry?.toDate() || new Date(),
    } as VerificationRequest;
  } catch (error) {
    console.error('Error getting pending verification:', error);
    return null;
  }
}

// ============================================
// Get User Verification Status
// ============================================

export async function getUserVerificationStatus(
  userId: string
): Promise<UserVerificationStatus> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (!userDoc.exists()) {
      return { isVerified: false };
    }
    
    const userData = userDoc.data();
    const pendingRequest = await getPendingVerificationRequest(userId);
    
    return {
      isVerified: userData.isVerified || false,
      verifiedAt: userData.verifiedAt?.toDate(),
      licenseNumber: userData.licenseNumber,
      licenseType: userData.licenseType,
      licenseExpiry: userData.licenseExpiry?.toDate(),
      pendingRequest: Boolean(pendingRequest),
    };
  } catch (error: any) {
    if (error?.code === 'permission-denied') return { isVerified: false }; // auth not ready yet
    console.error('Error getting verification status:', error);
    return { isVerified: false };
  }
}

// ============================================
// Admin Functions - Approve/Reject
// ============================================

export async function approveVerificationRequest(
  requestId: string,
  adminId: string
): Promise<void> {
  try {
    const requestRef = doc(db, VERIFICATIONS_COLLECTION, requestId);
    const requestDoc = await getDoc(requestRef);
    
    if (!requestDoc.exists()) {
      throw new Error('ไม่พบคำขอนี้');
    }
    
    const requestData = requestDoc.data();
    
    // Update verification request
    await updateDoc(requestRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedBy: adminId,
    });
    
    // Update user profile
    const userRef = doc(db, USERS_COLLECTION, requestData.userId);
    await updateDoc(userRef, {
      isVerified: true,
      verifiedAt: serverTimestamp(),
      firstName: requestData.firstName,
      lastName: requestData.lastName,
      licenseNumber: requestData.licenseNumber,
      licenseType: requestData.licenseType,
      licenseExpiry: requestData.licenseExpiry,
    });
  } catch (error) {
    console.error('Error approving verification:', error);
    throw new Error('ไม่สามารถอนุมัติคำขอได้');
  }
}

export async function rejectVerificationRequest(
  requestId: string,
  adminId: string,
  reason: string
): Promise<void> {
  try {
    const requestRef = doc(db, VERIFICATIONS_COLLECTION, requestId);
    
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedAt: serverTimestamp(),
      reviewedBy: adminId,
    });
  } catch (error) {
    console.error('Error rejecting verification:', error);
    throw new Error('ไม่สามารถปฏิเสธคำขอได้');
  }
}

// ============================================
// Get All Pending Requests (Admin)
// ============================================

export async function getAllPendingVerifications(): Promise<VerificationRequest[]> {
  try {
    const q = query(
      collection(db, VERIFICATIONS_COLLECTION),
      where('status', '==', 'pending')
    );
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        submittedAt: data.submittedAt?.toDate() || new Date(),
        licenseExpiry: data.licenseExpiry?.toDate() || new Date(),
      } as VerificationRequest;
    });
  } catch (error) {
    console.error('Error getting pending verifications:', error);
    return [];
  }
}
