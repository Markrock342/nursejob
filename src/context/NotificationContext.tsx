// ============================================
// NOTIFICATION CONTEXT - Push Notification Manager
// ============================================

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from './AuthContext';
import {
  registerForPushNotificationsAsync,
  savePushTokenToUser,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  clearLastNotificationResponseAsync,
  clearAllNotifications,
  getLastNotificationResponseAsync,
} from '../services/notificationService';
import { navigateFromNotification } from '../services/notificationNavigation';
import { setBroadcastAttribution, trackEvent } from '../services/analyticsService';
import { recordBroadcastOpen } from '../services/adminService';
import { Notification, subscribeToNotifications } from '../services/notificationsService';
import { loadAppSettings } from '../services/settingsService';
import { COLORS, BORDER_RADIUS, SHADOWS, SPACING, FONT_SIZES } from '../theme';

// ==========================================
// Types
// ==========================================
interface NotificationContextType {
  expoPushToken: string | null;
  notification: any | null;
  hasPermission: boolean;
  registerForNotifications: () => Promise<void>;
  clearNotifications: () => Promise<void>;
}

// ==========================================
// Context
// ==========================================
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function InAppNotificationBanner({
  visible,
  title,
  body,
  onPress,
  onHide,
}: {
  visible: boolean;
  title: string;
  body: string;
  onPress: () => void;
  onHide: () => void;
}) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(onHide);
    }, 4200);

    return () => clearTimeout(timer);
  }, [opacity, onHide, translateY, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.bannerWrap, { opacity, transform: [{ translateY }] }]}> 
      <TouchableOpacity style={styles.bannerCard} activeOpacity={0.92} onPress={onPress}>
        <View style={styles.bannerIconWrap}>
          <Text style={styles.bannerIcon}>แจ้งเตือน</Text>
        </View>
        <View style={styles.bannerTextWrap}>
          <Text style={styles.bannerTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.bannerBody} numberOfLines={2}>{body}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ==========================================
// Provider
// ==========================================
interface NotificationProviderProps {
  children: ReactNode;
  navigation?: any;
  navigationReady?: boolean;
}

function getResponseKey(response: any): string {
  const request = response?.notification?.request;
  const data = request?.content?.data || {};
  return String(
    request?.identifier
    || [data?.type, data?.broadcastId, data?.conversationId, data?.jobId, data?.shiftId].filter(Boolean).join(':')
    || 'unknown'
  );
}

