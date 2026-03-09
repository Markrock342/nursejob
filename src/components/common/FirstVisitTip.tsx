import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { BORDER_RADIUS, FONT_SIZES, SPACING } from '../../theme';

interface FirstVisitTipProps {
  storageKey: string;
  title: string;
  description: string;
  icon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
  containerStyle?: ViewStyle;
  badgeText?: string;
}

export default function FirstVisitTip({
  storageKey,
  title,
  description,
  icon = 'bulb-outline',
  actionLabel = 'ดูคู่มือ',
  onAction,
  containerStyle,
  badgeText = 'ทิปสำหรับหน้านี้',
}: FirstVisitTipProps) {
  const { colors, isDark } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadSeenState = async () => {
      try {
        const value = await AsyncStorage.getItem(storageKey);
        if (isMounted) {
          setIsVisible(!value);
        }
      } catch (_) {
        if (isMounted) {
          setIsVisible(true);
        }
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    };

    loadSeenState();

    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  const markSeen = async () => {
    try {
      await AsyncStorage.setItem(storageKey, '1');
    } catch (_) {}
  };

  const handleDismiss = async () => {
    setIsVisible(false);
    await markSeen();
  };

  const handleAction = async () => {
    setIsVisible(false);
    await markSeen();
    onAction?.();
  };

  if (!isReady || !isVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.card : colors.surface,
          borderColor: colors.primary,
          shadowColor: isDark ? '#000000' : '#0F172A',
        },
        containerStyle,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryBackground }]}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>

        <View style={styles.headerTextWrap}>
          <View style={[styles.badge, { backgroundColor: colors.primaryBackground }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>{badgeText}</Text>
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>

        <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>

      <View style={styles.footerRow}>
        <TouchableOpacity onPress={handleDismiss} style={[styles.secondaryButton, { borderColor: colors.border }]}> 
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>เข้าใจแล้ว</Text>
        </TouchableOpacity>

        {onAction ? (
          <TouchableOpacity onPress={handleAction} style={[styles.primaryButton, { backgroundColor: colors.primary }]}> 
            <Text style={styles.primaryButtonText}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={14} color={colors.white} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    lineHeight: 22,
  },
  description: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SPACING.md,
  },
  secondaryButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
