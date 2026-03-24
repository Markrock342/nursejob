// ============================================
// LOGIN SCREEN - Production Ready with Google Sign-In
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Button, Input, Divider, SuccessModal, ErrorModal } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useI18n } from '../../i18n';
import { AuthStackParamList } from '../../types';
import { getGoogleSigninModule, getGoogleSigninUnavailableMessage } from '../../utils/googleSignin';

// ============================================
// Google OAuth Config — อ่านจาก app.config.js extra
// ============================================
const extra = Constants.expoConfig?.extra || {};
const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId || '427547114323-87ibkaeo6kun7cfhc20919c9gn7ntp24.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = extra.googleAndroidClientId || '427547114323-o1qs4cq0kdbcao0mpvcti88la81p2nre.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId || '';

// ============================================
// Types
// ============================================
type LoginScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

interface Props {
  navigation: LoginScreenNavigationProp;
  onGuestLogin?: () => void;
}

// ============================================
// Component
// ============================================
export default function LoginScreen({ navigation, onGuestLogin }: Props) {
  // State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Auth context
  const { login, loginWithGoogle, isLoading, error, clearError } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const googleSigninModule = useMemo(() => getGoogleSigninModule(), []);
  const isGoogleSignInAvailable = Boolean(googleSigninModule);

  useEffect(() => {
    googleSigninModule?.GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      offlineAccess: false,
      profileImageSize: 120,
    });
  }, [googleSigninModule]);

  // Handle Google Login
  const handleGoogleLogin = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const { isNewUser } = await loginWithGoogle(idToken);
      if (isNewUser) {
        // New Google user → must pick role before entering app
        navigation.navigate('ChooseRole', { fromGoogle: true });
      } else {
        // Returning user → close auth modal
        setShowSuccessModal(true);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'กรุณาลองใหม่อีกครั้ง');
      setShowErrorModal(true);
    } finally {
      setGoogleLoading(false);
    }
  };

  // Trigger Google Sign-In
  const handleGoogleSignIn = async () => {
    if (!googleSigninModule) {
      setErrorMessage(getGoogleSigninUnavailableMessage());
      setShowErrorModal(true);
      return;
    }

    setGoogleLoading(true);
    clearError();
    try {
      if (Platform.OS === 'android') {
        await googleSigninModule.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      await googleSigninModule.GoogleSignin.signOut().catch(() => null);
      const response = await googleSigninModule.GoogleSignin.signIn();
      if (!googleSigninModule.isSuccessResponse(response)) {
        setGoogleLoading(false);
        return;
      }

      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error(t('auth.login.googleMissingToken'));
      }

      await handleGoogleLogin(idToken);
    } catch (err: any) {
      if (googleSigninModule.isErrorWithCode(err)) {
        if (err.code === googleSigninModule.statusCodes.SIGN_IN_CANCELLED) {
          setGoogleLoading(false);
          return;
        }
        if (err.code === googleSigninModule.statusCodes.IN_PROGRESS) {
          setErrorMessage(t('auth.login.googleInProgress'));
        } else if (err.code === googleSigninModule.statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setErrorMessage(t('auth.login.googleDeviceNotReady'));
        } else {
          setErrorMessage(err.message || t('auth.login.googleFailed'));
        }
      } else {
        setErrorMessage(err?.message || t('auth.login.googleCannotOpen'));
      }
      setShowErrorModal(true);
      setGoogleLoading(false);
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = t('auth.login.emailRequired');
    }

    if (!password) {
      newErrors.password = t('auth.login.passwordRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle login
  const handleLogin = async () => {
    clearError();
    
    if (!validateForm()) return;

    const trimmedInput = email.trim();

    try {
      // Login ผ่าน AuthContext (รองรับทั้ง email, username, และ admin)
      await login(trimmedInput, password);
      
      // Show success modal and navigate back
      setShowSuccessModal(true);
    } catch (err: any) {
      // Check if email not verified - navigate to verification screen
      if (err.code === 'email-not-verified') {
        navigation.navigate('EmailVerification', { email: err.email || trimmedInput });
        return;
      }
      setErrorMessage(err.message || t('common.alerts.genericTryAgain'));
      setShowErrorModal(true);
    }
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword');
  };

  // Handle register
  const handleRegister = () => {
    navigation.navigate('Register');
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
          {/* Logo & Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="medical" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>{t('auth.login.title')}</Text>
            <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <Input
              label={t('auth.login.emailLabel')}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              placeholder={t('auth.login.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              icon={<Ionicons name="person-outline" size={20} color={COLORS.textMuted} />}
            />

            <Input
              label={t('auth.login.passwordLabel')}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              placeholder={t('auth.login.passwordPlaceholder')}
              secureTextEntry={!showPassword}
              error={errors.password}
              icon={
                <TouchableOpacity style={styles.inputIconButton} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color={COLORS.textMuted}
                  />
                </TouchableOpacity>
              }
              iconPosition="right"
            />

            {/* Forgot Password */}
            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>{t('auth.login.forgotPassword')}</Text>
            </TouchableOpacity>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Login Button */}
            <Button
              title={t('auth.login.submit')}
              onPress={handleLogin}
              loading={isLoading}
              fullWidth
              size="large"
            />

            <Divider text={t('auth.login.or')} />

            {/* Phone Login Button */}
            <TouchableOpacity
              style={styles.phoneLoginButton}
              onPress={() => navigation.navigate('PhoneLogin')}
            >
              <Ionicons name="call-outline" size={20} color={COLORS.primary} style={styles.phoneLoginIcon} />
              <Text style={styles.phoneLoginText}>
                {t('auth.login.phoneLogin')}
              </Text>
            </TouchableOpacity>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[
                styles.googleButton,
                (!isGoogleSignInAvailable || googleLoading) && styles.googleButtonDisabled,
              ]}
              onPress={handleGoogleSignIn}
              disabled={!isGoogleSignInAvailable || googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleButtonText}>
                    {t('auth.login.googleLogin')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Guest Mode */}
            {onGuestLogin && (
              <Button
                title={t('auth.login.guestBrowse')}
                onPress={onGuestLogin}
                variant="outline"
                fullWidth
              />
            )}
          </View>

          {/* Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.login.noAccount')} </Text>
            <TouchableOpacity onPress={handleRegister}>
              <Text style={styles.registerLink}>{t('auth.login.registerLink')}</Text>
            </TouchableOpacity>
          </View>

          {/* Legal Links */}
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => navigation.navigate('Privacy')}>
              <Text style={styles.legalLinkText}>{t('help.privacyLink')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalSeparator}>|</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
              <Text style={styles.legalLinkText}>{t('help.termsLink')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={t('auth.login.successTitle')}
        message={t('auth.login.successMessage')}
        icon="✅"
        buttonText={t('common.actions.ok')}
        onClose={() => {
          setShowSuccessModal(false);
          navigation.getParent()?.goBack();
        }}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={t('auth.login.errorTitle')}
        message={errorMessage}
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
    padding: SPACING.lg,
    justifyContent: 'center',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl * 2,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logo: {
    fontSize: 72,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // Form
  form: {
    marginBottom: SPACING.xl,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.lg,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.sm,
  },
  inputIconButton: {
    padding: 2,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
  },

  // Google Button
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: SPACING.sm,
  },
  googleButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Phone Login Button
  phoneLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  phoneLoginIcon: {
    marginRight: SPACING.sm,
  },
  phoneLoginText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
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
  registerLink: {
    color: COLORS.primary,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  },
  legalLinkText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginHorizontal: SPACING.sm,
  },
});

