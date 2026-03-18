// ============================================
// SHOP SCREEN - entitlements and packages (role-aware)
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Clipboard,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { ThemeColors, useTheme } from '../../context/ThemeContext';
import { Card, KittenButton as Button } from '../../components/common';
import CustomAlert, {
  AlertState,
  initialAlertState,
  createAlert,
} from '../../components/common/CustomAlert';
import {
  getLaunchQuotaSummary,
  getUserSubscription,
  getSubscriptionStatusDisplay,
  LaunchQuotaSummary,
} from '../../services/subscriptionService';
import { getReferralInfo } from '../../services/referralService';
import {
  PRICING,
  CampaignCodePackage,
  RootStackParamList,
  SUBSCRIPTION_PLANS,
  Subscription,
  ReferralInfo,
  SubscriptionPlan,
  BillingCycle,
} from '../../types';
import {
  clearPendingCampaignCodeForUser,
  getCampaignBenefitSummary,
  getCampaignPackageDisplayLabel,
} from '../../services/campaignCodeService';
import {
  CommerceAccessStatus,
  getCommerceAccessStatus,
} from '../../services/commerceService';
import { trackEvent } from '../../services/analyticsService';

// ============================================
// Helpers
// ============================================
const getPlanTone = (plan: string, colors: ThemeColors) => {
  switch (plan) {
    case 'premium':
      return { accent: colors.accent, soft: colors.accentLight, label: colors.accentDark };
    case 'nurse_pro':
      return { accent: colors.accent, soft: colors.accentLight, label: colors.accentDark };
    case 'hospital_starter':
      return { accent: colors.primary, soft: colors.primaryBackground, label: colors.primaryDark };
    case 'hospital_pro':
      return { accent: colors.secondary, soft: colors.secondaryLight, label: colors.secondaryDark };
    case 'hospital_enterprise':
      return { accent: colors.success, soft: colors.successLight, label: colors.success };
    case 'premium':
      return { accent: colors.accent, soft: colors.accentLight, label: colors.accentDark };
    case 'free':
    default:
      return { accent: colors.textMuted, soft: colors.borderLight, label: colors.textSecondary };
  }
};

const PLAN_AUDIENCE_COPY: Record<string, string> = {
  free: 'เหมาะกับคนที่เพิ่งเริ่มใช้งานและยังลงประกาศไม่บ่อย',
  premium: 'คุ้มกับผู้ใช้ทั่วไปที่ต้องการสิทธิ์ใช้งานมากขึ้นโดยไม่ผูกกับสายงานพยาบาลโดยตรง',
  nurse_pro: 'คุ้มกับพยาบาลที่ลงเวรหรือหางานต่อเนื่องทุกสัปดาห์',
  hospital_starter: 'คุ้มกับองค์กรที่ลงประกาศเป็นรอบและยังไม่ต้องดันหลายตำแหน่งพร้อมกัน',
  hospital_pro: 'คุ้มกับองค์กรที่เปิดรับหลายตำแหน่งต่อเนื่องและต้องการความคล่องตัวมากขึ้น',
  hospital_enterprise: 'คุ้มกับองค์กรที่ต้องดันประกาศหลายชิ้นพร้อมกันตลอดเดือน',
};

