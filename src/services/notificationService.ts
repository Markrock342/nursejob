// ============================================
// NOTIFICATION SERVICE - Push Notifications
// ============================================

import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Guarded, synchronous require to avoid crashing in Expo Go when native module
// is not included. If not available, `Notifications` will be `null` and all
// functions become safe no-ops or return null.
let Notifications: any | null = undefined;
function getNotificationsSync() {
  if (Notifications !== undefined) return Notifications;
  try {
    // use require so Metro doesn't include an unresolved import at bundle time
    // when running in Expo Go without the native module.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require('expo-notifications');
  } catch (e) {
    Notifications = null;
    console.warn('expo-notifications not available in this environment. Notification functions will be no-ops.');
  }
  return Notifications;
}
import { doc, updateDoc } from 'firebase/firestore';
import app, { db } from '../config/firebase';
import { isAuthUser } from './security/authGuards';

// Ensure Firebase is initialized (for push notification context)
if (!app) {
  throw new Error('FirebaseApp is not initialized. Make sure to call initializeApp before using notificationService.');
}

// Configure notification behavior if available
const _Notifications = getNotificationsSync();
if (_Notifications) {
  try {
    _Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.warn('Failed to configure notification handler:', e);
  }
}

// ==========================================
// Register for Push Notifications
// ==========================================
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const N = getNotificationsSync();
  if (!N) return null; // Not available in this environment

  let token: string | null = null;

  // Expo Go (SDK 53+) no longer supports remote push notifications.
  if ((Constants as any)?.appOwnership === 'expo') {
    console.warn('Push token registration skipped in Expo Go. Use a development build for remote push.');
    return null;
  }

  // Skip on web - push notifications not fully supported
  if (Platform.OS === 'web') {
    if (__DEV__) console.log('Push notifications not supported on web');
    return null;
  }

  // Check if physical device (required for push notifications)
  if (!Device.isDevice) {
    if (__DEV__) console.log('Push notifications require a physical device');
    return null;
  }

  // Check and request permissions
  const { status: existingStatus } = await N.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await N.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    if (__DEV__) console.log('Push notification permission not granted');
    return null;
  }

  try {
    // Attempt to derive a projectId from environment or app config if provided.
    // Prefer `EXPO_PUBLIC_PROJECT_ID` (EAS public env) then fall back to expo constants.
    let manifestExtraProjectId = undefined;
    if (Constants?.manifest && typeof Constants.manifest === 'object' && 'extra' in Constants.manifest) {
      manifestExtraProjectId = (Constants.manifest as any).extra?.projectId;
    }
    const envProjectId = process.env.EXPO_PUBLIC_PROJECT_ID || manifestExtraProjectId || (Constants?.expoConfig?.extra as any)?.projectId;
    const options: any = {};
    if (envProjectId) options.projectId = envProjectId;

    // Get Expo push token (omit projectId if not available to avoid invalid UUID errors)
    const tokenData = await N.getExpoPushTokenAsync(Object.keys(options).length ? options : undefined);
    token = tokenData.data;
    if (__DEV__) console.log('Push token:', token);
  } catch (error: any) {
    // If the server complains about projectId being invalid, log a helpful hint
    if (error?.message?.includes?.('projectId')) {
      console.warn('Failed to get Expo push token: invalid or missing projectId. Remove hard-coded projectId or set EXPO_PUBLIC_PROJECT_ID.');
    }
    const msg = String(error?.message || '');
    if (msg.includes('Expo Go') || msg.includes('remote notifications')) {
      console.warn('Remote push token is unavailable in Expo Go.');
      return null;
    }
    console.error('Error getting push token:', error);
    return null;
  }

  // Configure Android channel
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('default', {
      name: 'default',
      importance: N.AndroidImportance?.MAX ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
    });

    // Create separate channels for different notification types
    await N.setNotificationChannelAsync('messages', {
      name: 'ข้อความ',
      description: 'การแจ้งเตือนข้อความใหม่',
      importance: N.AndroidImportance?.HIGH ?? 3,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4ECDC4',
      sound: 'default',
    });

    await N.setNotificationChannelAsync('jobs', {
      name: 'งานใหม่',
      description: 'การแจ้งเตือนเมื่อมีงานใหม่',
      importance: N.AndroidImportance?.DEFAULT ?? 2,
      lightColor: '#FF6B6B',
    });

    await N.setNotificationChannelAsync('applications', {
      name: 'ผู้สมัครงาน',
      description: 'การแจ้งเตือนเมื่อมีผู้สนใจงาน',
      importance: N.AndroidImportance?.HIGH ?? 3,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#45B7D1',
    });
  }

  return token;
}

// ==========================================
// Save Push Token to User Profile
// ==========================================
export async function savePushTokenToUser(userId: string, token: string): Promise<void> {
  try {
    if (!isAuthUser(userId)) {
      console.warn('[savePushTokenToUser] skipped: uid mismatch or not authenticated');
      return;
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      pushToken: token,
      pushTokenUpdatedAt: new Date(),
    });
    if (__DEV__) console.log('Push token saved to user profile');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

// ==========================================
// Local Notifications (for testing)
// ==========================================
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channelId: string = 'default'
): Promise<void> {
  const N = getNotificationsSync();
  if (!N) return;
  await N.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: 'default',
    },
    trigger: null, // null = immediate
  });
}

// ==========================================
// Send New Message Notification
// ==========================================
export async function sendMessageNotification(
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  await sendLocalNotification(
    `ข้อความจาก ${senderName}`,
    messagePreview,
    { type: 'message', conversationId },
    'messages'
  );
}

// ==========================================
// Send New Job Notification
// ==========================================
export async function sendNewJobNotification(
  jobTitle: string,
  location: string,
  jobId: string
): Promise<void> {
  await sendLocalNotification(
    'งานใหม่',
    `${jobTitle} - ${location}`,
    { type: 'job', jobId },
    'jobs'
  );
}

// ==========================================
// Send Application Notification (for job posters)
// ==========================================
export async function sendApplicationNotification(
  applicantName: string,
  jobTitle: string,
  applicationId: string
): Promise<void> {
  await sendLocalNotification(
    'มีผู้สนใจงาน',
    `${applicantName} สนใจงาน "${jobTitle}"`,
    { type: 'application', applicationId },
    'applications'
  );
}

// ==========================================
// Notification Listeners
// ==========================================
export function addNotificationReceivedListener(
  callback: (notification: any) => void
) {
  const N = getNotificationsSync();
  if (!N) return { remove: () => {} };
  return N.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: any) => void
) {
  const N = getNotificationsSync();
  if (!N) return { remove: () => {} };
  return N.addNotificationResponseReceivedListener(callback);
}

// ==========================================
// Get Badge Count
// ==========================================
export async function getBadgeCount(): Promise<number> {
  const N = getNotificationsSync();
  if (!N) return 0;
  return await N.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  const N = getNotificationsSync();
  if (!N) return;
  await N.setBadgeCountAsync(count);
}

// ==========================================
// Clear All Notifications
// ==========================================
export async function clearAllNotifications(): Promise<void> {
  const N = getNotificationsSync();
  if (!N) return;
  await N.dismissAllNotificationsAsync();
  await setBadgeCount(0);
}
