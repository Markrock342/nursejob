// ============================================
// LOADING OVERLAY - Fullscreen Loading State
// ============================================

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import BrandSpinner from './BrandSpinner';

// ============================================
// Types
// ============================================
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
}

// ============================================
// Component
// ============================================
export function LoadingOverlay({ 
  visible, 
  message = 'กำลังโหลด...', 
  transparent = true 
}: LoadingOverlayProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (visible && typeof document !== 'undefined') {
      try {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body) active.blur();
      } catch (e) {}
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={transparent}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay} accessibilityViewIsModal={true}>
        <View style={styles.container}>
          <BrandSpinner size={56} color={colors.accentLight} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

// ============================================
// Inline Loading (ใช้ในส่วนเล็กๆ)
// ============================================
interface InlineLoadingProps {
  message?: string;
  size?: 'small' | 'large';
}

export function InlineLoading({ message, size = 'small' }: InlineLoadingProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const spinnerSize = size === 'large' ? 46 : 26;
  return (
    <View style={styles.inlineContainer}>
      <BrandSpinner size={spinnerSize} color={colors.accent} />
      {message && <Text style={styles.inlineMessage}>{message}</Text>}
    </View>
  );
}

// ============================================
// Button Loading State
// ============================================
interface ButtonLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export function ButtonLoading({ loading, children, loadingText }: ButtonLoadingProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (loading) {
    return (
      <View style={styles.buttonLoading}>
        <BrandSpinner size={20} color={colors.white} />
        {loadingText && <Text style={styles.buttonLoadingText}>{loadingText}</Text>}
      </View>
    );
  }
  return <>{children}</>;
}

// ============================================
// Skeleton Loading (Placeholder)
// ============================================
interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style 
}: SkeletonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

// ============================================
// Job Card Skeleton
// ============================================
export function JobCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.cardSkeleton}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <Skeleton width="60%" height={16} />
          <Skeleton width="40%" height={12} style={{ marginTop: 4 }} />
        </View>
      </View>
      <Skeleton width="80%" height={18} style={{ marginTop: 12 }} />
      <Skeleton width="100%" height={14} style={{ marginTop: 8 }} />
      <Skeleton width="50%" height={14} style={{ marginTop: 4 }} />
      <View style={styles.cardFooter}>
        <Skeleton width={80} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

// ============================================
// Styles
// ============================================
const createStyles = (COLORS: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  message: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  inlineMessage: {
    marginLeft: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLoadingText: {
    marginLeft: SPACING.sm,
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
  },
  skeleton: {
    backgroundColor: COLORS.backgroundSecondary,
  },
  cardSkeleton: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
});

// ============================================
// Export
// ============================================
export default {
  LoadingOverlay,
  InlineLoading,
  ButtonLoading,
  Skeleton,
  JobCardSkeleton,
};