// ============================================
// Main Component
// ============================================
export default function ShopScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, refreshUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isHospital = user?.role === 'hospital' || user?.role === 'admin';
  const consumerPlan: SubscriptionPlan = user?.role === 'nurse' ? 'nurse_pro' : 'premium';

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [commerceStatus, setCommerceStatus] = useState<CommerceAccessStatus | null>(null);
  const [launchQuotaSummary, setLaunchQuotaSummary] = useState<LaunchQuotaSummary | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);

  const closeAlert = () => setAlert(initialAlertState);

  const getPlanPackageKey = useCallback(
    (plan: SubscriptionPlan): CampaignCodePackage => `${plan}_${billingCycle}` as CampaignCodePackage,
    [billingCycle],
  );

  const getAddonPackageKey = (item: 'extraPost' | 'extendPost' | 'urgent'): CampaignCodePackage => {
    switch (item) {
      case 'extraPost':
        return 'extra_post';
      case 'extendPost':
        return 'extend_post';
      case 'urgent':
      default:
        return 'urgent_post';
    }
  };

  const pendingCampaignCode = user?.pendingCampaignCode || null;

  const showBillingUnavailableAlert = (subject: string) => {
    setAlert({
      ...createAlert.info(
        'ยังอยู่ในช่วงทดลองใช้ฟรี',
        `${subject} จะเปิดให้ใช้งานแบบชำระเงินจริงได้อีกครั้งเมื่อระบบชำระเงินพร้อมใช้งาน ตอนนี้บัญชีใช้งานแบบโควตารายเดือนโดยไม่มีการตัดเงิน`
      ),
    } as AlertState);
  };

  const loadData = useCallback(async () => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    try {
      const [sub, ref, commerce, quotaSummary] = await Promise.all([
        getUserSubscription(user.uid),
        getReferralInfo(user.uid),
        getCommerceAccessStatus(),
        getLaunchQuotaSummary(user.uid),
      ]);
      setSubscription(sub);
      setReferralInfo(ref);
      setCommerceStatus(commerce);
      setLaunchQuotaSummary(quotaSummary);
    } catch (e) {
      console.error('ShopScreen loadData:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  const isFreeAccessActive = commerceStatus?.freeAccessEnabled ?? false;

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ----------------------------------------
  // Purchase plan
  // ----------------------------------------
  const handleBuyPlan = async (plan: SubscriptionPlan) => {
    if (isFreeAccessActive) {
      setAlert({
        ...createAlert.info(
          'ตอนนี้ยังเป็นสิทธิ์ช่วงเปิดตัว',
          `แพ็กเกจ ${SUBSCRIPTION_PLANS[plan].name} ยังไม่เปิดเก็บเงินจริง ตอนนี้บัญชีใช้ฟีเจอร์ได้ตามโควตารายเดือนของช่วงเปิดตัว`
        ),
      } as AlertState);
      return;
    }
    if (!user?.uid) {
      setAlert({ ...createAlert.warning('กรุณาเข้าสู่ระบบ', '') } as AlertState);
      return;
    }
    const packageKey = getPlanPackageKey(plan);
    const amount = priceFor(plan);

    if (!commerceStatus?.billingProviderReady) {
      showBillingUnavailableAlert(`แพ็กเกจ ${SUBSCRIPTION_PLANS[plan].name}`);
      return;
    }

    try {
      await trackEvent({
        eventName: 'purchase_started',
        screenName: 'Shop',
        subjectType: 'subscription_plan',
        subjectId: plan,
        props: {
          step: 'purchase_initiated',
          billingCycle,
          amount,
          packageKey,
        },
      });

      showBillingUnavailableAlert(`แพ็กเกจ ${SUBSCRIPTION_PLANS[plan].name}`);
    } catch (e: any) {
      setAlert({
        ...createAlert.error('❌ เกิดข้อผิดพลาด', e.message),
      } as AlertState);
    }
  };

  // ----------------------------------------
  // Purchase add-on
  // ----------------------------------------
  const handleBuyAddon = async (
    item: 'extraPost' | 'extendPost' | 'urgent',
  ) => {
    if (isFreeAccessActive) {
      setAlert({
        ...createAlert.info(
          'ตอนนี้ยังเป็นสิทธิ์ช่วงเปิดตัว',
          'บริการเสริมนี้ยังไม่เปิดเก็บเงินจริง ตอนนี้ใช้งานได้ตามโควตารายเดือนของบัญชี'
        ),
      } as AlertState);
      return;
    }
    if (!user?.uid) return;
    const packageKey = getAddonPackageKey(item);
    const amountMap = {
      extraPost: PRICING.extraPost,
      extendPost: PRICING.extendPost,
      urgent: PRICING.urgentPost,
    };
    const labels = {
      extraPost: 'โพสต์เพิ่ม',
      extendPost: 'ต่ออายุโพสต์',
      urgent: 'ปุ่มด่วน',
    };

    if (!commerceStatus?.billingProviderReady) {
      showBillingUnavailableAlert(labels[item]);
      return;
    }

    try {
      await trackEvent({
        eventName: 'purchase_started',
        screenName: 'Shop',
        subjectType: 'addon',
        subjectId: item,
        props: {
          step: 'purchase_initiated',
          amount: amountMap[item],
          packageKey,
        },
      });

      showBillingUnavailableAlert(labels[item]);
    } catch (e: any) {
      setAlert({
        ...createAlert.error('❌ เกิดข้อผิดพลาด', e.message),
      } as AlertState);
    }
  };

  const copyReferralCode = () => {
    if (referralInfo?.referralCode) {
      Clipboard.setString(referralInfo.referralCode);
      setAlert({
        ...createAlert.success(
          '📋 คัดลอกแล้ว!',
          `โค้ด ${referralInfo.referralCode} ถูกคัดลอกแล้ว`,
        ),
      } as AlertState);
    }
  };

  // ----------------------------------------
  // Price helpers
  // ----------------------------------------
  const priceFor = (plan: SubscriptionPlan): number => {
    const m: Record<SubscriptionPlan, { monthly: number; annual: number }> = {
      free: { monthly: 0, annual: 0 },
      premium: {
        monthly: PRICING.nursePro,
        annual: PRICING.nurseProAnnual,
      },
      nurse_pro: {
        monthly: PRICING.nursePro,
        annual: PRICING.nurseProAnnual,
      },
      hospital_starter: {
        monthly: PRICING.hospitalStarter,
        annual: PRICING.hospitalStarterAnnual,
      },
      hospital_pro: {
        monthly: PRICING.hospitalPro,
        annual: PRICING.hospitalProAnnual,
      },
      hospital_enterprise: {
        monthly: PRICING.hospitalEnterprise,
        annual: PRICING.hospitalEnterpriseAnnual,
      },
    };
    return billingCycle === 'annual' ? m[plan].annual : m[plan].monthly;
  };

  const savingsPct = (plan: SubscriptionPlan): number => {
    const m: Record<SubscriptionPlan, { monthly: number; annual: number }> = {
      free: { monthly: 0, annual: 0 },
      premium: {
        monthly: PRICING.nursePro,
        annual: PRICING.nurseProAnnual,
      },
      nurse_pro: {
        monthly: PRICING.nursePro,
        annual: PRICING.nurseProAnnual,
      },
      hospital_starter: {
        monthly: PRICING.hospitalStarter,
        annual: PRICING.hospitalStarterAnnual,
      },
      hospital_pro: {
        monthly: PRICING.hospitalPro,
        annual: PRICING.hospitalProAnnual,
      },
      hospital_enterprise: {
        monthly: PRICING.hospitalEnterprise,
        annual: PRICING.hospitalEnterpriseAnnual,
      },
    };
    const monthly12 = m[plan].monthly * 12;
    if (!monthly12) return 0;
    return Math.round(((monthly12 - m[plan].annual) / monthly12) * 100);
  };

  const currentPlan = subscription?.plan || 'free';
  const statusDisplay = subscription
    ? getSubscriptionStatusDisplay(subscription)
    : null;
  const currentPlanTone = getPlanTone(currentPlan, colors);
  const panelBackground = isDark ? colors.surface : colors.white;
  const panelAltBackground = isDark ? colors.card : colors.backgroundSecondary;
  const subtleBorder = colors.border;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  const toggleActiveStyle = {
    backgroundColor: panelBackground,
    borderColor: subtleBorder,
    borderWidth: isDark ? 1 : 0,
  };

  const handleClearPendingCode = async () => {
    if (!user?.uid) return;
    try {
      await clearPendingCampaignCodeForUser(user.uid);
      await refreshUser();
      setAlert({
        ...createAlert.success('ลบโค้ดที่รอใช้แล้ว', 'คุณสามารถกลับไปกรอกโค้ดใหม่ที่หน้าโปรไฟล์ได้'),
      } as AlertState);
    } catch (error: any) {
      setAlert({
        ...createAlert.error('ลบโค้ดไม่สำเร็จ', error.message || 'กรุณาลองใหม่'),
      } as AlertState);
    }
  };

  // ----------------------------------------
  // Render
  // ----------------------------------------
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: panelBackground }]} edges={['top']}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={panelBackground} translucent={false} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: panelBackground }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={panelBackground} translucent={false} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: panelBackground, borderBottomColor: subtleBorder }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{isFreeAccessActive ? 'สิทธิ์และบริการในบัญชี' : 'สิทธิ์และแพ็กเกจ'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isFreeAccessActive && commerceStatus && (
          <Card style={StyleSheet.flatten([
            styles.pendingCodeCard,
            { backgroundColor: colors.infoLight || '#E8F1FF', borderColor: colors.primary },
          ])}>
            <Text style={[styles.pendingCodeTitle, { color: colors.text }]}>สิทธิ์เพิ่มเติมที่เปิดใช้ในบัญชีนี้</Text>
            <Text style={[styles.pendingCodeDesc, { color: colors.textSecondary }]}> 
              บัญชีนี้ใช้งานฟีเจอร์หลักและบริการเสริมได้ในช่วงเปิดตัว แต่แต่ละรายการจะมีโควตารายเดือนตามประเภทบัญชี
            </Text>
            <Text style={[styles.pendingCodeHint, { color: colors.textMuted }]}> 
              รายละเอียดที่เห็นอาจแตกต่างกันตามประเภทบัญชีและจำนวนสิทธิ์ที่ใช้ไปแล้วในเดือนนี้
            </Text>
            <View style={styles.featureList}>
              {(isHospital
                ? [
                    'ลงประกาศและติดตามผู้สนใจได้ภายในโควตารายเดือนขององค์กร',
                    'ใช้ป้ายด่วน ต่ออายุ และดันโพสต์ได้ตามสิทธิ์ที่เหลือ',
                    'คุยต่อผ่านแชทและจัดการผู้สมัครได้ภายใต้โควตาการใช้งานของบัญชี',
                  ]
                : [
                    'ใช้งานฟีเจอร์หลักได้ทันทีภายในโควตารายเดือนของบัญชี',
                    'บริการเสริมบางรายการพร้อมใช้ตามสิทธิ์ที่ระบบจัดสรรให้',
                    'ระบบจะรีเซ็ตโควตาใหม่ทุกเดือนเพื่อให้ใช้งานต่อได้อย่างต่อเนื่อง',
                  ]).map((item) => (
                <View key={item} style={styles.featureRow}>
                  <Ionicons name="sparkles" size={16} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{item}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {isFreeAccessActive && launchQuotaSummary && (
          <Card style={StyleSheet.flatten([
            styles.pendingCodeCard,
            { backgroundColor: panelBackground, borderColor: subtleBorder },
          ])}>
            <Text style={[styles.pendingCodeTitle, { color: colors.text }]}>{launchQuotaSummary.title}</Text>
            <Text style={[styles.pendingCodeDesc, { color: colors.textSecondary }]}>
              {launchQuotaSummary.subtitle}
            </Text>
            <View style={styles.launchQuotaList}>
              {launchQuotaSummary.items.map((item) => (
                <View key={item.feature} style={[styles.launchQuotaRow, { borderTopColor: subtleBorder }]}> 
                  <View style={styles.launchQuotaHeader}>
                    <Text style={[styles.launchQuotaLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text style={[styles.launchQuotaStatus, { color: colors.primary }]}>{item.statusText}</Text>
                  </View>
                  <Text style={[styles.launchQuotaDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.pendingCodeHint, { color: colors.textMuted }]}>{launchQuotaSummary.footnote}</Text>
          </Card>
        )}

        {/* Current Plan Banner */}
        <Card
          style={StyleSheet.flatten([
            styles.currentPlanCard,
            { borderColor: currentPlanTone.accent, backgroundColor: panelBackground },
          ])}>
          <View style={styles.planBannerRow}>
            <View>
              <Text style={[styles.planLabel, { color: colors.textSecondary }]}>แพ็กเกจปัจจุบัน</Text>
              <Text
                style={[styles.planName, { color: currentPlanTone.accent }]}> 
                {statusDisplay?.planName || '🆓 ฟรี'}
              </Text>
            </View>
            {statusDisplay?.expiresText && (
              <View style={[styles.expiryBadge, { backgroundColor: currentPlanTone.soft }]}>
                <Text style={[styles.expiryText, { color: currentPlanTone.label }]}> 
                  {statusDisplay.expiresText}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {!isFreeAccessActive && pendingCampaignCode && (
          <Card style={StyleSheet.flatten([
            styles.pendingCodeCard,
            { backgroundColor: colors.warningLight, borderColor: colors.warning },
          ])}>
            <View style={styles.pendingCodeHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pendingCodeTitle, { color: colors.text }]}>โค้ดที่รอใช้</Text>
                <Text style={[styles.pendingCodeCode, { color: colors.warning }]}>{pendingCampaignCode.code}</Text>
              </View>
              <TouchableOpacity onPress={handleClearPendingCode} style={styles.pendingCodeClearBtn}>
                <Ionicons name="close-circle-outline" size={18} color={colors.warning} />
                <Text style={[styles.pendingCodeClearText, { color: colors.warning }]}>ล้าง</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.pendingCodeDesc, { color: colors.textSecondary }]}>
              ใช้กับ {getCampaignPackageDisplayLabel(pendingCampaignCode.packageKey, user?.role)}
            </Text>
            <Text style={[styles.pendingCodeDesc, { color: colors.textSecondary }]}> 
              {getCampaignBenefitSummary(pendingCampaignCode.benefitType, pendingCampaignCode.benefitValue)}
              {pendingCampaignCode.discountAmount > 0
                ? ` • จาก ฿${pendingCampaignCode.originalAmount.toLocaleString()} เหลือ ฿${pendingCampaignCode.finalAmount.toLocaleString()}`
                : ''}
            </Text>
            <Text style={[styles.pendingCodeHint, { color: colors.textMuted }]}>ระบบจะใช้โค้ดนี้อัตโนมัติเมื่อซื้อรายการที่ตรงกัน</Text>
          </Card>
        )}

        {isFreeAccessActive && (
          <Text style={[styles.sectionTitle, { color: colors.text }]}>สิทธิ์ที่เปิดใช้ในบัญชีนี้</Text>
        )}

        {/* Billing Cycle Toggle */}
        <View style={[styles.toggleRow, { backgroundColor: panelAltBackground }]}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              billingCycle === 'monthly' && styles.toggleActive,
              billingCycle === 'monthly' && toggleActiveStyle,
            ]}
            onPress={() => setBillingCycle('monthly')}>
            <Text
              style={[
                styles.toggleText,
                { color: colors.textSecondary },
                billingCycle === 'monthly' && styles.toggleActiveText,
                billingCycle === 'monthly' && { color: colors.text },
              ]}>
              รายเดือน
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              billingCycle === 'annual' && styles.toggleActive,
              billingCycle === 'annual' && toggleActiveStyle,
            ]}
            onPress={() => setBillingCycle('annual')}>
            <Text
              style={[
                styles.toggleText,
                { color: colors.textSecondary },
                billingCycle === 'annual' && styles.toggleActiveText,
                billingCycle === 'annual' && { color: colors.text },
              ]}>
              รายปี
            </Text>
            <View style={[styles.savingsPill, { backgroundColor: colors.successLight }]}>
              <Text style={[styles.savingsPillText, { color: colors.success }]}>ประหยัด ~17%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ---- NURSE PLANS ---- */}
        {!isHospital && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>แพ็กเกจสำหรับพยาบาล</Text>
            <NursePlanCard
              plan="free"
              isCurrent={currentPlan === 'free'}
              summary={PLAN_AUDIENCE_COPY.free}
              features={SUBSCRIPTION_PLANS.free.features}
              commerceLocked={isFreeAccessActive}
              onBuy={() => {}}
              billingCycle={billingCycle}
            />
            <NursePlanCard
              plan={consumerPlan as 'premium' | 'nurse_pro'}
              price={priceFor(consumerPlan)}
              savings={billingCycle === 'annual' ? savingsPct(consumerPlan) : 0}
              isCurrent={currentPlan === consumerPlan}
              summary={PLAN_AUDIENCE_COPY[consumerPlan]}
              features={SUBSCRIPTION_PLANS[consumerPlan].features}
              commerceLocked={isFreeAccessActive}
              onBuy={() => handleBuyPlan(consumerPlan)}
              billingCycle={billingCycle}
            />
          </>
        )}

        {/* ---- HOSPITAL PLANS ---- */}
        {isHospital && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>แพ็กเกจสำหรับโรงพยาบาล</Text>
            {(
              [
                'hospital_starter',
                'hospital_pro',
                'hospital_enterprise',
              ] as SubscriptionPlan[]
            ).map(plan => (
              <HospitalPlanCard
                key={plan}
                plan={plan}
                price={priceFor(plan)}
                savings={
                  billingCycle === 'annual' ? savingsPct(plan) : 0
                }
                isCurrent={currentPlan === plan}
                summary={PLAN_AUDIENCE_COPY[plan]}
                features={SUBSCRIPTION_PLANS[plan].features}
                commerceLocked={isFreeAccessActive}
                onBuy={() => handleBuyPlan(plan)}
                billingCycle={billingCycle}
              />
            ))}
          </>
        )}

        {/* ---- ADD-ONS ---- */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {isFreeAccessActive ? 'บริการเสริมที่พร้อมใช้ในบัญชีนี้' : 'เปิดใช้รายครั้ง'}
        </Text>

        <Card style={StyleSheet.flatten([styles.itemCard, { backgroundColor: panelBackground, borderColor: subtleBorder, borderWidth: 1 }])}> 
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemIcon}>📝</Text>
              <View>
                <Text style={[styles.itemTitle, { color: colors.text }]}>โพสต์เพิ่ม 1 ครั้ง</Text>
                <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>ใช้สำหรับเพิ่มความยืดหยุ่นเมื่อโควตาโพสต์ประจำเดือนใกล้เต็ม</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.buyButton, { backgroundColor: colors.primary }]}
              onPress={() => handleBuyAddon('extraPost')}
              disabled={isFreeAccessActive}>
              <Text style={[styles.buyButtonText, { color: colors.white }]}>{isFreeAccessActive ? 'ดูโควตาในบัญชี' : `฿${PRICING.extraPost}`}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={StyleSheet.flatten([styles.itemCard, { backgroundColor: panelBackground, borderColor: subtleBorder, borderWidth: 1 }])}> 
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemIcon}>⏰</Text>
              <View>
                <Text style={[styles.itemTitle, { color: colors.text }]}>ต่ออายุโพสต์ +1 วัน</Text>
                <Text style={[styles.itemDesc, { color: colors.textSecondary }]}> 
                  ขยายเวลาให้ประกาศยังมองเห็นต่อได้ภายในโควตาบริการเสริมของเดือนนี้
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.buyButton, { backgroundColor: colors.primary }]}
              onPress={() => handleBuyAddon('extendPost')}
              disabled={isFreeAccessActive}>
              <Text style={[styles.buyButtonText, { color: colors.white }]}>{isFreeAccessActive ? 'ดูโควตาในบัญชี' : `฿${PRICING.extendPost}`}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={StyleSheet.flatten([styles.itemCard, { backgroundColor: panelBackground, borderColor: subtleBorder, borderWidth: 1 }])}> 
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemIcon}>⚡</Text>
              <View>
                <Text style={[styles.itemTitle, { color: colors.text }]}>ปุ่มด่วน (Urgent)</Text>
                <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>ช่วยให้ประกาศสำคัญถูกมองเห็นได้เร็วขึ้นตามโควตาบริการเสริมที่เหลือ</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.buyButton, { backgroundColor: colors.primary }]}
              onPress={() => handleBuyAddon('urgent')}
              disabled={isFreeAccessActive}>
              <Text style={[styles.buyButtonText, { color: colors.white }]}>{isFreeAccessActive ? 'ดูโควตาในบัญชี' : `฿${PRICING.urgentPost}`}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ---- REFERRAL ---- */}
        {referralInfo && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>แนะนำเพื่อน</Text>
            <Card style={StyleSheet.flatten([styles.referralCard, { backgroundColor: colors.accentLight, borderColor: colors.accent }])}> 
              <Text style={[styles.referralTitle, { color: colors.accentDark }]}> 
                แนะนำเพื่อน → ได้ Pro ฟรี 1 เดือน!
              </Text>
              <Text style={[styles.referralDesc, { color: colors.textSecondary }]}> 
                เพื่อนสมัครและอัปเกรด คุณและเพื่อนได้รับสิทธิ์พรีเมียมฟรี 1 เดือนตามประเภทบัญชี
              </Text>
              <View style={[styles.referralCodeBox, { backgroundColor: panelBackground, borderColor: colors.accent }]}> 
                <Text style={[styles.referralCodeLabel, { color: colors.textMuted }]}>โค้ดของคุณ</Text>
                <View style={styles.referralCodeRow}>
                  <Text style={[styles.referralCode, { color: colors.text }]}> 
                    {referralInfo.referralCode}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={copyReferralCode}>
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={[styles.copyText, { color: colors.primary }]}>คัดลอก</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.referralStats, { backgroundColor: panelBackground }]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: colors.text }]}> 
                    {referralInfo.referredCount}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>เพื่อนที่แนะนำ</Text>
                </View>
                <View
                  style={[
                    styles.statBox,
                    { borderLeftWidth: 1, borderLeftColor: colors.border },
                  ]}>
                  <Text style={[styles.statNum, { color: colors.text }]}> 
                    {referralInfo.rewardMonthsEarned}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>เดือนฟรีที่ได้</Text>
                </View>
                <View
                  style={[
                    styles.statBox,
                    { borderLeftWidth: 1, borderLeftColor: colors.border },
                  ]}>
                  <Text style={[styles.statNum, { color: colors.text }]}> 
                    {referralInfo.rewardMonthsEarned -
                      referralInfo.rewardMonthsUsed}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>เดือนคงเหลือ</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      <CustomAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onClose={closeAlert}
      />
    </SafeAreaView>
  );
}

