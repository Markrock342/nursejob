import React, { useEffect, useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../types';
import { CommerceAccessStatus, getCommerceAccessStatus } from '../../services/commerceService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useI18n } from '../../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

export default function PaymentScreen({
  route, navigation }: Props) {
  const { t } = useI18n();
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
      ? t('payment.transitionReviewTitle')
      : t('payment.monthlyQuotaTitle')
    : t('payment.livePaymentTitle');
  const description = isFreeAccessEnabled
    ? transitionReviewRequired
      ? t('payment.transitionReviewDesc')
      : t('payment.monthlyQuotaDesc')
    : t('payment.livePaymentDesc');
  const noticeLines = isFreeAccessEnabled
    ? [
        transitionReviewRequired
          ? billingProviderReady
            ? t('payment.gatewayReadyAwaitingApproval')
            : t('payment.awaitingGateway')
          : t('payment.quotaManagedNote'),
        t('payment.noChargesNote'),
      ]
    : [
        billingProviderReady
          ? t('payment.livePaymentReady')
          : t('payment.paymentNotReady'),
        t('payment.willNotifyBeforeLaunch'),
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
              <Text style={styles.noticeTitle}>{t('payment.currentStatus')}</Text>
              {noticeLines.map((line) => (
                <Text key={line} style={styles.noticeText}>{line}</Text>
              ))}
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>{isFreeAccessEnabled ? t('payment.currentStatus') : t('payment.activeAmount')}</Text>
              <Text style={styles.amount}>{isFreeAccessEnabled ? t('payment.noCharges') : t('payment.baht')}</Text>
            </View>

            <TouchableOpacity
              style={[styles.payButton, { backgroundColor: colors.primary }]}
              onPress={handleClose}
            >
              <Text style={styles.payText}>{t('payment.continueUsing')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>{t('payment.closePage')}</Text>
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
