import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useScrollDirection } from '../context/ScrollDirectionContext';
import { useChatNotification } from '../context/ChatNotificationContext';

const TAB_BAR_HEIGHT = 56;

const TAB_CONFIG: Record<string, { focused: keyof typeof Ionicons.glyphMap; unfocused: keyof typeof Ionicons.glyphMap; label: string }> = {
  Home:     { focused: 'home',        unfocused: 'home-outline',        label: 'หน้าแรก'   },
  Chat:     { focused: 'chatbubbles', unfocused: 'chatbubbles-outline', label: 'ข้อความ'   },
  Schedule: { focused: 'calendar',    unfocused: 'calendar-outline',    label: 'ตารางงาน' },
  PostJob:  { focused: 'add-circle',  unfocused: 'add-circle-outline',  label: 'โพสต์'     },
  Profile:  { focused: 'person',      unfocused: 'person-outline',      label: 'โปรไฟล์'   },
};

export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { tabBarHidden, onScrollBack } = useScrollDirection();
  const { unreadCount } = useChatNotification();

  const totalHeight = TAB_BAR_HEIGHT + insets.bottom;

  const translateY = tabBarHidden.interpolate({
    inputRange: [0, 1],
    outputRange: [0, totalHeight],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: totalHeight,
          paddingBottom: insets.bottom,
          transform: [{ translateY }],
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const cfg = TAB_CONFIG[route.name];
        if (!cfg) return null;

        const iconName = isFocused ? cfg.focused : cfg.unfocused;
        const color = isFocused ? colors.primary : colors.textMuted;
        const badge = route.name === 'Chat' ? unreadCount : 0;

        const onPress = () => {
          onScrollBack();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tab}
            activeOpacity={0.75}
          >
            <View style={styles.iconWrap}>
              <Ionicons name={iconName} size={24} color={color} />
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error }]}>
                  <Text style={styles.badgeText}>{badge > 9 ? '9+' : String(badge)}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]}>{cfg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 4,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});
