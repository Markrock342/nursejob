// Modern FAB — redesigned: animated scale, subtle gradient, elevated shadow, optional actions
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS, SHADOWS, FONT_SIZES } from '../../theme';

interface FABAction {
  icon: string;
  label?: string;
  onPress: () => void;
  color?: string;
}

interface FABProps {
  icon?: string;
  mainIcon?: string;
  actions?: FABAction[];
  onPress?: () => void;
  size?: 100 | 64; // diameter
  position?: 'bottomRight' | 'bottomLeft';
  style?: ViewStyle;
  badge?: number | null;
}

export default function FAB({
  icon = 'add',
  mainIcon,
  actions,
  onPress,
  size = 64,
  position = 'bottomRight',
  style,
  badge = null,
}: FABProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: open ? 1 : 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.94, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true }).start();
  };

  

  // Animated derived values
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  // New toggle: always call onPress if provided, and still toggle actions if any
  const toggle = () => {
    // Call passed onPress (navigation/actions) synchronously
    if (onPress) onPress();
    if (actions && actions.length > 0) setOpen((v) => !v);
  };

  const horizontalAlign = position === 'bottomLeft' ? 'flex-start' : 'flex-end';

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          left: 0,
          right: 0,
          bottom: insets.bottom + SPACING.sm,
          paddingHorizontal: SPACING.md,
          alignItems: horizontalAlign,
        },
      ]}
    >
      {/* Action stack */}
      {actions && actions.map((a, i) => {
        const offset = (i + 1) * (size + 12);
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -offset] });
        const opacity = anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.6, 1] });

        return (
          <Animated.View
            key={i}
            style={[
              styles.actionRow,
              { transform: [{ translateY }], opacity },
              position === 'bottomLeft' ? { left: SPACING.md } : { right: SPACING.md },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() => { setOpen(false); a.onPress(); }}
              android_ripple={{ color: 'rgba(255,255,255,0.08)', borderless: true }}
              hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
              style={styles.actionPressable}
            >
              {a.label ? (
                <View style={styles.actionLabelBox}>
                  <Text style={styles.actionLabelText}>{a.label}</Text>
                </View>
              ) : null}

              <View style={[styles.smallButton, { backgroundColor: a.color || COLORS.primary }]}>
                <Ionicons name={a.icon as any} size={20} color="#fff" />
              </View>
            </Pressable>
          </Animated.View>
        );
      })}

      {/* Main FAB */}
      <Animated.View style={{ transform: [{ scale: pressScale }], elevation: 20, zIndex: 1000 }}>
        <Pressable
          onPress={toggle}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
          hitSlop={{ top: 28, left: 28, right: 28, bottom: 28 }}
          accessibilityLabel="Floating action button"
          style={({ pressed }) => [
            styles.fab,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: COLORS.primary,
              ...SHADOWS.large,
            },
            style,
          ]}
        >
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name={(mainIcon || icon) as any} size={Math.round(size * 0.45)} color="#fff" />
          </Animated.View>

          {typeof badge === 'number' && badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 99 ? '99+' : String(badge)}</Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// SimpleFAB alias — kept for compatibility
export function SimpleFAB({ icon = 'add', onPress, color = COLORS.primary, size = 56, position = 'bottomRight', style, }: { icon?: string; onPress: () => void; color?: string; size?: number; position?: 'bottomRight' | 'bottomLeft'; style?: ViewStyle }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + SPACING.sm, pointerEvents: 'box-none', paddingHorizontal: SPACING.md, alignItems: position === 'bottomLeft' ? 'flex-start' : 'flex-end', elevation: 20, zIndex: 1000 }}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
        hitSlop={{ top: 28, left: 28, right: 28, bottom: 28 }}
        style={[
          styles.fab,
          { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
          style,
        ]}
      >
        <Ionicons name={icon as any} size={Math.round(size * 0.45)} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 999,
    elevation: 30,
  },
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    right: 0,
    marginBottom: 8,
  },
  actionPressable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  smallButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionLabelBox: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    marginRight: 8,
    ...SHADOWS.sm,
  },
  actionLabelText: {
    color: COLORS.text,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.danger,
    paddingHorizontal: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
