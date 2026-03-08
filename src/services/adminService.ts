// ============================================
// ADMIN SERVICE - จัดการระบบสำหรับ Admin
// ============================================

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  startAfter,
  getCountFromServer,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import { getAuthUid } from './security/authGuards';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withPermissionRetry<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const code = error?.code || '';
    if (retries > 0 && code === 'permission-denied') {
      // Firebase token can be briefly unavailable right after sign-in.
      await wait(450);
      return withPermissionRetry(fn, retries - 1);
    }
    throw error;
  }
}

async function callAdminMutation(functionName: 'adminVerifyUser' | 'adminUpdateUserRole', payload: Record<string, any>): Promise<void> {
  const fn = httpsCallable(getFunctions(), functionName);
  await fn(payload);
}

// ============================================
// Types
// ============================================
export interface AdminUser {
  id: string;
  uid: string;
  email: string;
  username?: string;
  displayName: string;
  phone?: string;
  role: 'user' | 'nurse' | 'hospital' | 'admin'; // user = ผู้ใช้ทั่วไป, nurse = พยาบาล verified
  isAdmin: boolean;
  isActive: boolean;
  isVerified: boolean;
  licenseNumber?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastLoginAt?: Date;
}

export interface AdminJob {
  id: string;
  title: string;
  posterName: string;
  posterId: string;
  status: 'active' | 'closed' | 'urgent';
  department: string;
  staffType?: string;
  shiftRate: number;
  province?: string;
  hospital?: string;
  shiftDate?: Date;
  shiftTime?: string;
  createdAt: Date;
  contactsCount: number;
  applicantsCount: number;
  viewsCount: number;
}

export interface AdminConversation {
  id: string;
  participants: string[];
  participantDetails: { id: string; name: string; displayName?: string }[];
  jobTitle?: string;
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface DashboardStats {
  totalUsers: number;
  totalJobs: number;
  activeJobs: number;
  totalConversations: number;
  todayNewUsers: number;
  todayNewJobs: number;
  pendingVerifications?: number;
}

// ============================================
// Dashboard Stats
// ============================================
export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Run every count independently — one failure does not zero out the rest
  const safeCount = async (ref: any): Promise<number> => {
    try {
      const snap = await withPermissionRetry(() => getCountFromServer(ref), 1);
      return snap.data().count;
    } catch {
      return 0;
    }
  };

  const usersRef = collection(db, 'users');
  const jobsRef = collection(db, 'shifts');
  const conversationsRef = collection(db, 'conversations');

  const [totalUsers, todayNewUsers, totalJobs, activeJobs, todayNewJobs, totalConversations, pendingVerifications] =
    await Promise.all([
      safeCount(usersRef),
      safeCount(query(usersRef, where('createdAt', '>=', Timestamp.fromDate(today)))),
      safeCount(jobsRef),
      safeCount(query(jobsRef, where('status', '==', 'active'))),
      safeCount(query(jobsRef, where('createdAt', '>=', Timestamp.fromDate(today)))),
      safeCount(conversationsRef),
      safeCount(query(collection(db, 'verifications'), where('status', '==', 'pending'))),
    ]);

  return {
    totalUsers,
    totalJobs,
    activeJobs,
    totalConversations,
    todayNewUsers,
    todayNewJobs,
    pendingVerifications,
  };
}

// ============================================
// User Management
// ============================================
export async function getAllUsers(limitCount: number = 50): Promise<AdminUser[]> {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await withPermissionRetry(() => getDocs(q), 1);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid || doc.id,
        email: data.email || '',
        username: data.username,
        displayName: data.displayName || 'ไม่ระบุชื่อ',
        phone: data.phone,
        role: data.role || 'nurse',
        isAdmin: data.isAdmin || false,
        isActive: data.isActive !== false, // default true
        isVerified: data.isVerified || false,
        licenseNumber: data.licenseNumber,
        photoURL: data.photoURL,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.(),
        lastLoginAt: data.lastLoginAt?.toDate?.(),
      };
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getAllUsers] permission-denied — auth token not ready');
      return [];
    }
    console.warn('Error getting users:', error);
    return [];
  }
}

export async function searchUsers(searchTerm: string): Promise<AdminUser[]> {
  try {
    // Firestore doesn't support full-text search, so we get all and filter
    const allUsers = await getAllUsers(200);
    const term = searchTerm.toLowerCase();
    
    return allUsers.filter(
      (user) =>
        user.email.toLowerCase().includes(term) ||
        user.displayName.toLowerCase().includes(term) ||
        user.username?.toLowerCase().includes(term) ||
        user.phone?.includes(term)
    );
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

export async function updateUserStatus(
  userId: string,
  isActive: boolean
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    throw new Error('ไม่สามารถอัพเดทสถานะผู้ใช้ได้');
  }
}

export async function verifyUser(userId: string, isVerified: boolean): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    // ถ้า verify เป็น true = เปลี่ยน role เป็น 'nurse' (พยาบาล)
    // ถ้า verify เป็น false = เปลี่ยน role เป็น 'user' (ผู้ใช้ทั่วไป)
    const updateData: any = {
      isVerified,
      role: isVerified ? 'nurse' : 'user',
      updatedAt: serverTimestamp(),
    };
    
    await withPermissionRetry(() => updateDoc(userRef, updateData), 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      await callAdminMutation('adminVerifyUser', { userId, isVerified });
      return;
    }
    console.error('Error verifying user:', error);
    throw new Error('ไม่สามารถยืนยันผู้ใช้ได้');
  }
}

