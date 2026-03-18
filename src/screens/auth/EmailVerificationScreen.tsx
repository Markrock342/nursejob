// ============================================
// EMAIL VERIFICATION SCREEN
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { 
  sendVerificationEmail, 
  refreshEmailVerificationStatus,
  logoutUser 
} from '../../services/authService';
import { AuthStackParamList } from '../../types';

// ============================================
// Types
// ============================================
type EmailVerificationScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'EmailVerification'>;
type EmailVerificationScreenRouteProp = RouteProp<AuthStackParamList, 'EmailVerification'>;

interface Props {
  navigation: EmailVerificationScreenNavigationProp;
  route: EmailVerificationScreenRouteProp;
}

// ============================================
// Component
// ============================================
export default function EmailVerificationScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const email = route.params?.email || '';
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isChecking, setIsChecking] = useState(false);

  // Countdown for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-check verification status every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const verified = await refreshEmailVerificationStatus();
      if (verified) {
        clearInterval(interval);
        Alert.alert(
          'ยืนยันสำเร็จ! ✅',
          'Email ของคุณได้รับการยืนยันแล้ว',
          [
            {
              text: 'เข้าสู่ระบบ',
              onPress: () => navigation.replace('Login'),
            },
          ]
        );
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [navigation]);

  // Resend verification email
  const handleResendEmail = async () => {
    if (countdown > 0) return;

    setIsResending(true);
    try {
      await sendVerificationEmail();
      setCountdown(60); // 60 seconds cooldown
      Alert.alert('สำเร็จ', 'ส่ง email ยืนยันใหม่แล้ว กรุณาตรวจสอบกล่องจดหมาย');
    } catch (error: any) {
      Alert.alert('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถส่ง email ได้');
    } finally {
      setIsResending(false);
    }
  };

  // Manual check verification status
  const handleCheckVerification = async () => {
    setIsChecking(true);
    try {
      const verified = await refreshEmailVerificationStatus();
      if (verified) {
        Alert.alert(
          'ยืนยันสำเร็จ! ✅',
          'Email ของคุณได้รับการยืนยันแล้ว',
          [
            {
              text: 'เข้าสู่ระบบ',
              onPress: () => navigation.replace('Login'),
            },
          ]
        );
      } else {
        Alert.alert('ยังไม่ยืนยัน', 'กรุณาคลิกลิงก์ใน email ที่เราส่งไปให้');
      }
    } catch (error) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถตรวจสอบสถานะได้');
    } finally {
      setIsChecking(false);
    }
  };

  // Change email / go back
  const handleChangeEmail = async () => {
    try {
      await logoutUser();
      navigation.replace('Register');
    } catch (error) {
      navigation.replace('Register');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Email Icon */}
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={60} color={COLORS.primary} />
          </View>
          <View style={styles.checkBadge}>
            <Ionicons name="time-outline" size={20} color={COLORS.white} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>ยืนยัน Email ของคุณ</Text>
        <Text style={styles.subtitle}>
          เราได้ส่งลิงก์ยืนยันไปที่
        </Text>
        <Text style={styles.email}>{email}</Text>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>1</Text>
            </View>
            <Text style={styles.instructionText}>เปิดกล่องจดหมายของคุณ</Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>2</Text>
            </View>
            <Text style={styles.instructionText}>คลิกลิงก์ยืนยันใน email</Text>
          </View>
          
          <View style={styles.instructionItem}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>3</Text>
            </View>
            <Text style={styles.instructionText}>กลับมากด "ตรวจสอบสถานะ"</Text>
          </View>
        </View>

        {/* Note */}
        <View style={styles.noteContainer}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.textSecondary} />
          <Text style={styles.noteText}>
            หากไม่เจอ email ลองตรวจสอบโฟลเดอร์ Spam หรือ Junk
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={isChecking ? 'กำลังตรวจสอบ...' : 'ตรวจสอบสถานะ'}
            onPress={handleCheckVerification}
            loading={isChecking}
            style={styles.primaryButton}
          />

          <TouchableOpacity
            style={[styles.resendButton, countdown > 0 && styles.resendButtonDisabled]}
            onPress={handleResendEmail}
            disabled={countdown > 0 || isResending}
          >
            <Text style={[styles.resendButtonText, countdown > 0 && styles.resendButtonTextDisabled]}>
              {isResending 
                ? 'กำลังส่ง...' 
                : countdown > 0 
                  ? `ส่งใหม่ได้ใน ${countdown} วินาที` 
                  : 'ส่ง Email อีกครั้ง'
              }
            </Text>
          </TouchableOpacity>
        </View>

        {/* Change Email */}
        <TouchableOpacity style={styles.changeEmailButton} onPress={handleChangeEmail}>
          <Ionicons name="arrow-back" size={16} color={COLORS.textMuted} />
          <Text style={styles.changeEmailText}>เปลี่ยน Email / กลับไปสมัคร</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },

  // Icon
  iconContainer: {
    marginBottom: SPACING.xl,
    position: 'relative',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },

  // Text
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  email: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xl,
  },

  // Instructions
  instructionsContainer: {
    width: '100%',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  instructionNumberText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  instructionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    flex: 1,
  },

  // Note
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.warningLight || '#FFF3E0',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.xl,
    width: '100%',
  },
  noteText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: SPACING.xs,
    flex: 1,
  },

  // Actions
  actions: {
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  primaryButton: {
    width: '100%',
  },
  resendButton: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: COLORS.textMuted,
  },

  // Change Email
  changeEmailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  changeEmailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
});
