// ============================================
// COMMON COMPONENTS - Production Ready
// ============================================

import React, { useState, ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Image,
  ViewStyle,
  TextStyle,
  TextInputProps,
  Pressable,
  ImageStyle,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// ============================================
// BUTTON
// ============================================
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantColors = {
    primary: { bg: colors.primary, border: colors.primary, fg: colors.white },
    secondary: { bg: colors.secondary, border: colors.secondary, fg: colors.white },
    outline: { bg: 'transparent', border: colors.primary, fg: colors.primary },
    ghost: { bg: 'transparent', border: 'transparent', fg: colors.primary },
    danger: { bg: colors.danger, border: colors.danger, fg: colors.white },
  }[variant];

  const buttonStyles = [
    styles.button,
    styles[`button_${size}`],
    {
      backgroundColor: variantColors.bg,
      borderColor: variantColors.border,
      borderWidth: variant === 'outline' ? 1 : 0,
    },
    fullWidth && styles.buttonFullWidth,
    isDisabled && styles.buttonDisabled,
    style,
  ];

  const textStyles = [
    styles.buttonText,
    styles[`buttonText_${size}`],
    { color: variantColors.fg },
    isDisabled && styles.buttonTextDisabled,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator 
          color={variantColors.fg} 
          size="small" 
        />
      ) : (
        <View style={styles.buttonContent}>
          {icon && iconPosition === 'left' && (
            <View style={styles.iconLeft}>{typeof icon === 'string' || typeof icon === 'number' ? <Text>{icon}</Text> : icon}</View>
          )}
          <Text style={textStyles}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <View style={styles.iconRight}>{typeof icon === 'string' || typeof icon === 'number' ? <Text>{icon}</Text> : icon}</View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

// ============================================
// INPUT
// ============================================
interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  containerStyle?: ViewStyle;
  required?: boolean;
}

export function Input({
  label,
  error,
  icon,
  iconPosition = 'left',
  containerStyle,
  required,
  style,
  multiline,
  editable,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const { colors } = useTheme();

  return (
    <View style={[styles.inputContainer, containerStyle]}>
      {label && (
        <Text style={[styles.inputLabel, { color: colors.text }]}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      <View style={[
        styles.inputWrapper,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isFocused && [styles.inputWrapperFocused, { borderColor: colors.primary }],
        error && styles.inputWrapperError,
      ]}>
        {icon && iconPosition === 'left' && (
          <View style={styles.inputIcon}>{typeof icon === 'string' || typeof icon === 'number' ? <Text>{icon}</Text> : icon}</View>
        )}
        <TextInput
          style={[
            styles.input,
            { color: colors.text },
            icon && iconPosition === 'left' ? styles.inputWithIconLeft : undefined,
            icon && iconPosition === 'right' ? styles.inputWithIconRight : undefined,
            multiline && styles.inputMultiline,
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline={Boolean(multiline)}
          editable={editable !== false}
          {...props}
        />
        {icon && iconPosition === 'right' && (
          <View style={styles.inputIcon}>{typeof icon === 'string' || typeof icon === 'number' ? <Text>{icon}</Text> : icon}</View>
        )}
      </View>
      {error && <Text style={styles.inputError}>{error}</Text>}
    </View>
  );
}

// ============================================
// CARD
// ============================================
interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
  shadow?: boolean;
}

export function Card({ children, onPress, style, padding = SPACING.md, shadow = true }: CardProps) {
  const { colors, isDark } = useTheme();
  const cardContent = (
    <View style={[
      styles.card,
      shadow && SHADOWS.medium,
      { padding },
      {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        shadowColor: isDark ? '#000000' : '#0F172A',
      },
      style,
    ]}>
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
}

// ============================================
// AVATAR
// ============================================
interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  style?: ImageStyle;
}

export function Avatar({ uri, name, size = 50, style }: AvatarProps) {
  const { colors } = useTheme();
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
          style,
        ] as ImageStyle[]}
      />
    );
  }

  return (
    <View style={[
      styles.avatarPlaceholder,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary },
    ]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

// ============================================
// BADGE
// ============================================
interface BadgeProps {
  text: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export function Badge({ text, variant = 'primary', size = 'medium', style }: BadgeProps) {
  const { colors } = useTheme();
  const variantColors = {
    primary: { bg: colors.primaryLight, fg: colors.primaryDark },
    secondary: { bg: colors.secondaryLight, fg: colors.secondaryDark },
    success: { bg: colors.successLight, fg: colors.success },
    warning: { bg: colors.warningLight, fg: colors.warning },
    danger: { bg: colors.dangerLight, fg: colors.danger },
    info: { bg: colors.infoLight, fg: colors.info },
  }[variant];

  return (
    <View style={[
      styles.badge,
      styles[`badge_${size}`],
      { backgroundColor: variantColors.bg },
      style,
    ]}>
      <Text style={[styles.badgeText, styles[`badgeText_${size}`], { color: variantColors.fg }]}>{text}</Text>
    </View>
  );
}

// ============================================
// LOADING
// ============================================
interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  message?: string; // Alias for text
  fullScreen?: boolean;
}

export function Loading({ size = 'large', color = COLORS.primary, text, message, fullScreen = false }: LoadingProps) {
  const { colors } = useTheme();
  const displayText = text || message;
  if (fullScreen) {
    return (
      <View style={[styles.loadingFullScreen, { backgroundColor: colors.background }]}> 
        <ActivityIndicator size={size} color={color || colors.primary} />
        {displayText && <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{displayText}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size={size} color={color || colors.primary} />
      {displayText && <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{displayText}</Text>}
    </View>
  );
}

// ============================================
// MODAL
// ============================================
interface ModalContainerProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  showCloseButton?: boolean;
  fullScreen?: boolean;
}

export function ModalContainer({
  visible,
  onClose,
  title,
  children,
  showCloseButton = true,
  fullScreen = false,
}: ModalContainerProps) {
  const { colors, isDark } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent={fullScreen ? false : true}
      animationType={fullScreen ? 'slide' : 'slide'}
      onRequestClose={onClose}
    >
      {fullScreen ? (
        <SafeAreaView style={[styles.modalFullScreen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
          {title && (
            <View style={[styles.modalFullScreenHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              {showCloseButton && (
                <TouchableOpacity onPress={onClose} style={styles.modalCloseButton}>
                  <Text style={[styles.modalCloseText, { color: colors.text }]}>✕</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.modalFullScreenTitle, { color: colors.text }]}>{title}</Text>
              <View style={{ width: 44 }} />
            </View>
          )}
          <View style={styles.modalFullScreenContent}>
            {typeof children === 'string' ? <Text>{children}</Text> : children}
          </View>
        </SafeAreaView>
      ) : (
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={[styles.modalOverlay, { backgroundColor: isDark ? colors.overlay : 'rgba(0, 0, 0, 0.5)' }]} onPress={onClose}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              {title && (
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
                  {showCloseButton && (
                    <TouchableOpacity onPress={onClose}>
                      <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}

// ============================================
// EMPTY STATE
// ============================================
interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  subtitle?: string; // Alias for description
  actionText?: string;
  actionLabel?: string; // Alias for actionText
  onAction?: () => void;
}

export function EmptyState({ icon = '📭', title, description, subtitle, actionText, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  const displayDescription = description || subtitle;
  const displayActionText = actionText || actionLabel;
  
  // Check if icon is Ionicons name (contains '-') or emoji
  const isIoniconName = icon.includes('-') || icon.includes('outline');
  
  return (
    <View style={styles.emptyState}>
      {isIoniconName ? (
        <View style={styles.emptyStateIconContainer}>
          <Ionicons name={icon as any} size={64} color={colors.textMuted} />
        </View>
      ) : (
        <Text style={styles.emptyStateIcon}>{icon}</Text>
      )}
      <Text style={[styles.emptyStateTitle, { color: colors.text }]}>{title}</Text>
      {displayDescription && <Text style={[styles.emptyStateDescription, { color: colors.textSecondary }]}>{displayDescription}</Text>}
      {displayActionText && onAction && (
        <Button title={displayActionText} onPress={onAction} variant="outline" size="small" />
      )}
    </View>
  );
}

// ============================================
// DIVIDER
// ============================================
interface DividerProps {
  text?: string;
  style?: ViewStyle;
}

export function Divider({ text, style }: DividerProps) {
  const { colors } = useTheme();
  if (text) {
    return (
      <View style={[styles.dividerContainer, style]}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>{text}</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>
    );
  }

  return <View style={[styles.divider, { backgroundColor: colors.border }, style]} />;
}

// ============================================
// CHIP / TAG
// ============================================
interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function Chip({ label, selected, onPress, icon, style }: ChipProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.backgroundSecondary,
          borderColor: selected ? colors.primary : colors.border,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={Boolean(!onPress)}
    >
      {icon && (
        <View style={styles.chipIcon}>{typeof icon === 'string' || typeof icon === 'number' ? <Text>{icon}</Text> : icon}</View>
      )}
      <Text style={[styles.chipText, { color: selected ? colors.white : colors.textSecondary }, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  // Button styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.md,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Button variants
  button_primary: {
    backgroundColor: COLORS.primary,
  },
  button_secondary: {
    backgroundColor: COLORS.secondary,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  button_ghost: {
    backgroundColor: 'transparent',
  },
  button_danger: {
    backgroundColor: COLORS.danger,
  },

  // Button sizes
  button_small: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    minHeight: 36,
  },
  button_medium: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    minHeight: 44,
  },
  button_large: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    minHeight: 52,
  },

  // Button text
  buttonText: {
    fontWeight: '600',
  },
  buttonTextDisabled: {
    opacity: 0.5,
  },
  buttonText_primary: {
    color: COLORS.white,
  },
  buttonText_secondary: {
    color: COLORS.white,
  },
  buttonText_outline: {
    color: COLORS.primary,
  },
  buttonText_ghost: {
    color: COLORS.primary,
  },
  buttonText_danger: {
    color: COLORS.white,
  },
  buttonText_small: {
    fontSize: FONT_SIZES.sm,
  },
  buttonText_medium: {
    fontSize: FONT_SIZES.md,
  },
  buttonText_large: {
    fontSize: FONT_SIZES.lg,
  },

  iconLeft: {
    marginRight: SPACING.xs,
  },
  iconRight: {
    marginLeft: SPACING.xs,
  },

  // Input styles
  inputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  required: {
    color: COLORS.danger,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  inputWrapperError: {
    borderColor: COLORS.danger,
  },
  input: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 48,
  },
  inputWithIconLeft: {
    paddingLeft: 0,
  },
  inputWithIconRight: {
    paddingRight: 0,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: SPACING.sm,
  },
  inputIcon: {
    paddingHorizontal: SPACING.sm,
  },
  inputError: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.xs,
  },

  // Card styles
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // Avatar styles
  avatar: {
    backgroundColor: COLORS.backgroundSecondary,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: '600',
  },

  // Badge styles
  badge: {
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  badge_primary: {
    backgroundColor: COLORS.primaryLight,
  },
  badge_secondary: {
    backgroundColor: COLORS.secondaryLight,
  },
  badge_success: {
    backgroundColor: '#dcfce7',
  },
  badge_warning: {
    backgroundColor: '#fef3c7',
  },
  badge_danger: {
    backgroundColor: '#fee2e2',
  },
  badge_info: {
    backgroundColor: '#dbeafe',
  },
  badge_small: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
  },
  badge_medium: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
  },
  badgeText: {
    fontWeight: '500',
  },
  badgeText_small: {
    fontSize: FONT_SIZES.xs,
  },
  badgeText_medium: {
    fontSize: FONT_SIZES.sm,
  },

  // Loading styles
  loadingContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  loadingFullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.sm,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    padding: 0,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    width: '100%',
    maxHeight: '85%',
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingBottom: Platform.OS === 'android' ? SPACING.xl : SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalClose: {
    fontSize: 20,
    color: COLORS.textSecondary,
  },
  modalFullScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalFullScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  modalFullScreenTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: COLORS.text,
  },
  modalFullScreenContent: {
    flex: 1,
  },

  // Empty state styles
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyStateIconContainer: {
    marginBottom: SPACING.md,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  emptyStateTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  emptyStateDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },

  // Divider styles
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    paddingHorizontal: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },

  // Chip styles
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipIcon: {
    marginRight: SPACING.xs,
  },
  chipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

// Re-export Common Components
export { ErrorBoundary } from './ErrorBoundary';
export { default as BrandSpinner } from './BrandSpinner';
export { LoadingOverlay, InlineLoading, ButtonLoading, Skeleton, JobCardSkeleton } from './LoadingOverlay';
export { default as ConfirmModal, SuccessModal, ErrorModal } from './ConfirmModal';
export { default as TermsConsentModal } from './TermsConsentModal';
export { default as BackButton } from './BackButton';
export { PlaceAutocomplete, QuickPlacePicker } from './PlaceAutocomplete';
export { default as CalendarPicker } from './CalendarPicker';
export { default as ProfileProgressBar } from './ProfileProgressBar';
export { default as FAB, SimpleFAB } from './FAB';
export { default as ThemePicker } from './ThemePicker';
export { default as KittenButton } from './KittenButton';
export { default as FirstVisitTip } from './FirstVisitTip';
export { default as StickyInboxPanel } from './StickyInboxPanel';
