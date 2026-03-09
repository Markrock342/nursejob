// ============================================
// PROFILE PROGRESS BAR COMPONENT
// ============================================

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

// User type for profile progress
interface User {
  photoURL?: string | null;
  displayName?: string | null;
  phone?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  isVerified?: boolean;
}

interface ProfileProgressBarProps {
  user: User | null;
  onPress?: () => void;
}

interface ProgressItem {
  key: string;
  label: string;
  icon: string;
  completed: boolean;
}

export default function ProfileProgressBar({ user, onPress }: ProfileProgressBarProps) {
  const { colors, isDark } = useTheme();
  if (!user) return null;

  // Calculate progress items
  const items: ProgressItem[] = [
    {
      key: 'photo',
      label: 'รูปโปรไฟล์',
      icon: 'camera-outline',
      completed: Boolean(user.photoURL),
    },
    {
      key: 'name',
      label: 'ชื่อ-สกุล',
      icon: 'person-outline',
      completed: Boolean(user.displayName && user.displayName.length > 3),
    },
    {
      key: 'phone',
      label: 'เบอร์โทร',
      icon: 'call-outline',
      completed: Boolean(user.phone),
    },
    {
      key: 'email',
      label: 'อีเมล',
      icon: 'mail-outline',
      completed: Boolean(user.email),
    },
    {
      key: 'license',
      label: 'ใบประกอบวิชาชีพ',
      icon: 'ribbon-outline',
      completed: Boolean(user.licenseNumber),
    },
    {
      key: 'verified',
      label: 'ยืนยันตัวตน',
      icon: 'shield-checkmark-outline',
      completed: Boolean(user.isVerified),
    },
  ];

  const completedCount = items.filter(item => item.completed).length;
  const totalItems = items.length;
  const progressPercent = Math.round((completedCount / totalItems) * 100);
  const panelBackground = isDark ? colors.surface : colors.white;
  const subtlePanel = isDark ? colors.card : colors.background;
  const completedTone = { background: colors.successLight, text: colors.success };
  const progressColor = progressPercent >= 80 ? colors.success : progressPercent >= 50 ? colors.warning : colors.error;

  // If 100% complete, show minimal view
  if (progressPercent === 100) {
    return (
      <View style={[styles.completedContainer, { backgroundColor: completedTone.background }]}> 
        <Ionicons name="checkmark-circle" size={18} color={completedTone.text} style={{ marginRight: 6 }} />
        <Text style={[styles.completedText, { color: completedTone.text }]}>โปรไฟล์สมบูรณ์แล้ว</Text>
      </View>
    );
  }

  // Get next incomplete item for suggestion
  const nextIncomplete = items.find(item => !item.completed);

  return (
    <TouchableOpacity 
      style={[styles.container, { backgroundColor: panelBackground, borderColor: colors.border }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>โปรไฟล์ของคุณ</Text>
        <Text style={[styles.percentText, { color: colors.primary }]}>{progressPercent}%</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBackground, { backgroundColor: colors.borderLight }]}>
          <View 
            style={[
              styles.progressFill,
              { width: `${progressPercent}%` },
              { backgroundColor: progressColor },
            ]} 
          />
        </View>
      </View>

      {/* Items */}
      <View style={styles.itemsContainer}>
        {items.map((item) => (
          <View 
            key={item.key} 
            style={[
              styles.item,
              { backgroundColor: subtlePanel, borderColor: colors.borderLight },
              item.completed && styles.itemCompleted,
              item.completed && { backgroundColor: colors.successLight, borderColor: colors.success },
            ]}
          >
            <Ionicons
              name={item.completed ? 'checkmark' : item.icon as any}
              size={16}
              color={item.completed ? colors.success : colors.textMuted}
            />
          </View>
        ))}
      </View>

      {/* Suggestion */}
      {nextIncomplete && (
        <View style={[styles.suggestion, { backgroundColor: colors.primaryBackground }]}> 
          <Ionicons name={nextIncomplete.icon as any} size={15} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.suggestionText, { color: colors.primary }]}>
            เพิ่ม{nextIncomplete.label}เพื่อโปรไฟล์ที่ดีขึ้น
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  completedContainer: {
    backgroundColor: '#D1FAE5',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#059669',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  percentText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressContainer: {
    marginBottom: SPACING.sm,
  },
  progressBackground: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  itemsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  item: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  itemCompleted: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  suggestionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    flex: 1,
  },
});
