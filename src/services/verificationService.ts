// ============================================
// VERIFICATION SERVICE - ตรวจสอบใบประกอบวิชาชีพ
// ============================================

import { auth, db } from '../config/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  limit,
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

export type VerificationType = 'nurse' | 'hospital_hr' | 'clinic' | 'agency' | 'user';

export interface VerificationFlowConfig {
  type: VerificationType;
  menuLabel: string;
  title: string;
  subtitle: string;
  verifiedTitle: string;
  verifiedSubtitle: string;
  requiresLicenseInfo: boolean;
  requiresEmployeeCard: boolean;
  requiresIdCard: boolean;
  requiresDeclaration: boolean;
}

export interface VerificationRequest {
  id?: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  firstName: string;
  lastName: string;
  userEmail: string;
  userPhone?: string;
  role?: string;
  orgType?: string;
  staffType?: string;
  staffTypes?: string[];
  verificationType: VerificationType;
  
  // License info
  licenseNumber?: string;
  licenseType?: 'nurse' | 'practical_nurse' | 'midwife' | 'other';
  licenseExpiry?: Date | Timestamp;
  
  // Documents
  licenseDocumentUrl?: string;
  employeeCardUrl?: string;
  idCardUrl?: string;
  declarationDocumentUrl?: string;
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
  verificationType?: VerificationType;
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

export function resolveVerificationType(role?: string | null, orgType?: string | null): VerificationType {
  if (role === 'nurse') return 'nurse';
  if (role === 'hospital') {
    if (orgType === 'clinic') return 'clinic';
    if (orgType === 'agency') return 'agency';
    return 'hospital_hr';
  }
  return 'user';
}

export function getVerificationFlowConfig(role?: string | null, orgType?: string | null): VerificationFlowConfig {
  const type = resolveVerificationType(role, orgType);

  switch (type) {
    case 'nurse':
      return {
        type,
        menuLabel: 'ยืนยันตัวตนพยาบาล',
        title: 'ยืนยันตัวตนพยาบาล',
        subtitle: 'ส่งชื่อจริง นามสกุล และใบประกอบวิชาชีพ เพื่อให้ระบบแสดงว่าเป็นบัญชีที่ตรวจสอบได้',
        verifiedTitle: 'ยืนยันตัวตนพยาบาลแล้ว',
        verifiedSubtitle: 'บัญชีนี้ผ่านการตรวจสอบชื่อจริงและใบประกอบวิชาชีพแล้ว',
        requiresLicenseInfo: true,
        requiresEmployeeCard: false,
        requiresIdCard: false,
        requiresDeclaration: false,
      };
    case 'hospital_hr':
      return {
        type,
        menuLabel: 'ยืนยันตัวตน HR / โรงพยาบาล',
        title: 'ยืนยันตัวตน HR / โรงพยาบาล',
        subtitle: 'ส่งชื่อจริง นามสกุล บัตรพนักงาน บัตรประชาชน และเอกสารเซ็นกำกับว่าใช้กับ NurseGo เพื่อยืนยันตัวตนผู้ประกาศงาน',
        verifiedTitle: 'ยืนยันตัวตน HR / โรงพยาบาลแล้ว',
        verifiedSubtitle: 'บัญชีนี้ผ่านการตรวจสอบเอกสารผู้แทนองค์กรแล้ว',
        requiresLicenseInfo: false,
        requiresEmployeeCard: true,
        requiresIdCard: true,
        requiresDeclaration: true,
      };
    case 'clinic':
      return {
        type,
        menuLabel: 'ยืนยันตัวตนคลินิก',
        title: 'ยืนยันตัวตนคลินิก',
        subtitle: 'ส่งชื่อจริง นามสกุล บัตรพนักงาน บัตรประชาชน และเอกสารเซ็นกำกับว่าใช้กับ NurseGo เพื่อยืนยันคลินิกผู้ประกาศ',
        verifiedTitle: 'ยืนยันตัวตนคลินิกแล้ว',
        verifiedSubtitle: 'บัญชีนี้ผ่านการตรวจสอบเอกสารของคลินิกแล้ว',
        requiresLicenseInfo: false,
        requiresEmployeeCard: true,
        requiresIdCard: true,
        requiresDeclaration: true,
      };
    case 'agency':
      return {
        type,
        menuLabel: 'ยืนยันตัวตน Agency',
        title: 'ยืนยันตัวตน Agency',
        subtitle: 'ส่งชื่อจริง นามสกุล และบัตรประชาชนของผู้ดูแลบัญชี เพื่อยืนยันว่า Agency นี้ตรวจสอบตัวตนได้',
        verifiedTitle: 'ยืนยันตัวตน Agency แล้ว',
        verifiedSubtitle: 'บัญชีนี้ผ่านการตรวจสอบตัวตนผู้ดูแล Agency แล้ว',
        requiresLicenseInfo: false,
        requiresEmployeeCard: false,
        requiresIdCard: true,
        requiresDeclaration: false,
      };
    default:
      return {
        type,
        menuLabel: 'ยืนยันตัวตนผู้ใช้',
        title: 'ยืนยันตัวตนผู้ใช้',
        subtitle: 'ส่งชื่อจริง นามสกุล และบัตรประชาชน เพื่อเพิ่มความน่าเชื่อถือของบัญชี',
        verifiedTitle: 'ยืนยันตัวตนผู้ใช้แล้ว',
        verifiedSubtitle: 'บัญชีนี้ผ่านการตรวจสอบตัวตนแล้ว',
        requiresLicenseInfo: false,
        requiresEmployeeCard: false,
        requiresIdCard: true,
        requiresDeclaration: false,
      };
  }
}

export function getVerificationMenuLabel(role?: string | null, orgType?: string | null): string {
  return getVerificationFlowConfig(role, orgType).menuLabel;
}

export function getVerificationTypeLabel(type?: VerificationType | string | null): string {
  switch (type) {
    case 'nurse': return 'พยาบาล';
    case 'hospital_hr': return 'HR / โรงพยาบาล';
    case 'clinic': return 'คลินิก';
    case 'agency': return 'Agency';
    case 'user': return 'ผู้ใช้ทั่วไป';
    default: return 'ยืนยันตัวตน';
  }
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
    
    // Clean undefined values — Firestore rejects undefined fields
    const cleanRequest: Record<string, any> = {};
    for (const [key, value] of Object.entries(request)) {
      if (value !== undefined) cleanRequest[key] = value;
    }
    
    const docRef = await addDoc(collection(db, VERIFICATIONS_COLLECTION), {
      ...cleanRequest,
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
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      return null;
    }

    const q = query(
      collection(db, VERIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      where('status', '==', 'pending'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      submittedAt: data.submittedAt?.toDate() || new Date(),
      licenseExpiry: data.licenseExpiry?.toDate?.() || data.licenseExpiry,
    } as VerificationRequest;
  } catch (error: any) {
    if (error?.code !== 'permission-denied') {
      console.error('Error getting pending verification:', error);
    }
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
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      return { isVerified: false };
    }

    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    
    if (!userDoc.exists()) {
      return { isVerified: false };
    }
    
    const userData = userDoc.data();
    const pendingRequest = await getPendingVerificationRequest(userId);
    
    return {
      isVerified: userData.isVerified || false,
      verifiedAt: userData.verifiedAt?.toDate(),
      verificationType: userData.verificationType,
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
      verificationType: requestData.verificationType,
      firstName: requestData.firstName,
      lastName: requestData.lastName,
      ...(requestData.licenseNumber ? { licenseNumber: requestData.licenseNumber } : {}),
      ...(requestData.licenseType ? { licenseType: requestData.licenseType } : {}),
      ...(requestData.licenseExpiry ? { licenseExpiry: requestData.licenseExpiry } : {}),
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
    
    const requests = await Promise.all(snapshot.docs.map(async (requestDoc) => {
      const data = requestDoc.data();
      let userPhotoURL: string | undefined;

      if (data.userId) {
        try {
          const userSnap = await getDoc(doc(db, USERS_COLLECTION, data.userId));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            userPhotoURL = userData.photoURL;
          }
        } catch {
          // Ignore enrichment failures and return the request data anyway.
        }
      }

      return {
        id: requestDoc.id,
        ...data,
        userPhotoURL,
        submittedAt: data.submittedAt?.toDate() || new Date(),
        licenseExpiry: data.licenseExpiry?.toDate?.() || data.licenseExpiry,
      } as VerificationRequest;
    }));

    return requests;
  } catch (error) {
    console.error('Error getting pending verifications:', error);
    return [];
  }
}
