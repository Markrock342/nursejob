// ============================================
// POST JOB SCREEN - รองรับ 3 ประเภทประกาศ
// 1. หาคนแทนเวร 2. รับสมัครบุคลากร 3. หาคนดูแลผู้ป่วย
// ============================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOnboardingSurveyEnabled } from '../../hooks/useOnboardingSurveyEnabled';
import { KittenButton as Button, Input, Card, Chip, ModalContainer, CalendarPicker, PlaceAutocomplete, FirstVisitTip } from '../../components/common';
import MapPickerModal, { PickedLocation } from '../../components/common/MapPickerModal';
import { MultiDateCalendar } from '../../components/common/MultiDateCalendar';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import { createJob, updateJob } from '../../services/jobService';
import { canUseFreeUrgent, canUserPostToday, getUserCreatedPostCount, incrementPostCount, getUserSubscription, getPostExpiryDate, markFreeUrgentUsed } from '../../services/subscriptionService';

import { useTabRefresh } from '../../hooks/useTabRefresh';
import { JobContactMode, JobPost, PRICING, SUBSCRIPTION_PLANS, SubscriptionPlan } from '../../types';
import { getCommerceAccessStatus } from '../../services/commerceService';
import { ALL_PROVINCES, POPULAR_PROVINCES } from '../../constants/locations';
import { getDistrictsForProvince } from '../../constants/districts';
import {
  STAFF_TYPES,
  StaffType,
  LOCATION_TYPES,
  LocationType,
  PAYMENT_TYPES,
  PaymentType,
  QUICK_TAGS,
  TagGroup,
  getBenefitGroups,
  getDepartmentOptions,
  getLocationTypeOptions,
  getPaymentTypeOptions,
  getRateTypeOptions,
  getStaffTypeOptions,
  getTagGroups,
  getStaffTypeLabel,
} from '../../constants/jobOptions';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useI18n } from '../../i18n';
import { trackEvent } from '../../services/analyticsService';
import {
  buildPostShifts,
  detectExternalContactSignals,
  formatLocalDateKey,
  getSafeContactMode,
  parseJobPostText,
  parseStoredDate,
  toLocalNoonIsoString,
} from '../../utils/jobPostIntelligence';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Types
// ============================================
interface Props {
  navigation: any;
  route?: {
    params?: {
      editJob?: JobPost;
      duplicateJob?: JobPost;
      paidUrgent?: boolean;
      formData?: FormData;
      submissionToken?: string;
    };
  };
}

// ประเภทประกาศ
type PostType = 'shift' | 'job' | 'homecare';

const POST_TYPE_META = [
  { value: 'shift' as PostType, titleKey: 'postJob.postTypes.shift.title' as const, subtitleKey: 'postJob.postTypes.shift.subtitle' as const, icon: 'swap-horizontal-outline' as const, color: '#3B82F6', bgColor: '#EFF6FF' },
  { value: 'job' as PostType, titleKey: 'postJob.postTypes.job.title' as const, subtitleKey: 'postJob.postTypes.job.subtitle' as const, icon: 'briefcase-outline' as const, color: '#10B981', bgColor: '#ECFDF5' },
  { value: 'homecare' as PostType, titleKey: 'postJob.postTypes.homecare.title' as const, subtitleKey: 'postJob.postTypes.homecare.subtitle' as const, icon: 'home-outline' as const, color: '#F59E0B', bgColor: '#FFFBEB' },
];

const normalizePaymentType = (paymentType?: JobPost['paymentType']): PaymentType => {
  switch (paymentType) {
    case 'DEDUCT_PERCENT':
    case 'DEDUCT':
      return 'DEDUCT_PERCENT';
    case 'NEGOTIABLE':
      return 'NEGOTIABLE';
    case 'NET':
    case 'CASH':
    case 'TRANSFER':
    default:
      return 'NET';
  }
};

const toDateKey = (date: Date) => formatLocalDateKey(date);

const CONTACT_MODE_KEYS: Array<{ value: JobContactMode; labelKey: string; helperKey: string }> = [
  { value: 'in_app', labelKey: 'postJob.contactModes.inApp.label', helperKey: 'postJob.contactModes.inApp.helper' },
  { value: 'phone', labelKey: 'postJob.contactModes.phone.label', helperKey: 'postJob.contactModes.phone.helper' },
  { value: 'line', labelKey: 'postJob.contactModes.line.label', helperKey: 'postJob.contactModes.line.helper' },
  { value: 'phone_or_line', labelKey: 'postJob.contactModes.phoneLine.label', helperKey: 'postJob.contactModes.phoneLine.helper' },
];

interface FormData {
  // Common
  postType: PostType;
  title: string;
  description: string;
  
  // Staff type
  staffType: StaffType;
  staffTypeOther: string;
  
  // Location
  locationType: LocationType;
  province: string;
  district: string;
  hospital: string;
  address: string;
  department: string;
  locationLat?: number;
  locationLng?: number;
  
  // Date/Time (for shift)
  shiftDate: Date;
  shiftDates: Date[];
  shiftTime: string;
  customStartTime: string;
  customEndTime: string;
  // Per-date time slots: key = "YYYY-MM-DD", value = { start, end }
  shiftTimeSlots: Record<string, { start: string; end: string }>;
  
  // Duration (for homecare)
  duration: string;
  shiftDateEnd: Date | null;
  
  // Rate
  shiftRate: string;
  rateType: 'shift' | 'hour' | 'day' | 'month';
  paymentType: PaymentType;
  deductPercent: number;
  
  // For job posting
  salaryMin: string;
  salaryMax: string;
  benefits: string[];
  employmentType: string;
  startDateNote: string;
  workHours: string;
  
  // Contact
  contactPhone: string;
  contactLine: string;
  contactMode: JobContactMode;

  // Campaign / parser
  slotsNeeded: number;
  campaignTitle: string;
  campaignSummary: string;
  scheduleNote: string;
  sourceText: string;
  
  // Options
  isUrgent: boolean;
  tags: string[];
}

