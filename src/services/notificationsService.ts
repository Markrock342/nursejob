// ============================================
// NOTIFICATIONS SERVICE - Production Ready
// ============================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../config/firebase';
import { assertAuthUser, isAuthUser } from './security/authGuards';
import { beginTrackedSubscription, PerformanceMetricOptions, recordQueryRead } from './performanceMetrics';

const NOTIFICATIONS_COLLECTION = 'notifications';
const NOTIFICATION_WINDOW_SIZE = 100;

export type NotificationType = 
  | 'new_job'           // งานใหม่ที่ตรงกับที่สนใจ
  | 'application_sent'   // สมัครงานสำเร็จ
  | 'application_viewed' // โรงพยาบาลดูใบสมัคร
  | 'application_accepted' // ได้รับการตอบรับ
  | 'application_rejected' // ไม่ได้รับการตอบรับ
  | 'new_message'       // ข้อความใหม่
  | 'new_applicant'     // มีคนสมัครงาน (สำหรับโรงพยาบาล)
  | 'new_application'   // legacy: มีคนสนใจงาน
  | 'nearby_job'        // งานใกล้คุณ
  | 'job_expired'       // งานหมดอายุ
  | 'job_expiring'      // งานกำลังจะหมดอายุ
  | 'profile_reminder'  // เตือนให้อัพเดทโปรไฟล์
  | 'job_completed_review' // งานจบแล้วพร้อมรีวิว
  | 'new_review'       // มีคนรีวิวคุณใหม่
  | 'system'            // ข้อความจากระบบ
  | 'license_approved'  // ใบประกอบวิชาชีพผ่าน
  | 'license_rejected'  // ใบประกอบวิชาชีพไม่ผ่าน
  | 'admin_verification_request'; // แจ้งเตือนแอดมินตรวจเอกสาร

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: {
    jobId?: string;
    shiftId?: string;
    applicationId?: string;
    conversationId?: string;
    senderName?: string;
    senderPhotoURL?: string;
    recipientName?: string;
    recipientPhoto?: string;
    jobTitle?: string;
    [key: string]: any;
  };
  isRead: boolean;
  createdAt: Date;
}

function mapNotificationSnapshot(snapshot: any): Notification[] {
  return snapshot.docs.map((docSnap: any) => ({
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
  })) as Notification[];
}

function sortAndCapNotifications(notifications: Notification[]): Notification[] {
  return notifications
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, NOTIFICATION_WINDOW_SIZE);
}

function getBaseNotificationsQuery(userId: string) {
  return query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    limit(NOTIFICATION_WINDOW_SIZE)
  );
}

function getPreferredNotificationsQuery(userId: string) {
  return query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(NOTIFICATION_WINDOW_SIZE)
  );
}

async function getNotificationsSnapshotWithFallback(userId: string) {
  try {
    return await getDocs(getPreferredNotificationsQuery(userId));
  } catch {
    return await getDocs(getBaseNotificationsQuery(userId));
  }
}

// Create notification
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data?: Notification['data']
): Promise<string> {
  console.warn('[createNotification] client-side notification creation is disabled; use Cloud Functions/Admin SDK instead', {
    userId,
    type,
    title,
  });
  return '';
}

// Get user notifications
export async function getUserNotifications(userId: string, metrics?: PerformanceMetricOptions): Promise<Notification[]> {
  try {
    if (!isAuthUser(userId)) return [];

    const snapshot = await getNotificationsSnapshotWithFallback(userId);
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: metrics?.source || 'notifications:get',
    });
    return sortAndCapNotifications(mapNotificationSnapshot(snapshot));
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