// ============================================================
// Sub-components
// ============================================================

interface NursePlanCardProps {
  plan: 'free' | 'premium' | 'nurse_pro';
  price?: number;
  savings?: number;
  isCurrent: boolean;
  summary: string;
  features: readonly string[];
  commerceLocked: boolean;
  onBuy: () => void;
  billingCycle: BillingCycle;
}

function NursePlanCard({
  plan,
  price,
  savings,
  isCurrent,
  summary,
  features,
  commerceLocked,
  onBuy,
  billingCycle,
}: NursePlanCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isFree = plan === 'free';
  const tone = getPlanTone(plan, colors);

  return (
    <Card
      style={StyleSheet.flatten([
        styles.planCard,
        {
          backgroundColor: isDark ? colors.surface : colors.white,
          borderColor: isCurrent ? tone.accent : colors.border,
          borderWidth: isCurrent ? 2 : 1,
        },
      ])}>
      <View style={styles.planCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planCardName, { color: tone.accent }]}> 
            {isFree ? '🆓 ฟรี' : plan === 'premium' ? '👑 Premium' : '👑 Nurse Pro'}
          </Text>
          <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>{summary}</Text>
          {!isFree && price !== undefined && (
            <Text style={[styles.planCardPrice, { color: colors.text }]}> 
              ฿{price}
              <Text style={[styles.planCardPriceUnit, { color: colors.textSecondary }]}> 
                /{billingCycle === 'annual' ? 'ปี' : 'เดือน'}
              </Text>
              {billingCycle === 'monthly' && (
                <Text style={[styles.planCardPriceUnit, { color: colors.textSecondary }]}> 
                  {' '}(฿{PRICING.nursePro}/เดือน)
                </Text>
              )}
            </Text>
          )}
        </View>
        {savings && savings > 0 ? (
          <View style={[styles.savingsTag, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.savingsTagText, { color: colors.success }]}>ประหยัด {savings}%</Text>
          </View>
        ) : null}
        {isCurrent && (
          <View style={[styles.currentTag, { backgroundColor: tone.soft }]}>
            <Text style={[styles.currentTagText, { color: tone.label }]}>ใช้งานอยู่</Text>
          </View>
        )}
      </View>
      <View style={styles.featureList}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={tone.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
          </View>
        ))}
      </View>
      {!isCurrent && !isFree && !commerceLocked && (
        <TouchableOpacity
          style={[styles.planBuyBtn, { backgroundColor: tone.accent }]}
          onPress={onBuy}>
          <Text style={[styles.planBuyBtnText, { color: colors.white }]}>อัพเกรด</Text>
        </TouchableOpacity>
      )}
      {!isCurrent && !isFree && commerceLocked && (
        <View style={[styles.currentTag, { backgroundColor: tone.soft, alignSelf: 'flex-start', marginTop: 12 }]}> 
          <Text style={[styles.currentTagText, { color: tone.label }]}>รวมในสิทธิ์บัญชีนี้</Text>
        </View>
      )}
    </Card>
  );
}

