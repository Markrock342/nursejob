// FAB — Google Docs style
// Main = round button (+/×)
// Actions = full pill (icon + label together), slide up with spring animation
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface FABAction {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

interface FABProps {
  icon?: string;
  mainIcon?: string;
  actions?: FABAction[];
  onPress?: () => void;
  size?: number;
  position?: 'bottomRight' | 'bottomLeft';
  style?: ViewStyle;
  badge?: number | null;
}

export default function FAB({
  icon = 'add',
  mainIcon,
  actions,
  onPress,
  size = 60,
  position = 'bottomRight',
  style,
  badge = null,
}: FABProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Item anim refs (max 5)
  const itemAnims = useRef(
    Array.from({ length: 5 }, () => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.7),
    }))
  ).current;

  useEffect(() => {
    const count = actions?.length ?? 0;

    if (open) {
      // Open: backdrop fade in + stagger items up
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        ...itemAnims.slice(0, count).map((a, i) =>
          Animated.sequence([
            Animated.delay(i * 40),
            Animated.parallel([
              Animated.spring(a.translateY, { toValue: -1, friction: 6, tension: 70, useNativeDriver: true }),
              Animated.spring(a.opacity,    { toValue: 1,  friction: 6, tension: 70, useNativeDriver: true }),
              Animated.spring(a.scale,      { toValue: 1,  friction: 6, tension: 70, useNativeDriver: true }),
            ]),
          ])
        ),
      ]).start();
    } else {
      // Close: all at once
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
        Animated.spring(anim, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
        ...itemAnims.slice(0, count).map(a =>
          Animated.parallel([
            Animated.timing(a.translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
            Animated.timing(a.opacity,    { toValue: 0, duration: 120, useNativeDriver: true }),
            Animated.timing(a.scale,      { toValue: 0.7, duration: 120, useNativeDriver: true }),
          ])
        ),
      ]).start();
    }
  }, [open]);

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  const toggle = () => {
    if (actions && actions.length > 0) {
      setOpen(v => !v);
    } else {
      onPress?.();
    }
  };

  const handleAction = (a: FABAction) => {
    setOpen(false);
    setTimeout(() => a.onPress(), 180); // let close animation finish first
  };

  const align = position === 'bottomLeft' ? 'flex-start' : 'flex-end';

  return (
    <>
      {/* Backdrop — always rendered, pointerEvents toggled so Android touch works */}
      <Pressable
        onPress={() => setOpen(false)}
        style={[StyleSheet.absoluteFillObject, { zIndex: 998 }]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Animated.View
          style={[StyleSheet.absoluteFillObject, styles.backdrop, { opacity: backdropOpacity }]}
        />
      </Pressable>

      <View
        pointerEvents="box-none"
        style={[styles.wrapper, { bottom: insets.bottom + SPACING.md, paddingHorizontal: SPACING.md, alignItems: align }]}
      >
        {/* Action pills — stacked above main FAB */}
        {actions?.map((a, i) => {
          // Bottom offset: each pill is 52px tall + 10px gap, stacked from bottom
          const count = actions.length;
          const bottomOffset = (count - i - 1) * 62 + size + 16;
          const aRef = itemAnims[i];

          return (
            <Animated.View
              key={i}
              style={[
                styles.actionContainer,
                {
                  bottom: bottomOffset,
                  opacity: aRef.opacity,
                  transform: [
                    { translateY: aRef.translateY.interpolate({ inputRange: [-1, 0], outputRange: [-8, 16] }) },
                    { scale: aRef.scale },
                  ],
                  alignSelf: align === 'flex-start' ? 'flex-start' : 'flex-end',
                },
              ]}
              pointerEvents={open ? 'auto' : 'none'}
            >
              <Pressable
                onPress={() => handleAction(a)}
                android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
                style={({ pressed }) => [
                  styles.actionPill,
                  {
                    backgroundColor: colors.surface,
                    shadowColor: isDark ? '#000000' : '#0F172A',
                  },
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                {/* Icon circle */}
                <View style={[styles.actionIconCircle, { backgroundColor: a.color || colors.primary }]}> 
                  <Ionicons name={a.icon as any} size={20} color={colors.white} />
                </View>
                {/* Label */}
                <Text style={[styles.actionLabel, { color: colors.text }]}>{a.label}</Text>
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <Animated.View style={[styles.fabWrap, { transform: [{ scale: pressScale }] }, style]}>
          <Pressable
            onPress={toggle}
            onPressIn={() => Animated.spring(pressScale, { toValue: 0.91, useNativeDriver: true }).start()}
            onPressOut={() => Animated.spring(pressScale, { toValue: 1,    useNativeDriver: true }).start()}
            android_ripple={{ color: 'rgba(255,255,255,0.18)', borderless: true }}
            style={[styles.fab, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, shadowColor: colors.primary }]}
            accessibilityLabel="Floating action button"
          >
            <Animated.View style={{ transform: [{ rotate }] }}>
              <Ionicons name={(mainIcon || icon) as any} size={Math.round(size * 0.42)} color={colors.white} />
            </Animated.View>
            {typeof badge === 'number' && badge > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}

// SimpleFAB — unchanged for compatibility
export function SimpleFAB({
  icon = 'add',
  onPress,
  color = COLORS.primary,
  size = 56,
  position = 'bottomRight',
  style,
}: {
  icon?: string;
  onPress: () => void;
  color?: string;
  size?: number;
  position?: 'bottomRight' | 'bottomLeft';
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + SPACING.md, paddingHorizontal: SPACING.md, alignItems: position === 'bottomLeft' ? 'flex-start' : 'flex-end' }]}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true }}
        style={[styles.fab, { backgroundColor: color || colors.primary, width: size, height: size, borderRadius: size / 2, shadowColor: color || colors.primary }, style]}
      >
        <Ionicons name={icon as any} size={Math.round(size * 0.42)} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 998,
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 999,
    elevation: 20,
  },
  fabWrap: {
    elevation: 20,
    zIndex: 1001,
  },
  fab: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 20,
  },
  // Action items positioned absolutely above main FAB
  actionContainer: {
    position: 'absolute',
    zIndex: 1000,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingLeft: 6,
    paddingRight: 20,
    paddingVertical: 6,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 6,
    minWidth: 160,
  },
  actionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#1E293B',
    flexShrink: 1,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});