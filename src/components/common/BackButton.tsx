// ============================================
// BACK BUTTON - For navigation
// ============================================

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface BackButtonProps {
  onPress?: () => void;
  label?: string;
  color?: string;
  style?: ViewStyle;
}

export default function BackButton({ 
  onPress, 
  label = 'ย้อนกลับ',
  color,
  style,
}: BackButtonProps) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const resolvedColor = color || colors.primary;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text style={[styles.arrow, { color: resolvedColor }]}>←</Text>
      <Text style={[styles.label, { color: resolvedColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  arrow: {
    fontSize: FONT_SIZES.lg,
    marginRight: SPACING.xs,
  },
  label: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
});
