// ============================================
// SHOP SCREEN - à¸£à¹‰à¸²à¸™à¸„à¹‰à¸² / à¸‹à¸·à¹‰à¸­à¸šà¸£à¸´à¸à¸²à¸£ (Role-aware)
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Card, KittenButton as Button } from '../../components/common';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import { getUserSubscription, getSubscriptionStatusDisplay, upgradePlan } from '../../services/subscriptionService';
import { getReferralInfo } from '../../services/referralService';
import { PRICING, SUBSCRIPTION_PLANS, Subscription, ReferralInfo, SubscriptionPlan, BillingCycle } from '../../types';
import {
  initializeIAP,
  requestIAPPurchase,
  restoreIAPPurchases,
  cleanupIAP,
  IAP_PRODUCTS,
} from '../../services/iapService';

// ============================================
// Helpers
// ============================================
const planColor: Record<string, string> = {
  free: '#888',
  nurse_pro: '#FF8F00',
  hospital_starter: '#0288D1',
  hospital_pro: '#6A1B9A',
  hospital_enterprise: '#1B5E20',
  premium: '#FFD700',
};

// ============================================
// Component
// ============================================
export default function ShopScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();

  const isHospital = user?.role === 'hospital' || user?.role === 'admin';

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [referralInfo, setReferralInfo] = useState<ReferralInfo | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);

  const closeAlert = () => setAlert(initialAlertState);

  const loadData = useCallback(async () => {
    if (!user?.uid) { setIsLoading(false); return; }
    try {
      const [sub, ref] = await Promise.all([
        getUserSubscription(user.uid),
        getReferralInfo(user.uid),
      ]);
      setSubscription(sub);
      setReferralInfo(ref);
    } catch (e) {
      console.error('ShopScreen loadData:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    initializeIAP();
    loadData();
    return () => { cleanupIAP(); };
  }, [loadData]);

  // ----------------------------------------
  // Purchase plan
  // ----------------------------------------
  const handleBuyPlan = async (plan: SubscriptionPlan) => {
    if (!user?.uid) {
      setAlert({ ...createAlert.warning('à¸à¸£à¸¸à¸“à¸²à¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š', '') } as AlertState);
      return;
    }
    // All plans map to PREMIUM_MONTHLY product ID while USE_MOCK_IAP=true;
    // swap in real product IDs once IAP is wired up.
    const productId = IAP_PRODUCTS.PREMIUM_MONTHLY;

    setIsPurchasing(true);
    try {
      const result = await requestIAPPurchase(productId, user.uid, user.displayName || 'User');
      if (result.success) {
        await upgradePlan(user.uid, plan, billingCycle);
        setAlert({ ...createAlert.success('âœ… à¸­à¸±à¸žà¹€à¸à¸£à¸”à¸ªà¸³à¹€à¸£à¹‡à¸ˆ!', 'à¹à¸žà¹‡à¸à¹€à¸à¸ˆà¸‚à¸­à¸‡à¸„à¸¸à¸“à¸–à¸¹à¸à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹à¸¥à¹‰à¸§') } as AlertState);
        loadData();
      } else if (result.error && result.error !== 'à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸¢à¸à¹€à¸¥à¸´à¸') {
        setAlert({ ...createAlert.error('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', result.error) } as AlertState);
      }
    } catch (e: any) {
      setAlert({ ...createAlert.error('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', e.message) } as AlertState);
    } finally {
      setIsPurchasing(false);
    }
  };

  // ----------------------------------------
  // Purchase add-on
  // ----------------------------------------
  const handleBuyAddon = async (item: 'extraPost' | 'extendPost' | 'urgent') => {
    if (!user?.uid) return;
    const productIdMap = {
      extraPost: IAP_PRODUCTS.EXTRA_POST,
      extendPost: IAP_PRODUCTS.EXTEND_POST,
      urgent: IAP_PRODUCTS.URGENT_POST,
    };
    const labels = { extraPost: 'à¹‚à¸žà¸ªà¸•à¹Œà¹€à¸žà¸´à¹ˆà¸¡', extendPost: 'à¸•à¹ˆà¸­à¸­à¸²à¸¢à¸¸à¹‚à¸žà¸ªà¸•à¹Œ', urgent: 'à¸›à¸¸à¹ˆà¸¡à¸”à¹ˆà¸§à¸™' };

    setIsPurchasing(true);
    try {
      const result = await requestIAPPurchase(productIdMap[item], user.uid, user.displayName || 'User');
      if (result.success) {
        setAlert({ ...createAlert.success('âœ… à¸‹à¸·à¹‰à¸­à¸ªà¸³à¹€à¸£à¹‡à¸ˆ!', `${labels[item]} à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¹à¸¥à¹‰à¸§`) } as AlertState);
      } else if (result.error && result.error !== 'à¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸¢à¸à¹€à¸¥à¸´à¸') {
        setAlert({ ...createAlert.error('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', result.error) } as AlertState);
      }
    } catch (e: any) {
      setAlert({ ...createAlert.error('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', e.message) } as AlertState);
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      const results = await restoreIAPPurchases();
      const ok = results.filter(r => r.success);
      if (ok.length > 0) {
        setAlert({ ...createAlert.success('âœ… à¸à¸¹à¹‰à¸„à¸·à¸™à¸ªà¸³à¹€à¸£à¹‡à¸ˆ', `à¸žà¸š ${ok.length} à¸£à¸²à¸¢à¸à¸²à¸£`) } as AlertState);
        loadData();
      } else {
        setAlert({ ...createAlert.info('â„¹ï¸ à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£', 'à¹„à¸¡à¹ˆà¸žà¸šà¸£à¸²à¸¢à¸à¸²à¸£à¸‹à¸·à¹‰à¸­à¸—à¸µà¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸à¸¹à¹‰à¸„à¸·à¸™à¹„à¸”à¹‰') } as AlertState);
      }
    } catch (e: any) {
      setAlert({ ...createAlert.error('âŒ à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”', e.message) } as AlertState);
    } finally {
      setIsPurchasing(false);
    }
  };

  const copyReferralCode = () => {
    if (referralInfo?.referralCode) {
      Clipboard.setString(referralInfo.referralCode);
      setAlert({ ...createAlert.success('ðŸ“‹ à¸„à¸±à¸”à¸¥à¸­à¸à¹à¸¥à¹‰à¸§!', `à¹‚à¸„à¹‰à¸” ${referralInfo.referralCode} à¸–à¸¹à¸à¸„à¸±à¸”à¸¥à¸­à¸à¹à¸¥à¹‰à¸§`) } as AlertState);
    }
  };

  // ----------------------------------------
  // Price helper
  // ----------------------------------------
  const priceFor = (plan: SubscriptionPlan): number => {
    const m: Record<SubscriptionPlan, { monthly: number; annual: number }> = {
      free:                 { monthly: 0, annual: 0 },
      nurse_pro:            { monthly: PRICING.nursePro, annual: PRICING.nurseProAnnual },
      hospital_starter:     { monthly: PRICING.hospitalStarter, annual: PRICING.hospitalStarterAnnual },
      hospital_pro:         { monthly: PRICING.hospitalPro, annual: PRICING.hospitalProAnnual },
      hospital_enterprise:  { monthly: PRICING.hospitalEnterprise, annual: PRICING.hospitalEnterpriseAnnual },
    };
    return billingCycle === 'annual' ? m[plan].annual : m[plan].monthly;
  };

  const savingsPct = (plan: SubscriptionPlan): number => {
    const m: Record<SubscriptionPlan, { monthly: number; annual: number }> = {
      free:                 { monthly: 0, annual: 0 },
      nurse_pro:            { monthly: PRICING.nursePro, annual: PRICING.nurseProAnnual },
      hospital_starter:     { monthly: PRICING.hospitalStarter, annual: PRICING.hospitalStarterAnnual },
      hospital_pro:         { monthly: PRICING.hospitalPro, annual: PRICING.hospitalProAnnual },
      hospital_enterprise:  { monthly: PRICING.hospitalEnterprise, annual: PRICING.hospitalEnterpriseAnnual },
    };
    const monthly12 = m[plan].monthly * 12;
    if (!monthly12) return 0;
    return Math.round(((monthly12 - m[plan].annual) / monthly12) * 100);
  };

  const currentPlan = subscription?.plan || 'free';
  const statusDisplay = subscription ? getSubscriptionStatusDisplay(subscription) : null;

  // ----------------------------------------
  // Render
  // ----------------------------------------
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ðŸ›’ à¸£à¹‰à¸²à¸™à¸„à¹‰à¸²</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* Current Plan Banner */}
        <Card style={StyleSheet.flatten([styles.currentPlanCard, { borderColor: planColor[currentPlan] }])}>
          <View style={styles.planBannerRow}>
            <View>
              <Text style={styles.planLabel}>à¹à¸žà¹‡à¸à¹€à¸à¸ˆà¸›à¸±à¸ˆà¸ˆà¸¸à¸šà¸±à¸™</Text>
              <Text style={[styles.planName, { color: planColor[currentPlan] }]}>
                {statusDisplay?.planName || 'ðŸ†“ à¸Ÿà¸£à¸µ'}
              </Text>
            </View>
            {statusDisplay?.expiresText && (
              <View style={styles.expiryBadge}>
                <Text style={styles.expiryText}>{statusDisplay.expiresText}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Billing Cycle Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, billingCycle === 'monthly' && styles.toggleActive]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text style={[styles.toggleText, billingCycle === 'monthly' && styles.toggleActiveText]}>à¸£à¸²à¸¢à¹€à¸”à¸·à¸­à¸™</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, billingCycle === 'annual' && styles.toggleActive]}
            onPress={() => setBillingCycle('annual')}
          >
            <Text style={[styles.toggleText, billingCycle === 'annual' && styles.toggleActiveText]}>à¸£à¸²à¸¢à¸›à¸µ</Text>
            <View style={styles.savingsPill}><Text style={styles.savingsPillText}>à¸›à¸£à¸°à¸«à¸¢à¸±à¸” ~17%</Text></View>
          </TouchableOpacity>
        </View>

        {/* ---- NURSE PLANS ---- */}
        {!isHospital && (
          <>
            <Text style={styles.sectionTitle}>ðŸ’Š à¹à¸žà¹‡à¸à¹€à¸à¸ˆà¸ªà¸³à¸«à¸£à¸±à¸šà¸žà¸¢à¸²à¸šà¸²à¸¥</Text>

            <NursePlanCard
              plan="free"
              isCurrent={currentPlan === 'free'}
              onBuy={() => {}}
              billingCycle={billingCycle}
            />
            <NursePlanCard
              plan="nurse_pro"
              price={priceFor('nurse_pro')}
              savings={billingCycle === 'annual' ? savingsPct('nurse_pro') : 0}
              isCurrent={currentPlan === 'nurse_pro'}
              onBuy={() => handleBuyPlan('nurse_pro')}
              billingCycle={billingCycle}
            />
          </>
        )}

        {/* ---- HOSPITAL PLANS ---- */}
        {isHospital && (
          <>
            <Text style={styles.sectionTitle}>ðŸ¥ à¹à¸žà¹‡à¸à¹€à¸à¸ˆà¸ªà¸³à¸«à¸£à¸±à¸šà¹‚à¸£à¸‡à¸žà¸¢à¸²à¸šà¸²à¸¥</Text>
            {(['hospital_starter', 'hospital_pro', 'hospital_enterprise'] as SubscriptionPlan[]).map(plan => (
              <HospitalPlanCard
                key={plan}
                plan={plan}
                price={priceFor(plan)}
                savings={billingCycle === 'annual' ? savingsPct(plan) : 0}
                isCurrent={currentPlan === plan}
                onBuy={() => handleBuyPlan(plan)}
                billingCycle={billingCycle}
              />
            ))}
          </>
        )}

        {/* ---- ADD-ONS ---- */}
        <Text style={styles.sectionTitle}>ðŸ’¡ à¸‹à¸·à¹‰à¸­à¹à¸¢à¸à¸£à¸²à¸¢à¸„à¸£à¸±à¹‰à¸‡</Text>

        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemIcon}>ðŸ“</Text>
              <View>
                <Text style={styles.itemTitle}>à¹‚à¸žà¸ªà¸•à¹Œà¹€à¸žà¸´à¹ˆà¸¡ 1 à¸„à¸£à¸±à¹‰à¸‡</Text>
                <Text style={styles.itemDesc}>à¹€à¸žà¸´à¹ˆà¸¡à¹‚à¸žà¸ªà¸•à¹Œà¹€à¸¡à¸·à¹ˆà¸­à¸„à¸£à¸š limit</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.buyButton} onPress={() => handleBuyAddon('extraPost')}>
              <Text style={styles.buyButtonText}>à¸¿{PRICING.extraPost}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemIcon}>â°</Text>
              <View>
                <Text style={styles.itemTitle}>à¸•à¹ˆà¸­à¸­à¸²à¸¢à¸¸à¹‚à¸žà¸ªà¸•à¹Œ +1 à¸§à¸±à¸™</Text>
                <Text style={styles.itemDesc}>à¸‚à¸¢à¸²à¸¢à¸­à¸²à¸¢à¸¸à¹‚à¸žà¸ªà¸•à¹Œà¸—à¸µà¹ˆà¹ƒà¸à¸¥à¹‰à¸«à¸¡à¸”à¸­à¸²à¸¢à¸¸</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.buyButton} onPress={() => handleBuyAddon('extendPost')}>
              <Text style={styles.buyButtonText}>à¸¿{PRICING.extendPost}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.itemCard}>
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemIcon}>âš¡</Text>
              <View>
                <Text style={styles.itemTitle}>à¸›à¸¸à¹ˆà¸¡à¸”à¹ˆà¸§à¸™ (Urgent)</Text>
                <Text style={styles.itemDesc}>à¸—à¸³à¹ƒà¸«à¹‰à¸›à¸£à¸°à¸à¸²à¸¨à¹‚à¸”à¸”à¹€à¸”à¹ˆà¸™à¸‚à¸¶à¹‰à¸™</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.buyButton} onPress={() => handleBuyAddon('urgent')}>
              <Text style={styles.buyButtonText}>à¸¿{PRICING.urgentPost}</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* ---- REFERRAL SECTION ---- */}
        {referralInfo && (
          <>
            <Text style={styles.sectionTitle}>ðŸŽ à¹à¸™à¸°à¸™à¸³à¹€à¸žà¸·à¹ˆà¸­à¸™</Text>
            <Card style={styles.referralCard}>
              <Text style={styles.referralTitle}>à¹à¸™à¸°à¸™à¸³à¹€à¸žà¸·à¹ˆà¸­à¸™ â†’ à¹„à¸”à¹‰ Pro à¸Ÿà¸£à¸µ 1 à¹€à¸”à¸·à¸­à¸™!</Text>
              <Text style={styles.referralDesc}>
                à¹€à¸žà¸·à¹ˆà¸­à¸™à¸‚à¸­à¸‡à¸„à¸¸à¸“à¸ªà¸¡à¸±à¸„à¸£à¹à¸¥à¸°à¸­à¸±à¸žà¹€à¸à¸£à¸” à¸„à¸¸à¸“à¹à¸¥à¸°à¹€à¸žà¸·à¹ˆà¸­à¸™à¸ˆà¸°à¹„à¸”à¹‰à¸£à¸±à¸š Nurse Pro à¸Ÿà¸£à¸µ 1 à¹€à¸”à¸·à¸­à¸™
              </Text>

              <View style={styles.referralCodeBox}>
                <Text style={styles.referralCodeLabel}>à¹‚à¸„à¹‰à¸”à¸‚à¸­à¸‡à¸„à¸¸à¸“</Text>
                <View style={styles.referralCodeRow}>
                  <Text style={styles.referralCode}>{referralInfo.referralCode}</Text>
                  <TouchableOpacity style={styles.copyBtn} onPress={copyReferralCode}>
                    <Ionicons name="copy-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.copyText}>à¸„à¸±à¸”à¸¥à¸­à¸</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.referralStats}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{referralInfo.referredCount}</Text>
                  <Text style={styles.statLabel}>à¹€à¸žà¸·à¹ˆà¸­à¸™à¸—à¸µà¹ˆà¹à¸™à¸°à¸™à¸³</Text>
                </View>
                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}>
                  <Text style={styles.statNum}>{referralInfo.rewardMonthsEarned}</Text>
                  <Text style={styles.statLabel}>à¹€à¸”à¸·à¸­à¸™à¸Ÿà¸£à¸µà¸—à¸µà¹ˆà¹„à¸”à¹‰</Text>
                </View>
                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}>
                  <Text style={styles.statNum}>{referralInfo.rewardMonthsEarned - referralInfo.rewardMonthsUsed}</Text>
                  <Text style={styles.statLabel}>à¹€à¸”à¸·à¸­à¸™à¸„à¸‡à¹€à¸«à¸¥à¸·à¸­</Text>
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Restore */}
        <TouchableOpacity style={styles.restoreButton} onPress={handleRestore} disabled={isPurchasing}>
          <Ionicons name="refresh-outline" size={16} color={colors.primary} />
          <Text style={[styles.restoreText, { color: colors.primary }]}>à¸à¸¹à¹‰à¸„à¸·à¸™à¸£à¸²à¸¢à¸à¸²à¸£à¸‹à¸·à¹‰à¸­</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>

      {isPurchasing && (
        <View style={styles.purchasingOverlay}>
          <View style={styles.purchasingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.purchasingText}>à¸à¸³à¸¥à¸±à¸‡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£...</Text>
          </View>
        </View>
      )}

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
  plan: 'free' | 'nurse_pro';
  price?: number;
  savings?: number;
  isCurrent: boolean;
  onBuy: () => void;
  billingCycle: BillingCycle;
}

