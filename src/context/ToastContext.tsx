// ============================================
// TOAST CONTEXT - Beautiful Toast Messages
// ============================================

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../theme';
import { useTheme } from './ThemeContext';

// ============================================
// Types
// ============================================
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastConfig {
  message: string;
  title?: string;
  type?: ToastType;
  duration?: number;
  onPress?: () => void;
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
  // Shorthand methods
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

// ============================================
// Context
// ============================================
const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ============================================
// Provider
// ============================================
interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setToast(null);
    });
  }, [fadeAnim, translateY]);

  const showToast = useCallback((config: ToastConfig) => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setToast(config);
    setVisible(true);

    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide
    const duration = config.duration || 3000;
    timeoutRef.current = setTimeout(hideToast, duration);
  }, [fadeAnim, translateY, hideToast]);

  // Shorthand methods
  const success = useCallback((message: string, title?: string) => {
    showToast({ message, title: title || 'สำเร็จ!', type: 'success' });
  }, [showToast]);

  const error = useCallback((message: string, title?: string) => {
    showToast({ message, title: title || 'เกิดข้อผิดพลาด', type: 'error' });
  }, [showToast]);

  const info = useCallback((message: string, title?: string) => {
    showToast({ message, title, type: 'info' });
  }, [showToast]);

  const warning = useCallback((message: string, title?: string) => {
    showToast({ message, title: title || 'แจ้งเตือน', type: 'warning' });
  }, [showToast]);

  // Get icon and colors based on type
  const getToastStyle = (type: ToastType = 'info') => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          backgroundColor: colors.success,
          iconColor: colors.white,
        };
      case 'error':
        return {
          icon: 'close-circle' as const,
          backgroundColor: colors.error,
          iconColor: colors.white,
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          backgroundColor: colors.warning,
          iconColor: colors.white,
        };
      case 'info':
      default:
        return {
          icon: 'information-circle' as const,
          backgroundColor: colors.primary,
          iconColor: colors.white,
        };
    }
  };

  const toastStyle = toast ? getToastStyle(toast.type) : getToastStyle('info');

  return (
    <ToastContext.Provider value={{ showToast, hideToast, success, error, info, warning }}>
      {children}
      
      {visible && toast && (
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY }],
              top: insets.top + SPACING.sm,
              backgroundColor: toastStyle.backgroundColor,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.content}
            activeOpacity={0.9}
            onPress={() => {
              if (toast.onPress) {
                toast.onPress();
              }
              hideToast();
            }}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={toastStyle.icon} size={28} color={toastStyle.iconColor} />
            </View>
            <View style={styles.textContainer}>
              {toast.title && (
                <Text style={[styles.title, { color: colors.white }]}>{toast.title}</Text>
              )}
              <Text style={[styles.message, { color: 'rgba(255,255,255,0.9)' }]} numberOfLines={2}>{toast.message}</Text>
            </View>
            <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 9999,
    borderRadius: BORDER_RADIUS.lg,
    ...SHADOWS.large,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  message: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  closeButton: {
    padding: SPACING.xs,
    marginLeft: SPACING.sm,
  },
});
