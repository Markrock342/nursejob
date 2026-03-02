// ============================================
// NOTIFICATIONS SERVICE - Production Ready
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const NOTIFICATIONS_COLLECTION = 'notifications';

export type NotificationType = 
  | 'new_job'           // งานใหม่ที่ตรงกับที่สนใจ
  | 'application_sent'   // สมัครงานสำเร็จ
  | 'application_viewed' // โรงพยาบาลดูใบสมัคร
  | 'application_accepted' // ได้รับการตอบรับ
  | 'application_rejected' // ไม่ได้รับการตอบรับ
  | 'new_message'       // ข้อความใหม่
  | 'new_applicant'     // มีคนสมัครงาน (สำหรับโรงพยาบาล)
  | 'job_expired'       // งานหมดอายุ
  | 'profile_reminder'  // เตือนให้อัพเดทโปรไฟล์
  | 'system'            // ข้อความจากระบบ
  | 'license_approved'  // ใบประกอบวิชาชีพผ่าน
  | 'license_rejected'; // ใบประกอบวิชาชีพไม่ผ่าน

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    jobId?: string;
    applicationId?: string;
    conversationId?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: Date;
}

// Create notification
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Notification['data']
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
      userId,
      type,
      title,
      body,
      data: data || {},
      isRead: false,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

// Get user notifications
export async function getUserNotifications(userId: string): Promise<Notification[]> {
  try {
    // Simple query without orderBy (sorted client-side to avoid index requirement)
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Notification[];

    // Sort client-side (newest first)
    return notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    // Filter client-side
    return snapshot.docs.filter(doc => doc.data().isRead === false).length;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// Subscribe to notifications
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): () => void {
  // Simple query without orderBy (sorted client-side to avoid index requirement)
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Notification[];
    
    // Sort client-side (newest first)
    notifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    callback(notifications);
  }, (error) => {
    console.error('Notification subscription error:', error);
    callback([]);
  });
}

// Mark notification as read
export async function markAsRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
      isRead: true,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

// Mark all notifications as read
export async function markAllAsRead(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.update(docSnap.ref, { isRead: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
}

// Delete notification
export async function deleteNotification(notificationId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
}

// Delete all notifications
export async function deleteAllNotifications(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error deleting all notifications:', error);
  }
}

// Get unread count
export async function getUnreadNotificationsCount(userId: string): Promise<number> {
  try {
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// Helper: Send job application notification to hospital
export async function notifyNewApplicant(
  hospitalUserId: string,
  applicantName: string,
  jobTitle: string,
  applicationId: string,
  jobId: string
): Promise<void> {
  await createNotification(
    hospitalUserId,
    'new_applicant',
    'มีผู้สมัครงานใหม่',
    `${applicantName} สมัครตำแหน่ง ${jobTitle}`,
    { applicationId, jobId }
  );
}

// Helper: Send application status notification to nurse
export async function notifyApplicationStatus(
  nurseUserId: string,
  jobTitle: string,
  hospitalName: string,
  status: 'accepted' | 'rejected',
  applicationId: string,
  jobId: string
): Promise<void> {
  const type = status === 'accepted' ? 'application_accepted' : 'application_rejected';
  const title = status === 'accepted' ? 'ยินดีด้วย! 🎉' : 'ผลการสมัครงาน';
  const body = status === 'accepted'
    ? `${hospitalName} ตอบรับใบสมัครตำแหน่ง ${jobTitle} ของคุณแล้ว`
    : `${hospitalName} ไม่สามารถรับสมัครตำแหน่ง ${jobTitle} ได้ในขณะนี้`;
  
  await createNotification(nurseUserId, type, title, body, { applicationId, jobId });
}

// Helper: Send new message notification
export async function notifyNewMessage(
  userId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  await createNotification(
    userId,
    'new_message',
    `ข้อความจาก ${senderName}`,
    messagePreview.length > 50 ? messagePreview.substring(0, 50) + '...' : messagePreview,
    { conversationId }
  );
}

// Helper: แจ้งเตือนผลการตรวจสอบใบประกอบวิชาชีพ
export async function notifyLicenseVerification(
  userId: string,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<void> {
  if (status === 'approved') {
    await createNotification(
      userId,
      'license_approved',
      'ใบประกอบวิชาชีพผ่านการตรวจสอบ',
      'ใบประกอบวิชาชีพของคุณได้รับการอนุมัติแล้ว สามารถใช้งานระบบได้เต็มรูปแบบ',
    );
  } else {
    await createNotification(
      userId,
      'license_rejected',
      'ใบประกอบวิชาชีพไม่ผ่านการตรวจสอบ',
      `ใบประกอบวิชาชีพของคุณไม่ผ่านการตรวจสอบ${reason ? ': ' + reason : ''} กรุณาตรวจสอบและส่งใหม่อีกครั้ง`,
    );
  }
}
