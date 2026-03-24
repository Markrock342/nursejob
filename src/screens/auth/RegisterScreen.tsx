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
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { KittenButton as Button, Input, ErrorModal, TermsConsentModal } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../i18n';
import { AuthStackParamList, LegalConsentRecord } from '../../types';
import { sendOTP, isValidThaiPhone } from '../../services/otpService';
import { Ionicons } from '@expo/vector-icons';
import { trackEvent } from '../../services/analyticsService';
import { PRIVACY_VERSION, TERMS_VERSION } from '../../legal/legalContent';

// ============================================
// Types
// ============================================
type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

interface Props {
  navigation: RegisterScreenNavigationProp;
}

// ============================================
// Component
// ============================================
export default function RegisterScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // Form State
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(false);

  useEffect(() => {
    trackEvent({
      eventName: 'onboarding_started',
      screenName: 'Register',
      props: {
        entryPoint: 'phone_registration',
      },
    });
  }, []);



  // Format phone number for display
  const formatPhoneInput = (text: string): string => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const cleanedPhone = phone.replace(/\D/g, '');

    if (!cleanedPhone) {
      newErrors.phone = t('auth.register.phoneRequired');
    } else if (!isValidThaiPhone(cleanedPhone)) {
      newErrors.phone = t('auth.register.phoneInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle continue button press
  const handleContinuePress = async () => {
    if (!validateForm()) return;

    // Show terms modal for user to accept
    setShowTermsModal(true);
  };

  // Handle send OTP after accepting terms
  const handleSendOTP = async () => {
    setShowTermsModal(false);
    setIsLoading(true);

    try {
      const cleanedPhone = phone.replace(/\D/g, '');
      const acceptedAt = new Date();
      const legalConsent: LegalConsentRecord = {
        terms: {
          version: TERMS_VERSION,
          acceptedAt,
        },
        privacy: {
          version: PRIVACY_VERSION,
          acceptedAt,
        },
        acceptedFrom: 'register_modal',
      };

      const result = await sendOTP(cleanedPhone);

      if (result.success && result.verificationId) {
        await trackEvent({
          eventName: 'otp_requested',
          screenName: 'Register',
          subjectType: 'phone_registration',
          subjectId: cleanedPhone,
          props: {
            flow: 'register',
          },
        });

        navigation.navigate('OTPVerification', {
          phone: cleanedPhone,
          verificationId: result.verificationId,
          registrationData: {
            legalConsent,
          },
        });
      } else {
        setErrorMessage(result.error || t('auth.register.otpSendFailedMessage'));
        setShowErrorModal(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || t('auth.register.genericError'));
      setShowErrorModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle login navigation
  const handleLogin = () => {
    navigation.navigate('Login');
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
              <Text style={styles.backButtonText}>{`← ${t('auth.register.back')}`}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('auth.register.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.register.subtitle')}</Text>
          </View>

          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.illustration}>
              <Ionicons name="phone-portrait-outline" size={64} color={COLORS.black} />
            </View>
          </View>

          {/* Phone Input Form */}
          <View style={styles.form}>
            {/* Phone Info */}
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.black} />
              <Text style={styles.infoText}>
                {t('auth.register.info')}
              </Text>
            </View>

            {/* Phone Input */}
            <Input
              label={t('auth.register.phoneLabel')}
              value={phone}
              onChangeText={(text) => {
                setPhone(formatPhoneInput(text));
                if (errors.phone) setErrors({ ...errors, phone: '' });
              }}
              placeholder={t('auth.register.phonePlaceholder')}
              keyboardType="phone-pad"
              error={errors.phone}
              icon={<Text style={styles.flagIcon}>🇹🇭</Text>}
              maxLength={12}
              required
            />

            {/* Continue Button */}
            <Button
              onPress={handleContinuePress}
              loading={isLoading}
              size="large"
              style={styles.continueButton}
            >
              <Text style={{color: COLORS.white, fontWeight: '600'}}>
                {isLoading ? t('auth.register.requestOtpLoading') : t('auth.register.requestOtp')}
              </Text>
              {!isLoading && (
                <Ionicons name="arrow-forward" size={20} color={COLORS.white} style={{marginLeft: 8}} />
              )}
            </Button>

            {/* Note */}
            <Text style={styles.noteText} >
              {`📱 ${t('auth.register.note')}`}
            </Text>
          </View>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.register.haveAccount')} </Text>
            <TouchableOpacity onPress={handleLogin}>
              <Text style={styles.loginLink}>{t('auth.register.loginLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={t('auth.register.otpSendFailedTitle')}
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />

      {/* Terms Consent Modal */}
      <TermsConsentModal
        visible={showTermsModal}
        onAccept={handleSendOTP}
        onDecline={() => {
          setShowTermsModal(false);
        }}
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
    padding: SPACING.lg,
  },

  // Header
  header: {
    marginBottom: SPACING.lg,
  },
  backButton: {
    marginBottom: SPACING.md,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // Illustration
  illustrationContainer: {
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Form
  form: {
    marginBottom: SPACING.xl,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.black,
    lineHeight: 20,
  },
  flagIcon: {
    fontSize: 20,
  },
  continueButton: {
    marginTop: SPACING.lg,
  },
  noteText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.black,
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: SPACING.xl,
    marginTop: 'auto',
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
});

