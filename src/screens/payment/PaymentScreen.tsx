import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList, JobPost } from '../../types';
import { createJob } from '../../services/jobService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

export default function PaymentScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const params = route.params;

  const handleMockPayment = async () => {
    if (!params) return;
    setIsProcessing(true);
    try {
      // Build job payload from provided formData (best-effort mapping)
      const fd: any = params.formData || {};

      const jobData: Partial<JobPost> = {
        title: fd.title || params.title || 'ประกาศ',
        department: fd.department || fd.staffType || 'ทั่วไป',
        description: fd.description || params.description || '',
        shiftRate: fd.shiftRate ? parseInt(String(fd.shiftRate)) : fd.shiftRateNumber || 0,
        rateType: (fd.rateType || 'shift') as JobPost['rateType'],
        shiftDate: fd.shiftDate ? new Date(fd.shiftDate) : new Date(),
        shiftTime: fd.shiftTime || `${fd.customStartTime || '08:00'}-${fd.customEndTime || '16:00'}`,
        location: {
          province: fd.province || fd.location?.province || 'กรุงเทพมหานคร',
          district: fd.district || fd.location?.district || '',
          hospital: fd.hospital || fd.location?.hospital || '',
        },
        contactPhone: fd.contactPhone || '',
        contactLine: fd.contactLine || '',
        status: fd.isUrgent || params.type === 'urgent_post' ? 'urgent' : 'active',
      };

      // Add poster info
      if (user) {
        (jobData as any).posterId = user.uid;
        (jobData as any).posterName = user.displayName || 'ไม่ระบุชื่อ';
        (jobData as any).posterPhoto = user.photoURL || '';
        (jobData as any).posterVerified = Boolean((user as any).isVerified);
        (jobData as any).posterRole = (user as any).role;
        (jobData as any).posterOrgType = (user as any).orgType;
        (jobData as any).posterStaffType = (user as any).staffType;
        (jobData as any).posterPlan = (user as any)?.subscription?.plan || 'free';
      }

      await createJob(jobData as Partial<JobPost>);
      // If caller requested a returnTo, navigate back with serializable success flag and formData
      if (params?.returnTo) {
        try {
          navigation.navigate(params.returnTo as any, {
            paidUrgent: true,
            formData: params.formData,
          });
        } catch (e) {
          navigation.replace('MyPosts');
        }
      } else {
        // Default behavior
        navigation.replace('MyPosts');
      }
    } catch (err: any) {
      // Fallback: just go back
      navigation.goBack();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>หน้าชำระเงิน (ทดสอบ)</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>ระบบชำระเงินแบบ Mock — ทดสอบการชำระเงินสำหรับฟีเจอร์นี้</Text>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>จำนวนที่ต้องชำระ</Text>
          <Text style={styles.amount}>{params?.amount ?? 0} บาท</Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: colors.primary }]}
          onPress={handleMockPayment}
          disabled={isProcessing}
        >
          <Text style={styles.payText}>{isProcessing ? 'กำลังชำระ...' : 'ชำระ (Mock)'} </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>ยกเลิก</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.md, flex: 1, justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '800', marginBottom: SPACING.sm },
  description: { fontSize: FONT_SIZES.sm, marginBottom: SPACING.lg },
  amountBox: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: '#F8FAFF', marginBottom: SPACING.lg },
  amountLabel: { fontSize: FONT_SIZES.sm, color: '#6B7280' },
  amount: { fontSize: FONT_SIZES.xl, fontWeight: '800', color: COLORS.success, marginTop: SPACING.xs },
  payButton: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  payText: { color: '#FFF', fontWeight: '700' },
  cancelButton: { marginTop: SPACING.md, alignItems: 'center' },
  cancelText: { fontSize: FONT_SIZES.sm },
});
