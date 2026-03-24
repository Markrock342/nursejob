// ============================================
// COMPLETE REGISTRATION SCREEN (After OTP Verification)
// ============================================

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { KittenButton as Button, Input, SuccessModal, ErrorModal } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../types';
import { getErrorMessage } from '../../utils/helpers';
import { trackEvent } from '../../services/analyticsService';
import { useI18n } from '../../i18n';

// ============================================
// Types
// ============================================
type CompleteRegistrationScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'CompleteRegistration'>;
type CompleteRegistrationScreenRouteProp = RouteProp<AuthStackParamList, 'CompleteRegistration'>;

interface Props {
  navigation: CompleteRegistrationScreenNavigationProp;
  route: CompleteRegistrationScreenRouteProp;
}

// ============================================
// Component
// ============================================
export default function CompleteRegistrationScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { phone, phoneVerified, role, staffType, orgType, registrationData } = route.params;
  
  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

// Auth context
const { register, isLoading, clearError, user } = useAuth();

  useEffect(() => {
    trackEvent({
      eventName: 'onboarding_started',
      screenName: 'CompleteRegistration',
      props: {
        role: role || 'user',
        staffType: staffType || null,
        orgType: orgType || null,
      },
    });
  }, [orgType, role, staffType]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = t('auth.completeRegistration.displayNameRequired');
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = t('auth.completeRegistration.displayNameTooShort');
    }

    if (!email.trim()) {
      newErrors.email = t('auth.completeRegistration.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = t('auth.completeRegistration.emailInvalid');
    }

    if (!password) {
      newErrors.password = t('auth.completeRegistration.passwordRequired');
    } else if (password.length < 8) {
      newErrors.password = t('auth.completeRegistration.passwordTooShort');
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = t('auth.completeRegistration.confirmPasswordRequired');
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = t('auth.completeRegistration.confirmPasswordMismatch');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle registration
  const handleRegister = async () => {
    clearError();
    if (!validateForm()) return;

    try {
      await register(
        email.trim(),
        password,
        displayName.trim(),
        role || 'user', // ใช้ role ที่เลือก หรือ 'user' ถ้าไม่ได้เลือก
        undefined, // username
        phone, // verified phone
        staffType, // ประเภทบุคลากร (nurse)
        orgType,  // ประเภทองค์กร (hospital)
        registrationData?.legalConsent,
      );

      await trackEvent({
        eventName: 'onboarding_step_completed',
        screenName: 'CompleteRegistration',
        props: {
          step: 'account_created',
          role: role || 'user',
          hasPhoneVerified: Boolean(phoneVerified),
        },
      });
      
      // ถ้า register สำเร็จ ให้แสดง success modal
      setShowSuccessModal(true);
    } catch (err: any) {
      // เคสที่ Firebase สร้างบัญชีสำเร็จ แต่ขั้นตอนหลังจากนั้น error
      // (เช่น เก็บข้อมูลลง AsyncStorage หรือ network บางส่วน) ทำให้ register() โยน error
      // ถ้า context มี user แล้ว ให้ถือว่าสมัครสำเร็จ แล้วพาไปหน้า Login
      if (user) {
        setShowSuccessModal(true);
        return;
      }

      let message = err.message || t('auth.completeRegistration.genericError');
      if (!message.includes('อีเมล') && !message.includes('รหัสผ่าน') && !message.includes('บัญชี')) {
        message = getErrorMessage(err);
      }
      setErrorMessage(message);
      setShowErrorModal(true);
    }
  };

  // Format phone for display
  const formatPhoneDisplay = (phoneNum: string) => {
    const cleaned = phoneNum.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNum;
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>{`← ${t('auth.completeRegistration.back')}`}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('auth.completeRegistration.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.completeRegistration.subtitle')}</Text>
          </View>

          {/* Verified Phone Badge */}
          <View style={styles.verifiedPhoneContainer}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              <Text style={styles.verifiedText}>{t('auth.completeRegistration.verifiedPhone')}</Text>
            </View>
            <Text style={styles.phoneNumber}>{formatPhoneDisplay(phone)}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label={t('auth.completeRegistration.displayNameLabel')}
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (errors.displayName) setErrors({ ...errors, displayName: '' });
              }}
              placeholder={t('auth.completeRegistration.displayNamePlaceholder')}
              error={errors.displayName}
              icon={<Text>👤</Text>}
              required
            />

            <Input
              label={t('auth.completeRegistration.emailLabel')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: '' });
              }}
              placeholder="example@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
              icon={<Text>📧</Text>}
              required
            />

            <View>
              <Input
                label={t('auth.completeRegistration.passwordLabel')}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                placeholder={t('auth.completeRegistration.passwordPlaceholder')}
                secureTextEntry={!showPassword}
                error={errors.password}
                icon={
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons 
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                      size={20} 
                      color={COLORS.textMuted} 
                    />
                  </TouchableOpacity>
                }
                iconPosition="right"
                required
              />
            </View>

            <Input
              label={t('auth.completeRegistration.confirmPasswordLabel')}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
              }}
              placeholder={t('auth.completeRegistration.confirmPasswordPlaceholder')}
              secureTextEntry={!showPassword}
              error={errors.confirmPassword}
              icon={<Text>🔒</Text>}
              required
            />

            {/* Register Button */}
            <Button
              title={t('auth.completeRegistration.submit')}
              onPress={handleRegister}
              loading={isLoading}
              style={styles.registerButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={t('auth.completeRegistration.successTitle')}
        message={t('auth.completeRegistration.successMessage')}
        buttonText={t('auth.completeRegistration.successButton')}
        onClose={() => {
          setShowSuccessModal(false);
          // Navigate to onboarding survey in RootStack
          navigation.getParent()?.reset({
            index: 0,
            routes: [{ name: 'OnboardingSurvey' as any }],
          });
        }}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={t('auth.completeRegistration.errorTitle')}
        message={errorMessage}
        buttonText={t('auth.completeRegistration.retry')}
        onClose={() => setShowErrorModal(false)}
      />
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  header: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  backButton: {
    marginBottom: SPACING.md,
  },
  backButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // Verified Phone
  verifiedPhoneContainer: {
    backgroundColor: COLORS.successLight,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  verifiedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
    fontWeight: '600',
  },
  phoneNumber: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },

  // Form
  form: {
    gap: SPACING.md,
  },
  registerButton: {
    marginTop: SPACING.md,
  },
});
