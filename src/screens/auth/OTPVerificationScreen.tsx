// ============================================
// OTP VERIFICATION SCREEN - Firebase Phone Auth
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { sendOTP, verifyOTP } from '../../services/otpService';
import { firebaseConfig } from '../../config/firebase';
import { AuthStackParamList } from '../../types';

type OTPVerificationScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OTPVerification'>;
type OTPVerificationScreenRouteProp = RouteProp<AuthStackParamList, 'OTPVerification'>;
interface Props {
  navigation: OTPVerificationScreenNavigationProp;
  route: OTPVerificationScreenRouteProp;
}

export default function OTPVerificationScreen({ navigation, route }: Props) {
  const { phone, verificationId: initialVerificationId, registrationData } = route.params;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [verificationId, setVerificationId] = useState(initialVerificationId);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const recaptchaRef = useRef<FirebaseRecaptchaVerifierModal>(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (value && index === 5 && newOtp.join('').length === 6) {
      Keyboard.dismiss();
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOTP = async () => {
    if (!recaptchaRef.current) return;
    setIsResending(true);
    try {
      const result = await sendOTP(phone, recaptchaRef.current);
      if (result.success && result.verificationId) {
        setVerificationId(result.verificationId);
        setCountdown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        Alert.alert('??? OTP ????????', '???????????? SMS ??????');
      } else {
        Alert.alert('??? OTP ?????????', result.error || '????????????');
      }
    } catch {
      Alert.alert('??????????????', '???????????? OTP ???');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      Alert.alert('????????? OTP', '????????????? OTP 6 ????');
      return;
    }
    setIsLoading(true);
    try {
      const result = await verifyOTP(verificationId, code);
      if (result.success) {
        Alert.alert(
          '????????????! ?',
          '??????????????????????????????????????',
          [{
            text: '????????????',
            onPress: () => navigation.replace('ChooseRole', { phone, phoneVerified: true, registrationData }),
          }]
        );
      } else {
        Alert.alert('???? OTP ??????????', result.error || '??????????????????????');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      Alert.alert('??????????????', '??????????????? OTP ???');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneDisplay = (p: string) => {
    const c = p.replace(/\D/g, '');
    return c.length === 10 ? `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6)}` : p;
  };

  return (
    <SafeAreaView style={styles.container}>
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaRef}
        firebaseConfig={firebaseConfig}
        attemptInvisibleVerification={true}
      />

      <View style={styles.content}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="phone-portrait-outline" size={50} color={COLORS.primary} />
          </View>
        </View>

        <Text style={styles.title}>???????????????????</Text>
        <Text style={styles.subtitle}>?????????? OTP ?????</Text>
        <Text style={styles.phone}>{formatPhoneDisplay(phone)}</Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputRefs.current[index] = ref; }}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              autoFocus={index === 0}
            />
          ))}
        </View>

        <Button
          title={isLoading ? '????????????...' : '?????? OTP'}
          onPress={() => handleVerifyOTP()}
          loading={isLoading}
          disabled={otp.join('').length !== 6}
          style={styles.verifyButton}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>?????????????? </Text>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>???????????? {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResendOTP} disabled={isResending}>
              <Text style={styles.resendLink}>{isResending ? '????????...' : '???????????'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.changePhoneButton} onPress={() => navigation.goBack()}>
          <Ionicons name="create-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.changePhoneText}>????????????????????</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.lg },
  iconContainer: { alignItems: 'center', marginBottom: SPACING.xl },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.xxl, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: SPACING.sm },
  subtitle: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary, textAlign: 'center' },
  phone: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: COLORS.primary, textAlign: 'center', marginBottom: SPACING.xl },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm, marginBottom: SPACING.xl },
  otpInput: { width: 48, height: 56, borderRadius: BORDER_RADIUS.md, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.backgroundSecondary, fontSize: FONT_SIZES.xl, fontWeight: '700', textAlign: 'center', color: COLORS.text },
  otpInputFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  verifyButton: { marginBottom: SPACING.lg },
  resendContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xl },
  resendText: { fontSize: FONT_SIZES.md, color: COLORS.textSecondary },
  countdownText: { fontSize: FONT_SIZES.md, color: COLORS.textMuted },
  resendLink: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.primary },
  changePhoneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs },
  changePhoneText: { fontSize: FONT_SIZES.sm, color: COLORS.textMuted },
});