function NursePlanCard({ plan, price, savings, isCurrent, onBuy, billingCycle }: NursePlanCardProps) {
  const isFree = plan === 'free';
  const features = isFree
    ? ['à¹‚à¸žà¸ªà¸•à¹Œ 2 à¸„à¸£à¸±à¹‰à¸‡/à¸§à¸±à¸™', 'à¹‚à¸žà¸ªà¸•à¹Œà¸­à¸¢à¸¹à¹ˆ 3 à¸§à¸±à¸™', 'à¸ªà¸¡à¸±à¸„à¸£à¸‡à¸²à¸™ 3 à¸„à¸£à¸±à¹‰à¸‡/à¸§à¸±à¸™']
    : ['à¹‚à¸žà¸ªà¸•à¹Œà¹„à¸¡à¹ˆà¸ˆà¸³à¸à¸±à¸”', 'à¹‚à¸žà¸ªà¸•à¹Œà¸­à¸¢à¸¹à¹ˆ 30 à¸§à¸±à¸™', 'à¸ªà¸¡à¸±à¸„à¸£à¸‡à¸²à¸™à¹„à¸¡à¹ˆà¸ˆà¸³à¸à¸±à¸”', 'ðŸŽ à¸›à¸¸à¹ˆà¸¡à¸”à¹ˆà¸§à¸™à¸Ÿà¸£à¸µ 1 à¸„à¸£à¸±à¹‰à¸‡/à¹€à¸”à¸·à¸­à¸™'];

  const color = isFree ? '#888' : '#FF8F00';

  return (
    <Card style={StyleSheet.flatten([styles.planCard, isCurrent && { borderColor: color, borderWidth: 2 }])}>      
      <View style={styles.planCardHeader}>
        <View>
          <Text style={[styles.planCardName, { color }]}>
            {isFree ? 'ðŸ†“ à¸Ÿà¸£à¸µ' : 'ðŸ‘‘ Nurse Pro'}
          </Text>
          {!isFree && price !== undefined && (
            <Text style={styles.planCardPrice}>
              à¸¿{price}
              <Text style={styles.planCardPriceUnit}>/{billingCycle === 'annual' ? 'à¸›à¸µ' : 'à¹€à¸”à¸·à¸­à¸™'}</Text>
              {billingCycle === 'monthly' && <Text style={styles.planCardPriceUnit}> (à¸¿{PRICING.nursePro}/à¹€à¸”à¸·à¸­à¸™)</Text>}
            </Text>
          )}
        </View>
        {savings && savings > 0 ? <View style={styles.savingsTag}><Text style={styles.savingsTagText}>à¸›à¸£à¸°à¸«à¸¢à¸±à¸” {savings}%</Text></View> : null}
        {isCurrent && <View style={styles.currentTag}><Text style={styles.currentTagText}>à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸­à¸¢à¸¹à¹ˆ</Text></View>}
      </View>
      <View style={styles.featureList}>
        {features.map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={color} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      {!isCurrent && !isFree && (
        <TouchableOpacity style={[styles.planBuyBtn, { backgroundColor: color }]} onPress={onBuy}>
          <Text style={styles.planBuyBtnText}>à¸­à¸±à¸žà¹€à¸à¸£à¸”</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

interface HospitalPlanCardProps {
  plan: SubscriptionPlan;
  price: number;
  savings: number;
  isCurrent: boolean;
  onBuy: () => void;
  billingCycle: BillingCycle;
}

function HospitalPlanCard({ plan, price, savings, isCurrent, onBuy, billingCycle }: HospitalPlanCardProps) {
  const planMeta: Record<string, { label: string; features: string[]; color: string }> = {
    hospital_starter: {
      label: 'ðŸ¥ Starter',
      color: '#0288D1',
      features: ['5 à¹‚à¸žà¸ªà¸•à¹Œ/à¹€à¸”à¸·à¸­à¸™', 'à¹‚à¸žà¸ªà¸•à¹Œà¸­à¸¢à¸¹à¹ˆ 30 à¸§à¸±à¸™', 'à¸„à¹‰à¸™à¸«à¸²à¸žà¸¢à¸²à¸šà¸²à¸¥'],
    },
    hospital_pro: {
      label: 'ðŸ¥ Professional',
      color: '#6A1B9A',
      features: ['à¹‚à¸žà¸ªà¸•à¹Œà¹„à¸¡à¹ˆà¸ˆà¸³à¸à¸±à¸”', 'à¸›à¸¸à¹ˆà¸¡à¸”à¹ˆà¸§à¸™à¸Ÿà¸£à¸µ 3 à¸„à¸£à¸±à¹‰à¸‡/à¹€à¸”à¸·à¸­à¸™', 'à¹à¸ªà¸”à¸‡à¹‚à¸¥à¹‚à¸à¹‰à¹‚à¸£à¸‡à¸žà¸¢à¸²à¸šà¸²à¸¥', 'à¹à¸”à¸Šà¸šà¸­à¸£à¹Œà¸”à¸§à¸´à¹€à¸„à¸£à¸²à¸°à¸«à¹Œ'],
    },
    hospital_enterprise: {
      label: 'ðŸ¢ Enterprise',
      color: '#1B5E20',
      features: ['à¸—à¸¸à¸à¸­à¸¢à¹ˆà¸²à¸‡à¹ƒà¸™ Pro', 'à¸›à¸¸à¹ˆà¸¡à¸”à¹ˆà¸§à¸™à¸Ÿà¸£à¸µ 10 à¸„à¸£à¸±à¹‰à¸‡/à¹€à¸”à¸·à¸­à¸™', 'Multi-account support', 'Priority Support'],
    },
  };

  const meta = planMeta[plan];
  const color = meta?.color || '#444';

  return (
    <Card style={StyleSheet.flatten([styles.planCard, isCurrent && { borderColor: color, borderWidth: 2 }])}>
      <View style={styles.planCardHeader}>
        <View>
          <Text style={[styles.planCardName, { color }]}>{meta?.label}</Text>
          <Text style={styles.planCardPrice}>
            à¸¿{price}
            <Text style={styles.planCardPriceUnit}>/{billingCycle === 'annual' ? 'à¸›à¸µ' : 'à¹€à¸”à¸·à¸­à¸™'}</Text>
          </Text>
        </View>
        {savings > 0 && <View style={styles.savingsTag}><Text style={styles.savingsTagText}>à¸›à¸£à¸°à¸«à¸¢à¸±à¸” {savings}%</Text></View>}
        {isCurrent && <View style={styles.currentTag}><Text style={styles.currentTagText}>à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸­à¸¢à¸¹à¹ˆ</Text></View>}
      </View>
      <View style={styles.featureList}>
        {(meta?.features || []).map((f, i) => (
          <View key={i} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={color} />
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>
      {!isCurrent && (
        <TouchableOpacity style={[styles.planBuyBtn, { backgroundColor: color }]} onPress={onBuy}>
          <Text style={styles.planBuyBtnText}>à¹€à¸¥à¸·à¸­à¸à¹à¸œà¸™à¸™à¸µà¹‰</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700', color: COLORS.text },
  content: { flex: 1, padding: SPACING.md },

  // Current Plan
  currentPlanCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.md,
  },
  planBannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textSecondary, marginBottom: 2 },
  planName: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  expiryBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  expiryText: { fontSize: FONT_SIZES.xs, color: '#E65100', fontWeight: '600' },

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
  toggleText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, fontWeight: '500' },
  toggleActiveText: { color: COLORS.text, fontWeight: '700' },
  savingsPill: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BORDER_RADIUS.full,
  },
  savingsPillText: { fontSize: FONT_SIZES.xs, color: '#2E7D32', fontWeight: '600' },

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
  planCardPrice: { fontSize: FONT_SIZES.md, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  planCardPriceUnit: { fontSize: FONT_SIZES.sm, fontWeight: '400', color: COLORS.textSecondary },
  savingsTag: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  savingsTagText: { fontSize: FONT_SIZES.xs, color: '#2E7D32', fontWeight: '700' },
  currentTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  currentTagText: { fontSize: FONT_SIZES.xs, color: COLORS.primary, fontWeight: '700' },
  featureList: { marginBottom: SPACING.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: SPACING.xs },
  featureText: { fontSize: FONT_SIZES.sm, color: COLORS.text },
  planBuyBtn: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  planBuyBtnText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: '#fff' },

  // Add-on Item Card
  itemCard: { marginBottom: SPACING.sm, padding: SPACING.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  itemIcon: { fontSize: 26, marginRight: SPACING.md },
  itemTitle: { fontSize: FONT_SIZES.md, fontWeight: '600', color: COLORS.text },
  itemDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },
  buyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  buyButtonText: { fontSize: FONT_SIZES.md, fontWeight: '700', color: '#fff' },

  // Referral Card
  referralCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD54F',
    borderRadius: BORDER_RADIUS.md,
  },
  referralTitle: { fontSize: FONT_SIZES.md, fontWeight: '700', color: '#E65100', marginBottom: 4 },
  referralDesc: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary, marginBottom: SPACING.md, lineHeight: 20 },
  referralCodeBox: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FFD54F',
  },
  referralCodeLabel: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted, marginBottom: 4 },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  referralCode: { fontSize: FONT_SIZES.lg, fontWeight: '800', color: COLORS.text, letterSpacing: 2 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyText: { fontSize: FONT_SIZES.sm, color: COLORS.primary, fontWeight: '600' },
  referralStats: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: BORDER_RADIUS.md, overflow: 'hidden' },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm },
  statNum: { fontSize: FONT_SIZES.xl, fontWeight: '800', color: COLORS.text },
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

  // Purchasing Overlay
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
  purchasingText: { fontSize: FONT_SIZES.md, color: COLORS.text, fontWeight: '500' },
});
