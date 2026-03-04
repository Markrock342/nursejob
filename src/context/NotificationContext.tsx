// ============================================
// NOTIFICATION CONTEXT - Push Notification Manager
// ============================================

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  registerForPushNotificationsAsync,
  savePushTokenToUser,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  clearAllNotifications,
} from '../services/notificationService';

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

// ==========================================
// Provider
// ==========================================
interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { user, isInitialized } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [hasPermission, setHasPermission] = useState(false);

  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  // Register for push notifications when user logs in
  // Wait for isInitialized (real Firebase auth) before saving push token to Firestore
  useEffect(() => {
    if (user?.uid && isInitialized) {
      registerForNotifications();
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
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current?.remove) {
        try { notificationListener.current.remove(); } catch {}
      }
      if (responseListener.current?.remove) {
        try { responseListener.current.remove(); } catch {}
      }
    };
  }, []);

  // Handle notification tap/response
  const handleNotificationResponse = (response: any) => {
    const data = response.notification.request.content.data;
    
    // TODO: Navigate based on notification type
    // This will be handled by the navigation container
    console.log('Notification data:', data);
    
    // Examples:
    // if (data.type === 'message') { navigate to chat }
    // if (data.type === 'job') { navigate to job detail }
    // if (data.type === 'application') { navigate to applicants }
  };

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
    </NotificationContext.Provider>
  );
}

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