interface HospitalPlanCardProps {
  plan: SubscriptionPlan;
  price: number;
  savings: number;
  isCurrent: boolean;
  summary: string;
  features: readonly string[];
  commerceLocked: boolean;
  onBuy: () => void;
  billingCycle: BillingCycle;
}

function HospitalPlanCard({
  plan,
  price,
  savings,
  isCurrent,
  summary,
  features,
  commerceLocked,
  onBuy,
  billingCycle,
}: HospitalPlanCardProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const planMeta: Record<string, { label: string }> = {
    hospital_starter: {
      label: '🏥 Starter',
    },
    hospital_pro: {
      label: '🏥 Professional',
    },
    hospital_enterprise: {
      label: '🏢 Enterprise',
    },
  };

  const meta = planMeta[plan];
  const tone = getPlanTone(plan, colors);

  return (
    <Card
      style={StyleSheet.flatten([
        styles.planCard,
        {
          backgroundColor: isDark ? colors.surface : colors.white,
          borderColor: isCurrent ? tone.accent : colors.border,
          borderWidth: isCurrent ? 2 : 1,
        },
      ])}>
      <View style={styles.planCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.planCardName, { color: tone.accent }]}>{meta?.label}</Text>
          <Text style={[styles.itemDesc, { color: colors.textSecondary }]}>{summary}</Text>
          <Text style={[styles.planCardPrice, { color: colors.text }]}> 
            ฿{price}
            <Text style={[styles.planCardPriceUnit, { color: colors.textSecondary }]}> 
              /{billingCycle === 'annual' ? 'ปี' : 'เดือน'}
            </Text>
          </Text>
        </View>
        {savings > 0 && (
          <View style={[styles.savingsTag, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.savingsTagText, { color: colors.success }]}>ประหยัด {savings}%</Text>
          </View>
        )}
        {isCurrent && (
          <View style={[styles.currentTag, { backgroundColor: tone.soft }]}>
            <Text style={[styles.currentTagText, { color: tone.label }]}>ใช้งานอยู่</Text>
          </View>
        )}
      </View>
      <View style={styles.featureList}>
        {(features || []).map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={tone.accent} />
            <Text style={[styles.featureText, { color: colors.text }]}>{f}</Text>
          </View>
        ))}
      </View>
      {!isCurrent && !commerceLocked && (
        <TouchableOpacity
          style={[styles.planBuyBtn, { backgroundColor: tone.accent }]}
          onPress={onBuy}>
          <Text style={[styles.planBuyBtnText, { color: colors.white }]}>เลือกแผนนี้</Text>
        </TouchableOpacity>
      )}
      {!isCurrent && commerceLocked && (
        <View style={[styles.currentTag, { backgroundColor: tone.soft, alignSelf: 'flex-start', marginTop: 12 }]}> 
          <Text style={[styles.currentTagText, { color: tone.label }]}>รวมในสิทธิ์บัญชีนี้</Text>
        </View>
      )}
    </Card>
  );
}

