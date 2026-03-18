import React, { useEffect, useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../types';
import { CommerceAccessStatus, getCommerceAccessStatus } from '../../services/commerceService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

export default function PaymentScreen({ route, navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isLoading, setIsLoading] = useState(true);
  const [commerceStatus, setCommerceStatus] = useState<CommerceAccessStatus | null>(null);

  const params = route.params;

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        const status = await getCommerceAccessStatus();
        if (mounted) {
          setCommerceStatus(status);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleClose = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('MyPosts');
  };

  const isFreeAccessEnabled = commerceStatus?.freeAccessEnabled ?? true;
  const billingProviderReady = commerceStatus?.billingProviderReady ?? false;
  const transitionReviewRequired = commerceStatus?.transitionReviewRequired ?? false;
  const title = isFreeAccessEnabled
    ? transitionReviewRequired
      ? 'ถึงช่วงทบทวนการเปิดชำระเงินแล้ว'
      : 'ช่วงใช้งานแบบโควตารายเดือน'
    : 'ระบบชำระเงินจริงเริ่มทำงานแล้ว';
  const description = isFreeAccessEnabled
    ? transitionReviewRequired
      ? 'ตอนนี้ระบบถึงเกณฑ์ทบทวนแล้ว แต่ยังคงใช้ฟรีต่อจนกว่าผู้ดูแลจะอนุมัติเปิดชำระเงินจริง'
      : 'ตอนนี้แอปยังไม่เรียกเก็บเงินจริงในแอป โดยสิทธิ์ต่าง ๆ จะถูกควบคุมผ่านโควตารายเดือนของบัญชี'
    : 'สถานะนี้ใช้เมื่อผู้ดูแลอนุมัติเปิดชำระเงินจริงและช่องทางชำระเงินพร้อมใช้งานแล้ว';
  const noticeLines = isFreeAccessEnabled
    ? [
        transitionReviewRequired
          ? billingProviderReady
            ? 'ช่องทางชำระเงินจริงพร้อมแล้ว แต่ระบบยังรอผู้ดูแลอนุมัติการเปิดใช้งาน'
            : 'ระบบยังรอช่องทางชำระเงินจริงพร้อมก่อนเข้าสู่ขั้นพิจารณาเปิดใช้งานจริง'
          : 'สิทธิ์ฟีเจอร์หลักและบริการเสริมที่เปิดให้ จะถูกดูแลผ่านระบบโควตารายเดือนของบัญชีโดยตรง',
        'ไม่มีการจำลองชำระเงินและไม่มีการตัดเงินในขั้นตอนนี้',
      ]
    : [
        billingProviderReady
          ? 'ระบบชำระเงินพร้อมและถูกเปิดใช้งานแล้วในสถานะนี้'
          : 'ระบบชำระเงินยังไม่พร้อม จึงยังไม่สามารถเปิดเก็บเงินจริงได้',
        'เมื่อเปิดระบบชำระเงิน เราจะแจ้งรายละเอียดให้ทราบก่อนใช้งานจริง',
      ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} />
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>{params?.title || title}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>

            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>สถานะตอนนี้</Text>
              {noticeLines.map((line) => (
                <Text key={line} style={styles.noticeText}>{line}</Text>
              ))}
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>{isFreeAccessEnabled ? 'สถานะตอนนี้' : 'จำนวนที่เปิดใช้งานอยู่'}</Text>
              <Text style={styles.amount}>{isFreeAccessEnabled ? 'ยังไม่คิดเงิน' : `${params?.amount ?? 0} บาท`}</Text>
            </View>

            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={handleClose}
            >
              <Text style={styles.payText}>กลับไปใช้งานต่อ</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>ปิดหน้านี้</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.md, flex: 1, justifyContent: 'center' },
  title: { fontSize: FONT_SIZES.xl, fontWeight: '800', marginBottom: SPACING.sm },
  description: { fontSize: FONT_SIZES.sm, marginBottom: SPACING.lg },
  noticeBox: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.warningLight,
    marginBottom: SPACING.md,
  },
  noticeTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: COLORS.warning,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.warning,
    lineHeight: 20,
  },
  amountBox: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, backgroundColor: COLORS.backgroundSecondary, marginBottom: SPACING.lg },
  amountLabel: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  amount: { fontSize: FONT_SIZES.xl, fontWeight: '800', color: COLORS.success, marginTop: SPACING.xs },
  payButton: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, alignItems: 'center' },
  payText: { color: '#FFF', fontWeight: '700' },
  cancelButton: { marginTop: SPACING.md, alignItems: 'center' },
  cancelText: { fontSize: FONT_SIZES.sm },
});
