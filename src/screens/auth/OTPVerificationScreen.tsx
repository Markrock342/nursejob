// ============================================
// OTP VERIFICATION SCREEN - Firebase Phone Auth
// ============================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Keyboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { sendOTP, verifyOTP } from '../../services/otpService';
import { AuthStackParamList } from '../../types';
import { trackEvent } from '../../services/analyticsService';

type OTPVerificationScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'OTPVerification'>;
type OTPVerificationScreenRouteProp = RouteProp<AuthStackParamList, 'OTPVerification'>;
interface Props {
  navigation: OTPVerificationScreenNavigationProp;
  route: OTPVerificationScreenRouteProp;
}

export default function OTPVerificationScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { phone, verificationId: initialVerificationId, registrationData } = route.params;

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [verificationId, setVerificationId] = useState(initialVerificationId);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    trackEvent({
      eventName: 'onboarding_started',
      screenName: 'OTPVerification',
      props: {
        entryPoint: 'otp_verification',
      },
    });
  }, []);

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
    setIsResending(true);
    try {
      const result = await sendOTP(phone);
      if (result.success && result.verificationId) {
        await trackEvent({
          eventName: 'otp_requested',
          screenName: 'OTPVerification',
          subjectType: 'phone_registration',
          subjectId: phone,
          props: {
            flow: 'register_resend',
          },
        });

        setVerificationId(result.verificationId);
        setCountdown(60);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        Alert.alert('ส่งอีก OTP สำเร็จ', 'SMS ส่งไปแล้ว');
      } else {
        Alert.alert('ส่ง OTP ล้มเหลว', result.error || 'ไม่สามารถส่ง OTP ได้');
      }
    } catch {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถส่ง OTP ได้');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOTP = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== 6) {
      Alert.alert('กรุณากรอก OTP', 'กรุณากรอก OTP 6 หลัก');
      return;
    }
    setIsLoading(true);
    try {
      const result = await verifyOTP(verificationId, code);
      if (result.success) {
        await trackEvent({
          eventName: 'otp_verified',
          screenName: 'OTPVerification',
          subjectType: 'phone_registration',
          subjectId: phone,
          props: {
            flow: 'register',
          },
        });

        Alert.alert(
          'ยืนยันสำเร็จ!',
          'เบอร์โทรศัพท์ของคุณได้รับการยืนยันแล้ว',
          [{
            text: 'ถัดไป',
            onPress: () => navigation.replace('ChooseRole', { phone, phoneVerified: true, registrationData }),
          }]
        );
      } else {
        Alert.alert('OTP ไม่ถูกต้อง', result.error || 'กรุณาลองใหม่อีกครั้ง');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถยืนยัน OTP ได้');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneDisplay = (p: string) => {
    const c = p.replace(/\D/g, '');
    return c.length === 10 ? `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6)}` : p;
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.background}
        translucent={false}
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

        <Text style={styles.title}>ยืนยันตัวตน</Text>
        <Text style={styles.subtitle}>กรุณากรอก OTP</Text>
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
          title={isLoading ? 'กำลังตรวจสอบ...' : 'ยืนยัน OTP'}
          onPress={() => handleVerifyOTP()}
          loading={isLoading}
          disabled={otp.join('').length !== 6}
          style={styles.verifyButton}
        />

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>ไม่ได้รับ OTP? </Text>
          {countdown > 0 ? (
            <Text style={styles.countdownText}>ลองใหม่ใน {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResendOTP} disabled={isResending}>
              <Text style={styles.resendLink}>{isResending ? 'กำลังส่ง...' : 'ส่งอีกครั้ง'}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.changePhoneButton} onPress={() => navigation.goBack()}>
          <Ionicons name="create-outline" size={16} color={COLORS.textMuted} />
          <Text style={styles.changePhoneText}>เปลี่ยนเบอร์โทร</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
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
