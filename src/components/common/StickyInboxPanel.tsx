import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SHADOWS, SPACING } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { StickyInboxItem } from '../../services/communicationsService';

interface StickyInboxPanelProps {
  items: StickyInboxItem[];
  maxItems?: number;
  containerStyle?: StyleProp<ViewStyle>;
}

function getAccentColor(severity: StickyInboxItem['severity'], primary: string): string {
  switch (severity) {
    case 'critical':
      return COLORS.error;
    case 'warning':
      return COLORS.warning;
    case 'success':
      return COLORS.success;
    default:
      return primary;
  }
}

export default function StickyInboxPanel({
  items,
  maxItems = 3,
  containerStyle,
}: StickyInboxPanelProps) {
  const { colors } = useTheme();

  if (!items.length) return null;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {items.slice(0, maxItems).map((item) => {
        const accentColor = getAccentColor(item.severity, colors.primary);
        return (
          <View
            key={item.id}
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: `${accentColor}33`,
              },
            ]}
          >
            <View style={[styles.badge, { backgroundColor: `${accentColor}18` }]}>
              <Ionicons
                name={item.severity === 'critical' ? 'alert-circle-outline' : 'megaphone-outline'}
                size={16}
                color={accentColor}
              />
              <Text style={[styles.badgeText, { color: accentColor }]}>ประกาศด่วน</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={3}>
              {item.body}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  card: {
    borderRadius: BORDER_RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
});