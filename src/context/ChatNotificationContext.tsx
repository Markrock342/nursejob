// ============================================
// GLOBAL CHAT NOTIFICATION CONTEXT
// Shows toast on ALL screens except active ChatRoom
// ============================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Vibration,
} from 'react-native';
// Removed `expo-av` usage (replaced with vibration + web audio fallback)
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { getConversationRecipientInfo, subscribeToConversations } from '../services/chatService';
import { sendMessageNotification } from '../services/notificationService';
import { SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../theme';
import { Conversation } from '../types';

interface ChatNotificationContextType {
  unreadCount: number;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
}

interface ToastData {
  senderName: string;
  message: string;
  conversationId: string;
  recipientId: string;
  recipientPhoto: string;
  jobTitle: string;
  jobId: string;
}

const ChatNotificationContext = createContext<ChatNotificationContextType>({
  unreadCount: 0,
  activeConversationId: null,
  setActiveConversationId: () => {},
});

export const useChatNotification = () => useContext(ChatNotificationContext);

// Toast Notification Component
interface ToastProps {
  visible: boolean;
  senderName: string;
  message: string;
  onHide: () => void;
  onPress: () => void;
}

function GlobalToast({ visible, senderName, message, onHide, onPress }: ToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onHide());
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <TouchableOpacity 
        style={styles.toastContent}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={styles.toastIcon}>
          <Ionicons name="chatbubble-ellipses" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.toastTextContainer}>
          <Text style={styles.toastSender} numberOfLines={1}>{senderName}</Text>
          <Text style={styles.toastMessage} numberOfLines={2}>{message}</Text>
        </View>
        <TouchableOpacity onPress={hideToast} style={styles.toastCloseBtn}>
          <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface Props {
  children: React.ReactNode;
  navigation?: any;
}

export function ChatNotificationProvider({ children, navigation }: Props) {
  const { user, isInitialized } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState<ToastData>({ 
    senderName: '', 
    message: '',
    conversationId: '',
    recipientId: '',
    recipientPhoto: '',
    jobTitle: '',
    jobId: '',
  });
  
  // Store previous conversations to detect new messages
  const previousConversations = useRef<Map<string, { lastMessage: string; lastMessageAt: any }>>(new Map());
  const isFirstLoad = useRef(true);

  // Play notification sound/vibration
  const playSound = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        // Vibrate pattern on mobile: wait, vibrate, wait, vibrate (more noticeable)
        Vibration.vibrate([0, 150, 100, 150]);
        
        // We removed `expo-av` to avoid native-module issues in Expo Go.
        // For mobile devices we rely on vibration (most reliable across devices).
        // If you need richer audio notifications, install and use `expo-audio` or a
        // development build with the native module included.
      } else {
        // Web Audio API for web
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          // Two-tone notification sound
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.value = 0.15;
          
          oscillator.start();
          
          // First beep
          setTimeout(() => {
            oscillator.frequency.value = 1100;
          }, 100);
          
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          setTimeout(() => oscillator.stop(), 300);
        } catch (webAudioError) {
          console.log('Web audio not available');
        }
      }
    } catch (error) {
      console.log('Could not play notification:', error);
    }
  }, []);

  // Subscribe to all conversations
  useEffect(() => {
    // Wait for real Firebase auth token before subscribing
    if (!user?.uid || !isInitialized) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToConversations(user.uid, (conversations) => {
      // Calculate total unread
      let totalUnread = 0;
      
      conversations.forEach(conv => {
        // Count unread for this conversation - support both old and new format
        const unreadForConv = conv.unreadBy?.[user.uid] ?? conv.unreadCount ?? 0;
        totalUnread += unreadForConv;

        // Check for new messages (not first load, not active conversation)
        if (!isFirstLoad.current) {
          const prevConv = previousConversations.current.get(conv.id);
          
          // New message detected
          if (prevConv && 
              conv.lastMessage !== prevConv.lastMessage &&
              conv.id !== activeConversationId) {
            
            // Get sender name (the other participant)
            const otherParticipant = conv.participantDetails?.find(p => p.id !== user.uid);
            const senderName = otherParticipant?.name || 'ผู้ใช้';
            
            // Show toast
            const msgText = conv.lastMessage || 'ส่งข้อความใหม่';
            setToastData({
              senderName,
              message: msgText,
              conversationId: conv.id,
              recipientId: otherParticipant?.id || '',
              recipientPhoto: otherParticipant?.photoURL || '',
              jobTitle: conv.jobTitle || '',
              jobId: conv.jobId || '',
            });
            setShowToast(true);
            playSound();
            // Also fire a push notification (works in background)
            sendMessageNotification(senderName, msgText, conv.id).catch(() => {});
          }
        }

        // Update previous state
        previousConversations.current.set(conv.id, {
          lastMessage: conv.lastMessage || '',
          lastMessageAt: conv.lastMessageAt,
        });
      });

      setUnreadCount(totalUnread);
      isFirstLoad.current = false;
    });

    return () => unsubscribe();
  }, [user?.uid, isInitialized, activeConversationId, playSound]);

  // Handle toast press - navigate to chat
  const handleToastPress = useCallback(async () => {
    const navigator = navigation?.current ?? navigation;
    if (navigator && toastData.conversationId) {
      const conversationMeta = user?.uid
        ? await getConversationRecipientInfo(toastData.conversationId, user.uid)
        : null;

      navigator.navigate('ChatRoom', {
        conversationId: toastData.conversationId,
        recipientId: toastData.recipientId || conversationMeta?.recipientId,
        recipientName: toastData.senderName || conversationMeta?.recipientName,
        recipientPhoto: toastData.recipientPhoto || conversationMeta?.recipientPhoto,
        jobTitle: toastData.jobTitle || conversationMeta?.jobTitle,
        jobId: toastData.jobId || conversationMeta?.jobId,
      });
    }
    setShowToast(false);
  }, [navigation, toastData, user?.uid]);

  return (
    <ChatNotificationContext.Provider
      value={{
        unreadCount,
        activeConversationId,
        setActiveConversationId,
      }}
    >
      {children}
      
      {/* Global Toast - shows on all screens */}
      <GlobalToast
        visible={showToast}
        senderName={toastData.senderName}
        message={toastData.message}
        onHide={() => setShowToast(false)}
        onPress={handleToastPress}
      />
    </ChatNotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(14,165,233,0.3)',
    ...SHADOWS.lg,
  },
  toastIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastSender: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  toastMessage: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 16,
  },
  toastCloseBtn: {
    padding: 6,
    marginLeft: SPACING.xs,
  },
});