export async function enrichNotificationsWithChatMetadata(
  notifications: Notification[],
  currentUserId: string
): Promise<Notification[]> {
  try {
    if (!isAuthUser(currentUserId)) return notifications;

    const targetNotifications = notifications.filter(
      (notification) =>
        notification.type === 'new_message' &&
        notification.data?.conversationId &&
        (!notification.data?.senderName || !notification.data?.senderPhotoURL)
    );

    if (targetNotifications.length === 0) {
      return notifications;
    }

    const conversationIds = [...new Set(
      targetNotifications
        .map((notification) => notification.data?.conversationId)
        .filter(Boolean)
    )] as string[];

    const conversationEntries = await Promise.all(
      conversationIds.map(async (conversationId) => {
        try {
          const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
          if (!conversationSnap.exists()) {
            return [conversationId, null] as const;
          }

          const conversationData = conversationSnap.data();
          const participants = Array.isArray(conversationData.participantDetails)
            ? conversationData.participantDetails
            : [];

          const otherParticipant = participants.find(
            (participant: any) => participant?.id && participant.id !== currentUserId
          );

          if (!otherParticipant?.id) {
            return [conversationId, null] as const;
          }

          let senderName = otherParticipant.displayName || otherParticipant.name || '';
          let senderPhotoURL = otherParticipant.photoURL || '';

          if (!senderName || !senderPhotoURL) {
            const userSnap = await getDoc(doc(db, 'users', otherParticipant.id));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              senderName = senderName || userData.displayName || '';
              senderPhotoURL = senderPhotoURL || userData.photoURL || '';
            }
          }

          return [conversationId, {
            senderName: senderName || 'ผู้ใช้',
            senderPhotoURL: senderPhotoURL || undefined,
          }] as const;
        } catch {
          return [conversationId, null] as const;
        }
      })
    );

    const conversationMap = new Map(conversationEntries);

    return notifications.map((notification) => {
      if (notification.type !== 'new_message' || !notification.data?.conversationId) {
        return notification;
      }

      const enriched = conversationMap.get(notification.data.conversationId);
      if (!enriched) {
        return notification;
      }

      return {
        ...notification,
        data: {
          ...notification.data,
          senderName: notification.data.senderName || enriched.senderName,
          senderPhotoURL: notification.data.senderPhotoURL || enriched.senderPhotoURL,
        },
      };
    });
  } catch {
    return notifications;
  }
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    if (!isAuthUser(userId)) return 0;

    try {
      const unreadQuery = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snapshot = await getDocs(unreadQuery);
      return snapshot.size;
    } catch {
      const snapshot = await getNotificationsSnapshotWithFallback(userId);
      return mapNotificationSnapshot(snapshot).filter((item) => item.isRead === false).length;
    }
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
}

// Subscribe to notifications
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  metrics?: PerformanceMetricOptions
): () => void {
  if (!isAuthUser(userId)) {
    callback([]);
    return () => {};
  }
  const baseQuery = getBaseNotificationsQuery(userId);
  const preferredQuery = getPreferredNotificationsQuery(userId);
  let fallbackUnsubscribe: (() => void) | null = null;
  const endMetric = beginTrackedSubscription({
    screenName: metrics?.screenName,
    source: metrics?.source || 'notifications:subscription',
  });

  const emitSnapshot = (snapshot: any) => {
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: `${metrics?.source || 'notifications:subscription'}:snapshot`,
    });
    callback(sortAndCapNotifications(mapNotificationSnapshot(snapshot)));
  };

  const preferredUnsubscribe = onSnapshot(preferredQuery, emitSnapshot, (error: any) => {
    if (error?.code === 'permission-denied') {
      // Silently ignore — triggered when auth token not yet active (cached user race)
      console.warn('[subscribeToNotifications] permission-denied, will retry on next auth');
      callback([]);
      return;
    }
    if (!fallbackUnsubscribe) {
      fallbackUnsubscribe = onSnapshot(baseQuery, emitSnapshot, (fallbackError: any) => {
        if (fallbackError?.code === 'permission-denied') {
          callback([]);
          return;
        }
        console.error('Notification fallback subscription error:', fallbackError);
        callback([]);
      });
      return;
    }
    console.error('Notification subscription error:', error);
    callback([]);
  });

  return () => {
    endMetric();
    preferredUnsubscribe();
    if (fallbackUnsubscribe) {
      fallbackUnsubscribe();
    }
  };
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
    if (!isAuthUser(userId)) return;

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
    if (!isAuthUser(userId)) return;

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
    if (!isAuthUser(userId)) return 0;

    try {
      const q = query(
        collection(db, NOTIFICATIONS_COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch {
      const snapshot = await getNotificationsSnapshotWithFallback(userId);
      return mapNotificationSnapshot(snapshot).filter((item) => item.isRead === false).length;
    }
  } catch (error: any) {
    if (error?.code === 'permission-denied') return 0; // auth not ready yet
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
  const fn = httpsCallable(getFunctions(), 'notifyNewApplicant');
  await fn({ hospitalUserId, applicantName, jobTitle, applicationId, jobId });
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
  const fn = httpsCallable(getFunctions(), 'notifyApplicationStatus');
  await fn({ nurseUserId, jobTitle, hospitalName, status, applicationId, jobId });
}

// Helper: Send new message notification
export async function notifyNewMessage(
  userId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  const fn = httpsCallable(getFunctions(), 'notifyNewMessage');
  await fn({ userId, senderName, messagePreview, conversationId });
}

// Helper: แจ้งเตือนผลการตรวจสอบใบประกอบวิชาชีพ
export async function notifyLicenseVerification(
  userId: string,
  status: 'approved' | 'rejected',
  reason?: string
): Promise<void> {
  console.warn('[notifyLicenseVerification] client-side verification notifications are disabled; rely on Firestore triggers in Cloud Functions', {
    userId,
    status,
    reason,
  });
}
