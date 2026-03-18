// ============================================
// PROFILE SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KittenButton as Button, Avatar, Card, Loading, ModalContainer, Input, Badge, Divider, ConfirmModal, SuccessModal, ErrorModal, ProfileProgressBar, Chip, FirstVisitTip } from '../../components/common';
import { sendOTP, verifyOTP } from '../../services/otpService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, POSITIONS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useOnboardingSurveyEnabled } from '../../hooks/useOnboardingSurveyEnabled';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import { getUserShiftContacts, deleteShiftContact, syncPosterSnapshotToMyPosts } from '../../services/jobService';
import { getLaunchQuotaSummary, getUserSubscription, LaunchQuotaSummary } from '../../services/subscriptionService';
import { getFavoritesCount } from '../../services/favoritesService';
import { getUnreadNotificationsCount } from '../../services/notificationsService';
import { getApplicationStats } from '../../services/applicantsService';
import { getUserVerificationStatus, getVerificationMenuLabel, UserVerificationStatus } from '../../services/verificationService';
import { uploadProfilePhoto } from '../../services/storageService';
import { getTargetRating } from '../../services/reviewsService';
import {
  COMMERCE_CONFIG,
  CommerceAccessStatus,
  getCommerceAccessStatus,
  getCommerceEntrySubtitle,
  getCommerceEntryTitle,
} from '../../services/commerceService';
import { STAFF_TYPES } from '../../constants/jobOptions';
import { CampaignCodePackage, ShiftContact, MainTabParamList, RootStackParamList } from '../../types';
import {
  CAMPAIGN_PACKAGE_OPTIONS,
  clearPendingCampaignCodeForUser,
  getCampaignBenefitSummary,
  getCampaignPackageAmount,
  getCampaignPackageDisplayKey,
  getCampaignPackageDisplayLabel,
  savePendingCampaignCodeForUser,
} from '../../services/campaignCodeService';
import { formatDate, formatRelativeTime } from '../../utils/helpers';
import { getPremiumTagColors, getPremiumTagText, getRoleIconName, getRoleLabel, getRoleTagColors, hasPremiumTag } from '../../utils/verificationTag';
import {
  ORG_TYPE_OPTIONS,
  getCareTypeThaiLabel,
  getHiringUrgencyThaiLabel,
  getOrgTypeThaiLabel,
  getStaffTypeThaiLabel,
  getThaiLabels,
  getWorkStyleThaiLabel,
  HOSPITAL_URGENCY_OPTIONS,
  NURSE_WORK_STYLE_OPTIONS,
  OrgType,
  USER_CARE_TYPE_OPTIONS,
} from '../../utils/profileLabels';
import { trackEvent } from '../../services/analyticsService';

function getDefaultCampaignPackage(role?: string | null): CampaignCodePackage {
  return role === 'nurse' ? 'nurse_pro_monthly' : 'premium_monthly';
}

// ============================================
// Types
// ============================================
type ProfileScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Profile'>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

