// ============================================
// FORGOT PASSWORD SCREEN - Production Ready
// ============================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Input } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { resetPassword } from '../../services/authService';
import { AuthStackParamList } from '../../types';

// ============================================
// Types
// ============================================
type ForgotPasswordScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

interface Props {
  navigation: ForgotPasswordScreenNavigationProp;
}

// ============================================
// Component
// ============================================
export default function ForgotPasswordScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // State
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  // Validate email
  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setError('กรุณากรอกอีเมล');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return false;
    }
    setError('');
    return true;
  };

  // Handle reset password
  const handleResetPassword = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setEmailSent(true);
    } catch (err: any) {
      Alert.alert(
        'ส่งอีเมลไม่สำเร็จ',
        err.message || 'กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resend
  const handleResend = async () => {
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      Alert.alert('สำเร็จ', 'ส่งอีเมลรีเซ็ตรหัสผ่านอีกครั้งแล้ว');
    } catch (err: any) {
      Alert.alert('ส่งอีเมลไม่สำเร็จ', err.message || 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
    }
  };

  // Success state
  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✉️</Text>
          <Text style={styles.successTitle}>ส่งอีเมลแล้ว</Text>
          <Text style={styles.successMessage}>
            เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปยัง{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <Text style={styles.instructionText}>
            กรุณาตรวจสอบอีเมลของคุณและคลิกลิงก์เพื่อรีเซ็ตรหัสผ่าน
          </Text>

          <Button
            title="กลับไปหน้าเข้าสู่ระบบ"
            onPress={() => navigation.navigate('Login')}
            fullWidth
            style={{ marginTop: SPACING.xl }}
          />

          <TouchableOpacity 
            style={styles.resendButton}
            onPress={handleResend}
            disabled={isLoading}
          >
            <Text style={styles.resendText}>
              {isLoading ? 'กำลังส่ง...' : 'ไม่ได้รับอีเมล? ส่งอีกครั้ง'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Header */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← ย้อนกลับ</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.icon}>🔐</Text>
            <Text style={styles.title}>ลืมรหัสผ่าน?</Text>
            <Text style={styles.subtitle}>
              กรอกอีเมลที่ใช้ลงทะเบียน เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้คุณ
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="อีเมล"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={error}
              icon={<Text>📧</Text>}
            />

            <Button
              title="ส่งลิงก์รีเซ็ตรหัสผ่าน"
              onPress={handleResetPassword}
              loading={isLoading}
              fullWidth
              size="large"
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>จำรหัสผ่านได้แล้ว? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: 'center',
  },

  // Back Button
  backButton: {
    position: 'absolute',
    top: SPACING.md,
    left: SPACING.lg,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },

  // Form
  form: {
    marginBottom: SPACING.xl,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },
  loginLink: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },

  // Success State
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  successIcon: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.success,
    marginBottom: SPACING.md,
  },
  successMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: SPACING.md,
  },
  emailHighlight: {
    color: COLORS.text,
    fontWeight: '600',
  },
  instructionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.xl,
  },
  resendButton: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  resendText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },
});