export function NotificationProvider({ children, navigation, navigationReady = false }: NotificationProviderProps) {
  const { user, isInitialized } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const notificationFeedReady = useRef(false);
  const pendingResponseRef = useRef<any | null>(null);
  const lastHandledResponseKeyRef = useRef<string>('');
  const isHandlingResponseRef = useRef(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerNotification, setBannerNotification] = useState<Notification | null>(null);

  const handleNotificationResponse = useCallback(async (response: any) => {
    const responseKey = getResponseKey(response);
    if (responseKey && lastHandledResponseKeyRef.current === responseKey) {
      return;
    }

    if (!navigation?.current || !navigationReady || !isInitialized) {
      pendingResponseRef.current = response;
      return;
    }

    if (isHandlingResponseRef.current) {
      pendingResponseRef.current = response;
      return;
    }

    isHandlingResponseRef.current = true;
    lastHandledResponseKeyRef.current = responseKey;

    try {
      const data = response.notification.request.content.data;
      console.log('Notification data:', data);

      if (data?.broadcastId) {
        setBroadcastAttribution({
          broadcastId: String(data.broadcastId),
          variantId: data?.variantId ? String(data.variantId) : undefined,
          targetScreen: data?.targetScreen ? String(data.targetScreen) : undefined,
        });
        await Promise.allSettled([
          recordBroadcastOpen({
            broadcastId: String(data.broadcastId),
            variantId: data?.variantId ? String(data.variantId) : undefined,
            targetScreen: data?.targetScreen ? String(data.targetScreen) : undefined,
          }),
          trackEvent({
            eventName: 'notification_opened',
            screenName: 'PushNotification',
            subjectType: 'broadcast',
            subjectId: String(data.broadcastId),
            props: {
              notificationType: data?.category || data?.type || 'admin_broadcast',
              broadcastId: String(data.broadcastId),
              variantId: data?.variantId ? String(data.variantId) : undefined,
              targetScreen: data?.targetScreen ? String(data.targetScreen) : undefined,
              source: 'push_tap',
            },
          }),
        ]);
      }

      await navigateFromNotification(navigation, {
        type: data?.type,
        data,
      }, user?.uid);
    } finally {
      isHandlingResponseRef.current = false;
    }
  }, [isInitialized, navigation, navigationReady, user?.uid]);

  // Register for push notifications when user logs in
  // Wait for isInitialized (real Firebase auth) before saving push token to Firestore
  useEffect(() => {
    if (user?.uid && isInitialized) {
      void (async () => {
        const settings = await loadAppSettings();
        if (settings.notifications.pushEnabled) {
          await registerForNotifications();
        }
      })();
    }
  }, [user?.uid, isInitialized]);

  // Set up notification listeners
  useEffect(() => {
    // Listen for incoming notifications (service will return a safe no-op if unavailable)
    notificationListener.current = addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      setNotification(notification);
    });

    // Listen for notification interactions
    responseListener.current = addNotificationResponseListener((response) => {
      console.log('Notification response:', response);
      void handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current?.remove) {
        try { notificationListener.current.remove(); } catch {}
      }
      if (responseListener.current?.remove) {
        try { responseListener.current.remove(); } catch {}
      }
    };
  }, [handleNotificationResponse]);

  useEffect(() => {
    let cancelled = false;

    const restoreLastResponse = async () => {
      try {
        const response = await getLastNotificationResponseAsync();
        if (!response || cancelled) return;
        pendingResponseRef.current = response;
      } catch (error) {
        console.warn('Failed to restore last notification response:', error);
      }
    };

    restoreLastResponse();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!pendingResponseRef.current || !navigationReady || !isInitialized) {
      return;
    }

    const pendingResponse = pendingResponseRef.current;
    pendingResponseRef.current = null;

    void handleNotificationResponse(pendingResponse).finally(() => {
      void clearLastNotificationResponseAsync();
    });
  }, [handleNotificationResponse, isInitialized, navigationReady]);

  useEffect(() => {
    if (!user?.uid || !isInitialized) return;

    const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
      if (!notificationFeedReady.current) {
        notifications.forEach((item) => seenNotificationIds.current.add(item.id));
        notificationFeedReady.current = true;
        return;
      }

      const toastCandidate = notifications.find((item) => ['new_applicant', 'new_review', 'job_completed_review'].includes(item.type) && !seenNotificationIds.current.has(item.id));

      notifications.forEach((item) => seenNotificationIds.current.add(item.id));

      if (toastCandidate) {
        setBannerNotification(toastCandidate);
        setBannerVisible(true);
      }
    });

    return () => {
      unsubscribe();
      notificationFeedReady.current = false;
      seenNotificationIds.current = new Set();
    };
  }, [isInitialized, user?.uid]);

  // Register for push notifications
  const registerForNotifications = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        setExpoPushToken(token);
        setHasPermission(true);

        // Save token to user profile in Firebase
        if (user?.uid) {
          await savePushTokenToUser(user.uid, token);
        }
      } else {
        setHasPermission(false);
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
      setHasPermission(false);
    }
  };

  // Clear all notifications
  const handleClearNotifications = async () => {
    await clearAllNotifications();
    setNotification(null);
  };

  const value: NotificationContextType = {
    expoPushToken,
    notification,
    hasPermission,
    registerForNotifications,
    clearNotifications: handleClearNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <InAppNotificationBanner
        visible={bannerVisible && !!bannerNotification}
        title={bannerNotification?.title || ''}
        body={bannerNotification?.body || ''}
        onHide={() => setBannerVisible(false)}
        onPress={async () => {
          if (!bannerNotification) return;
          setBannerVisible(false);
          await navigateFromNotification(navigation, {
            type: bannerNotification.type,
            data: bannerNotification.data,
          }, user?.uid);
        }}
      />
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 1000,
  },
  bannerCard: {
    backgroundColor: COLORS.text,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  bannerIconWrap: {
    marginRight: SPACING.sm,
  },
  bannerIcon: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  bannerTextWrap: {
    flex: 1,
  },
  bannerTitle: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerBody: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
  },
});

// ==========================================
// Hook
// ==========================================
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