// ============================================
// Main Component
// ============================================
export default function PostJobScreen({ navigation, route }: Props) {
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const submitLockRef = useRef(false);
  const handledPaidSubmissionRef = useRef<string | null>(null);
  const headerBackground = isDark ? colors.surface : colors.primary;
  const headerButtonBackground = isDark ? colors.card : 'rgba(255,255,255,0.2)';
  const stepIndicatorBackground = isDark ? colors.backgroundSecondary : 'rgba(255,255,255,0.2)';
  const typeCardBackground = isDark ? colors.card : colors.surface;
  const inputSurface = isDark ? colors.card : colors.surface;
  const roleTones = {
    user: {
      background: colors.warningLight,
      icon: colors.warning,
      text: isDark ? colors.text : colors.warning,
    },
    nurse: {
      background: colors.infoLight,
      icon: colors.info,
      text: colors.info,
    },
    hospital: {
      background: colors.successLight,
      icon: colors.success,
      text: colors.success,
    },
  } as const;
  const mapSelectedTone = {
    border: colors.success,
    background: colors.successLight,
    text: colors.success,
  };
  const warningTone = {
    background: colors.warningLight,
    border: colors.warning,
    text: colors.warning,
  };
  const statusBarStyle = 'light-content';
  const statusBarBackground = headerBackground;
  const headerSubtitleColor = isDark ? colors.textSecondary : 'rgba(255,255,255,0.8)';
  const urgentPriceTone = {
    background: colors.error,
    text: colors.white,
  };
  const errorTextColor = colors.error;
  
  const editJob = route?.params?.editJob;
  const duplicateJob = route?.params?.duplicateJob;
  const seedJob = duplicateJob || editJob;
  const isEditMode = Boolean(editJob);

  // กรองประเภทโพสต์ตาม role
  const visiblePostTypes = POST_TYPE_META.filter((pt) => {
    if (!user) return true; // ยังไม่ล็อกอิน — แสดงทั้งหมด
    switch (user.role) {
      case 'nurse':   return pt.value === 'shift';
      case 'hospital': return pt.value === 'job';
      case 'user':    return pt.value === 'homecare';
      default:        return true;
    }
  });

  // ถ้ามี postType เดียว → ข้าม step 0 เลย
  const autoSkipTypeSelect = !isEditMode && visiblePostTypes.length === 1;

  // Current step (0 = select type, 1-4 = form steps)
  const [currentStep, setCurrentStep] = useState(
    isEditMode ? 1 : autoSkipTypeSelect ? 1 : 0
  );
  const [slideAnim] = useState(new Animated.Value(0));
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  // Form data
  const [form, setForm] = useState<FormData>({
    postType: (seedJob?.postType as PostType) || (visiblePostTypes[0]?.value ?? 'shift'),
    title: seedJob?.title || '',
    description: seedJob?.description || '',
    staffType: (seedJob?.staffType as StaffType) || 'RN',
    staffTypeOther: seedJob?.staffTypeOther || '',
    locationType: seedJob?.locationType || 'HOSPITAL',
    province: seedJob?.location?.province || 'กรุงเทพมหานคร',
    district: seedJob?.location?.district || '',
    hospital: seedJob?.location?.hospital || '',
    address: seedJob?.location?.address || '',
    department: seedJob?.department || '',
    shiftDate: duplicateJob ? new Date() : (seedJob?.shiftDate ? new Date(seedJob.shiftDate as any) : new Date()),
    shiftDates: duplicateJob ? [new Date()] : (seedJob?.shiftDates ? (seedJob.shiftDates as any[]).map((d: any) => new Date(d)) : [new Date()]),
    shiftTime: seedJob?.shiftTime || '08:00-16:00',
    customStartTime: '08:00',
    customEndTime: '16:00',
    shiftTimeSlots: duplicateJob ? {} : (seedJob?.shiftTimeSlots || {}),
    duration: seedJob?.duration || '',
    shiftDateEnd: duplicateJob ? null : (seedJob?.shiftDateEnd ? new Date(seedJob.shiftDateEnd as any) : null),
    shiftRate: seedJob?.shiftRate ? String(seedJob.shiftRate) : '',
    rateType: seedJob?.rateType === 'month' ? 'month' : (seedJob?.rateType as any) || 'shift',
    paymentType: normalizePaymentType(seedJob?.paymentType),
    deductPercent: seedJob?.deductPercent || 0,
    salaryMin: seedJob?.salary ? String(seedJob.salary) : (seedJob?.rateType === 'month' && seedJob?.shiftRate ? String(seedJob.shiftRate) : ''),
    salaryMax: '',
    benefits: seedJob?.benefits || [],
    employmentType: seedJob?.employmentType || seedJob?.salaryType || 'full_time',
    startDateNote: seedJob?.startDateNote || '',
    workHours: seedJob?.workHours || (seedJob?.postType === 'job' ? seedJob?.shiftTime || '' : ''),
    contactPhone: seedJob?.contactPhone || user?.phone || '',
    contactLine: seedJob?.contactLine || '',
    contactMode: getSafeContactMode(seedJob?.contactMode, Boolean(seedJob?.contactPhone), Boolean(seedJob?.contactLine)),
    slotsNeeded: Math.max(1, seedJob?.slotsNeeded || 1),
    campaignTitle: seedJob?.campaignTitle || seedJob?.title || '',
    campaignSummary: seedJob?.campaignSummary || '',
    scheduleNote: seedJob?.scheduleNote || '',
    sourceText: seedJob?.sourceText || '',
    isUrgent: duplicateJob ? false : (seedJob?.status === 'urgent' || seedJob?.isUrgent || false),
    tags: seedJob?.tags || [],
  });
  
  // UI State
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  // Per-date time editing
  const [editingSlotKey, setEditingSlotKey] = useState<string | null>(null);
  const [editingSlotType, setEditingSlotType] = useState<'start' | 'end'>('start');
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');
  const [showAllProvinces, setShowAllProvinces] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [customBenefitInput, setCustomBenefitInput] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  
  // Time options (every 30 minutes)
  const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, '0');
    const mins = i % 2 === 0 ? '00' : '30';
    return `${hours}:${mins}`;
  });
  
  // Subscription
  const [postsRemaining, setPostsRemaining] = useState<number | null>(null);
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('free');
  const staffTypeOptions = getStaffTypeOptions();
  const locationTypeOptions = getLocationTypeOptions();
  const departmentOptions = getDepartmentOptions(form.postType, form.locationType);
  const rateTypeOptions = getRateTypeOptions();
  const paymentTypeOptions = getPaymentTypeOptions();
  const benefitGroups = getBenefitGroups();
  const tagGroups = getTagGroups(form.postType);

  useEffect(() => {
    if (!user?.uid) return;
    trackEvent({
      eventName: 'post_job_started',
      screenName: 'PostJob',
      subjectType: 'job_draft',
      subjectId: editJob?.id || user.uid,
      props: {
        mode: isEditMode ? 'edit' : 'create',
        defaultPostType: form.postType,
        role: user.role || null,
      },
    });
  }, [editJob?.id, form.postType, isEditMode, user?.role, user?.uid]);
  
  // Get total steps based on post type
  const getTotalSteps = () => {
    return 4; // Step 0 is type selection, then 4 more steps
  };
  
  // Animate progress bar
  useEffect(() => {
    if (currentStep === 0) return;
    Animated.timing(progressAnim, {
      toValue: currentStep / getTotalSteps(),
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentStep]);
  
  // Check subscription
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user?.uid) return;
      const subscription = await getUserSubscription(user.uid);
      setUserPlan(subscription?.plan ?? 'free');
      const postStatus = await canUserPostToday(user.uid);
      setPostsRemaining(postStatus.postsRemaining);
    };
    checkSubscription();
  }, [user?.uid]);

  const refreshComposerState = useCallback(async () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    setAlert(initialAlertState);
    setErrors({});
    setShowProvinceModal(false);
    setShowDepartmentModal(false);
    setShowDateModal(false);
    setShowStartTimeModal(false);
    setShowEndTimeModal(false);
    setShowDistrictModal(false);
    setShowMapPicker(false);

    if (!user?.uid) return;

    const [subscription, postStatus] = await Promise.all([
      getUserSubscription(user.uid),
      canUserPostToday(user.uid),
    ]);
    setUserPlan(subscription?.plan ?? 'free');
    setPostsRemaining(postStatus.postsRemaining);
  }, [user?.uid]);

  useTabRefresh(refreshComposerState, {
    scrollToTop: () => scrollViewRef.current?.scrollTo({ y: 0, animated: true }),
  });

  function createSubmissionToken() {
    return `post-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function deserializeFormData(raw?: Partial<FormData> | null): FormData | undefined {
    if (!raw) return undefined;

    return {
      ...(raw as FormData),
      shiftDate: raw.shiftDate ? parseStoredDate(raw.shiftDate as any) : new Date(),
      shiftDateEnd: raw.shiftDateEnd ? parseStoredDate(raw.shiftDateEnd as any) : null,
      shiftDates: Array.isArray(raw.shiftDates)
        ? raw.shiftDates.map((value: any) => parseStoredDate(value))
        : (raw.shiftDate ? [parseStoredDate(raw.shiftDate as any)] : []),
      shiftTimeSlots: raw.shiftTimeSlots || {},
    };
  }

  const applySourceText = () => {
    const rawText = form.sourceText.trim();
    if (!rawText) {
      setAlert(createAlert.info(t('postJob.alerts.noSourceText'), t('postJob.alerts.noSourceTextMessage')) as AlertState);
      return;
    }

    const parsed = parseJobPostText(rawText);
    const nextShiftDates = parsed.shiftDates?.length
      ? parsed.shiftDates.map((value) => new Date(value))
      : form.shiftDates;
    const nextShiftTimeSlots = Object.keys(parsed.shiftTimeSlots || {}).length > 0
      ? parsed.shiftTimeSlots || {}
      : form.shiftTimeSlots;
    const nextContactMode = getSafeContactMode(
      'in_app',
      Boolean(parsed.contactPhone || form.contactPhone),
      Boolean(parsed.contactLine || form.contactLine)
    );

    setForm((prev) => ({
      ...prev,
      title: prev.title || parsed.title || '',
      description: parsed.description || prev.description,
      staffType: parsed.staffType || prev.staffType,
      department: parsed.department || prev.department,
      province: parsed.province || prev.province,
      district: parsed.district || prev.district,
      hospital: parsed.hospital || prev.hospital,
      shiftDates: nextShiftDates,
      shiftDate: nextShiftDates[0] || prev.shiftDate,
      shiftTimeSlots: nextShiftTimeSlots,
      shiftRate: parsed.shiftRate ? String(parsed.shiftRate) : prev.shiftRate,
      salaryMin: prev.postType === 'job' && parsed.shiftRate ? String(parsed.shiftRate) : prev.salaryMin,
      rateType: parsed.rateType || prev.rateType,
      slotsNeeded: parsed.slotsNeeded || prev.slotsNeeded,
      campaignTitle: parsed.campaignTitle || prev.campaignTitle || parsed.title || prev.title,
      campaignSummary: parsed.campaignSummary || prev.campaignSummary,
      scheduleNote: parsed.scheduleNote || prev.scheduleNote,
      contactPhone: prev.contactPhone || parsed.contactPhone || '',
      contactLine: prev.contactLine || parsed.contactLine || '',
      contactMode: nextContactMode,
      tags: [...new Set([...(prev.tags || []), ...(parsed.tags || [])])],
      sourceText: rawText,
    }));
    setParseWarnings(parsed.parseWarnings);
    setAlert(createAlert.success(t('postJob.alerts.parsedSuccess'), t('postJob.alerts.parsedSuccessMessage')) as AlertState);
  };

  const externalContactSignals = detectExternalContactSignals(`${form.title}\n${form.description}\n${form.sourceText}`);

  // Handle return from Payment screen (serializable params)
  useEffect(() => {
    const paid = route?.params?.paidUrgent;
    const paidForm = route?.params?.formData;
    const submissionToken = route?.params?.submissionToken;
    if (!paid || !paidForm) return;

    const handledKey = submissionToken || JSON.stringify(paidForm);
    if (handledPaidSubmissionRef.current === handledKey) return;
    handledPaidSubmissionRef.current = handledKey;

    const hydratedForm = deserializeFormData(paidForm);
    if (!hydratedForm) return;

    try {
      navigation.setParams?.({ paidUrgent: undefined, formData: undefined, submissionToken: undefined });
    } catch (e) {}

    const submitPaidPost = async () => {
      if (submitLockRef.current) return;

      submitLockRef.current = true;
      setIsSubmitting(true);
      try {
        await createJobPost(true, hydratedForm);
      } finally {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    };

    void submitPaidPost();
  }, [navigation, route?.params?.paidUrgent, route?.params?.formData, route?.params?.submissionToken]);
  
  // Filter provinces
  const filteredProvinces = provinceSearch
    ? ALL_PROVINCES.filter((province: string) => province.includes(provinceSearch))
    : Array.from(showAllProvinces ? ALL_PROVINCES : POPULAR_PROVINCES);
  
  // Get departments based on post type
  const getDepartments = () => {
    return departmentOptions;
  };
  
  // Guest check
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredView}>
          <Ionicons name="document-text-outline" size={64} color={colors.border} />
          <Text style={[styles.centeredTitle, { color: colors.text }]}>{t('postJob.guest.title')}</Text>
          <Text style={[styles.centeredSubtitle, { color: colors.textSecondary }]}>
            {t('postJob.guest.subtitle')}
          </Text>
          <Button
              onPress={() => navigation.navigate('Auth')}
              style={{ marginTop: SPACING.lg }}
            >{t('postJob.guest.button')}</Button>
        </View>
      </SafeAreaView>
    );
  }
  
  // Validate current step
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 1: // ข้อมูลพื้นฐาน
        if (!form.staffType) newErrors.staffType = t('postJob.validation.staffType');
        if (form.postType !== 'homecare' && !form.locationType) {
          newErrors.locationType = t('postJob.validation.locationType');
        }
        if (!form.department) {
          newErrors.department = t('postJob.validation.department');
        }
        break;
      case 2: // วันเวลา
        if (form.postType === 'job') {
          if (!form.employmentType) newErrors.employmentType = t('postJob.validation.employmentType');
          if (!form.workHours.trim()) newErrors.workHours = t('postJob.validation.workHours');
        } else {
          if (!form.slotsNeeded || form.slotsNeeded < 1) {
            newErrors.slotsNeeded = t('postJob.validation.slotsNeeded');
          }
          if (form.shiftDates.length === 0) {
            newErrors.shiftDates = t('postJob.validation.shiftDates');
          }
          // Check each selected date has both start and end time
          {
            const missingTime = form.shiftDates.some(d => {
              const s = form.shiftTimeSlots[toDateKey(d)];
              return !s?.start || !s?.end;
            });
            if (missingTime) newErrors.shiftTimes = t('postJob.validation.shiftTimes');
          }
        }
        break;
      case 3: // สถานที่
        if (!form.province) newErrors.province = t('postJob.validation.province');
        // ผ่านได้ถ้าพิมพ์ชื่อสถานที่ OR ปักหมุดบนแผนที่แล้ว
        if (form.locationType !== 'HOME' && !form.hospital && !(form.locationLat && form.locationLng)) {
          newErrors.hospital = t('postJob.validation.hospital');
        }
        if (form.locationType === 'HOME' && !form.address && !(form.locationLat && form.locationLng)) {
          newErrors.address = t('postJob.validation.address');
        }
        break;
      case 4: // ค่าตอบแทน & ติดต่อ
        if (!form.shiftRate && form.postType !== 'job') {
          newErrors.shiftRate = t('postJob.validation.shiftRate');
        }
        if (form.postType === 'job' && !form.salaryMin) {
          newErrors.salaryMin = t('postJob.validation.salaryMin');
        }
        if (form.postType === 'job' && !form.description.trim()) {
          newErrors.description = t('postJob.validation.description');
        }
        if (form.contactMode === 'phone' && !form.contactPhone.trim()) {
          newErrors.contact = t('postJob.validation.contactPhone');
        }
        if (form.contactMode === 'line' && !form.contactLine.trim()) {
          newErrors.contact = t('postJob.validation.contactLine');
        }
        if (form.contactMode === 'phone_or_line' && !form.contactPhone.trim() && !form.contactLine.trim()) {
          newErrors.contact = t('postJob.validation.contactPhoneOrLine');
        }
        if (form.contactMode === 'in_app' && externalContactSignals.hasExternalContact) {
          newErrors.contact = t('postJob.validation.contactExternalSignal');
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Navigation
  const goNext = () => {
    if (currentStep === 0) {
      setCurrentStep(1);
      return;
    }
    if (validateStep(currentStep)) {
      if (currentStep < getTotalSteps()) {
        setCurrentStep(currentStep + 1);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        handleSubmit();
      }
    }
  };
  
  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      navigation.goBack();
    }
  };

  // Serialize form for navigation (convert Dates to ISO strings)
  const serializeForm = (f: FormData) => {
    return {
      ...f,
      shiftDate: f.shiftDate ? toDateKey(f.shiftDate) : undefined,
      shiftDateEnd: f.shiftDateEnd ? toDateKey(f.shiftDateEnd) : undefined,
      shiftDates: (f.shiftDates || []).map((date) => toDateKey(date)),
    } as any;
  };

  
  
  // Submit
  const handleSubmit = async () => {
    if (submitLockRef.current || isLoading || isSubmitting) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      if (!user?.uid || !isInitialized) {
        setAlert(createAlert.warning(t('postJob.alerts.sessionPending'), t('postJob.alerts.sessionPendingMessage')) as AlertState);
        return;
      }

      // Check posting limit
      if (!isEditMode) {
        const postStatus = await canUserPostToday(user.uid);
        if (!postStatus.canPost) {
          setAlert(createAlert.warning(t('postJob.alerts.postLimitReached'), postStatus.reason || t('postJob.alerts.postLimitReachedMessage')) as AlertState);
          return;
        }
      }

      // If urgent post selected, go to payment first
      if (form.isUrgent && !isEditMode) {
        const totalCreatedPosts = await getUserCreatedPostCount(user.uid);
        const commerceStatus = await getCommerceAccessStatus();

        if (totalCreatedPosts === 0 && !commerceStatus.freeAccessEnabled) {
          await trackEvent({
            eventName: 'post_job_submitted',
            screenName: 'PostJob',
            subjectType: 'job_draft',
            subjectId: user.uid,
            province: form.province,
            props: {
              step: 'urgent_deferred_first_post',
              postType: form.postType,
              isUrgent: true,
              staffType: form.staffType,
              locationType: form.locationType,
            },
          });

          setAlert(
            createAlert.info(
              t('postJob.alerts.firstPostDeferred'),
              t('postJob.alerts.firstPostDeferredMessage')
            ) as AlertState
          );
          await createJobPost(false, { ...form, isUrgent: false });
          return;
        }

        if (commerceStatus.freeAccessEnabled) {
          const canUseUrgent = await canUseFreeUrgent(user.uid);
          if (!canUseUrgent) {
            setAlert(createAlert.info(t('postJob.alerts.urgentQuotaReached'), t('postJob.alerts.urgentQuotaReachedMessage')) as AlertState);
            return;
          }

          await createJobPost(true, undefined, true);
          return;
        }

        await trackEvent({
          eventName: 'post_job_submitted',
          screenName: 'PostJob',
          subjectType: 'job_draft',
          subjectId: user.uid,
          province: form.province,
          props: {
            step: 'payment_required',
            postType: form.postType,
            isUrgent: true,
            staffType: form.staffType,
            locationType: form.locationType,
          },
        });

        navigation.navigate('Payment', {
          type: 'urgent_post',
          amount: PRICING.urgentPost,
          title: t('postJob.alerts.paymentTitle'),
          description: t('postJob.alerts.paymentDescription'),
          // pass only serializable data (no functions)
          formData: serializeForm(form),
          submissionToken: createSubmissionToken(),
          // indicate which screen to return to after success
          returnTo: 'PostJob',
        });
        return;
      }

      // Create job directly
      await createJobPost(false);
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };
  
  // Create job post function
  const createJobPost = async (isPaidUrgent: boolean, formArg?: FormData, consumeUrgentEntitlement: boolean = false) => {
    if (!user?.uid || !isInitialized) {
      setAlert(createAlert.warning(t('postJob.alerts.sessionPending'), t('postJob.alerts.sessionPendingMessage')) as AlertState);
      return;
    }
    
    const usedForm = formArg || form;

    setIsLoading(true);
    try {
      const subscription = await getUserSubscription(user.uid);
      const planKey = (subscription?.plan as any) || 'free';
      const expiresAt = getPostExpiryDate(planKey);
      
      // Build shift time — use first date's slot, fallback to customStartTime/End
      const firstSlot = usedForm.shiftDates.length > 0
        ? usedForm.shiftTimeSlots[toDateKey(usedForm.shiftDates[0])]
        : undefined;
      const shiftTime = firstSlot
        ? `${firstSlot.start}-${firstSlot.end}`
        : (usedForm.shiftTime === 'custom'
            ? `${usedForm.customStartTime}-${usedForm.customEndTime}`
            : usedForm.shiftTime);
      const shiftDatesIso = usedForm.postType === 'shift'
        ? usedForm.shiftDates.map((date) => toLocalNoonIsoString(date))
        : [];
      const shifts = usedForm.postType === 'shift'
        ? buildPostShifts(shiftDatesIso, usedForm.shiftTimeSlots, Math.max(1, usedForm.slotsNeeded || 1))
        : undefined;
      const totalShifts = shifts?.reduce((sum, slot) => sum + Math.max(1, slot.slotsNeeded || 1), 0);
      const contactMode = getSafeContactMode(usedForm.contactMode, Boolean(usedForm.contactPhone), Boolean(usedForm.contactLine));
      
      // Build title if empty
      let title = usedForm.title;
      if (!title) {
        const staffLabel = getStaffTypeLabel(usedForm.staffType);
        if (usedForm.postType === 'shift') {
          title = t('postJob.autoTitle.shift', { staff: staffLabel, dept: usedForm.department || '' } as any).trim();
        } else if (usedForm.postType === 'job') {
          title = t('postJob.autoTitle.job', { staff: staffLabel, hospital: usedForm.hospital || '' } as any).trim();
        } else {
          title = t('postJob.autoTitle.homecare', { dept: usedForm.department ? ` (${usedForm.department})` : '' } as any).trim();
        }
      }
      
      const jobData: Partial<JobPost> = {
        title,
        postType: usedForm.postType,
        staffType: usedForm.staffType,
        staffTypeOther: usedForm.staffTypeOther,
        locationType: usedForm.postType === 'homecare' ? 'HOME' : usedForm.locationType,
        department: usedForm.department,
        description: usedForm.description,
        benefits: usedForm.postType === 'job' ? usedForm.benefits : undefined,
        employmentType: usedForm.postType === 'job' ? usedForm.employmentType : undefined,
        startDateNote: usedForm.postType === 'job' ? usedForm.startDateNote : undefined,
        workHours: usedForm.postType === 'job' ? usedForm.workHours : undefined,
        shiftRate: usedForm.postType === 'job'
          ? parseInt(usedForm.salaryMin)
          : parseInt(usedForm.shiftRate),
        salary: usedForm.postType === 'job' ? parseInt(usedForm.salaryMin) : undefined,
        rateType: usedForm.postType === 'job' ? 'month' : usedForm.rateType,
        salaryType: usedForm.postType === 'job' ? usedForm.employmentType : undefined,
        paymentType: usedForm.paymentType,
        deductPercent: usedForm.paymentType === 'DEDUCT_PERCENT' ? usedForm.deductPercent : undefined,
        shiftDate: usedForm.postType === 'job' ? new Date() : (usedForm.shiftDates[0] || usedForm.shiftDate),
        shiftDates: usedForm.postType === 'shift' ? usedForm.shiftDates.map((date) => toLocalNoonIsoString(date)) : undefined,
        shiftTimeSlots: usedForm.postType === 'shift' ? usedForm.shiftTimeSlots : undefined,
        shiftDateEnd: usedForm.shiftDateEnd || undefined,
        shiftTime: usedForm.postType === 'shift' ? shiftTime : (usedForm.postType === 'job' ? usedForm.workHours : undefined),
        duration: usedForm.postType === 'homecare' ? usedForm.duration : undefined,
        location: {
          province: usedForm.province,
          district: usedForm.district,
          hospital: usedForm.hospital,
          address: usedForm.address,
          lat: usedForm.locationLat,
          lng: usedForm.locationLng,
        },
        contactPhone: usedForm.contactPhone,
        contactLine: usedForm.contactLine,
        contactMode,
        slotsNeeded: usedForm.postType === 'shift' ? Math.max(1, usedForm.slotsNeeded || 1) : undefined,
        campaignTitle: usedForm.campaignTitle || title,
        campaignSummary: usedForm.campaignSummary || undefined,
        scheduleNote: usedForm.scheduleNote || undefined,
        sourceText: usedForm.sourceText || undefined,
        sourceChannel: usedForm.sourceText ? 'paste' : 'manual',
        shifts,
        totalShifts,
        filledShifts: 0,
        status: (usedForm.isUrgent ? 'urgent' : 'active') as 'active' | 'urgent',
        tags: usedForm.tags,
        expiresAt,
      };
      
      if (isEditMode && editJob) {
        await updateJob(editJob.id, jobData);
        await trackEvent({
          eventName: 'post_job_submitted',
          screenName: 'PostJob',
          subjectType: 'shift',
          subjectId: editJob.id,
          province: usedForm.province,
          props: {
            step: 'updated',
            postType: usedForm.postType,
            isUrgent: Boolean(usedForm.isUrgent),
            staffType: usedForm.staffType,
            userPlan: planKey,
          },
        });

        setAlert(createAlert.success(t('postJob.alerts.editSuccess'), t('postJob.alerts.editSuccessMessage'), [
          { text: t('postJob.alerts.editSuccessButton'), onPress: () => navigation.goBack() }
        ]) as AlertState);
      } else {
        const createdJobId = await createJob({
          ...jobData,
          posterId: user.uid,
          posterName: user.displayName || t('postJob.alerts.posterNameFallback'),
          posterPhoto: user.photoURL || '',
          posterVerified: user.isVerified || false,
          posterRole: user.role,
          posterOrgType: (user as any).orgType,
          posterStaffType: (user as any).staffType,
          posterStaffTypes: (user as any).staffTypes || ((user as any).staffType ? [(user as any).staffType] : []),
          posterPlan: (user as any)?.subscription?.plan || 'free',
          posterAdminTags: user.adminTags || [],
          posterWarningTag: user.adminWarningTag || undefined,
        });
        await trackEvent({
          eventName: 'post_job_submitted',
          screenName: 'PostJob',
          subjectType: 'shift',
          subjectId: createdJobId || user.uid,
          jobId: createdJobId,
          province: usedForm.province,
          props: {
            step: isPaidUrgent ? 'created_after_payment' : 'created',
            postType: usedForm.postType,
            isUrgent: Boolean(usedForm.isUrgent),
            staffType: usedForm.staffType,
            userPlan: planKey,
          },
        });

        await incrementPostCount(user.uid);
        if (consumeUrgentEntitlement && usedForm.isUrgent) {
          await markFreeUrgentUsed(user.uid);
        }
        
        setAlert(createAlert.success(t('postJob.alerts.postSuccess'), t('postJob.alerts.postSuccessMessage'), [
          { text: t('postJob.alerts.postSuccessButton'), onPress: () => navigation.replace('MyPosts') }
        ]) as AlertState);
      }
    } catch (error: any) {
      setAlert(createAlert.error(t('postJob.alerts.errorGeneric'), error.message) as AlertState);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Get step title
  const getStepTitle = () => {
    if (currentStep === 0) {
      if (duplicateJob) {
        return { title: t('postJob.steps.duplicateDraft.title'), subtitle: t('postJob.steps.duplicateDraft.subtitle') };
      }
      if (isEditMode) {
        return { title: t('postJob.steps.editPost.title'), subtitle: t('postJob.steps.editPost.subtitle') };
      }
      return { title: t('postJob.steps.selectType.title'), subtitle: t('postJob.steps.selectType.subtitle') };
    }
    
    const stepsKey = `postJob.steps.${form.postType}`;
    const idx = currentStep - 1;
    return {
      title: t(`${stepsKey}.${idx}.title` as any) || '',
      subtitle: t(`${stepsKey}.${idx}.subtitle` as any) || '',
    };
  };
  
  // ============================================
  // STEP 0: เลือกประเภทประกาศ
  // ============================================
  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.typeSelectTitle, { color: colors.text }]}>
        {t('postJob.steps.selectType.subtitle')}
      </Text>

      {/* แสดงหมายเหตุแต่ละ role */}
      {user?.role === 'user' && (
        <View style={[styles.infoBox, { backgroundColor: roleTones.user.background, marginBottom: 12 }]}> 
          <Ionicons name="person-circle-outline" size={20} color={roleTones.user.icon} />
          <Text style={[styles.infoText, { color: roleTones.user.text }]}> 
            {t('postJob.roleHints.user')}
          </Text>
        </View>
      )}
      {user?.role === 'nurse' && (
        <View style={[styles.infoBox, { backgroundColor: roleTones.nurse.background, marginBottom: 12 }]}> 
          <Ionicons name="medical-outline" size={20} color={roleTones.nurse.icon} />
          <Text style={[styles.infoText, { color: roleTones.nurse.text }]}> 
            {t('postJob.roleHints.nurse')}
          </Text>
        </View>
      )}
      {user?.role === 'hospital' && (
        <View style={[styles.infoBox, { backgroundColor: roleTones.hospital.background, marginBottom: 12 }]}> 
          <Ionicons name="business-outline" size={20} color={roleTones.hospital.icon} />
          <Text style={[styles.infoText, { color: roleTones.hospital.text }]}> 
            {t('postJob.roleHints.hospital')}
          </Text>
        </View>
      )}

      {visiblePostTypes.map((type) => {
        const isSelected = form.postType === type.value;
        return (
          <TouchableOpacity
            key={type.value}
            activeOpacity={0.7}
            style={[
              styles.typeCard,
              {
                backgroundColor: isSelected
                  ? isDark ? `${type.color}25` : type.bgColor
                  : typeCardBackground,
                borderColor: isSelected ? type.color : colors.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => setForm({ ...form, postType: type.value as PostType })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View style={[styles.typeIconWrap, {
                backgroundColor: isSelected ? type.color : type.color + '18',
                width: 52,
                height: 52,
                borderRadius: 16,
              }]}>
                <Ionicons name={type.icon} size={28} color={isSelected ? '#FFFFFF' : type.color} />
              </View>
              <View style={[styles.typeInfo, { marginLeft: 14 }]}>
                <Text style={[styles.typeTitle, {
                  color: isSelected ? type.color : colors.text,
                  fontSize: 16,
                  fontWeight: '700',
                }]}>{t(type.titleKey)}</Text>
                <Text style={[styles.typeSubtitle, {
                  color: colors.textSecondary,
                  fontSize: 12,
                  marginTop: 2,
                  lineHeight: 17,
                }]}>{t(type.subtitleKey)}</Text>
              </View>
            </View>
            <View style={[
              styles.typeRadio,
              {
                borderColor: isSelected ? type.color : colors.border,
                borderWidth: 2,
                width: 24,
                height: 24,
                borderRadius: 12,
              },
              isSelected && { backgroundColor: type.color },
            ]}>
              {isSelected && (
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        );
      })}
      
      {/* Info box */}
      <View style={[styles.infoBox, { backgroundColor: colors.primaryBackground }]}>
        <Ionicons name="information-circle" size={20} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.primaryDark }]}>
          {form.postType === 'shift'
            ? t('postJob.infoBoxes.shift')
            : form.postType === 'job'
            ? t('postJob.infoBoxes.job')
            : t('postJob.infoBoxes.homecare')}
        </Text>
      </View>
    </View>
  );
  
  // ============================================
  // STEP 1: ข้อมูลพื้นฐาน
  // ============================================
  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('postJob.sections.pasteSource')}</Text>
      <TextInput
        style={[styles.textInput, styles.textArea, { borderColor: colors.border, color: colors.text, backgroundColor: inputSurface }]}
        value={form.sourceText}
        onChangeText={(value) => setForm({ ...form, sourceText: value })}
        placeholder={t('postJob.placeholders.sourceText')}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={5}
      />
      <View style={styles.parserActionRow}>
        <TouchableOpacity
          style={[styles.parserButton, { backgroundColor: colors.primary }]}
          onPress={applySourceText}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles-outline" size={18} color={colors.white} />
          <Text style={styles.parserButtonText}>{t('postJob.buttons.extractAuto')}</Text>
        </TouchableOpacity>
      </View>
      {parseWarnings.length > 0 && (
        <View style={[styles.infoBox, { backgroundColor: colors.warningLight, marginTop: SPACING.sm }]}> 
          <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
          <Text style={[styles.infoText, { color: colors.warning }]}> 
            {parseWarnings.join(' • ')}
          </Text>
        </View>
      )}
      {!!form.campaignSummary && (
        <View style={[styles.infoBox, { backgroundColor: colors.primaryBackground, marginTop: SPACING.sm }]}> 
          <Ionicons name="layers-outline" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.primaryDark }]}> 
            {form.campaignSummary}
          </Text>
        </View>
      )}

      {/* Staff Type */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}> 
        {form.postType === 'homecare' ? t('postJob.sections.staffTypeQuestion') : t('postJob.sections.staffTypeLabel')}
      </Text>
      <View style={styles.optionGrid}>
        {staffTypeOptions.map((type) => (
          <TouchableOpacity
            key={type.code}
            style={[
              styles.optionCard,
              { backgroundColor: typeCardBackground },
              { borderColor: form.staffType === type.code ? colors.primary : colors.border },
              form.staffType === type.code && { backgroundColor: colors.primaryLight },
            ]}
            onPress={() => setForm({ ...form, staffType: type.code })}
          >
            <Text style={[styles.optionTitle, { color: colors.text }]}>{type.shortDisplayName}</Text>
            <Text style={[styles.optionSubtitle, { color: colors.textSecondary }]}>{type.displayName}</Text>
            {type.requiresLicense && (
              <View style={[styles.licenseBadge, { backgroundColor: colors.warning }]}> 
                <Text style={[styles.licenseBadgeText, { color: colors.white }]}>{t('postJob.buttons.licenseBadge')}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {errors.staffType && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.staffType}</Text>}
      
      {/* Location Type (not for homecare) */}
      {form.postType !== 'homecare' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
            {t('postJob.sections.workplaceLabel')}
          </Text>
          <View style={styles.optionGrid}>
            {locationTypeOptions.map((type) => (
              <TouchableOpacity
                key={type.code}
                style={[
                  styles.optionCard,
                  { backgroundColor: typeCardBackground },
                  { borderColor: form.locationType === type.code ? colors.primary : colors.border },
                  form.locationType === type.code && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => setForm({ ...form, locationType: type.code })}
              >
                <Ionicons
                  name={type.icon as any}
                  size={24}
                  color={form.locationType === type.code ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.optionTitle, { color: colors.text }]}>{type.displayName}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.locationType && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.locationType}</Text>}
        </>
      )}
      
      {/* Department / Care Type */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}> 
        {form.postType === 'homecare' ? t('postJob.sections.careTypeLabel') : t('postJob.sections.departmentRequired')} <Text style={{ color: colors.error }}>*</Text>
      </Text>
      <TouchableOpacity
        style={[styles.inputButton, { borderColor: errors.department ? colors.error : colors.border, backgroundColor: inputSurface }]}
        onPress={() => setShowDepartmentModal(true)}
      >
        <Ionicons name="medical-outline" size={20} color={errors.department ? colors.error : colors.primary} />
        <Text style={[styles.inputButtonText, { color: form.department ? colors.text : colors.textMuted }]}> 
          {form.department || (form.postType === 'homecare' ? t('postJob.sections.selectCareType') : t('postJob.sections.selectDepartment'))}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {errors.department && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.department}</Text>}
    </View>
  );
  
  // ============================================
  // STEP 2: วันเวลา (ใช้เหมือนกันทุกประเภทโพสต์)
  // ============================================
  const renderStep2 = () => {
    if (form.postType === 'job') {
      const employmentOptions = [
        { value: 'full_time', label: t('postJob.employment.fullTime') },
        { value: 'part_time', label: t('postJob.employment.partTime') },
        { value: 'contract', label: t('postJob.employment.contract') },
        { value: 'temporary', label: t('postJob.employment.temporary') },
      ];

      return (
        <View style={styles.stepContent}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('postJob.sections.employmentFormat')}</Text>
          <View style={styles.chipRow}>
            {employmentOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={form.employmentType === option.value}
                onPress={() => setForm({ ...form, employmentType: option.value })}
              />
            ))}
          </View>
          {errors.employmentType && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.employmentType}</Text>}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>{t('postJob.sections.workSchedule')}</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { borderColor: errors.workHours ? colors.error : colors.border, color: colors.text, backgroundColor: inputSurface }]}
            value={form.workHours}
            onChangeText={(v) => setForm({ ...form, workHours: v })}
            placeholder={t('postJob.placeholders.workHours')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
          {errors.workHours && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.workHours}</Text>}

          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>{t('postJob.sections.startDate')}</Text>
          <TextInput
            style={[styles.textInput, { borderColor: colors.border, color: colors.text }]}
            value={form.startDateNote}
            onChangeText={(v) => setForm({ ...form, startDateNote: v })}
            placeholder={t('postJob.placeholders.startDateNote')}
            placeholderTextColor={colors.textMuted}
          />

          <View style={[styles.infoBox, { backgroundColor: colors.primaryBackground, marginTop: SPACING.lg }]}> 
            <Ionicons name="bulb-outline" size={18} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primaryDark }]}> 
              {t('postJob.infoBoxes.systemNote')}
            </Text>
          </View>
        </View>
      );
    }
    const formatDateTH = (d: Date) =>
      d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });

    const openSlotTime = (key: string, type: 'start' | 'end') => {
      setEditingSlotKey(key);
      setEditingSlotType(type);
      if (type === 'start') setShowStartTimeModal(true);
      else setShowEndTimeModal(true);
    };

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('postJob.sections.datesNeeded')}</Text>
        <MultiDateCalendar
          selectedDates={form.shiftDates}
          onChange={(dates) => {
            const newSlots: Record<string, { start: string; end: string }> = {};
            dates.forEach(d => {
              const k = toDateKey(d);
              newSlots[k] = form.shiftTimeSlots[k] || { start: '', end: '' };
            });
            setForm({ ...form, shiftDates: dates, shiftDate: dates[0] || new Date(), shiftTimeSlots: newSlots });
          }}
        />
        {errors.shiftDates && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.shiftDates}</Text>}

        {form.shiftDates.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
              {t('postJob.sections.timePerDate')}
            </Text>
            {errors.shiftTimes && (
              <Text style={[styles.errorText, { color: errorTextColor, marginBottom: SPACING.sm }]}>{errors.shiftTimes}</Text>
            )}
            {form.shiftDates
              .slice()
              .sort((a, b) => a.getTime() - b.getTime())
              .map(date => {
                const key = toDateKey(date);
                const slot = form.shiftTimeSlots[key] || { start: '', end: '' };
                const missing = !slot.start || !slot.end;
                return (
                  <View
                    key={key}
                    style={[styles.slotRow, {
                      borderColor: missing ? colors.error : colors.border,
                      backgroundColor: inputSurface,
                    }]}
                  >
                    <View style={styles.slotDateWrap}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.slotDateText, { color: colors.text }]}>
                        {formatDateTH(date)}
                      </Text>
                    </View>
                    <View style={styles.slotTimeWrap}>
                      <TouchableOpacity
                        style={[styles.slotTimeBtn, {
                          borderColor: slot.start ? colors.primary : (missing ? colors.error : colors.border),
                          backgroundColor: slot.start ? colors.primaryBackground : colors.card,
                        }]}
                        onPress={() => openSlotTime(key, 'start')}
                      >
                        <Text style={[styles.slotTimeTxt, { color: slot.start ? colors.primary : colors.textMuted }]}>
                          {slot.start || t('postJob.buttons.start_time')}
                        </Text>
                      </TouchableOpacity>
                      <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                      <TouchableOpacity
                        style={[styles.slotTimeBtn, {
                          borderColor: slot.end ? colors.primary : (missing ? colors.error : colors.border),
                          backgroundColor: slot.end ? colors.primaryBackground : colors.card,
                        }]}
                        onPress={() => openSlotTime(key, 'end')}
                      >
                        <Text style={[styles.slotTimeTxt, { color: slot.end ? colors.primary : colors.textMuted }]}>
                          {slot.end || t('postJob.buttons.end_time')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
          </>
        )}
      </View>
    );
  };

  // ============================================
  // STEP 3: สถานที่
  // ============================================
  const renderStep3 = () => (
    <View style={styles.stepContent}>
      {/* Hospital/Place Search FIRST - Auto-fill province/district */}
      {form.postType !== 'homecare' && form.locationType !== 'HOME' ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {form.locationType === 'HOSPITAL' ? t('postJob.sections.searchHospital') : t('postJob.sections.searchPlace')}
          </Text>
          <PlaceAutocomplete
            value={form.hospital}
            placeholder={form.locationType === 'HOSPITAL' ? t('postJob.placeholders.hospitalSearch') : t('postJob.placeholders.placeSearch')}
            onSelect={(place) => {
              setForm({
                ...form,
                hospital: place.name,
                province: place.province || form.province,
                district: place.district || form.district,
                locationLat: place.lat,
                locationLng: place.lng,
              });
            }}
          />
          {errors.hospital && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.hospital}</Text>}
        </>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('postJob.sections.patientAddress')}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { borderColor: colors.border, color: colors.text }]}
            value={form.address}
            onChangeText={(v) => setForm({ ...form, address: v })}
            placeholder={t('postJob.placeholders.patientAddress')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
          {errors.address && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.address}</Text>}
        </>
      )}
      
      {/* Province - can be auto-filled or manual */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>{t('postJob.sections.provinceLabel')}</Text>
      <TouchableOpacity
        style={[styles.inputButton, { borderColor: colors.border }]}
        onPress={() => setShowProvinceModal(true)}
      >
        <Ionicons name="location-outline" size={20} color={colors.primary} />
        <Text style={[styles.inputButtonText, { color: form.province ? colors.text : colors.textMuted }]}>
          {form.province || t('postJob.sections.selectProvince')}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
      {errors.province && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.province}</Text>}
      
      {/* District - can be auto-filled or manual */}
      {form.province && getDistrictsForProvince(form.province).length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>
            {form.province === 'กรุงเทพมหานคร' ? t('postJob.khetLabel') : t('postJob.amphoeLabel')}
          </Text>
          <TouchableOpacity
            style={[styles.selectButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={() => setShowDistrictModal(true)}
          >
            <Text style={[
              styles.selectButtonText,
              { color: form.district ? colors.text : colors.textMuted }
            ]}>
              {form.district || (form.province === 'กรุงเทพมหานคร' ? t('postJob.selectKhetPlaceholder') : t('postJob.selectAmphoePlaceholder'))}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </>
      )}
      
      {/* MAP PICKER BUTTON */}
      <TouchableOpacity
        style={[
          styles.mapPickerBtn,
          {
            borderColor: form.locationLat && form.locationLng ? mapSelectedTone.border : colors.border,
            backgroundColor: form.locationLat && form.locationLng ? mapSelectedTone.background : inputSurface,
          },
        ]}
        onPress={() => setShowMapPicker(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.mapPickerIconWrap, { backgroundColor: form.locationLat && form.locationLng ? mapSelectedTone.border : colors.primary }]}> 
          <Ionicons name={form.locationLat && form.locationLng ? 'checkmark' : 'map-outline'} size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.mapPickerBtnTitle, { color: colors.text }]}>
            {form.locationLat && form.locationLng ? t('postJob.sections.pinnedCoordinates') : t('postJob.sections.pinOnMap')}
          </Text>
          {form.locationLat && form.locationLng ? (
            <Text style={[styles.mapPickerBtnSub, { color: mapSelectedTone.text }]} numberOfLines={1}>
              {form.locationLat.toFixed(5)}, {form.locationLng.toFixed(5)}
            </Text>
          ) : (
            <Text style={[styles.mapPickerBtnSub, { color: colors.textMuted }]}>{t('postJob.sections.tapToPin')}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Hint text */}
      <View style={[styles.infoBox, { backgroundColor: colors.primaryBackground, marginTop: SPACING.md }]}> 
        <Ionicons name="bulb-outline" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.primaryDark }]}> 
          {t('postJob.infoBoxes.autoFillHint')}
        </Text>
      </View>
    </View>
  );
  
  // ============================================
  // STEP 4: ค่าตอบแทน & ติดต่อ
  // ============================================
  const renderStep4 = () => (
    <View style={styles.stepContent}>
      {/* Title (optional) */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('postJob.sections.postTitle')}</Text>
      <TextInput
        style={[styles.textInput, { borderColor: colors.border, color: colors.text }]}
        value={form.title}
        onChangeText={(v) => setForm({ ...form, title: v })}
        placeholder={
          form.postType === 'shift' ? t('postJob.titlePlaceholder.shift', { staff: getStaffTypeLabel(form.staffType), dept: form.department || '' }) :
          form.postType === 'job' ? t('postJob.titlePlaceholder.job', { staff: getStaffTypeLabel(form.staffType) }) :
          t('postJob.titlePlaceholder.homecare', { dept: form.department || '' })
        }
        placeholderTextColor={colors.textMuted}
      />
      
      {/* Description + Benefits - for job posting only */}
      {form.postType === 'job' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>{t('postJob.sections.jobDescription')}</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { borderColor: colors.border, color: colors.text }]}
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            placeholder={t('postJob.placeholders.jobDescription')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={5}
          />
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
            {t('postJob.sections.benefits')}
          </Text>
          {benefitGroups.map((group) => (
            <View key={group.title} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                <Ionicons name={group.icon as any} size={16} color={colors.primary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{group.title}</Text>
              </View>
              <View style={styles.chipRow}>
                {group.items.map((benefit) => (
                  <Chip
                    key={benefit.value}
                    label={benefit.label}
                    selected={form.benefits.includes(benefit.value)}
                    onPress={() => {
                      if (form.benefits.includes(benefit.value)) {
                        setForm({ ...form, benefits: form.benefits.filter((item) => item !== benefit.value) });
                      } else {
                        setForm({ ...form, benefits: [...form.benefits, benefit.value] });
                      }
                    }}
                  />
                ))}
              </View>
            </View>
          ))}
          {/* Custom added benefits (not in presets) */}
          {(() => {
            const presetBenefits = benefitGroups.flatMap((group) => group.items.map((item) => item.value));
            const customBenefits = form.benefits.filter((benefit) => !presetBenefits.includes(benefit));
            if (customBenefits.length === 0) return null;
            return (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
                  <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{t('postJob.sections.customBenefits')}</Text>
                </View>
                <View style={styles.chipRow}>
                  {customBenefits.map((benefit) => (
                    <Chip
                      key={benefit}
                      label={benefit}
                      selected={true}
                      onPress={() => setForm({ ...form, benefits: form.benefits.filter(b => b !== benefit) })}
                    />
                  ))}
                </View>
              </View>
            );
          })()}
          {/* Custom benefit input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <TextInput
              style={[styles.textInput, { flex: 1, borderColor: colors.border, color: colors.text, marginBottom: 0 }]}
              value={customBenefitInput}
              onChangeText={setCustomBenefitInput}
              placeholder={t('postJob.sections.addBenefitPlaceholder')}
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={() => {
                const val = customBenefitInput.trim();
                if (val && !form.benefits.includes(val)) {
                  setForm({ ...form, benefits: [...form.benefits, val] });
                  setCustomBenefitInput('');
                }
              }}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={{
                width: 44, height: 44, borderRadius: 12,
                backgroundColor: customBenefitInput.trim() ? colors.primary : colors.borderLight,
                alignItems: 'center', justifyContent: 'center',
              }}
              onPress={() => {
                const val = customBenefitInput.trim();
                if (val && !form.benefits.includes(val)) {
                  setForm({ ...form, benefits: [...form.benefits, val] });
                  setCustomBenefitInput('');
                }
              }}
            >
              <Ionicons name="add" size={22} color={customBenefitInput.trim() ? colors.white : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Rate/Salary */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
        {form.postType === 'job' ? t('postJob.sections.salary') : t('postJob.sections.compensation')}
      </Text>
      
      {form.postType === 'job' ? (
        <>
          <TextInput
            style={[styles.textInput, { borderColor: colors.border, color: colors.text }]}
            value={form.salaryMin}
            onChangeText={(v) => setForm({ ...form, salaryMin: v.replace(/[^0-9]/g, '') })}
            placeholder={t('postJob.placeholders.salaryMin')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>{t('postJob.sections.salaryHelper')}</Text>
        </>
      ) : (
        <View style={styles.row}>
          <TextInput
            style={[styles.textInput, { flex: 1, borderColor: colors.border, color: colors.text }]}
            value={form.shiftRate}
            onChangeText={(v) => setForm({ ...form, shiftRate: v.replace(/[^0-9]/g, '') })}
            placeholder={t('postJob.placeholders.shiftRate')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
          <View style={styles.rateTypeContainer}>
            {rateTypeOptions.map((rt) => (
              <TouchableOpacity
                key={rt.value}
                style={[
                  styles.rateTypeButton,
                  { borderColor: form.rateType === rt.value ? colors.primary : colors.border },
                  form.rateType === rt.value && { backgroundColor: colors.primary },
                ]}
                onPress={() => setForm({ ...form, rateType: rt.value as any })}
              >
                <Text style={{ color: form.rateType === rt.value ? colors.white : colors.text, fontSize: 12 }}>
                  {rt.shortLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {errors.shiftRate && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.shiftRate}</Text>}
      {errors.salaryMin && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.salaryMin}</Text>}
      {errors.description && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.description}</Text>}
      
      {/* Payment Type */}
      {form.postType !== 'job' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>
            {t('postJob.sections.paymentFormat')}
          </Text>
          <View style={styles.chipRow}>
            {paymentTypeOptions.map((pt) => (
              <Chip
                key={pt.code}
                label={pt.label}
                selected={form.paymentType === pt.code}
                onPress={() => setForm({ ...form, paymentType: pt.code })}
              />
            ))}
          </View>
          
          {/* Deduct Percent - แสดงเฉพาะถ้าเลือก DEDUCT_PERCENT */}
          {form.paymentType === 'DEDUCT_PERCENT' && (
            <View style={[styles.deductContainer, { backgroundColor: warningTone.background }]}> 
              <Text style={[styles.deductLabel, { color: warningTone.text }]}>{t('postJob.sections.deductQuestion')}</Text>
              <View style={styles.deductInputRow}>
                <TextInput
                  style={[styles.deductInput, { borderColor: warningTone.border, color: colors.text, backgroundColor: inputSurface }]}
                  value={form.deductPercent > 0 ? form.deductPercent.toString() : ''}
                  onChangeText={(v) => {
                    const num = parseInt(v.replace(/[^0-9]/g, '')) || 0;
                    setForm({ ...form, deductPercent: Math.min(num, 50) });
                  }}
                  placeholder={t('postJob.placeholders.deductPercent')}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={[styles.deductPercentSign, { color: warningTone.text }]}>%</Text>
              </View>
              {form.shiftRate && form.deductPercent > 0 && (
                <Text style={[styles.deductResult, { color: colors.success }]}> 
                  {t('postJob.sections.nurseReceives')}฿{Math.round(parseInt(form.shiftRate) * (1 - form.deductPercent / 100)).toLocaleString()}
                </Text>
              )}
            </View>
          )}
        </>
      )}
      
      {/* Description */}
      {form.postType !== 'job' && (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>
            {t('postJob.sections.additionalDetails')}
          </Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { borderColor: colors.border, color: colors.text }]}
            value={form.description}
            onChangeText={(v) => setForm({ ...form, description: v })}
            placeholder={t('postJob.placeholders.additionalDetails')}
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
          />
        </>
      )}
      
      {/* Tags */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.md }]}>
        {t('postJob.sections.tags')}
      </Text>
      {tagGroups.map((group) => (
        <View key={group.title} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <Ionicons name={group.icon as any} size={16} color={colors.primary} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{group.title}</Text>
          </View>
          <View style={styles.chipRow}>
            {group.items.map((tag) => (
              <Chip
                key={tag.value}
                label={tag.label}
                selected={form.tags.includes(tag.value)}
                onPress={() => {
                  if (form.tags.includes(tag.value)) {
                    setForm({ ...form, tags: form.tags.filter((item) => item !== tag.value) });
                  } else {
                    setForm({ ...form, tags: [...form.tags, tag.value] });
                  }
                }}
              />
            ))}
          </View>
        </View>
      ))}
      {/* Custom added tags (not in presets) */}
      {(() => {
        const presetTags = tagGroups.flatMap((group) => group.items.map((item) => item.value));
        const customTags = form.tags.filter((tag) => !presetTags.includes(tag));
        if (customTags.length === 0) return null;
        return (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 }}>
              <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{t('postJob.sections.customTags')}</Text>
            </View>
            <View style={styles.chipRow}>
              {customTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  selected={true}
                  onPress={() => setForm({ ...form, tags: form.tags.filter(t => t !== tag) })}
                />
              ))}
            </View>
          </View>
        );
      })()}
      {/* Custom tag input */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <TextInput
          style={[styles.textInput, { flex: 1, borderColor: colors.border, color: colors.text, marginBottom: 0 }]}
          value={customTagInput}
          onChangeText={setCustomTagInput}
          placeholder={t('postJob.sections.addTagPlaceholder')}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => {
            const val = customTagInput.trim();
            if (val && !form.tags.includes(val)) {
              setForm({ ...form, tags: [...form.tags, val] });
              setCustomTagInput('');
            }
          }}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: customTagInput.trim() ? colors.primary : colors.borderLight,
            alignItems: 'center', justifyContent: 'center',
          }}
          onPress={() => {
            const val = customTagInput.trim();
            if (val && !form.tags.includes(val)) {
              setForm({ ...form, tags: [...form.tags, val] });
              setCustomTagInput('');
            }
          }}
        >
          <Ionicons name="add" size={22} color={customTagInput.trim() ? colors.white : colors.textMuted} />
        </TouchableOpacity>
      </View>
      
      {/* Contact */}
      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: SPACING.lg }]}>{t('postJob.sections.contactChannel')}</Text>
      <View style={styles.contactModeGrid}>
        {CONTACT_MODE_KEYS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.contactModeCard,
              {
                borderColor: form.contactMode === option.value ? colors.primary : colors.border,
                backgroundColor: form.contactMode === option.value ? colors.primaryBackground : inputSurface,
              },
            ]}
            onPress={() => setForm({ ...form, contactMode: option.value })}
            activeOpacity={0.85}
          >
            <Text style={[styles.contactModeTitle, { color: form.contactMode === option.value ? colors.primary : colors.text }]}>{t(option.labelKey as any)}</Text>
            <Text style={[styles.contactModeHelper, { color: colors.textSecondary }]}>{t(option.helperKey as any)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {form.contactMode !== 'in_app' && (
        <View style={styles.row}>
          {(form.contactMode === 'phone' || form.contactMode === 'phone_or_line') && (
            <View style={{ flex: 1, marginRight: form.contactMode === 'phone_or_line' ? SPACING.sm : 0 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>{t('postJob.sections.phoneLabel')}</Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.text }]}
                value={form.contactPhone}
                onChangeText={(v) => setForm({ ...form, contactPhone: v })}
                placeholder="08X-XXX-XXXX"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          )}
          {(form.contactMode === 'line' || form.contactMode === 'phone_or_line') && (
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>LINE ID</Text>
              <TextInput
                style={[styles.textInput, { borderColor: colors.border, color: colors.text }]}
                value={form.contactLine}
                onChangeText={(v) => setForm({ ...form, contactLine: v })}
                placeholder="@lineID"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          )}
        </View>
      )}

      <View style={[styles.infoBox, { backgroundColor: colors.primaryBackground, marginTop: SPACING.sm }]}> 
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.primaryDark }]}> 
          {t('postJob.infoBoxes.contactPrivacy')}
        </Text>
      </View>
      {externalContactSignals.hasExternalContact && form.contactMode === 'in_app' && (
        <Text style={[styles.errorText, { color: errorTextColor }]}>{t('postJob.externalContactWarning')}</Text>
      )}
      {errors.contact && <Text style={[styles.errorText, { color: errorTextColor }]}>{errors.contact}</Text>}
      
      {/* Urgent Toggle */}
      <TouchableOpacity
        style={[
          styles.urgentToggle,
          { borderColor: form.isUrgent ? colors.error : colors.border },
          { backgroundColor: inputSurface },
          form.isUrgent && { backgroundColor: colors.errorLight },
        ]}
        onPress={() => setForm({ ...form, isUrgent: !form.isUrgent })}
      >
        <Text style={styles.urgentIcon}>🔥</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.urgentTitle, { color: colors.text }]}>{t('postJob.sections.urgentPost')}</Text>
          <Text style={[styles.urgentSubtitle, { color: colors.textMuted }]}>
            {t('postJob.sections.urgentSubtitle')}
          </Text>
          <View style={[styles.urgentPriceTag, { backgroundColor: urgentPriceTone.background }]}>
            <Text style={[styles.urgentPriceText, { color: urgentPriceTone.text }]}>฿{PRICING.urgentPost}</Text>
          </View>
        </View>
        <Ionicons
          name={form.isUrgent ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={form.isUrgent ? colors.error : colors.textMuted}
        />
      </TouchableOpacity>
      {form.isUrgent && (
        <View style={[styles.urgentNote, { backgroundColor: warningTone.background }]}> 
          <Ionicons name="information-circle" size={16} color={warningTone.text} />
          <Text style={[styles.urgentNoteText, { color: warningTone.text }]}> 
            {t('postJob.infoBoxes.urgentNote')}
          </Text>
        </View>
      )}
    </View>
  );
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderStep0();
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return null;
    }
  };
  
  const stepInfo = getStepTitle();
  const duplicateDraftBanner = duplicateJob ? (
    <View style={[styles.duplicateBanner, { backgroundColor: colors.surface, borderColor: colors.warning }]}> 
      <View style={[styles.duplicateBannerIcon, { backgroundColor: colors.warningLight }]}> 
        <Ionicons name="copy-outline" size={20} color={colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.duplicateBannerTitle, { color: colors.text }]}>{t('postJob.duplicateBanner.title')}</Text>
        <Text style={[styles.duplicateBannerText, { color: colors.textSecondary }]}>{t('postJob.duplicateBanner.text')}</Text>
      </View>
    </View>
  ) : null;
  
  return (
    <>
      <StatusBar barStyle={statusBarStyle} backgroundColor={statusBarBackground} translucent={false} />
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: headerBackground }]}> 
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: headerButtonBackground }]} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: colors.white }]}>{stepInfo.title}</Text>
          <Text style={[styles.headerSubtitle, { color: headerSubtitleColor }]}>{stepInfo.subtitle}</Text>
        </View>
        {currentStep > 0 && (
          <Text style={[styles.stepIndicator, { color: colors.white, backgroundColor: stepIndicatorBackground }]}>{currentStep}/{getTotalSteps()}</Text>
        )}
      </View>
      
      {/* Progress Bar (only for steps 1-4) */}
      {currentStep > 0 && (
        <View style={[styles.progressContainer, { backgroundColor: colors.borderLight }]}>
          <Animated.View
            style={[
              styles.progressBar,
              { 
                backgroundColor: colors.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}
      
      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {currentStep === 0 ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {user && user.onboardingCompleted && (
              <FirstVisitTip
                storageKey={`first_tip_post_job_${user.uid}`}
                icon="create-outline"
                title={t('postJob.firstVisitTip.title')}
                description={t('postJob.firstVisitTip.description')}
                actionLabel={onboardingSurveyEnabled ? t('postJob.firstVisitTip.actionLabel') : undefined}
                onAction={onboardingSurveyEnabled ? () => navigation.navigate('OnboardingSurvey') : undefined}
              />
            )}
            {duplicateDraftBanner}
            {renderStepContent()}
          </ScrollView>
        ) : (
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {user && user.onboardingCompleted && currentStep === 1 && (
              <FirstVisitTip
                storageKey={`first_tip_post_job_${user.uid}`}
                icon="create-outline"
                title={t('postJob.firstVisitTip.title')}
                description={t('postJob.firstVisitTip.description')}
                actionLabel={onboardingSurveyEnabled ? t('postJob.firstVisitTip.actionLabel') : undefined}
                onAction={onboardingSurveyEnabled ? () => navigation.navigate('OnboardingSurvey') : undefined}
              />
            )}
            {duplicateDraftBanner}
            {renderStepContent()}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, { borderTopColor: colors.border, backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}> 
        {currentStep > 0 && (
          <TouchableOpacity
            onPress={goBack}
            style={{
              flex: 1,
              height: 48,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: SPACING.sm,
              backgroundColor: inputSurface,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 16 }}>{t('postJob.buttons.back')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={goNext}
          disabled={isLoading || isSubmitting}
          style={{
            flex: 1,
            height: 48,
            borderRadius: 12,
            backgroundColor: isLoading || isSubmitting ? colors.textMuted : colors.primary,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: isLoading || isSubmitting ? 0.7 : 1,
          }}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: 16 }}>
            {currentStep === 0 ? t('postJob.buttons.start') :
              currentStep === getTotalSteps() ? ((isLoading || isSubmitting) ? t('postJob.buttons.posting') : (duplicateJob ? t('postJob.buttons.createFromDraft') : t('postJob.buttons.postNow'))) :
              t('postJob.buttons.next')}
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Province Modal */}
      <ModalContainer
        visible={showProvinceModal}
        onClose={() => setShowProvinceModal(false)}
        title={t('postJob.modals.provinceTitle')}
      >
        <TextInput
          style={[styles.searchInput, { borderColor: colors.border, color: colors.text }]}
          value={provinceSearch}
          onChangeText={setProvinceSearch}
          placeholder={t('postJob.modals.provinceSearch')}
          placeholderTextColor={colors.textMuted}
        />
        
        {/* Popular */}
        {!provinceSearch && !showAllProvinces && (
          <>
            <Text style={[styles.modalSectionTitle, { color: colors.textMuted }]}>{t('postJob.modals.popular')}</Text>
            <View style={styles.chipRow}>
              {POPULAR_PROVINCES.map((p: string) => (
                <Chip
                  key={p}
                  label={p}
                  selected={form.province === p}
                  onPress={() => {
                    setForm({ ...form, province: p, district: '' });
                    setShowProvinceModal(false);
                  }}
                />
              ))}
            </View>
          </>
        )}
        
        {/* Show All Button */}
        {!provinceSearch && !showAllProvinces && (
          <TouchableOpacity 
            style={styles.showMoreButton}
            onPress={() => setShowAllProvinces(true)}
          >
            <Text style={[styles.showMoreText, { color: colors.primary }]}>{t('postJob.modals.showAll77')}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        <ScrollView style={{ maxHeight: 350 }}>
          {filteredProvinces.map((province: string) => (
            <TouchableOpacity
              key={province}
              style={[
                styles.listItem,
                form.province === province && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => {
                setForm({ ...form, province, district: '' });
                setShowProvinceModal(false);
                setProvinceSearch('');
                setShowAllProvinces(false);
              }}
            >
              <Text style={[styles.listItemText, { color: colors.text }]}>{province}</Text>
              {form.province === province && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ModalContainer>
      
      {/* Department Modal */}
      <ModalContainer
        visible={showDepartmentModal}
        onClose={() => setShowDepartmentModal(false)}
        title={form.postType === 'homecare' ? t('postJob.modals.careTypeTitle') : t('postJob.modals.departmentTitle')}
      >
        <ScrollView style={{ maxHeight: 400 }}>
          {getDepartments().map((dept) => (
            <TouchableOpacity
              key={dept.value}
              style={[
                styles.listItem,
                form.department === dept.value && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => {
                setForm({ ...form, department: dept.value });
                setShowDepartmentModal(false);
              }}
            >
              <Text style={[styles.listItemText, { color: colors.text }]}>{dept.label}</Text>
              {form.department === dept.value && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ModalContainer>
      
      {/* District Modal */}
      <ModalContainer
        visible={showDistrictModal}
        onClose={() => {
          setShowDistrictModal(false);
          setDistrictSearch('');
        }}
        title={form.province === 'กรุงเทพมหานคร' ? t('postJob.modals.districtTitleKhet') : t('postJob.modals.districtTitleAmphoe')}
      >
        <TextInput
          style={[styles.searchInput, { borderColor: colors.border, color: colors.text }]}
          value={districtSearch}
          onChangeText={setDistrictSearch}
          placeholder={form.province === 'กรุงเทพมหานคร' ? t('postJob.modals.districtSearchKhet') : t('postJob.modals.districtSearchAmphoe')}
          placeholderTextColor={colors.textMuted}
        />
        <ScrollView style={{ maxHeight: 400 }}>
          {getDistrictsForProvince(form.province)
            .filter(d => !districtSearch || d.includes(districtSearch))
            .map((district) => (
            <TouchableOpacity
              key={district}
              style={[
                styles.listItem,
                form.district === district && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => {
                setForm({ ...form, district });
                setShowDistrictModal(false);
                setDistrictSearch('');
              }}
            >
              <Text style={[styles.listItemText, { color: colors.text }]}>{district}</Text>
              {form.district === district && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </ModalContainer>
      
      {/* Date Modal */}
      <ModalContainer
        visible={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t('postJob.modals.dateTitle')}
      >
        <CalendarPicker
          value={form.shiftDate}
          onChange={(date: Date) => {
            setForm({ ...form, shiftDate: date });
            setShowDateModal(false);
          }}
          minDate={new Date()}
        />
      </ModalContainer>
      
      {/* Start Time Modal */}
      <ModalContainer
        visible={showStartTimeModal}
        onClose={() => { setShowStartTimeModal(false); setEditingSlotKey(null); }}
        title={t('postJob.modals.startTimeTitle')}
      >
        <ScrollView style={{ maxHeight: 400 }}>
          {TIME_OPTIONS.map((time) => {
            const currentVal = editingSlotKey
              ? (form.shiftTimeSlots[editingSlotKey]?.start || '')
              : form.customStartTime;
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeOption,
                  currentVal === time && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => {
                  if (editingSlotKey) {
                    setForm(prev => ({
                      ...prev,
                      shiftTimeSlots: {
                        ...prev.shiftTimeSlots,
                        [editingSlotKey]: { ...prev.shiftTimeSlots[editingSlotKey], start: time },
                      },
                    }));
                  } else {
                    setForm(prev => ({ ...prev, customStartTime: time, shiftTime: 'custom' }));
                  }
                  setShowStartTimeModal(false);
                  setEditingSlotKey(null);
                }}
              >
                <Text style={[
                  styles.timeOptionText,
                  { color: currentVal === time ? colors.primary : colors.text }
                ]}>
                  {time}
                </Text>
                {currentVal === time && (
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ModalContainer>
      
      {/* End Time Modal */}
      <ModalContainer
        visible={showEndTimeModal}
        onClose={() => { setShowEndTimeModal(false); setEditingSlotKey(null); }}
        title={t('postJob.modals.endTimeTitle')}
      >
        <ScrollView style={{ maxHeight: 400 }}>
          {TIME_OPTIONS.map((time) => {
            const currentVal = editingSlotKey
              ? (form.shiftTimeSlots[editingSlotKey]?.end || '')
              : form.customEndTime;
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeOption,
                  currentVal === time && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => {
                  if (editingSlotKey) {
                    setForm(prev => ({
                      ...prev,
                      shiftTimeSlots: {
                        ...prev.shiftTimeSlots,
                        [editingSlotKey!]: { ...prev.shiftTimeSlots[editingSlotKey!], end: time },
                      },
                    }));
                  } else {
                    setForm(prev => ({ ...prev, customEndTime: time, shiftTime: 'custom' }));
                  }
                  setShowEndTimeModal(false);
                  setEditingSlotKey(null);
                }}
              >
                <Text style={[
                styles.timeOptionText,
                { color: currentVal === time ? colors.primary : colors.text }
              ]}>
                {time}
              </Text>
              {currentVal === time && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ModalContainer>
      
      {/* Alert */}
      <CustomAlert {...alert} onClose={() => setAlert(initialAlertState)} />

      {/* Map Pin Picker */}
      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        initialLat={form.locationLat}
        initialLng={form.locationLng}
        onConfirm={(picked: PickedLocation) => {
          setForm(prev => ({
            ...prev,
            locationLat: picked.lat,
            locationLng: picked.lng,
            // Apply province/district from reverse geocode
            province: picked.province || prev.province,
            district: picked.district || prev.district,
            // Fill hospital/address if not already typed
            hospital: prev.hospital || picked.address,
            address: prev.address || picked.address,
          }));
          setShowMapPicker(false);
        }}
      />
    </SafeAreaView>
    </>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  centeredIcon: {
    fontSize: 60,
    marginBottom: SPACING.md,
  },
  centeredTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  centeredSubtitle: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  stepIndicator: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.md,
  },
  
  // Progress
  progressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  duplicateBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  duplicateBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateBannerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  duplicateBannerText: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  
  // Step Content
  stepContent: {
    flex: 1,
  },
  
  // Step 0: Type Selection
  typeSelectTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  typeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  typeInfo: {
    flex: 1,
  },
  typeTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  typeSubtitle: {
    fontSize: FONT_SIZES.sm,
  },
  typeRadio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
  },

  // Map Picker Button
  mapPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    marginTop: SPACING.lg,
  },
  mapPickerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPickerBtnTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  mapPickerBtnSub: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  
  // Section Title
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  
  // Option Grid
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  optionCard: {
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.sm * 2) / 3,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  optionIcon: {
    fontSize: 28,
    marginBottom: 4,
  },
  optionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  optionSubtitle: {
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
  },
  licenseBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  licenseBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  
  // Duration Grid
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  durationCard: {
    width: (SCREEN_WIDTH - SPACING.md * 2 - SPACING.sm) / 2,
    padding: SPACING.md,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  durationLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  durationDesc: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  
  // Inputs
  inputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  inputButtonText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 6,
    textAlign: 'center',
  },
  timeInputLarge: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeInputText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  timeArrow: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  timeOptionText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
  },
  quickPresetsLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.sm,
  },
  quickPresetsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  presetChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    minWidth: 90,
  },
  presetChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  presetChipTime: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 4,
  },
  parserActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: SPACING.sm,
  },
  parserButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  parserButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  
  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  
  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactModeGrid: {
    gap: SPACING.sm,
  },
  contactModeCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  contactModeTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  contactModeHelper: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  
  // Rate Type
  rateTypeContainer: {
    flexDirection: 'row',
    marginLeft: SPACING.sm,
  },
  rateTypeButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: 4,
  },
  
  // Deduct Container
  deductContainer: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.sm,
  },
  deductLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  deductResult: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  
  // Urgent Toggle
  urgentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.lg,
  },
  urgentIcon: {
    fontSize: 28,
    marginRight: SPACING.sm,
  },
  urgentTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  urgentSubtitle: {
    fontSize: FONT_SIZES.xs,
  },
  urgentPriceTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  urgentPriceText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  urgentNote: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  urgentNoteText: {
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  
  // Deduct Input
  deductInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deductInput: {
    borderWidth: 2,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    textAlign: 'center',
    width: 80,
  },
  deductPercentSign: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  
  // Error
  errorText: {
    fontSize: FONT_SIZES.sm,
    marginTop: 4,
  },
  
  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderTopWidth: 1,
  },

  // Per-date slot row
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  slotDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  slotDateText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  slotTimeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slotTimeBtn: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 58,
    alignItems: 'center',
  },
  slotTimeTxt: {
    fontSize: 13,
    fontWeight: '700',
  },
  
  // Modal
  searchInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    fontSize: FONT_SIZES.md,
  },
  modalSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  showMoreText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    marginRight: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
  },
  listItemText: {
    fontSize: FONT_SIZES.md,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
  },
  selectButtonText: {
    fontSize: FONT_SIZES.md,
    flex: 1,
  },
});