// ============================================
// Styles
// ============================================
const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: { flex: 1, padding: SPACING.md },

  // Current Plan
  currentPlanCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
  },
  pendingCodeCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
  },
  pendingCodeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: SPACING.sm,
  },
  pendingCodeTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  pendingCodeCode: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    marginTop: 2,
  },
  pendingCodeClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pendingCodeClearText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  pendingCodeDesc: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  pendingCodeHint: {
    fontSize: FONT_SIZES.xs,
    marginTop: 8,
  },
  launchQuotaList: {
    marginTop: SPACING.sm,
  },
  launchQuotaRow: {
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  launchQuotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  launchQuotaLabel: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  launchQuotaStatus: {
    flex: 1,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    textAlign: 'right',
  },
  launchQuotaDesc: {
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
    lineHeight: 18,
  },
  planBannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  planName: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  expiryBadge: {
    backgroundColor: COLORS.warningLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  expiryText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    fontWeight: '600',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.full,
    padding: 4,
    marginBottom: SPACING.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  toggleActive: { backgroundColor: COLORS.white, ...SHADOWS.small },
  toggleText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  toggleActiveText: { color: COLORS.text, fontWeight: '700' },
  savingsPill: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
  },
  savingsPillText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '600',
  },

  // Section Title
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.xs,
  },

  // Plan Card
  planCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  planCardName: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  planCardPrice: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  planCardPriceUnit: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  savingsTag: {
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.xs,
  },
  savingsTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '700',
  },
  currentTag: {
    backgroundColor: COLORS.infoLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    marginLeft: SPACING.xs,
  },
  currentTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '700',
  },
  featureList: { marginBottom: SPACING.md },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: SPACING.xs,
  },
  featureText: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  planBuyBtn: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  planBuyBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#fff',
  },

  // Add-on cards
  itemCard: { marginBottom: SPACING.sm, padding: SPACING.md },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemIcon: { fontSize: 26, marginRight: SPACING.md },
  itemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  buyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  buyButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#fff',
  },

  // Referral
  referralCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.warningLight,
    borderWidth: 1,
    borderColor: COLORS.warning,
    borderRadius: BORDER_RADIUS.md,
  },
  referralTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.warning,
    marginBottom: 4,
  },
  referralDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  referralCodeBox: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  referralCodeLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  referralCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  referralCode: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 2,
  },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  referralStats: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  statNum: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: COLORS.text,
  },
  statLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary },

  // Restore
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
  },
  restoreText: { fontSize: FONT_SIZES.sm, fontWeight: '500' },

  // Purchasing overlay
  purchasingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  purchasingBox: {
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    gap: SPACING.md,
    ...SHADOWS.medium,
  },
  purchasingText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
});