interface EditProfileForm {
  displayName: string;
  phone: string;
  staffType: string;
  orgType: OrgType | '';
  interestedStaffTypes: string[];
  licenseNumber: string;
  experience: string;
  workStyle: string[];
  careNeeds: string[];
  hiringUrgency: string;
  bio: string;
  province: string;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ProfileShortcut {
  key: string;
  label: string;
  icon: IoniconName;
  badge?: string;
  onPress: () => void;
}

interface ProfileMenuItem {
  key: string;
  label: string;
  subtitle?: string;
  icon: IoniconName;
  badge?: string;
  onPress: () => void;
}

interface ProfileMenuSection {
  key: string;
  title: string;
  items: ProfileMenuItem[];
}

interface ProfileInfoTile {
  key: string;
  label: string;
  value: string;
  icon: IoniconName;
  fullWidth?: boolean;
}

// ============================================
// Component
// ============================================
export default function ProfileScreen({ navigation }: Props) {
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  // Auth context
  const { user, isAuthenticated, logout, updateUser, refreshUser, isLoading: isAuthLoading, isAdmin, isInitialized } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const profileScrollRef = useRef<ScrollView>(null);
  // Eva icons
  const EvaIcon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 24, color = colors.primary }) => (
    <Ionicons name={name as any} size={size} color={color} />
  );

  // State
  const [contacts, setContacts] = useState<ShiftContact[]>([]);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [pendingDeleteContact, setPendingDeleteContact] = useState<{ id: string; title: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [applicantsInterestedCount, setApplicantsInterestedCount] = useState(0);
  // OTP states
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [pendingVerificationId, setPendingVerificationId] = useState('');
  // Phone OTP inline step: 'idle' | 'sending' | 'verify' | 'verified'
  const [phoneStep, setPhoneStep] = useState<'idle' | 'sending' | 'verify' | 'verified'>('idle');
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [userPlan, setUserPlan] = useState<import('../../types').SubscriptionPlan>('free');
  const [commerceStatus, setCommerceStatus] = useState<CommerceAccessStatus | null>(null);
  const [launchQuotaSummary, setLaunchQuotaSummary] = useState<LaunchQuotaSummary | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ averageRating: number; totalReviews: number } | null>(null);
  const [showCampaignCodeModal, setShowCampaignCodeModal] = useState(false);
  const [campaignCodeInput, setCampaignCodeInput] = useState('');
  const [selectedCampaignPackage, setSelectedCampaignPackage] = useState<CampaignCodePackage>(getDefaultCampaignPackage(user?.role));
  const [isApplyingCampaignCode, setIsApplyingCampaignCode] = useState(false);
  const [editForm, setEditForm] = useState<EditProfileForm>({
    displayName: '',
    phone: '',
    staffType: '',
    orgType: '',
    interestedStaffTypes: [],
    licenseNumber: '',
    experience: '',
    workStyle: [],
    careNeeds: [],
    hiringUrgency: '',
    bio: '',
    province: '',
  });

  useEffect(() => {
    if (!user?.uid) return;
    trackEvent({
      eventName: 'profile_viewed',
      screenName: 'Profile',
      subjectType: 'user_profile',
      subjectId: user.uid,
      province: user.location?.province,
      props: {
        role: user.role || null,
        isVerified: Boolean(user.isVerified),
        userPlan,
      },
    });
  }, [user?.isVerified, user?.location?.province, user?.role, user?.uid, userPlan]);

  // Check if user is hospital (no longer used but kept for reference)
  const canManageApplicants = Boolean(user && user.role !== 'admin');
  const focusSyncInProgressRef = useRef(false);
  const posterSnapshotSyncDoneRef = useRef(false);
  const headerBackground = isDark ? colors.surface : colors.primary;
  const profileStatusBarStyle = isDark ? 'light-content' : 'light-content';
  const elevatedSurface = isDark ? colors.card : colors.surface;
  const warningTone = { background: colors.warningLight, border: colors.warning, text: colors.warning };
  const accentTone = { background: colors.accentLight, border: colors.accent, text: colors.accentDark };
  const successTone = { background: colors.successLight, text: colors.success };
  const campaignPackageOptions = CAMPAIGN_PACKAGE_OPTIONS.filter((item) => {
    if (item.audience === 'both') return true;
    if (user?.role === 'admin') return true;
    return item.audience === user?.role;
  });
  const pendingCampaignCode = user?.pendingCampaignCode || null;
  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      const syncAndLoad = async () => {
        if (focusSyncInProgressRef.current) return;
        focusSyncInProgressRef.current = true;
        try {
          await refreshUser();
          if (!posterSnapshotSyncDoneRef.current && user?.uid) {
            try {
              await syncPosterSnapshotToMyPosts(user.uid, {
                displayName: user.displayName,
                photoURL: user.photoURL || '',
              });
            } catch (err) {
              console.warn('Poster snapshot sync failed:', err);
            }
            posterSnapshotSyncDoneRef.current = true;
          }
          await loadAllData();
        } finally {
          focusSyncInProgressRef.current = false;
        }
      };

      // Only load after real Firebase auth is confirmed (not cached user)
      if (user?.uid && isInitialized) {
        syncAndLoad();
      }
    }, [user?.uid, isInitialized, refreshUser])
  );

  // Load all data
  const loadAllData = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const [shiftsData, favCount, notifCount, verifyStatus, applicantStats] = await Promise.all([
        getUserShiftContacts(user.uid),
        getFavoritesCount(user.uid),
        getUnreadNotificationsCount(user.uid),
        getUserVerificationStatus(user.uid),
        user.role !== 'admin' ? getApplicationStats(user.uid) : Promise.resolve(null),
      ]);
      setContacts(shiftsData);
      setFavoritesCount(favCount);
      setUnreadNotifications(notifCount);
      setApplicantsInterestedCount(applicantStats?.interested || 0);
      setVerificationStatus(verifyStatus);
      const ratingInfo = await getTargetRating(user.uid, 'user');
      setReviewSummary({ averageRating: ratingInfo.averageRating, totalReviews: ratingInfo.totalReviews });
      try {
        const [sub, commerce, quotaSummary] = await Promise.all([
          getUserSubscription(user.uid),
          getCommerceAccessStatus(),
          getLaunchQuotaSummary(user.uid),
        ]);
        setUserPlan(sub?.plan ?? 'free');
        setCommerceStatus(commerce);
        setLaunchQuotaSummary(quotaSummary);
      } catch (err) {
        console.error('Error loading subscription in profile', err);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAllData();
  };

  useTabRefresh(
    useCallback(() => {
      handleRefresh();
    }, [])
    , {
      scrollToTop: () => profileScrollRef.current?.scrollTo({ y: 0, animated: true }),
    }
  );

  useEffect(() => {
    if (!campaignPackageOptions.some((item) => item.key === selectedCampaignPackage)) {
      setSelectedCampaignPackage(campaignPackageOptions[0]?.key || getDefaultCampaignPackage(user?.role));
    }
  }, [campaignPackageOptions, selectedCampaignPackage, user?.role]);

  useEffect(() => {
    if (showCampaignCodeModal) {
      setCampaignCodeInput(pendingCampaignCode?.code || '');
      if (pendingCampaignCode?.packageKey) {
        setSelectedCampaignPackage(getCampaignPackageDisplayKey(pendingCampaignCode.packageKey, user?.role));
      }
    }
  }, [showCampaignCodeModal, pendingCampaignCode, user?.role]);

  const handleApplyCampaignCode = async () => {
    if (!user?.uid) return;

    const normalizedCode = campaignCodeInput.trim().toUpperCase();
    if (!normalizedCode) {
      setModalTitle('กรอกรหัสโค้ดก่อน');
      setModalMessage('โปรดระบุโค้ดแคมเปญหรือโค้ดส่วนลดที่ต้องการใช้');
      setShowErrorModal(true);
      return;
    }

    setIsApplyingCampaignCode(true);
    try {
      const amount = getCampaignPackageAmount(selectedCampaignPackage);
      const result = await savePendingCampaignCodeForUser({
        code: normalizedCode,
        userId: user.uid,
        userRole: user.role,
        packageKey: selectedCampaignPackage,
        amount,
      });

      if (!result.valid || !result.pendingCode) {
        setModalTitle('ใช้โค้ดไม่ได้');
        setModalMessage(result.message || 'กรุณาตรวจสอบกติกาโค้ดอีกครั้ง');
        setShowErrorModal(true);
        return;
      }

      await refreshUser();
      setShowCampaignCodeModal(false);
      setModalTitle('บันทึกโค้ดเรียบร้อย');
      setModalMessage(
        `${result.pendingCode.code} ใช้กับ ${getCampaignPackageDisplayLabel(result.pendingCode.packageKey, user.role)}\n${getCampaignBenefitSummary(result.pendingCode.benefitType, result.pendingCode.benefitValue)}`,
      );
      setShowSuccessModal(true);
    } catch (error: any) {
      setModalTitle('เกิดข้อผิดพลาด');
      setModalMessage(error.message || 'ไม่สามารถบันทึกโค้ดได้');
      setShowErrorModal(true);
    } finally {
      setIsApplyingCampaignCode(false);
    }
  };

  const handleClearCampaignCode = async () => {
    if (!user?.uid) return;

    setIsApplyingCampaignCode(true);
    try {
      await clearPendingCampaignCodeForUser(user.uid);
      await refreshUser();
      setCampaignCodeInput('');
      setModalTitle('ลบโค้ดที่บันทึกแล้ว');
      setModalMessage('ระบบจะไม่ใช้โค้ดแคมเปญกับการซื้อครั้งถัดไป');
      setShowSuccessModal(true);
    } catch (error: any) {
      setModalTitle('ลบโค้ดไม่สำเร็จ');
      setModalMessage(error.message || 'กรุณาลองใหม่อีกครั้ง');
      setShowErrorModal(true);
    } finally {
      setIsApplyingCampaignCode(false);
    }
  };

  // Initialize edit form when modal opens
  useEffect(() => {
    if (showEditModal && user) {
      setEditForm({
        displayName: user.displayName || '',
        phone: user.phone || '',
        staffType: user.staffType || '',
        orgType: (user.orgType as OrgType | undefined) || '',
        interestedStaffTypes: user.interestedStaffTypes || [],
        licenseNumber: user.licenseNumber || '',
        experience: user.experience?.toString() || '',
        workStyle: user.workStyle || [],
        careNeeds: user.careNeeds || user.careTypes || [],
        hiringUrgency: user.hiringUrgency || '',
        bio: user.bio || '',
        province: (user as any).location?.province || (user as any).preferredProvince || '',
      });
      // Reset OTP/phone state on open
      setPhoneStep('idle');
      setOtpValue('');
      setOtpError('');
      setOtpResendCountdown(0);
    }
  }, [showEditModal, user]);

  // Delete contact from history
  const handleDeleteContact = (contactId: string, jobTitle: string) => {
    setPendingDeleteContact({ id: contactId, title: jobTitle });
    setShowDeleteContactModal(true);
  };

  const confirmDeleteContact = async () => {
    if (!pendingDeleteContact) return;
    setShowDeleteContactModal(false);
    setDeletingContactId(pendingDeleteContact.id);
    try {
      await deleteShiftContact(pendingDeleteContact.id);
      setContacts(prev => prev.filter(c => c.id !== pendingDeleteContact.id));
    } catch (e) {
      setModalTitle('เกิดข้อผิดพลาด');
      setModalMessage('ไม่สามารถลบได้ กรุณาลองใหม่');
      setShowErrorModal(true);
    } finally {
      setDeletingContactId(null);
      setPendingDeleteContact(null);
    }
  };

  // Get status config for contact history
  const getContactStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed': return { label: 'ยืนยันแล้ว', color: colors.success, bg: colors.successLight, icon: 'checkmark-circle' as const };
      case 'cancelled': return { label: 'ยกเลิก', color: colors.error, bg: colors.errorLight, icon: 'close-circle' as const };
      case 'expired': return { label: 'โพสต์ถูกลบ', color: colors.textMuted, bg: colors.borderLight, icon: 'archive-outline' as const };
      default: return { label: 'สนใจ', color: colors.warning, bg: colors.warningLight, icon: 'star-outline' as const };
    }
  };

  // Handle logout - show modal
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // Confirm logout
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logout();
      // Don't show success modal - user will be logged out immediately
      // The ProfileScreen will unmount because isAuthenticated becomes false
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle photo change
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  const handleChangePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      setModalTitle('ไม่มีสิทธิ์');
      setModalMessage('กรุณาอนุญาตการเข้าถึงรูปภาพในการตั้งค่าของคุณ');
      setShowErrorModal(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0] && user?.uid) {
      setIsUploadingPhoto(true);
      try {
        // Upload to Firebase Storage
        const photoURL = await uploadProfilePhoto(user.uid, result.assets[0].uri);
        
        // Update user profile with new photo URL
        await updateUser({ photoURL });
        await trackEvent({
          eventName: 'profile_photo_updated',
          screenName: 'Profile',
          subjectType: 'user_profile',
          subjectId: user.uid,
          props: {
            role: user.role || null,
          },
        });
        
        setModalTitle('สำเร็จ');
        setModalMessage('อัพโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
        setShowSuccessModal(true);
      } catch (error: any) {
        console.error('Upload photo error:', error);
        setModalTitle('เกิดข้อผิดพลาด');
        setModalMessage(error.message || 'ไม่สามารถอัพโหลดรูปได้');
        setShowErrorModal(true);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  // Start OTP countdown timer
  const startOtpCountdown = (seconds = 60) => {
    setOtpResendCountdown(seconds);
    const interval = setInterval(() => {
      setOtpResendCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Send OTP for phone verification
  const handleSendPhoneOTP = async () => {
    const phone = editForm.phone.trim();
    if (!phone || phone.length < 9) {
      setOtpError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
      return;
    }
    setPhoneStep('sending');
    setOtpError('');
    try {
      const result = await sendOTP(phone);
      if (!result.success) {
        setPhoneStep('idle');
        setOtpError(result.error || 'ส่งรหัส OTP ไม่สำเร็จ');
        return;
      }
      setPendingVerificationId(result.verificationId || '');
      setPhoneStep('verify');
      setOtpValue('');
      startOtpCountdown(60);
    } catch (error: any) {
      setPhoneStep('idle');
      setOtpError(error.message || 'ส่งรหัส OTP ไม่สำเร็จ');
    }
  };

  // Verify OTP code
  const handleVerifyOTP = async () => {
    if (!otpValue || otpValue.length < 4) {
      setOtpError('กรุณากรอกรหัส OTP ให้ครบถ้วน');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const otpResult = await verifyOTP(pendingVerificationId, otpValue, { skipSignIn: true });
      if (!otpResult.success) {
        setOtpError(otpResult.error || 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่');
        return;
      }
      setPhoneStep('verified');
      setOtpError('');
    } catch (error: any) {
      setOtpError(error.message || 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่');
    } finally {
      setOtpLoading(false);
    }
  };

  const toggleEditArrayValue = (field: 'interestedStaffTypes' | 'workStyle' | 'careNeeds', value: string) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((item) => item !== value)
        : [...prev[field], value],
    }));
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    const phoneChanged = editForm.phone.trim() !== (user?.phone || '').trim();
    const licenseChanged = editForm.licenseNumber.trim() !== (user?.licenseNumber || '').trim() && editForm.licenseNumber.trim() !== '';

    // Phone changed but not verified yet → trigger OTP
    if (phoneChanged && phoneStep !== 'verified') {
      await handleSendPhoneOTP();
      return;
    }

    try {
      const updates: any = {
        displayName: editForm.displayName,
        bio: editForm.bio,
        location: { province: editForm.province.trim(), district: (user as any)?.location?.district || '' },
        preferredProvince: editForm.province.trim(),
      };

      if (user?.role === 'nurse') {
        updates.staffType = editForm.staffType || null;
        updates.staffTypes = editForm.staffType ? [editForm.staffType] : [];
        updates.experience = parseInt(editForm.experience) || 0;
        updates.workStyle = editForm.workStyle;
        updates.orgType = null;
        updates.interestedStaffTypes = [];
        updates.careNeeds = [];
        updates.careTypes = [];
        updates.hiringUrgency = null;
      } else if (user?.role === 'hospital') {
        updates.staffType = null;
        updates.staffTypes = [];
        updates.orgType = editForm.orgType || null;
        updates.interestedStaffTypes = editForm.interestedStaffTypes;
        updates.hiringUrgency = editForm.hiringUrgency || null;
        updates.workStyle = [];
        updates.careNeeds = [];
        updates.careTypes = [];
      } else {
        updates.staffType = null;
        updates.staffTypes = [];
        updates.orgType = null;
        updates.interestedStaffTypes = editForm.interestedStaffTypes;
        updates.careNeeds = editForm.careNeeds;
        updates.careTypes = editForm.careNeeds;
        updates.workStyle = [];
        updates.hiringUrgency = null;
      }

      // Only update phone if verified (or unchanged)
      if (!phoneChanged || phoneStep === 'verified') {
        updates.phone = editForm.phone;
      }

      // License: save as pending for review, not directly active
      if (licenseChanged) {
        updates.pendingLicenseNumber = editForm.licenseNumber.trim();
        updates.licenseVerificationStatus = 'pending';
      }

      await updateUser(updates);
      await trackEvent({
        eventName: 'profile_updated',
        screenName: 'Profile',
        subjectType: 'user_profile',
        subjectId: user?.uid,
        province: updates.preferredProvince,
        props: {
          role: user?.role || null,
          phoneChanged,
          licenseChanged,
          hasBio: Boolean(editForm.bio.trim()),
          hasProvince: Boolean(editForm.province.trim()),
        },
      });
      setShowEditModal(false);
      setPhoneStep('idle');

      if (licenseChanged) {
        setModalTitle('บันทึกสำเร็จ');
        setModalMessage('ข้อมูลถูกบันทึกแล้ว\n\nเลขใบประกอบวิชาชีพที่กรอกใหม่จะรอการตรวจสอบจากผู้ดูแลระบบก่อนแสดงบนโปรไฟล์');
        setShowSuccessModal(true);
      } else {
        setModalTitle('สำเร็จ');
        setModalMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      setModalTitle('เกิดข้อผิดพลาด');
      setModalMessage(error.message || 'ไม่สามารถบันทึกข้อมูลได้');
      setShowErrorModal(true);
    }
  };

  // Legacy OTP confirm (kept for backward compat)
  const handleConfirmOTP = handleVerifyOTP;

  const workStyleLabels = getThaiLabels((user as any)?.workStyle || [], getWorkStyleThaiLabel);
  const interestedStaffTypeLabels = getThaiLabels((user as any)?.interestedStaffTypes || [], getStaffTypeThaiLabel);
  const careNeedLabels = getThaiLabels((user as any)?.careNeeds || (user as any)?.careTypes || [], getCareTypeThaiLabel);
  const profileProvince = (user as any)?.location?.province || (user as any)?.preferredProvince || 'ยังไม่ระบุ';
  const roleLabel = getRoleLabel(user?.role, (user as any)?.orgType, (user as any)?.staffType);
  const planLabel = hasPremiumTag(userPlan) ? getPremiumTagText(userPlan) : 'สมาชิกทั่วไป';
  const primaryShortcuts: ProfileShortcut[] = [
    {
      key: 'myposts',
      label: 'งานของฉัน',
      icon: 'briefcase-outline' as const,
      badge: canManageApplicants && applicantsInterestedCount > 0 ? String(applicantsInterestedCount > 9 ? '9+' : applicantsInterestedCount) : undefined,
      onPress: () => nav.navigate('MyPosts'),
    },
    {
      key: 'notifications',
      label: 'แจ้งเตือน',
      icon: 'notifications-outline' as const,
      badge: unreadNotifications > 0 ? String(unreadNotifications > 9 ? '9+' : unreadNotifications) : undefined,
      onPress: () => nav.navigate('Notifications'),
    },
    {
      key: 'reviews',
      label: 'รีวิว',
      icon: 'star-outline' as const,
      badge: reviewSummary?.totalReviews ? String(reviewSummary.totalReviews) : undefined,
      onPress: () => nav.navigate('Reviews', { targetUserId: user?.uid, targetName: user?.displayName, targetRole: user?.role }),
    },
    {
      key: 'documents',
      label: 'เอกสาร',
      icon: 'document-text-outline' as const,
      onPress: () => nav.navigate('Documents'),
    },
    {
      key: 'favorites',
      label: 'รายการโปรด',
      icon: 'heart-outline' as const,
      badge: favoritesCount > 0 ? String(favoritesCount) : undefined,
      onPress: () => nav.navigate('Favorites'),
    },
    {
      key: 'verification',
      label: 'ยืนยันตัวตน',
      icon: 'shield-checkmark-outline' as const,
      badge: verificationStatus?.pendingRequest ? 'รอ' : verificationStatus?.isVerified ? 'ผ่าน' : undefined,
      onPress: () => nav.navigate('Verification'),
    },
    {
      key: 'shop',
      label: 'สิทธิ์และบริการ',
      icon: 'sparkles-outline' as const,
      onPress: () => nav.navigate('Shop'),
    },
    {
      key: canManageApplicants ? 'applicants' : 'help',
      label: canManageApplicants ? 'ผู้สมัคร' : 'ช่วยเหลือ',
      icon: canManageApplicants ? 'people-outline' : 'help-circle-outline',
      onPress: () => (canManageApplicants ? nav.navigate('Applicants') : nav.navigate('Help')),
    },
  ];
  const profileInfoTiles: ProfileInfoTile[] = [
    {
      key: 'phone',
      label: 'เบอร์โทรศัพท์',
      value: user?.phone || 'ยังไม่ระบุ',
      icon: 'call-outline',
    },
    ...(user?.role === 'nurse'
      ? [
          {
            key: 'staffType',
            label: 'วิชาชีพหลัก',
            value: getStaffTypeThaiLabel((user as any)?.staffType),
            icon: 'medkit-outline' as const,
          },
          {
            key: 'licenseNumber',
            label: 'เลขใบประกอบวิชาชีพ',
            value: user?.licenseNumber || 'ยังไม่ระบุ',
            icon: 'ribbon-outline' as const,
          },
          {
            key: 'experience',
            label: 'ประสบการณ์',
            value: user?.experience ? `${user.experience} ปี` : 'ยังไม่ระบุ',
            icon: 'briefcase-outline' as const,
          },
          {
            key: 'workStyle',
            label: 'รูปแบบงานที่สนใจ',
            value: workStyleLabels.length > 0 ? workStyleLabels.join(', ') : 'ยังไม่ระบุ',
            icon: 'options-outline' as const,
            fullWidth: true,
          },
        ]
      : user?.role === 'hospital'
        ? [
            {
              key: 'orgType',
              label: 'ประเภทองค์กร',
              value: getOrgTypeThaiLabel((user as any)?.orgType),
              icon: 'business-outline' as const,
            },
            {
              key: 'staffInterest',
              label: 'บุคลากรที่กำลังมองหา',
              value: interestedStaffTypeLabels.length > 0 ? interestedStaffTypeLabels.join(', ') : 'ยังไม่ระบุ',
              icon: 'people-outline' as const,
              fullWidth: true,
            },
            {
              key: 'urgency',
              label: 'ความเร่งด่วน',
              value: getHiringUrgencyThaiLabel((user as any)?.hiringUrgency),
              icon: 'flash-outline' as const,
            },
          ]
        : [
            {
              key: 'staffInterest',
              label: 'บุคลากรที่ต้องการติดต่อ',
              value: interestedStaffTypeLabels.length > 0 ? interestedStaffTypeLabels.join(', ') : 'ยังไม่ระบุ',
              icon: 'people-outline' as const,
              fullWidth: true,
            },
            {
              key: 'careNeeds',
              label: 'ลักษณะการดูแลที่ต้องการ',
              value: careNeedLabels.length > 0 ? careNeedLabels.join(', ') : 'ยังไม่ระบุ',
              icon: 'heart-outline' as const,
              fullWidth: true,
            },
          ]),
    {
      key: 'province',
      label: 'จังหวัด',
      value: profileProvince,
      icon: 'location-outline',
    },
  ];
  const menuSections: ProfileMenuSection[] = [
    {
      key: 'account',
      title: 'บัญชีและการใช้งาน',
      items: [
        {
          key: 'edit-profile',
          label: 'แก้ไขโปรไฟล์',
          subtitle: 'อัปเดตรูป เบอร์โทร และข้อมูลวิชาชีพ',
          icon: 'create-outline' as const,
          onPress: () => setShowEditModal(true),
        },
        {
          key: 'settings',
          label: 'ตั้งค่า',
          subtitle: 'การแจ้งเตือน ความเป็นส่วนตัว และธีม',
          icon: 'settings-outline' as const,
          onPress: () => nav.navigate('Settings'),
        },
        {
          key: 'campaign',
          label: 'โค้ดส่วนลด / แคมเปญ',
          subtitle: pendingCampaignCode ? 'มีโค้ดรอใช้งานอยู่' : 'บันทึกโค้ดไว้ใช้ภายหลังได้',
          icon: 'ticket-outline' as const,
          badge: pendingCampaignCode ? 'รอใช้' : undefined,
          onPress: () => setShowCampaignCodeModal(true),
        },
        ...(isAdmin
          ? [
              {
                key: 'admin',
                label: 'แผงควบคุม Admin',
                subtitle: 'ดูภาพรวมระบบและจัดการการสื่อสาร',
                icon: 'shield-outline' as const,
                onPress: () => nav.navigate('AdminDashboard'),
              },
            ]
          : []),
      ],
    },
    {
      key: 'support',
      title: 'ศูนย์ช่วยเหลือ',
      items: [
        {
          key: 'quick-guide',
          label: 'คู่มือใช้งานแบบเร็ว',
          subtitle: 'ดู flow สำคัญของแอปแบบย่อ',
          icon: 'sparkles-outline' as const,
          onPress: onboardingSurveyEnabled ? () => nav.navigate('OnboardingSurvey') : () => nav.navigate('Help'),
        },
        {
          key: 'help',
          label: 'ช่วยเหลือและคำถามที่พบบ่อย',
          subtitle: 'รวมคำตอบและวิธีใช้งานพื้นฐาน',
          icon: 'help-circle-outline' as const,
          onPress: () => nav.navigate('Help'),
        },
      ],
    },
    {
      key: 'legal',
      title: 'เงื่อนไขและนโยบาย',
      items: [
        {
          key: 'terms',
          label: 'เงื่อนไขการใช้งาน',
          icon: 'document-text-outline' as const,
          onPress: () => nav.navigate('Terms'),
        },
        {
          key: 'privacy',
          label: 'นโยบายความเป็นส่วนตัว',
          icon: 'shield-checkmark-outline' as const,
          onPress: () => nav.navigate('Privacy'),
        },
      ],
    },
  ];

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge text="รอพิจารณา" variant="warning" size="small" />;
      case 'reviewed':
        return <Badge text="กำลังพิจารณา" variant="info" size="small" />;
      case 'accepted':
        return <Badge text="ผ่านการคัดเลือก" variant="success" size="small" />;
      case 'rejected':
        return <Badge text="ไม่ผ่าน" variant="danger" size="small" />;
      case 'withdrawn':
        return <Badge text="ถอนใบสมัคร" variant="secondary" size="small" />;
      default:
        return <Badge text={status} variant="secondary" size="small" />;
    }
  };

  // Guest view
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.guestContainer}>
          <Ionicons name="person-circle-outline" size={80} color={colors.border} />
          <Text style={[styles.guestTitle, { color: colors.text }]}>ยังไม่ได้เข้าสู่ระบบ</Text>
          <Text style={[styles.guestDescription, { color: colors.textSecondary }]}>
            เข้าสู่ระบบเพื่อจัดการโปรไฟล์และดูประวัติการสมัครงาน
          </Text>
          <Button
            onPress={() => (navigation as any).navigate('Auth')}
            size="large"
            style={{ marginTop: SPACING.lg }}
          >
            <Text>เข้าสู่ระบบ</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar
        barStyle={profileStatusBarStyle}
        backgroundColor={headerBackground}
        translucent={false}
      />
      <ScrollView
        ref={profileScrollRef}
        style={{ backgroundColor: colors.background }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {user?.uid && user.onboardingCompleted && (
          <FirstVisitTip
            storageKey={`first_tip_profile_${user.uid}`}
            icon="person-circle-outline"
            title="โปรไฟล์ที่ครบช่วยให้ตัดสินใจง่ายขึ้น"
            description="หน้านี้ใช้จัดการข้อมูลส่วนตัว รีวิว การยืนยันตัวตน รายการโปรด และประกาศของคุณ ถ้าอยากใช้งานได้คุ้มสุด ให้เริ่มจากเติมโปรไฟล์และเช็กสถานะการยืนยันตัวตน"
            actionLabel={onboardingSurveyEnabled ? 'ดูคู่มือ' : undefined}
            onAction={onboardingSurveyEnabled ? () => nav.navigate('OnboardingSurvey') : undefined}
            containerStyle={{ marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 2 }}
          />
        )}

        <View style={[styles.profileDashboardHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
          <TouchableOpacity onPress={handleChangePhoto} disabled={isUploadingPhoto} style={styles.profileDashboardAvatarWrap}>
            <Avatar uri={user?.photoURL} name={user?.displayName || 'User'} size={42} />
            <View style={[styles.profileDashboardEditDot, { backgroundColor: colors.primary }]}>
              <Ionicons name={isUploadingPhoto ? 'cloud-upload-outline' : 'camera-outline'} size={12} color={colors.white} />
            </View>
          </TouchableOpacity>
          <View style={styles.profileDashboardTitleWrap}>
            <Text style={[styles.profileDashboardTitle, { color: colors.text }]} numberOfLines={1}>{user?.displayName}</Text>
            <Text style={[styles.profileDashboardSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>{roleLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={() => nav.navigate('Settings')}
            style={[styles.profileDashboardSettingsBtn, { backgroundColor: colors.primaryBackground }]}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileDashboardContent}>
          <View style={[styles.profileHeroCardModern, { backgroundColor: colors.primary }]}> 
            <View style={styles.profileHeroBackdropCircle} />
            <View style={[styles.profileHeroBackdropCircle, styles.profileHeroBackdropCircleSecondary]} />
            <View style={styles.profileHeroEyebrowRow}>
              <View style={[styles.profileHeroEyebrowChip, { backgroundColor: 'rgba(255,255,255,0.15)' }]}> 
                <Text style={styles.profileHeroEyebrowText}>ศูนย์บัญชีของคุณ</Text>
              </View>
              <View style={[styles.profileHeroEyebrowChip, { backgroundColor: 'rgba(255,255,255,0.12)' }]}> 
                <Ionicons name="location-outline" size={12} color={colors.white} />
                <Text style={styles.profileHeroEyebrowText}>{profileProvince}</Text>
              </View>
            </View>
            <View style={styles.profileHeroTopRow}>
              <TouchableOpacity onPress={handleChangePhoto} disabled={isUploadingPhoto} style={styles.profileHeroAvatarButton}>
                <Avatar uri={user?.photoURL} name={user?.displayName || 'User'} size={72} />
                <View style={[styles.profileHeroCameraBadge, { backgroundColor: colors.white }]}> 
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                </View>
              </TouchableOpacity>
              <View style={styles.profileHeroMainInfo}>
                <View style={styles.profileHeroNameRow}>
                  <Text style={styles.profileHeroName} numberOfLines={1}>{user?.displayName}</Text>
                  {user?.isVerified ? <Ionicons name="shield-checkmark" size={18} color={colors.white} /> : null}
                </View>
                <Text style={styles.profileHeroMeta} numberOfLines={1}>{user?.email || roleLabel}</Text>
                <View style={styles.profileHeroBadgeRow}>
                  <View style={[styles.profileHeroBadge, { backgroundColor: 'rgba(255,255,255,0.18)' }]}> 
                    <Ionicons name={getRoleIconName(user?.role)} size={13} color={colors.white} />
                    <Text style={styles.profileHeroBadgeText}>{roleLabel}</Text>
                  </View>
                  <View style={[styles.profileHeroBadge, { backgroundColor: 'rgba(255,255,255,0.14)' }]}> 
                    <Text style={styles.profileHeroBadgeText}>{planLabel}</Text>
                  </View>
                </View>
                <Text style={styles.profileHeroDescription}>จัดการข้อมูลส่วนตัว สิทธิ์การใช้งาน และประวัติการติดต่อไว้ในที่เดียว</Text>
              </View>
            </View>

            <View style={[styles.profileHeroAccessCard, { backgroundColor: colors.white, borderColor: colors.primaryBackground }]}> 
              <View style={styles.profileHeroAccessHeader}>
                <View>
                  <Text style={[styles.profileHeroAccessLabel, { color: colors.textSecondary }]}>สถานะบัญชี</Text>
                  <Text style={[styles.profileHeroAccessValue, { color: colors.text }]}>{planLabel}</Text>
                </View>
                <TouchableOpacity onPress={() => nav.navigate('Shop')} style={styles.profileHeroAccessLink}>
                  <Text style={[styles.profileHeroAccessLinkText, { color: colors.primary }]}>{getCommerceEntryTitle(commerceStatus)}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <View style={styles.profileHeroStatsRow}>
                <View style={styles.profileHeroStatItem}>
                  <Text style={[styles.profileHeroStatValue, { color: colors.text }]}>{favoritesCount}</Text>
                  <Text style={[styles.profileHeroStatLabel, { color: colors.textSecondary }]}>รายการโปรด</Text>
                </View>
                <View style={[styles.profileHeroStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.profileHeroStatItem}>
                  <Text style={[styles.profileHeroStatValue, { color: colors.text }]}>{contacts.length}</Text>
                  <Text style={[styles.profileHeroStatLabel, { color: colors.textSecondary }]}>ประวัติติดต่อ</Text>
                </View>
                <View style={[styles.profileHeroStatDivider, { backgroundColor: colors.border }]} />
                <View style={styles.profileHeroStatItem}>
                  <Text style={[styles.profileHeroStatValue, { color: colors.text }]}>{reviewSummary?.totalReviews || 0}</Text>
                  <Text style={[styles.profileHeroStatLabel, { color: colors.textSecondary }]}>รีวิว</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.profileHeroPrimaryButton, { backgroundColor: colors.primaryBackground }]}
                onPress={() => setShowEditModal(true)}
              >
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={[styles.profileHeroPrimaryButtonText, { color: colors.primary }]}>แก้ไขโปรไฟล์</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ProfileProgressBar user={user as any} onPress={() => setShowEditModal(true)} />

          {commerceStatus?.freeAccessEnabled && (
            <View style={[styles.earlyAccessCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}> 
              <View style={styles.earlyAccessCardHeader}>
                <View style={[styles.earlyAccessCardIcon, { backgroundColor: colors.warning }]}> 
                  <Ionicons name="rocket-outline" size={18} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.earlyAccessCardTitle, { color: colors.text }]}>{launchQuotaSummary?.title || 'บัญชีนี้ทำอะไรได้บ้าง'}</Text>
                  <Text style={[styles.earlyAccessCardSubtitle, { color: colors.textSecondary }]}>{launchQuotaSummary?.subtitle || 'บัญชีนี้ใช้ฟีเจอร์หลักและบริการเสริมได้ตามโควตารายเดือน'}</Text>
                </View>
                <View style={[styles.earlyAccessCardBadge, { backgroundColor: colors.accent }]}> 
                  <Text style={[styles.earlyAccessCardBadgeText, { color: colors.textInverse }]}>พร้อมใช้</Text>
                </View>
              </View>
              {launchQuotaSummary?.items?.slice(0, 3).map((item) => (
                <View key={item.feature} style={styles.earlyAccessQuotaRow}>
                  <Text style={[styles.earlyAccessQuotaLabel, { color: colors.text }]}>{item.label}</Text>
                  <Text style={[styles.earlyAccessQuotaStatus, { color: colors.textSecondary }]}>{item.statusText}</Text>
                </View>
              ))}
              <Text style={[styles.earlyAccessCardFootnote, { color: colors.textSecondary }]}>{launchQuotaSummary?.footnote || 'ดูรายละเอียดทั้งหมดได้ที่หน้า สิทธิ์และบริการในบัญชี'}</Text>
            </View>
          )}

          <View style={[styles.profileShortcutCard, { backgroundColor: elevatedSurface }]}> 
            <View style={styles.profileShortcutHeader}>
              <Text style={[styles.profileShortcutTitle, { color: colors.text }]}>ทางลัดที่ใช้บ่อย</Text>
              <Text style={[styles.profileShortcutSubtitle, { color: colors.textSecondary }]}>เข้าถึงงาน เอกสาร และการแจ้งเตือนจากบล็อกเดียว</Text>
            </View>
            <View style={styles.profileShortcutGrid}>
              {primaryShortcuts.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={0.84}
                  style={styles.profileShortcutItem}
                  onPress={item.onPress}
                >
                  <View style={[styles.profileShortcutIconWrap, { backgroundColor: colors.primaryBackground }]}> 
                    <Ionicons name={item.icon} size={22} color={colors.primary} />
                    {item.badge ? (
                      <View style={[styles.profileShortcutBadge, { backgroundColor: colors.danger }]}> 
                        <Text style={styles.profileShortcutBadgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.profileShortcutText,
                      item.key === 'myposts' && styles.profileShortcutTextCompact,
                      { color: colors.text },
                    ]}
                    numberOfLines={item.key === 'myposts' ? 1 : 2}
                    allowFontScaling={false}
                  >
                    {item.key === 'myposts' ? 'งานของฉัน' : item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Profile Info Modern */}
        <Card style={styles.profileDetailCard}>
          <View style={styles.profileSectionHeaderBlock}>
            <Text style={[styles.profileSectionEyebrow, { color: colors.primary }]}>Profile details</Text>
            <Text style={[styles.sectionTitle, styles.profileSectionTitleCompact]}>ข้อมูลส่วนตัว</Text>
            <Text style={[styles.profileSectionSubtitle, { color: colors.textSecondary }]}>สรุปข้อมูลสำคัญของบัญชีในมุมมองที่อ่านง่ายขึ้น</Text>
          </View>
          <View style={styles.profileInfoGrid}>
            {profileInfoTiles.map((item) => (
              <View
                key={item.key}
                style={[
                  styles.profileInfoTile,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight },
                ]}
              >
                <View style={[styles.profileInfoTileIconWrap, { backgroundColor: colors.primaryBackground }]}> 
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.profileInfoTileContent}>
                  <Text style={[styles.profileInfoTileLabel, { color: colors.textSecondary }]}>{item.label}</Text>
                  <Text style={[styles.profileInfoTileValue, { color: colors.text }]}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
          {user?.bio ? (
            <View style={[styles.profileBioPanel, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}> 
              <View style={[styles.profileInfoTileIconWrap, styles.profileBioIconWrap, { backgroundColor: colors.primaryBackground }]}> 
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.profileBioContent}>
                <Text style={[styles.profileInfoTileLabel, { color: colors.textSecondary }]}>เกี่ยวกับฉัน</Text>
                <Text style={[styles.profileBioText, { color: colors.text }]}>{user.bio}</Text>
              </View>
            </View>
          ) : null}
        </Card>

        {/* Shift Contact History */}
        <View style={[styles.profileActivityCard, { backgroundColor: elevatedSurface, borderColor: colors.borderLight }]}> 
          <View style={styles.profileActivityHeader}>
            <View style={styles.profileActivityTitleWrap}>
              <Text style={[styles.profileSectionEyebrow, { color: colors.primary }]}>Recent activity</Text>
              <View style={styles.profileActivityTitleRow}>
                <Text style={[styles.sectionTitle, styles.profileSectionTitleCompact, { marginBottom: 0 }]}>ประวัติการติดต่องาน</Text>
                {contacts.length > 0 && (
                  <View style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ color: colors.white, fontSize: 11, fontWeight: '700' }}>{contacts.length}</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={[styles.profileActivityMeta, { color: colors.primary }]}>
              ล่าสุด {contacts.length > 0 ? formatRelativeTime(contacts[0]?.contactedAt) : '-'}
            </Text>
          </View>

          {isLoading ? (
            <Loading text="กำลังโหลด..." />
          ) : contacts.length === 0 ? (
            <View style={[styles.profileEmptyState, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderLight }]}> 
              <Ionicons name="document-text-outline" size={36} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>ยังไม่มีประวัติการติดต่อ</Text>
            </View>
          ) : (
            <>
              {(showAllContacts ? contacts : contacts.slice(0, 5)).map((contact) => {
                const statusConfig = getContactStatusConfig(contact.status);
                const isDeleting = deletingContactId === contact.id;
                return (
                  <TouchableOpacity
                    key={contact.id}
                    activeOpacity={0.85}
                    onLongPress={() => handleDeleteContact(contact.id, contact.job?.title || 'งานนี้')}
                    onPress={() => {
                      if (contact.status === 'expired' || !contact.job) return;
                      const job = contact.job;
                      const serializedJob = {
                        ...job,
                        shiftDate: job.shiftDate
                          ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate)
                          : undefined,
                      } as any;
                      (navigation as any).navigate('JobDetail', { job: serializedJob, source: 'profile_activity' });
                    }}
                    style={[
                      styles.profileActivityRow,
                      {
                        backgroundColor: colors.backgroundSecondary,
                        borderColor: contact.status === 'expired' ? colors.border : statusConfig.bg,
                        opacity: isDeleting ? 0.5 : contact.status === 'expired' ? 0.65 : 1,
                      },
                    ]}
                  >
                    {/* Status icon */}
                    <View style={[styles.profileActivityStatusIcon, { backgroundColor: statusConfig.bg }]}>
                      <Ionicons name={statusConfig.icon} size={22} color={statusConfig.color} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.text, fontSize: 14, marginBottom: 2 }}>
                        {contact.job?.title || 'เวร (ถูกลบแล้ว)'}
                      </Text>
                      <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
                        {contact.status === 'expired' ? 'โพสต์นี้ถูกลบไปแล้ว' : (contact.job?.posterName || 'ผู้โพสต์')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                        {formatRelativeTime(contact.contactedAt)}
                      </Text>
                    </View>

                    {/* Status badge */}
                    <View style={styles.profileActivityStatusWrap}>
                      <View style={{ backgroundColor: statusConfig.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: statusConfig.color, fontSize: 11, fontWeight: '700' }}>{statusConfig.label}</Text>
                      </View>
                      <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Show more / less */}
              {contacts.length > 5 && (
                <TouchableOpacity
                  onPress={() => setShowAllContacts(!showAllContacts)}
                  style={styles.profileActivityToggle}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                    {showAllContacts ? 'แสดงน้อยลง' : `ดูทั้งหมด (${contacts.length})`}
                  </Text>
                  <Ionicons
                    name={showAllContacts ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}

              {/* Hint */}
              <Text style={[styles.profileActivityHint, { color: colors.textMuted }]}>
                กดค้างเพื่อลบออกจากประวัติ
              </Text>
            </>
          )}
        </View>

        {menuSections.map((section) => (
          <View key={section.key} style={[styles.profileMenuSectionCard, { backgroundColor: elevatedSurface }]}> 
            <Text style={[styles.profileMenuSectionTitle, { color: colors.text }]}>{section.title}</Text>
            {section.items.map((item: any, index: number) => (
              <TouchableOpacity
                key={item.key}
                activeOpacity={0.82}
                style={[
                  styles.profileMenuRow,
                  index !== section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
                ]}
                onPress={item.onPress}
              >
                <View style={[styles.profileMenuIconWrap, { backgroundColor: colors.primaryBackground }]}> 
                  <Ionicons name={item.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.profileMenuTextWrap}>
                  <Text style={[styles.profileMenuLabel, { color: colors.text }]}>{item.label}</Text>
                  {item.subtitle ? <Text style={[styles.profileMenuSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>{item.subtitle}</Text> : null}
                </View>
                {item.badge ? (
                  <View style={[styles.profileMenuBadge, { backgroundColor: colors.accent }]}> 
                    <Text style={[styles.profileMenuBadgeText, { color: colors.textInverse }]}>{item.badge}</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        ))}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleLogout}
          style={[styles.profileLogoutButtonWide, { backgroundColor: elevatedSurface, borderColor: colors.border }]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={[styles.profileLogoutButtonText, { color: colors.error }]}>ออกจากระบบ</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>

      {/* ─── Edit Profile Modal ─── */}
      <ModalContainer
        visible={showEditModal}
        onClose={() => { setShowEditModal(false); setPhoneStep('idle'); }}
        title="แก้ไขโปรไฟล์"
        fullScreen={true}
      >
        <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false}>

          {/* ── SECTION: ข้อมูลส่วนตัว ── */}
          <View style={profileEditStyles.section}>
            <View style={profileEditStyles.sectionHeader}>
              <View style={[profileEditStyles.sectionDot, { backgroundColor: colors.primary }]} />
              <Text style={[profileEditStyles.sectionTitle, { color: colors.text }]}>ข้อมูลส่วนตัว</Text>
            </View>

            {/* ชื่อ-นามสกุล */}
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>ชื่อ-นามสกุล</Text>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text }]}
                  value={editForm.displayName}
                  onChangeText={(t) => setEditForm({ ...editForm, displayName: t })}
                  placeholder="ชื่อจริง นามสกุล"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* เบอร์โทรศัพท์ */}
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: phoneStep === 'verify' ? colors.warning : phoneStep === 'verified' ? colors.success : editForm.phone !== (user?.phone || '') ? colors.warning : colors.border }]}>
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons
                  name={phoneStep === 'verified' ? 'checkmark-circle' : 'call-outline'}
                  size={18}
                  color={phoneStep === 'verified' ? colors.success : phoneStep === 'verify' ? colors.warning : colors.primary}
                />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>เบอร์โทรศัพท์</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[profileEditStyles.fieldInput, { color: colors.text, flex: 1 }]}
                    value={editForm.phone}
                    onChangeText={(t) => {
                      setEditForm({ ...editForm, phone: t });
                      if (phoneStep !== 'idle') { setPhoneStep('idle'); setOtpValue(''); setOtpError(''); }
                    }}
                    placeholder="0xx-xxx-xxxx"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    editable={phoneStep !== 'verify'}
                  />
                  {phoneStep === 'verified' && (
                    <View style={[profileEditStyles.verifiedBadge, { backgroundColor: colors.success + '20' }]}>
                      <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>ยืนยันแล้ว ✓</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>จังหวัด</Text>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text }]}
                  value={editForm.province}
                  onChangeText={(t) => setEditForm({ ...editForm, province: t })}
                  placeholder="เช่น กรุงเทพมหานคร"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* Phone changed warning */}
            {editForm.phone.trim() !== (user?.phone || '').trim() && editForm.phone.trim() !== '' && phoneStep === 'idle' && (
              <View style={[profileEditStyles.infoBanner, { backgroundColor: warningTone.background, borderColor: warningTone.border }]}> 
                <Ionicons name="warning-outline" size={16} color={warningTone.text} style={{ marginRight: 8 }} />
                <Text style={{ color: warningTone.text, fontSize: 13, flex: 1 }}>
                  การเปลี่ยนเบอร์โทรศัพท์ต้องยืนยัน OTP ก่อนที่จะบันทึก
                </Text>
              </View>
            )}

            {/* OTP Inline Step */}
            {(phoneStep === 'verify' || phoneStep === 'sending') && (
              <View style={[profileEditStyles.otpBox, { backgroundColor: colors.background, borderColor: colors.warning }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.warning} />
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>ยืนยัน OTP</Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14 }}>
                  กรอกรหัส 6 หลัก ที่ส่งไปยัง {'\n'}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{editForm.phone}</Text>
                </Text>

                {/* OTP digit input */}
                <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: otpError ? colors.danger : colors.border }]}>
                  <View style={profileEditStyles.fieldIcon}>
                    <Ionicons name="keypad-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={profileEditStyles.fieldContent}>
                    <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>รหัส OTP</Text>
                    <TextInput
                      style={[profileEditStyles.fieldInput, { color: colors.text, letterSpacing: 8, fontSize: 20, fontWeight: '700' }]}
                      value={otpValue}
                      onChangeText={setOtpValue}
                      placeholder="------"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                </View>

                {otpError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13, marginLeft: 6 }}>{otpError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleVerifyOTP}
                  disabled={otpLoading || !otpValue}
                  style={[profileEditStyles.otpConfirmBtn, { backgroundColor: otpLoading || !otpValue ? colors.border : colors.primary }]}
                >
                  {otpLoading
                    ? <Text style={{ color: colors.white, fontWeight: '700' }}>กำลังยืนยัน…</Text>
                    : <Text style={{ color: colors.white, fontWeight: '700' }}>ยืนยันรหัส OTP</Text>
                  }
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                  {otpResendCountdown > 0
                    ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>ขอรหัสใหม่ได้อีกใน {otpResendCountdown} วินาที</Text>
                    : (
                      <TouchableOpacity onPress={handleSendPhoneOTP} disabled={phoneStep === 'sending'}>
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                          {phoneStep === 'sending' ? 'กำลังส่ง…' : '📨 ส่งรหัสใหม่'}
                        </Text>
                      </TouchableOpacity>
                    )
                  }
                </View>
              </View>
            )}
          </View>

          {/* ── SECTION: Role-specific ── */}
          <View style={profileEditStyles.section}>
            <View style={profileEditStyles.sectionHeader}>
              <View style={[profileEditStyles.sectionDot, { backgroundColor: colors.accent }]} />
              <Text style={[profileEditStyles.sectionTitle, { color: colors.text }]}>
                {user?.role === 'nurse' ? 'ข้อมูลวิชาชีพ' : user?.role === 'hospital' ? 'ข้อมูลองค์กร' : 'ข้อมูลการใช้งาน'}
              </Text>
            </View>

            {user?.role === 'nurse' ? (
              <>
                <View style={{ marginBottom: 12 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>วิชาชีพหลัก</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STAFF_TYPES.map((staff) => (
                      <Chip
                        key={staff.code}
                        label={staff.shortName}
                        selected={editForm.staffType === staff.code}
                        onPress={() => setEditForm((prev) => ({ ...prev, staffType: prev.staffType === staff.code ? '' : staff.code }))}
                      />
                    ))}
                  </View>
                </View>

                <View style={[profileEditStyles.fieldBox, {
                  backgroundColor: colors.surface,
                  borderColor: editForm.licenseNumber !== (user?.licenseNumber || '') && editForm.licenseNumber !== '' ? colors.accent : colors.border,
                }]}>
                  <View style={profileEditStyles.fieldIcon}>
                    <Ionicons name="ribbon-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={profileEditStyles.fieldContent}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>เลขใบประกอบวิชาชีพ</Text>
                      {(user as any)?.licenseVerificationStatus === 'pending' && (
                        <View style={{ backgroundColor: warningTone.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: warningTone.text, fontSize: 10, fontWeight: '700' }}>⏳ รอตรวจสอบ</Text>
                        </View>
                      )}
                      {(user as any)?.licenseVerificationStatus === 'approved' && (
                        <View style={{ backgroundColor: successTone.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: successTone.text, fontSize: 10, fontWeight: '700' }}>✓ ยืนยันแล้ว</Text>
                        </View>
                      )}
                      {(user as any)?.licenseVerificationStatus === 'rejected' && (
                        <View style={{ backgroundColor: colors.errorLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                          <Text style={{ color: colors.error, fontSize: 10, fontWeight: '700' }}>✗ ไม่ผ่าน</Text>
                        </View>
                      )}
                    </View>
                    <TextInput
                      style={[profileEditStyles.fieldInput, { color: colors.text }]}
                      value={editForm.licenseNumber}
                      onChangeText={(t) => setEditForm({ ...editForm, licenseNumber: t })}
                      placeholder="เลขที่ใบอนุญาต เช่น ผ.12345"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                    />
                  </View>
                </View>

                {(user as any)?.pendingLicenseNumber && (user as any)?.licenseVerificationStatus === 'pending' && (
                  <View style={[profileEditStyles.infoBanner, { backgroundColor: warningTone.background, borderColor: warningTone.border }]}> 
                    <Ionicons name="time-outline" size={16} color={warningTone.text} style={{ marginRight: 8 }} />
                    <Text style={{ color: warningTone.text, fontSize: 12, flex: 1 }}>
                      เลขที่รอตรวจสอบ: <Text style={{ fontWeight: '700' }}>{(user as any).pendingLicenseNumber}</Text>
                      {'\n'}จะแสดงบนโปรไฟล์หลังจากได้รับการอนุมัติ
                    </Text>
                  </View>
                )}

                {editForm.licenseNumber.trim() !== (user?.licenseNumber || '').trim() && editForm.licenseNumber.trim() !== '' && (
                  <View style={[profileEditStyles.infoBanner, { backgroundColor: accentTone.background, borderColor: accentTone.border }]}> 
                    <Ionicons name="information-circle-outline" size={16} color={accentTone.text} style={{ marginRight: 8 }} />
                    <Text style={{ color: accentTone.text, fontSize: 12, flex: 1 }}>
                      เลขใบประกอบวิชาชีพใหม่จะถูกส่งเพื่อรอการตรวจสอบจากผู้ดูแลระบบก่อนแสดงบนโปรไฟล์
                    </Text>
                  </View>
                )}

                <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
                  <View style={profileEditStyles.fieldIcon}>
                    <Ionicons name="briefcase-outline" size={18} color={colors.success} />
                  </View>
                  <View style={profileEditStyles.fieldContent}>
                    <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>ประสบการณ์ทำงาน (ปี)</Text>
                    <TextInput
                      style={[profileEditStyles.fieldInput, { color: colors.text }]}
                      value={editForm.experience}
                      onChangeText={(t) => setEditForm({ ...editForm, experience: t.replace(/[^0-9]/g, '') })}
                      placeholder="0"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={{ marginBottom: 4 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>รูปแบบงานที่สนใจ</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {NURSE_WORK_STYLE_OPTIONS.map((option) => (
                      <Chip
                        key={option.key}
                        label={option.label}
                        selected={editForm.workStyle.includes(option.key)}
                        onPress={() => toggleEditArrayValue('workStyle', option.key)}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : user?.role === 'hospital' ? (
              <>
                <View style={{ marginBottom: 12 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>ประเภทองค์กร</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {ORG_TYPE_OPTIONS.map((option) => (
                      <Chip
                        key={option.code}
                        label={option.label}
                        selected={editForm.orgType === option.code}
                        onPress={() => setEditForm((prev) => ({ ...prev, orgType: prev.orgType === option.code ? '' : option.code }))}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>บุคลากรที่กำลังมองหา</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STAFF_TYPES.map((staff) => (
                      <Chip
                        key={staff.code}
                        label={staff.shortName}
                        selected={editForm.interestedStaffTypes.includes(staff.code)}
                        onPress={() => toggleEditArrayValue('interestedStaffTypes', staff.code)}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ marginBottom: 4 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>ความเร่งด่วนในการรับสมัคร</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {HOSPITAL_URGENCY_OPTIONS.map((option) => (
                      <Chip
                        key={option.key}
                        label={option.label}
                        selected={editForm.hiringUrgency === option.key}
                        onPress={() => setEditForm((prev) => ({ ...prev, hiringUrgency: prev.hiringUrgency === option.key ? '' : option.key }))}
                      />
                    ))}
                  </View>
                </View>
              </>
            ) : (
              <>
                <View style={{ marginBottom: 12 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>บุคลากรที่ต้องการติดต่อ</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {STAFF_TYPES.map((staff) => (
                      <Chip
                        key={staff.code}
                        label={staff.shortName}
                        selected={editForm.interestedStaffTypes.includes(staff.code)}
                        onPress={() => toggleEditArrayValue('interestedStaffTypes', staff.code)}
                      />
                    ))}
                  </View>
                </View>

                <View style={{ marginBottom: 4 }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 8 }]}>ลักษณะการดูแลที่ต้องการ</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {USER_CARE_TYPE_OPTIONS.map((option) => (
                      <Chip
                        key={option.key}
                        label={option.label}
                        selected={editForm.careNeeds.includes(option.key)}
                        onPress={() => toggleEditArrayValue('careNeeds', option.key)}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>

          {/* ── SECTION: เกี่ยวกับฉัน ── */}
          <View style={profileEditStyles.section}>
            <View style={profileEditStyles.sectionHeader}>
              <View style={[profileEditStyles.sectionDot, { backgroundColor: colors.primary }]} />
              <Text style={[profileEditStyles.sectionTitle, { color: colors.text }]}>เกี่ยวกับฉัน</Text>
            </View>
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'flex-start', minHeight: 100 }]}>
              <View style={[profileEditStyles.fieldIcon, { marginTop: 10 }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
              </View>
              <View style={[profileEditStyles.fieldContent, { paddingTop: 10 }]}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 4 }]}>บรรยายตัวเอง</Text>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
                  value={editForm.bio}
                  onChangeText={(t) => setEditForm({ ...editForm, bio: t })}
                  placeholder="บอกเล่าเกี่ยวกับตัวคุณ ความเชี่ยวชาญ และสิ่งที่คุณมองหา..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.editModalActions, { paddingBottom: Math.max(insets.bottom, 16) + SPACING.md }]}>
          <TouchableOpacity
            onPress={() => { setShowEditModal(false); setPhoneStep('idle'); }}
            style={[profileEditStyles.actionBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginRight: 10 }]}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>ยกเลิก</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={isAuthLoading || phoneStep === 'sending' || phoneStep === 'verify'}
            style={[profileEditStyles.actionBtn, {
              backgroundColor: (isAuthLoading || phoneStep === 'sending' || phoneStep === 'verify') ? colors.border : colors.primary,
              flex: 1.5,
            }]}
          >
            {isAuthLoading
              ? <Text style={{ color: colors.white, fontWeight: '700', fontSize: 16 }}>กำลังบันทึก…</Text>
              : phoneStep === 'verify' || phoneStep === 'sending'
                ? <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>ยืนยัน OTP ก่อนบันทึก</Text>
                : editForm.phone.trim() !== (user?.phone || '').trim() && editForm.phone.trim() !== '' && phoneStep === 'idle'
                  ? <><Ionicons name="shield-outline" size={16} color={colors.white} style={{ marginRight: 6 }} /><Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>ขอ OTP & บันทึก</Text></>
                  : <><Ionicons name="checkmark-circle-outline" size={16} color={colors.white} style={{ marginRight: 6 }} /><Text style={{ color: colors.white, fontWeight: '700', fontSize: 15 }}>บันทึกข้อมูล</Text></>
            }
          </TouchableOpacity>
        </View>
      </ModalContainer>

      <ModalContainer
        visible={showCampaignCodeModal}
        onClose={() => setShowCampaignCodeModal(false)}
        title="โค้ดส่วนลด / แคมเปญ"
      >
        <View style={styles.campaignModalContent}>
          <Text style={[styles.campaignModalDescription, { color: colors.textSecondary }]}>เลือกแพ็กเกจที่ต้องการใช้โค้ดก่อน ระบบจะเช็ก role, แพ็กเกจ, ยอดซื้อขั้นต่ำ และสิทธิ์ครั้งแรกให้ทันที</Text>

          {pendingCampaignCode ? (
            <View style={[styles.pendingCodeBox, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}> 
              <View style={styles.pendingCodeBoxHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pendingCodeBoxTitle, { color: colors.text }]}>โค้ดที่บันทึกไว้</Text>
                  <Text style={[styles.pendingCodeBoxCode, { color: colors.warning }]}>{pendingCampaignCode.code}</Text>
                </View>
                <TouchableOpacity onPress={handleClearCampaignCode} disabled={isApplyingCampaignCode}>
                  <Text style={[styles.pendingCodeBoxAction, { color: colors.warning }]}>ลบ</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.pendingCodeBoxText, { color: colors.textSecondary }]}>ใช้กับ {getCampaignPackageDisplayLabel(pendingCampaignCode.packageKey, user?.role)}</Text>
              <Text style={[styles.pendingCodeBoxText, { color: colors.textSecondary }]}> 
                {getCampaignBenefitSummary(pendingCampaignCode.benefitType, pendingCampaignCode.benefitValue)}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.campaignSectionLabel, { color: colors.text }]}>รหัสโค้ด</Text>
          <TextInput
            style={[styles.campaignInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={campaignCodeInput}
            onChangeText={setCampaignCodeInput}
            placeholder="เช่น NURSEGO10"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
          />

          <Text style={[styles.campaignSectionLabel, { color: colors.text }]}>เลือกแพ็กเกจ / บริการ</Text>
          <View style={styles.campaignChipWrap}>
            {campaignPackageOptions.map((item) => (
              <Chip
                key={item.key}
                label={`${getCampaignPackageDisplayLabel(item.key, user?.role)} ฿${item.amount.toLocaleString()}`}
                selected={selectedCampaignPackage === item.key}
                onPress={() => setSelectedCampaignPackage(item.key)}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.campaignApplyButton, { backgroundColor: colors.primary }, isApplyingCampaignCode && { opacity: 0.7 }]}
            onPress={handleApplyCampaignCode}
            disabled={isApplyingCampaignCode}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
            <Text style={styles.campaignApplyButtonText}>{isApplyingCampaignCode ? 'กำลังตรวจสอบ...' : 'บันทึกโค้ดนี้ไว้ใช้'}</Text>
          </TouchableOpacity>

          <Text style={[styles.campaignFootnote, { color: colors.textMuted }]}>หลังบันทึกแล้ว ระบบจะใช้โค้ดให้อัตโนมัติเมื่อคุณซื้อรายการที่ตรงกับแพ็กเกจที่เลือกในหน้า{getCommerceEntryTitle(commerceStatus)}</Text>
        </View>
      </ModalContainer>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        visible={showLogoutModal}
        title="ออกจากระบบ"
        message="คุณต้องการออกจากระบบหรือไม่?"
        icon="🚪"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Delete Contact Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteContactModal}
        title="ลบออกจากประวัติ"
        message={pendingDeleteContact ? `ต้องการลบ "${pendingDeleteContact.title}" ออกจากประวัติการติดต่อ?` : ''}
        icon="🗑️"
        confirmText="ลบ"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={confirmDeleteContact}
        onCancel={() => { setShowDeleteContactModal(false); setPendingDeleteContact(null); }}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={modalTitle}
        message={modalMessage}
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

  profileDashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  profileDashboardAvatarWrap: {
    position: 'relative',
    marginRight: SPACING.sm,
  },
  profileDashboardEditDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  profileDashboardTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileDashboardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  profileDashboardSubtitle: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  profileDashboardSettingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
  profileDashboardContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  profileHeroCardModern: {
    borderRadius: 28,
    padding: SPACING.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  profileHeroBackdropCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.10)',
    top: -60,
    right: -30,
  },
  profileHeroBackdropCircleSecondary: {
    width: 120,
    height: 120,
    borderRadius: 60,
    top: 100,
    right: -20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileHeroEyebrowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: SPACING.md,
  },
  profileHeroEyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
  },
  profileHeroEyebrowText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  profileHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  profileHeroAvatarButton: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  profileHeroCameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeroMainInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileHeroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  profileHeroName: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.white,
  },
  profileHeroMeta: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.86)',
    marginTop: 4,
  },
  profileHeroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.sm,
  },
  profileHeroDescription: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
    marginTop: SPACING.sm,
    maxWidth: 260,
  },
  profileHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  profileHeroBadgeText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  profileHeroAccessCard: {
    borderRadius: 22,
    padding: SPACING.md,
    gap: SPACING.md,
    borderWidth: 1,
  },
  profileHeroAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  profileHeroAccessLabel: {
    fontSize: FONT_SIZES.sm,
    marginBottom: 2,
  },
  profileHeroAccessValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  profileHeroAccessLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileHeroAccessLinkText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  profileHeroStatsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  profileHeroStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  profileHeroStatValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  profileHeroStatLabel: {
    fontSize: FONT_SIZES.xs,
    textAlign: 'center',
    marginTop: 4,
  },
  profileHeroStatDivider: {
    width: 1,
    marginHorizontal: SPACING.xs,
  },
  profileHeroPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 12,
  },
  profileHeroPrimaryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  profileShortcutCard: {
    borderRadius: 22,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  profileShortcutHeader: {
    marginBottom: SPACING.sm,
  },
  profileShortcutTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
  },
  profileShortcutSubtitle: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    marginTop: 2,
  },
  profileShortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  profileShortcutItem: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 10,
    minHeight: 108,
  },
  profileShortcutIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    position: 'relative',
  },
  profileShortcutBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  profileShortcutBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },
  profileShortcutText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
    minHeight: 30,
  },
  profileShortcutTextCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  profileMenuSectionCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 22,
    paddingTop: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  profileMenuSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  profileMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    gap: 12,
  },
  profileMenuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileMenuTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileMenuLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  profileMenuSubtitle: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
    lineHeight: 16,
  },
  profileMenuBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 4,
  },
  profileMenuBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  profileLogoutButtonWide: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
  },
  profileLogoutButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  profileDetailCard: {
    borderRadius: 22,
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  profileSectionHeaderBlock: {
    marginBottom: SPACING.md,
  },
  profileSectionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  profileSectionTitleCompact: {
    marginBottom: 4,
  },
  profileSectionSubtitle: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
  },
  profileInfoGrid: {
    gap: 10,
  },
  profileInfoTile: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    minHeight: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profileInfoTileFull: {
    width: '100%',
  },
  profileInfoTileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    marginRight: 12,
    flexShrink: 0,
  },
  profileInfoTileContent: {
    flex: 1,
  },
  profileInfoTileLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  profileInfoTileValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  profileBioPanel: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profileBioIconWrap: {
    marginBottom: 0,
    marginRight: 12,
  },
  profileBioContent: {
    flex: 1,
  },
  profileBioText: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 21,
    fontWeight: '500',
  },
  profileActivityCard: {
    marginBottom: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: 22,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },
  profileActivityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  profileActivityTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  profileActivityTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileActivityMeta: {
    fontSize: 12,
    fontWeight: '700',
    paddingTop: 16,
  },
  profileEmptyState: {
    alignItems: 'center',
    paddingVertical: 28,
    borderRadius: 16,
    borderWidth: 1,
  },
  profileActivityRow: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  profileActivityStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileActivityStatusWrap: {
    marginLeft: 8,
    alignItems: 'flex-end',
    gap: 4,
  },
  profileActivityToggle: {
    alignItems: 'center',
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  profileActivityHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  logoutButton: {
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#FEE2E2',
    borderRadius: BORDER_RADIUS.md,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  editAvatarIcon: {
    fontSize: 16,
  },
  displayName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  email: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: SPACING.sm,
  },

  // Info Card
  infoCard: {
    margin: SPACING.md,
    marginTop: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
    width: 30,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginTop: 2,
  },

  // Section
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  // Applications
  applicationsSection: {
    padding: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  applicationCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  applicationCard: {
    marginBottom: SPACING.sm,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  applicationInfo: {
    flex: 1,
  },
  applicationJobTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  applicationHospital: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  applicationDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // Empty State
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // Links Card
  linksCard: {
    margin: SPACING.md,
    padding: 0,
    overflow: 'hidden',
  },
  linksSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  linkIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
    width: 30,
  },
  linkText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  linkArrow: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  adminLink: {
    backgroundColor: '#FEF3C7', // Light amber background
  },
  adminLinkText: {
    color: '#B45309', // Amber color for admin text
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: SPACING.sm,
  },
  notificationBadge: {
    backgroundColor: COLORS.danger,
  },
  countText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  linkSubtext: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  earlyAccessCard: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  earlyAccessCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  earlyAccessCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earlyAccessCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    marginBottom: 2,
  },
  earlyAccessCardSubtitle: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 19,
  },
  earlyAccessCardBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  earlyAccessCardBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  earlyAccessCardFootnote: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 19,
    marginTop: SPACING.sm,
  },
  earlyAccessQuotaRow: {
    marginTop: SPACING.sm,
  },
  earlyAccessQuotaLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  earlyAccessQuotaStatus: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
    marginTop: 2,
  },

  campaignModalContent: {
    gap: SPACING.md,
  },
  campaignModalDescription: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  campaignSectionLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  campaignInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  campaignChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  campaignApplyButton: {
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  campaignApplyButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  campaignFootnote: {
    fontSize: FONT_SIZES.xs,
    lineHeight: 18,
  },
  pendingCodeBox: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    gap: 6,
  },
  pendingCodeBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  pendingCodeBoxTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  pendingCodeBoxCode: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    marginTop: 2,
  },
  pendingCodeBoxText: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  pendingCodeBoxAction: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },

  // Guest View
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  guestIcon: {
    fontSize: 80,
    marginBottom: SPACING.md,
  },
  guestTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  guestDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Edit Modal
  editModalContent: {
    flex: 1,
    padding: SPACING.md,
  },
  bioInput: {
    marginBottom: SPACING.md,
  },
  bioLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bioTextInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 100,
    backgroundColor: COLORS.surface,
  },
  editModalActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

// ── New Edit Modal Styles ──
const profileEditStyles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionDot: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fieldIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 2,
  },
  verifiedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    marginTop: -4,
  },
  otpBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    marginTop: -4,
  },
  otpConfirmBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
});