export async function updateUserRole(
  userId: string,
  role: 'user' | 'nurse' | 'hospital' | 'admin'
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await withPermissionRetry(() => updateDoc(userRef, {
      role,
      isAdmin: role === 'admin',
      updatedAt: serverTimestamp(),
    }), 1);
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      await callAdminMutation('adminUpdateUserRole', { userId, role });
      return;
    }
    console.error('Error updating user role:', error);
    throw new Error(`ไม่สามารถเปลี่ยน role ได้ (${error?.code || 'unknown'})`);
  }
}

export async function deleteUser(userId: string): Promise<void> {
  try {
    // Delete user document from Firestore
    const userRef = doc(db, 'users', userId);
    await deleteDoc(userRef);
    
    // Note: This doesn't delete from Firebase Auth
    // To fully delete, you'd need Firebase Admin SDK or Cloud Functions
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new Error('ไม่สามารถลบผู้ใช้ได้');
  }
}

export async function getUserById(userId: string): Promise<AdminUser | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snapshot = await getDoc(userRef);
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data();
    return {
      id: snapshot.id,
      uid: data.uid || snapshot.id,
      email: data.email || '',
      username: data.username,
      displayName: data.displayName || 'ไม่ระบุชื่อ',
      phone: data.phone,
      role: data.role || 'nurse',
      isAdmin: data.isAdmin || false,
      isActive: data.isActive !== false,
      isVerified: data.isVerified || false,
      licenseNumber: data.licenseNumber,
      photoURL: data.photoURL,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.(),
      lastLoginAt: data.lastLoginAt?.toDate?.(),
    };
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// ============================================
// Job Management
// ============================================
export async function getAllJobs(limitCount: number = 50): Promise<AdminJob[]> {
  try {
    const jobsRef = collection(db, 'shifts');
    const q = query(jobsRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const loc = data.location || {};

      // Parse shiftDate safely (ternary precedence bug fix)
      let shiftDate: Date | undefined;
      if (data.shiftDate?.toDate) {
        shiftDate = data.shiftDate.toDate();
      } else if (Array.isArray(data.shiftDates) && data.shiftDates.length > 0) {
        try { shiftDate = new Date(data.shiftDates[0]); } catch (_) { /* skip */ }
      }

      return {
        id: docSnap.id,
        title: data.title || 'ไม่ระบุชื่อ',
        posterName: data.posterName || 'ไม่ระบุ',
        posterId: data.posterId || '',
        status: data.status || 'active',
        department: data.department || '',
        staffType: data.staffType,
        shiftRate: data.shiftRate || 0,
        province: data.province || loc.province || '',
        hospital: data.hospital || loc.hospital || '',
        shiftDate,
        shiftTime: data.shiftTime || (data.startTime && data.endTime ? `${data.startTime}-${data.endTime}` : ''),
        createdAt: data.createdAt?.toDate?.() || new Date(),
        contactsCount: data.contactsCount || 0,
        applicantsCount: data.applicantsCount || 0,
        viewsCount: data.viewsCount || 0,
      };
    });
  } catch (error) {
    console.error('Error getting jobs:', error);
    return [];
  }
}

export async function updateJobStatus(
  jobId: string,
  status: 'active' | 'closed' | 'urgent'
): Promise<void> {
  try {
    const jobRef = doc(db, 'shifts', jobId);
    await updateDoc(jobRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    throw new Error('ไม่สามารถอัพเดทสถานะงานได้');
  }
}

export async function deleteJob(jobId: string): Promise<void> {
  try {
    const jobRef = doc(db, 'shifts', jobId);
    await deleteDoc(jobRef);
  } catch (error) {
    console.error('Error deleting job:', error);
    throw new Error('ไม่สามารถลบงานได้');
  }
}

// ============================================
// Conversation Management (View All Chats)
// ============================================
export async function getAllConversations(
  limitCount: number = 50
): Promise<AdminConversation[]> {
  if (!getAuthUid()) return [];
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      orderBy('lastMessageAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        participants: data.participants || [],
        participantDetails: data.participantDetails || [],
        jobTitle: data.jobTitle,
        lastMessage: data.lastMessage || '',
        lastMessageAt: data.lastMessageAt?.toDate?.() || new Date(),
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getAllConversations] permission-denied — admin session not ready');
      return [];
    }
    console.warn('Error getting conversations:', error);
    return [];
  }
}

export async function getConversationMessages(
  conversationId: string,
  limitCount: number = 100
): Promise<any[]> {
  try {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        createdAt: data.createdAt?.toDate?.() || new Date(),
      };
    }).reverse();
  } catch (error) {
    console.error('Error getting messages:', error);
    return [];
  }
}

export async function deleteConversation(conversationId: string): Promise<void> {
  try {
    // Delete all messages first
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messagesSnapshot = await getDocs(messagesRef);
    
    const deletePromises = messagesSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
    
    // Delete conversation
    const conversationRef = doc(db, 'conversations', conversationId);
    await deleteDoc(conversationRef);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw new Error('ไม่สามารถลบการสนทนาได้');
  }
}
