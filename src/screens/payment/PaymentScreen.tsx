import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getApp } from 'firebase/app';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../types';
import { createJob } from '../../services/jobService';
import { upgradePlan } from '../../services/subscriptionService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';

const functions = getFunctions(getApp());

// 🔧 เปลี่ยนเป็น false เมื่อพร้อม integrate Omise จริง
const FREE_TRIAL_MODE = true;

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;
type PaymentState = 'idle' | 'loading' | 'qr_shown' | 'polling' | 'success' | 'failed' | 'expired';

const POLL_INTERVAL_MS = 5000;
const QR_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export default function PaymentScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = route.params;

  const [state, setState] = useState<PaymentState>('idle');
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // After payment success: activate subscription or create urgent job
  const handleActivateSuccess = useCallback(async () => {
    try {
      if (user?.uid && params?.plan) {
        await upgradePlan(user.uid, params.plan as any, (params.billingCycle as any) || 'monthly');
      }
      if (params?.formData && params?.returnTo) {
        const fd: any = params.formData || {};
        await createJob({
          title: fd.title || params.title || 'ประกาศ',
          department: fd.department || fd.staffType || 'ทั่วไป',
          description: fd.description || '',
          shiftRate: fd.shiftRate ? parseInt(String(fd.shiftRate), 10) : 0,
          rateType: (fd.rateType || 'shift') as any,
          shiftDate: fd.shiftDate ? new Date(fd.shiftDate) : new Date(),
          shiftTime: fd.shiftTime || `${fd.customStartTime || '08:00'}-${fd.customEndTime || '16:00'}`,
          location: {
            province: fd.province || fd.location?.province || 'กรุงเทพมหานคร',
            district: fd.district || fd.location?.district || '',
            hospital: fd.hospital || fd.location?.hospital || '',
          },
          contactPhone: fd.contactPhone || '',
          contactLine: fd.contactLine || '',
          status: 'urgent',
          posterId: user?.uid,
          posterName: user?.displayName || 'ไม่ระบุชื่อ',
          posterVerified: Boolean((user as any)?.isVerified),
          posterRole: ((user as any)?.role as any) || 'user',
        } as any);
      }
    } catch (e) {
      console.error('[Payment] activate error:', e);
    }
    setState('success');
  }, [user, params]);

  const startPolling = useCallback((id: string) => {
    setState('polling');
    const checkFn = httpsCallable(functions, 'checkOmiseCharge');

    pollRef.current = setInterval(async () => {
      try {
        const result = await checkFn({ chargeId: id });
        const data = result.data as any;
        if (data.status === 'successful') {
          stopPolling();
          await handleActivateSuccess();
        } else if (data.status === 'failed' || data.status === 'reversed') {
          stopPolling();
          setState('failed');
          setErrorMsg('การชำระเงินถูกปฏิเสธ กรุณาลองใหม่');
        }
      } catch (err) {
        console.error('[Payment] poll error:', err);
      }
    }, POLL_INTERVAL_MS);

    timeoutRef.current = setTimeout(() => {
      stopPolling();
      setState('expired');
    }, QR_TIMEOUT_MS);
  }, [handleActivateSuccess, stopPolling]);

  const handleCreateCharge = async () => {
    if (!user?.uid) return;
    setState('loading');
    setErrorMsg('');
    setQrUri(null);

    // ── FREE TRIAL MODE: activate ทันทีโดยไม่ผ่าน Omise ──────────────
    if (FREE_TRIAL_MODE) {
      await handleActivateSuccess();
      return;
    }

    // ── OMISE (เปิดใช้เมื่อ FREE_TRIAL_MODE = false) ─────────────────
    try {
      const fn = httpsCallable(functions, 'createOmiseCharge');
      const amountSatang = Math.round((params?.amount || 0) * 100);
      const result = await fn({
        userId: user.uid,
        productId: params?.plan || params?.productKey || params?.type || 'payment',
        amount: amountSatang,
        currency: 'thb',
        description: params?.title || 'NurseGo Payment',
        source: { type: 'promptpay' },
      });

      const data = result.data as any;
      if (!data.success) {
        setState('failed');
        setErrorMsg('ไม่สามารถสร้าง QR Code ได้');
        return;
      }

      setChargeId(data.chargeId);
      setQrUri(data.qrCodeUri);
      setState('qr_shown');
      startPolling(data.chargeId);
    } catch (err: any) {
      setState('failed');
      setErrorMsg(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    }
  };

  const handleDone = () => {
    if (params?.returnTo) {
      try {
        navigation.navigate(params.returnTo as any, { paidUrgent: true, formData: params.formData });
        return;
      } catch { /* fallthrough */ }
    }
    const dest = params?.plan ? 'Shop' : 'MyPosts';
    navigation.replace(dest as any);
  };

  // ── Shared header ─────────────────────────────────────────────────────────
  const renderHeader = () => (
    <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
      <Ionicons name="chevron-back" size={24} color={colors.text} />
      <Text style={[styles.backLabel, { color: colors.text }]}>กลับ</Text>
    </TouchableOpacity>
  );

  // ── Success ───────────────────────────────────────────────────────────────
  if (state === 'success') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="checkmark-circle" size={86} color="#22C55E" />
          <Text style={[styles.bigTitle, { color: colors.text }]}>ชำระเงินสำเร็จ!</Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]}>
            รายการของคุณได้รับการเปิดใช้งานแล้ว
          </Text>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={handleDone}>
            <Text style={styles.btnText}>ดำเนินการต่อ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (state === 'failed') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="close-circle" size={86} color="#EF4444" />
          <Text style={[styles.bigTitle, { color: colors.text }]}>ชำระเงินไม่สำเร็จ</Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]}>{errorMsg}</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => { setState('idle'); setChargeId(null); setQrUri(null); }}>
            <Text style={styles.btnText}>ลองใหม่</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Expired ───────────────────────────────────────────────────────────────
  if (state === 'expired') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="time-outline" size={86} color="#F59E0B" />
          <Text style={[styles.bigTitle, { color: colors.text }]}>QR Code หมดอายุ</Text>
          <Text style={[styles.subText, { color: colors.textSecondary }]}>กรุณาสร้าง QR Code ใหม่</Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => { setQrUri(null); setChargeId(null); setState('idle'); }}>
            <Text style={styles.btnText}>สร้าง QR ใหม่</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>ยกเลิก</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main (idle / loading / qr_shown / polling) ────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {renderHeader()}

        <Text style={[styles.pageTitle, { color: colors.text }]}>
          {params?.title || 'ชำระเงิน'}
        </Text>

        {/* Amount box */}
        <View style={[styles.amountBox, { backgroundColor: colors.card ?? '#F8FAFF' }]}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>ยอดที่ต้องชำระ</Text>
          <Text style={[styles.amountValue, { color: COLORS.success ?? '#22C55E' }]}>
            ฿{(params?.amount ?? 0).toLocaleString('th-TH')}
          </Text>
          {params?.description ? (
            <Text style={[styles.amountDesc, { color: colors.textSecondary }]}>
              {params.description}
            </Text>
          ) : null}
        </View>

        {/* QR Code */}
        {(state === 'qr_shown' || state === 'polling') && qrUri ? (
          <View style={styles.qrSection}>
            <Text style={[styles.qrTitle, { color: colors.text }]}>
              สแกน QR Code ด้วยแอปธนาคาร
            </Text>
            <Image source={{ uri: qrUri }} style={styles.qrImage} resizeMode="contain" />
            <View style={styles.pollingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.pollingText, { color: colors.textSecondary }]}>
                กำลังรอการชำระเงิน...
              </Text>
            </View>
            <Text style={[styles.qrNote, { color: colors.textSecondary }]}>
              QR Code จะหมดอายุใน 5 นาที
            </Text>
          </View>
        ) : null}

        {/* Buttons */}
        {state === 'idle' ? (
          <View style={styles.btnGroup}>
            <TouchableOpacity
              style={[styles.promptpayBtn, FREE_TRIAL_MODE && { backgroundColor: COLORS.success ?? '#22C55E' }]}
              onPress={handleCreateCharge}>
              <Ionicons name={FREE_TRIAL_MODE ? 'gift-outline' : 'qr-code-outline'} size={22} color="#FFF" />
              <Text style={styles.btnText}>
                {'  '}{FREE_TRIAL_MODE ? 'เปิดใช้งานฟรี (ช่วงทดลอง)' : 'ชำระด้วย PromptPay / QR'}
              </Text>
            </TouchableOpacity>
            {!FREE_TRIAL_MODE && (
              <Text style={[styles.supported, { color: colors.textSecondary }]}>
                รองรับทุกธนาคาร · K PLUS, SCB Easy, Krungthai Next และอื่นๆ
              </Text>
            )}
          </View>
        ) : state === 'loading' ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              กำลังสร้าง QR Code...
            </Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>ยกเลิก</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: SPACING.md, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  backLabel: { fontSize: FONT_SIZES.md, marginLeft: 4 },
  pageTitle: { fontSize: FONT_SIZES.xl, fontWeight: '800', marginBottom: SPACING.lg },
  amountBox: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  amountLabel: { fontSize: FONT_SIZES.sm, marginBottom: SPACING.xs },
  amountValue: { fontSize: 42, fontWeight: '900' },
  amountDesc: { fontSize: FONT_SIZES.sm, marginTop: SPACING.xs },
  qrSection: { alignItems: 'center', marginBottom: SPACING.xl },
  qrTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', marginBottom: SPACING.md, textAlign: 'center' },
  qrImage: { width: 240, height: 240, marginBottom: SPACING.md },
  pollingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pollingText: { fontSize: FONT_SIZES.sm },
  qrNote: { fontSize: FONT_SIZES.xs, textAlign: 'center' },
  btnGroup: { gap: SPACING.md, marginBottom: SPACING.md },
  promptpayBtn: {
    flexDirection: 'row',
    backgroundColor: '#004B8D',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
  },
  btnText: { color: '#FFF', fontWeight: '700', fontSize: FONT_SIZES.md },
  supported: { fontSize: FONT_SIZES.xs, textAlign: 'center' },
  loadingSection: { alignItems: 'center', paddingVertical: SPACING.xl },
  loadingText: { marginTop: SPACING.md, fontSize: FONT_SIZES.sm },
  bigTitle: { fontSize: FONT_SIZES.xl + 4, fontWeight: '800', marginTop: SPACING.lg, textAlign: 'center' },
  subText: { fontSize: FONT_SIZES.sm, marginTop: SPACING.sm, marginBottom: SPACING.xl, textAlign: 'center' },
  cancelBtn: { alignItems: 'center', padding: SPACING.md, marginTop: SPACING.sm },
  cancelText: { fontSize: FONT_SIZES.sm },
});
