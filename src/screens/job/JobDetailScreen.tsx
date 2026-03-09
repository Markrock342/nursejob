// ============================================
// SHIFT DETAIL SCREEN - รายละเอียดงาน
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { KittenButton as Button, Avatar, Badge, Card, ModalContainer, BackButton, ConfirmModal, SuccessModal, ErrorModal } from '../../components/common';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import ReportModal from '../../components/report/ReportModal';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { contactForShift, deleteJob, updateJob, incrementViewCount, getShiftContacts, updateJobStatus, getJobById } from '../../services/jobService';
import { getUserSubscription } from '../../services/subscriptionService';
import { getOrCreateConversation } from '../../services/chatService';
import { toggleFavorite, isFavorited } from '../../services/favoritesService';
import { useToast } from '../../context/ToastContext';
import { JobPost, RootStackParamList, SubscriptionPlan, StaffType } from '../../types';
import { formatDate, formatRelativeTime, callPhone, openLine, openMapsDirections } from '../../utils/helpers';
import { getStaffTypeLabel } from '../../constants/jobOptions';
import { getPremiumTagColors, getPremiumTagText, getRoleIconName, getRoleLabel, getRoleTagColors, getVerificationTagText, hasPremiumTag, hasRoleTag } from '../../utils/verificationTag';

// ============================================
// Types
// ============================================
type JobDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'JobDetail'>;
type JobDetailScreenRouteProp = RouteProp<RootStackParamList, 'JobDetail'>;

interface Props {
  navigation: JobDetailScreenNavigationProp;
  route: JobDetailScreenRouteProp;
}

// ============================================
// Helpers
// ============================================
const formatShiftRate = (rate: number, type: string): string => {
  const formattedRate = rate.toLocaleString('th-TH');
  const unit = type === 'hour' ? '/ชม.' : type === 'day' ? '/วัน' : type === 'month' ? '/เดือน' : '/เวร';
  return `฿${formattedRate}${unit}`;
};

const formatShiftDate = (date: Date): string => {
  const d = new Date(date);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  };
  return d.toLocaleDateString('th-TH', options);
};

const getShiftTimeLabel = (time: string): string => {
  const timeMap: Record<string, string> = {
    '08:00-16:00': 'เวรเช้า',
    '16:00-00:00': 'เวรบ่าย', 
    '00:00-08:00': 'เวรดึก',
    '08:00-20:00': 'เช้า-บ่าย',
    '20:00-08:00': 'บ่าย-ดึก',
    '00:00-24:00': 'ทั้งวัน',
  };
  return timeMap[time] || time;
};

const getJobStartLabel = (job: JobPost): string => {
  if (job.postType === 'job') {
    return job.startDateNote || 'ตามตกลง';
  }
  return formatShiftDate(job.shiftDate);
};

const getJobTimeLabel = (job: JobPost): string => {
  if (job.postType === 'job') {
    return job.workHours || job.shiftTime || 'ตามตกลง';
  }
  const key = (job.shiftDates?.[0] || (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : String(job.shiftDate)))?.slice(0, 10);
  const slot = key ? job.shiftTimeSlots?.[key] : undefined;
  return slot ? `${slot.start} – ${slot.end}` : (job.shiftTime || 'ตามตกลง');
};

// ============================================
// Component
// ============================================
export default function JobDetailScreen({ navigation, route }: Props) {
  const routeJob = route.params?.job ?? null;
  const routeJobId = route.params?.jobId || routeJob?.id;
  const { user, requireAuth, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [isContacting, setIsContacting] = useState(false);
  const [hasContacted, setHasContacted] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingFav, setIsSavingFav] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [job, setJob] = useState<JobPost | null>(routeJob);
  const [isLoadingJob, setIsLoadingJob] = useState(!routeJob && Boolean(routeJobId));
  
  // New states for improved flow
  const [applicantsCount, setApplicantsCount] = useState(0);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showContactSuccessModal, setShowContactSuccessModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [jobStatus, setJobStatus] = useState(routeJob?.status ?? 'active');
  const [posterPlan, setPosterPlan] = useState<SubscriptionPlan>('free');
  const [viewsCount, setViewsCount] = useState<number>(routeJob?.viewsCount ?? 0);
  const roleLabel = getRoleLabel(job?.posterRole, job?.posterOrgType, job?.posterStaffType);
  const showRoleTag = hasRoleTag(job?.posterRole, job?.posterOrgType, job?.posterStaffType);
  const roleTagColors = getRoleTagColors(job?.posterRole);
  const premiumTagText = getPremiumTagText(job?.posterPlan || posterPlan);
  const premiumTagColors = getPremiumTagColors();
  const verificationTagText = getVerificationTagText({
    isVerified: job?.posterVerified,
    role: job?.posterRole,
    orgType: job?.posterOrgType,
    staffType: job?.posterStaffType,
  });

  useEffect(() => {
    let isMounted = true;

    const loadJob = async () => {
      if (routeJob || !routeJobId) {
        setIsLoadingJob(false);
        return;
      }

      setIsLoadingJob(true);
      try {
        const loadedJob = await getJobById(routeJobId);
        if (!isMounted) return;
        setJob(loadedJob);
        setJobStatus(loadedJob?.status ?? 'active');
        setViewsCount(loadedJob?.viewsCount ?? 0);
      } catch (error) {
        console.error('Error loading job from deep link:', error);
        if (isMounted) {
          setJob(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingJob(false);
        }
      }
    };

    loadJob();

    return () => {
      isMounted = false;
    };
  }, [routeJob, routeJobId]);

  // Check if user is logged in
  const isLoggedIn = isAuthenticated && user;
  
  // Check if user is the owner of this job
  const isOwner = user && job && (user.uid === job.posterId || user.id === job.posterId);

  // Increment view count when screen loads
  useEffect(() => {
    if (job?.id && !isOwner) {
      setViewsCount((prev) => prev + 1);
      incrementViewCount(job.id);
    }
  }, [job?.id, isOwner]);

  // Load initial favorite state
  useEffect(() => {
    if (!user?.uid || !job?.id) return;
    isFavorited(user.uid, job.id).then(setIsSaved).catch(() => {});
  }, [user?.uid, job?.id]);

  // Load poster's subscription plan to show badge
  useEffect(() => {
    const loadPosterPlan = async () => {
      if (!job?.posterId) return;
      try {
        const sub = await getUserSubscription(job.posterId);
        setPosterPlan(sub?.plan ?? 'free');
      } catch (err) {
        console.error('Error loading poster subscription', err);
      }
    };
    loadPosterPlan();
  }, [job?.posterId]);

  // Load applicants count for owner
  useEffect(() => {
    const loadApplicantsCount = async () => {
      if (isOwner && job?.id) {
        try {
          const contacts = await getShiftContacts(job.id);
          setApplicantsCount(contacts.length);
        } catch (error) {
          console.error('Error loading applicants count:', error);
        }
      }
    };
    loadApplicantsCount();
  }, [isOwner, job?.id]);

  if (isLoadingJob) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>กำลังโหลดรายละเอียดประกาศ...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
          <Ionicons name="document-text-outline" size={52} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.text }]}>ไม่พบประกาศนี้</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryButtonText, { color: colors.white }]}>ย้อนกลับ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle contact poster
  const handleContact = () => {
    requireAuth(() => {
      if (hasContacted) {
        setAlert(createAlert.info('แจ้งเตือน', 'คุณได้ติดต่อเรื่องงานนี้ไปแล้ว') as AlertState);
        return;
      }
      setShowContactModal(true);
    });
  };

  // Submit contact
  const submitContact = async () => {
    if (!user) return;

    setIsContacting(true);
    try {
      await contactForShift(
        job.id, 
        user.uid, 
        user.displayName || 'ผู้ใช้',
        user.phone || ''
      );
      setShowContactModal(false);
      setHasContacted(true);
      // Show success modal with contact options
      setShowContactSuccessModal(true);
    } catch (error: any) {
      setAlert(createAlert.error('เกิดข้อผิดพลาด', error.message || 'กรุณาลองใหม่') as AlertState);
    } finally {
      setIsContacting(false);
    }
  };

  // Handle close job (for owner)
  const handleCloseJob = async () => {
    setIsClosing(true);
    try {
      await updateJobStatus(job.id, 'closed');
      setJobStatus('closed');
      setShowCloseModal(false);
      setAlert(createAlert.success('ปิดรับสมัครแล้ว', 'ประกาศจะไม่แสดงในหน้าแรกอีกต่อไป') as AlertState);
    } catch (error: any) {
      setAlert(createAlert.error('เกิดข้อผิดพลาด', error.message || 'กรุณาลองใหม่') as AlertState);
    } finally {
      setIsClosing(false);
    }
  };

  // Handle reopen job (for owner)
  const handleReopenJob = async () => {
    try {
      await updateJobStatus(job.id, 'active');
      setJobStatus('active');
      setAlert(createAlert.success('เปิดรับสมัครอีกครั้งแล้ว', 'ประกาศแสดงในหน้าแรกแล้ว') as AlertState);
    } catch (error: any) {
      setAlert(createAlert.error('เกิดข้อผิดพลาด', error.message || 'กรุณาลองใหม่') as AlertState);
    }
  };

  // Navigate to applicants screen
  const handleViewApplicants = () => {
    (navigation as any).navigate('Applicants');
  };

  // Handle call
  const handleCall = () => {
    if (job.contactPhone) {
      callPhone(job.contactPhone);
    } else {
      setAlert(createAlert.info('ไม่มีเบอร์โทร', 'ประกาศนี้ไม่ได้ระบุเบอร์โทรติดต่อ') as AlertState);
    }
  };

  // Handle LINE
  const handleLine = () => {
    if (job.contactLine) {
      openLine(job.contactLine);
    } else {
      setAlert(createAlert.info('ไม่มี LINE ID', 'ประกาศนี้ไม่ได้ระบุ LINE ID') as AlertState);
    }
  };

  // Handle directions - open Google Maps with route
  const handleDirections = () => {
    // สร้าง search term รวมชื่อสถานที่และที่ตั้ง
    let searchTerm = '';
    
    if (job.location?.hospital) {
      searchTerm = job.location.hospital;
      // เพิ่มจังหวัดเพื่อความแม่นยำ
      if (job.location?.district) {
        searchTerm += ` ${job.location.district}`;
      }
      if (job.location?.province) {
        searchTerm += ` ${job.location.province}`;
      }
    } else if (job.location?.address) {
      searchTerm = job.location.address;
    } else if (job.location?.province) {
      searchTerm = job.location.province;
    }
    
    if (searchTerm) {
      openMapsDirections(searchTerm);
    } else {
      setAlert(createAlert.info('ไม่มีที่อยู่', 'ประกาศนี้ไม่ได้ระบุที่ตั้ง') as AlertState);
    }
  };

  // Handle share
  const handleShare = async () => {
    try {
      const rateText = formatShiftRate(job.shiftRate, job.rateType);
      const dateLabel = job.postType === 'job' ? 'เริ่มงาน' : 'วันที่';
      const timeLabel = job.postType === 'job' ? 'เวลางาน' : 'เวลา';
      const dateText = getJobStartLabel(job);
      const timeText = getJobTimeLabel(job);
      const shareUrl = `https://nursego.app/job/${job.id}`;
      const appLink = `nursego://job/${job.id}`;
      await Share.share({
        message: `${job.title}\n${dateLabel}: ${dateText}\n${timeLabel}: ${timeText}\n${job.postType === 'job' ? 'เงินเดือน' : 'ค่าตอบแทน'}: ${rateText}\nสถานที่: ${job.location?.hospital || job.location?.province}\n\nดูรายละเอียด: ${shareUrl}\nเปิดตรงในแอป: ${appLink}`,
        title: job.title,
        url: shareUrl,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // Handle save
  const handleSave = () => {
    requireAuth(async () => {
      if (!user?.uid || !job?.id || isSavingFav) return;
      setIsSavingFav(true);
      const prev = isSaved;
      setIsSaved(!prev); // optimistic
      try {
        const isNow = await toggleFavorite(user.uid, job.id);
        setIsSaved(isNow);
        if (isNow) {
          toast.success(`บันทึก "${job.title}" ไว้ในรายการโปรดแล้ว`, '❤️ บันทึกแล้ว');
        } else {
          toast.info('ลบออกจากรายการโปรดแล้ว', '💔 ลบออกแล้ว');
        }
      } catch {
        setIsSaved(prev); // rollback
        toast.error('ไม่สามารถบันทึกงานได้ กรุณาลองใหม่');
      } finally {
        setIsSavingFav(false);
      }
    });
  };

  // Handle start chat with poster
  const handleStartChat = async () => {
    requireAuth(async () => {
      if (!user || !job.posterId) return;
      
      // Don't allow chatting with yourself
      if (user.uid === job.posterId || user.id === job.posterId) {
        setAlert(createAlert.warning('ไม่สามารถแชทได้', 'คุณไม่สามารถแชทกับตัวเองได้') as AlertState);
        return;
      }
      
      setIsStartingChat(true);
      try {
        const conversationId = await getOrCreateConversation(
          user.uid,
          user.displayName || 'ผู้ใช้',
          job.posterId,
          job.posterName || 'ผู้โพสต์',
          job.id,
          job.title,
          job.location?.hospital || undefined
        );
        
        // Navigate to chat room
        (navigation as any).navigate('ChatRoom', {
          conversationId,
          recipientName: job.posterName || 'ผู้โพสต์',
          jobTitle: job.title,
        });
      } catch (error: any) {
        setErrorMessage(error.message || 'ไม่สามารถเริ่มแชทได้ กรุณาลองใหม่');
        setShowErrorModal(true);
      } finally {
        setIsStartingChat(false);
      }
    });
  };

  // Handle report job
  const handleReportJob = () => {
    requireAuth(() => {
      setShowReportModal(true);
    });
  };

  // Handle delete job (for owner only)
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteJob(job.id);
      setShowDeleteModal(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      setShowDeleteModal(false);
      setErrorMessage(error.message || 'ไม่สามารถลบได้ กรุณาลองใหม่');
      setShowErrorModal(true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle edit job (for owner only)
  const handleEdit = () => {
    const serialized = {
      ...job,
      shiftDate: job.shiftDate ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate) : undefined,
      shiftDateEnd: (job as any).shiftDateEnd ? ((job as any).shiftDateEnd instanceof Date ? (job as any).shiftDateEnd.toISOString() : (job as any).shiftDateEnd) : undefined,
    } as any;
    (navigation as any).navigate('Main', { screen: 'PostJob', params: { editJob: serialized } });
  };

  // Handle mark as filled
  const handleMarkAsFilled = async () => {
    try {
      await updateJob(job.id, { status: 'closed' });
      setAlert(createAlert.success('ปิดรับสมัครแล้ว', '') as AlertState);
      navigation.goBack();
    } catch (error) {
      setAlert(createAlert.error('เกิดข้อผิดพลาด', 'กรุณาลองใหม่') as AlertState);
    }
  };

  // Guard: job not passed in route params
  if (!job) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.textSecondary }}>ไม่พบข้อมูลประกาศ</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={[styles.headerCard, { paddingTop: insets.top + SPACING.sm }]}>
          {/* Back & Actions */}
          <View style={styles.headerTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleSave} disabled={isSavingFav}>
                <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={22} color={isSaved ? '#FF6B6B' : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={22} color="#fff" />
              </TouchableOpacity>
              {!isOwner && (
                <TouchableOpacity style={styles.actionButton} onPress={handleReportJob}>
                  <Ionicons name="flag-outline" size={20} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Poster Info */}
          <TouchableOpacity 
            style={styles.posterSection}
            onPress={() => {
              (navigation as any).navigate('UserProfile', {
                userId: job.posterId,
                userName: job.posterName,
                userPhoto: job.posterPhoto,
              });
            }}
            activeOpacity={0.7}
          >
            <Avatar 
              uri={job.posterPhoto}
              name={job.posterName}
              size={60}
            />
            <View style={styles.posterInfo}>
              <View style={styles.posterNameRow}>
                <Text style={styles.posterName}>{job.posterName}</Text>
                {showRoleTag ? (
                  <View style={[styles.posterTag, { backgroundColor: roleTagColors.backgroundColor }]}>
                    <Ionicons
                      name={getRoleIconName(job.posterRole)}
                      size={11}
                      color={roleTagColors.textColor}
                    />
                    <Text style={[styles.posterTagText, { color: roleTagColors.textColor }]} numberOfLines={1}>{roleLabel}</Text>
                  </View>
                ) : null}
                {hasPremiumTag(job?.posterPlan || posterPlan) ? (
                  <View style={[styles.posterTag, { backgroundColor: premiumTagColors.backgroundColor }]}>
                    <Ionicons name="diamond" size={11} color={premiumTagColors.textColor} />
                    <Text style={[styles.posterTagText, { color: premiumTagColors.textColor }]} numberOfLines={1}>{premiumTagText}</Text>
                  </View>
                ) : null}
                {verificationTagText ? (
                  <View style={[styles.posterTag, styles.posterVerifyTag]}>
                    <Ionicons name="checkmark-circle" size={11} color={COLORS.white} />
                    <Text style={styles.posterTagText} numberOfLines={1}>{verificationTagText}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.postedTime}>โพสต์ {formatRelativeTime(job.createdAt)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>{job.title}</Text>

          {/* Badges */}
          <View style={styles.badges}>
            {(job.status === 'urgent' || job.isUrgent) && (
              <Badge text="🔥 ด่วน" variant="danger" />
            )}
            {job.department ? (
              <Badge text={job.department} variant="primary" />
            ) : null}
            {job.staffType ? (
              <Badge text={getStaffTypeLabel(job.staffType as StaffType)} variant="info" />
            ) : null}
            {job.locationType === 'HOME' ? (
              <Badge text="🏠 ดูแลบ้าน" variant="warning" />
            ) : null}
            {job.paymentType === 'NET' ? (
              <Badge text="NET (รับเต็ม)" variant="success" />
            ) : null}
            {job.paymentType === 'DEDUCT_PERCENT' && job.deductPercent ? (
              <Badge text={`หัก ${job.deductPercent}%`} variant="danger" />
            ) : null}
            {job.postType === 'job' && job.employmentType ? (
              <Badge
                text={job.employmentType === 'full_time' ? 'งานประจำ' : job.employmentType === 'part_time' ? 'พาร์ตไทม์' : job.employmentType === 'contract' ? 'สัญญาจ้าง' : 'ชั่วคราว'}
                variant="secondary"
              />
            ) : null}
            {job.shiftTime && getShiftTimeLabel(job.shiftTime) !== job.shiftTime ? (
              <Badge text={getShiftTimeLabel(job.shiftTime)} variant="secondary" />
            ) : null}
          </View>
        </View>

        {/* Shift Details */}
        <Card style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>รายละเอียดงาน</Text>
          </View>

          {job.postType === 'job' ? (
            <>
              {job.employmentType ? (
                <View style={styles.detailRow}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>ประเภทการจ้าง</Text>
                    <Text style={styles.detailValue}>
                      {job.employmentType === 'full_time' ? 'งานประจำ' : job.employmentType === 'part_time' ? 'พาร์ตไทม์' : job.employmentType === 'contract' ? 'สัญญาจ้าง' : 'ชั่วคราว'}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>วันเริ่มงาน</Text>
                  <Text style={styles.detailValue}>{getJobStartLabel(job)}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>วันและเวลาทำงาน</Text>
                  <Text style={styles.detailValue}>{getJobTimeLabel(job)}</Text>
                </View>
              </View>

              {job.benefits && job.benefits.length > 0 ? (
                <View style={styles.detailRow}>
                  <Ionicons name="gift-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>สวัสดิการ</Text>
                    <Text style={styles.detailValue}>{job.benefits.join(' • ')}</Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : job.shiftDates && job.shiftDates.length > 1 ? (
            <View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>ตารางเวร ({job.shiftDates.length} วัน)</Text>
                </View>
              </View>
              {job.shiftDates.map((isoDate, idx) => {
                const key = isoDate.slice(0, 10);
                const slot = job.shiftTimeSlots?.[key];
                const timeStr = slot ? `${slot.start} – ${slot.end}` : (job.shiftTime || 'ตามตกลง');
                const d = new Date(isoDate);
                const dateStr = d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
                return (
                  <View key={key} style={[styles.shiftSlotRow, { borderColor: colors.borderLight, backgroundColor: colors.backgroundSecondary }]}>
                    <View style={[styles.shiftSlotIndex, { backgroundColor: colors.primary }]}>
                      <Text style={styles.shiftSlotIndexText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.shiftSlotContent}>
                      <Text style={[styles.shiftSlotDate, { color: colors.text }]}>{dateStr}</Text>
                      <View style={styles.shiftSlotTimeRow}>
                        <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                        <Text style={[styles.shiftSlotTime, { color: colors.textSecondary }]}>{timeStr}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>วันที่</Text>
                  <Text style={styles.detailValue}>{formatShiftDate(job.shiftDate)}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>เวลา</Text>
                  <Text style={styles.detailValue}>{getJobTimeLabel(job)}</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={20} color={colors.success} style={styles.detailIcon} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{job.postType === 'job' ? 'เงินเดือน' : 'ค่าตอบแทน'}</Text>
              <Text style={[styles.detailValue, styles.rateValue]}>
                {formatShiftRate(job.shiftRate, job.rateType)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Location */}
        <Card style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={18} color={colors.primary} />
            <Text style={styles.sectionTitle}>สถานที่</Text>
          </View>
          
          {job.location?.hospital && (
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={20} color={colors.primary} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>โรงพยาบาล/สถานที่</Text>
                <Text style={styles.detailValue}>{job.location.hospital}</Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="map-outline" size={20} color={colors.primary} style={styles.detailIcon} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>พื้นที่</Text>
              <Text style={styles.detailValue}>
                {job.location?.district ? `${job.location.district}, ` : ''}
                {job.location?.province || 'ไม่ระบุ'}
              </Text>
            </View>
          </View>

          {(job.location?.hospital || job.location?.address) && (
            <TouchableOpacity style={styles.mapButton} onPress={handleDirections}>
              <Ionicons name="navigate-outline" size={16} color={colors.white} />
              <Text style={styles.mapButtonText}>ดูแผนที่</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Description - Only show for logged in users */}
        {job.description && isLoggedIn && (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>รายละเอียดเพิ่มเติม</Text>
            </View>
            <Text style={styles.description}>{job.description}</Text>
          </Card>
        )}

        {/* Owner Actions - Only show for job owner */}
        {isOwner && (
          <Card style={styles.ownerSection}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>จัดการประกาศ</Text>
            </View>
            <Text style={styles.ownerNote}>คุณเป็นเจ้าของประกาศนี้</Text>
            
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerButton} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                <Text style={styles.ownerButtonText}>แก้ไข</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.ownerButton} onPress={handleMarkAsFilled}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                <Text style={styles.ownerButtonText}>ปิดรับ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.ownerButton, styles.deleteButton]} 
                onPress={() => setShowDeleteModal(true)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.ownerButtonText, styles.deleteButtonText]}>ลบ</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Contact - Only show for logged in users */}
        {isLoggedIn ? (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>ช่องทางติดต่อ</Text>
            </View>
            
            <View style={styles.contactButtons}>
              {job.contactPhone && (
                <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                  <Ionicons name="call" size={18} color={colors.primary} />
                  <Text style={styles.contactText}>โทร {job.contactPhone}</Text>
                </TouchableOpacity>
              )}
              
              {job.contactLine && (
                <TouchableOpacity style={styles.contactButton} onPress={handleLine}>
                  <Ionicons name="chatbubble-ellipses" size={18} color={colors.success} />
                  <Text style={styles.contactText}>LINE: {job.contactLine}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Card>
        ) : (
          <Card style={styles.lockedSection}>
            <View style={styles.lockedContent}>
              <Ionicons name="lock-closed" size={32} color={colors.textMuted} />
              <Text style={styles.lockedTitle}>เข้าสู่ระบบเพื่อดูข้อมูลติดต่อ</Text>
              <Text style={styles.lockedDescription}>
                สมัครสมาชิกฟรี เพื่อดูรายละเอียดงานและติดต่อผู้โพสต์
              </Text>
              <Button
                title="เข้าสู่ระบบ / สมัครสมาชิก"
                onPress={() => (navigation as any).navigate('Auth')}
                style={{ marginTop: SPACING.md }}
              />
            </View>
          </Card>
        )}

        {/* Views */}
        {viewsCount !== undefined && (
          <View style={styles.viewsRow}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <Text style={styles.viewsText}>{viewsCount} คนดู</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + SPACING.md }]}>
        {!isOwner && (
          <View style={styles.bottomRate}>
            <Text style={styles.bottomRateLabel}>{job.postType === 'job' ? 'เงินเดือน' : 'ค่าตอบแทน'}</Text>
            <Text style={styles.bottomRateValue}>
              {formatShiftRate(job.shiftRate, job.rateType)}
            </Text>
          </View>
        )}
        
        {!isOwner && (
          <View style={styles.bottomButtons}>
            {/* Chat Button */}
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleStartChat}
              disabled={isStartingChat}
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.primary} />
              <Text style={styles.chatButtonText}>
                {isStartingChat ? 'กำลังเปิด...' : 'แชท'}
              </Text>
            </TouchableOpacity>
            
            {/* Contact Button */}
            <Button
              title={hasContacted ? '✓ สนใจแล้ว' : 'สนใจงานนี้'}
              onPress={handleContact}
              disabled={hasContacted}
              style={styles.contactMainButton}
            />
          </View>
        )}
        
        {isOwner && (
          <View style={styles.ownerBottomButtons}>
            {/* View Applicants */}
            <TouchableOpacity
              style={styles.applicantsButton}
              onPress={handleViewApplicants}
            >
              <Ionicons name="people-outline" size={18} color={colors.primary} />
              <Text style={[styles.applicantsButtonText, { color: colors.primary }]}>
                ผู้สนใจ ({applicantsCount})
              </Text>
            </TouchableOpacity>

            {/* Close/Reopen */}
            <TouchableOpacity
              style={[
                styles.ownerActionBtn,
                { backgroundColor: jobStatus === 'closed' ? colors.primary : colors.surface,
                  borderColor: jobStatus === 'closed' ? colors.primary : colors.border }
              ]}
              onPress={jobStatus === 'closed' ? handleReopenJob : () => setShowCloseModal(true)}
            >
              <Ionicons
                name={jobStatus === 'closed' ? 'refresh-outline' : 'checkmark-circle-outline'}
                size={18}
                color={jobStatus === 'closed' ? '#fff' : colors.textSecondary}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.ownerActionBtnText,
                  { color: jobStatus === 'closed' ? '#fff' : colors.textSecondary }
                ]}
              >
                {jobStatus === 'closed' ? 'เปิดอีกครั้ง' : 'ปิดรับ'}
              </Text>
            </TouchableOpacity>

            {/* More Options */}
            <TouchableOpacity
              style={styles.moreButton}
              onPress={() => setShowOptionsModal(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Contact Modal */}
      <ModalContainer
        visible={showContactModal}
        onClose={() => setShowContactModal(false)}
        title="ยืนยันความสนใจ"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalIcon}>📞</Text>
          <Text style={styles.modalTitle}>{job.title}</Text>
          <Text style={styles.modalSubtitle}>
            {getJobStartLabel(job)} • {getJobTimeLabel(job)}
          </Text>
          <Text style={styles.modalRate}>
            {formatShiftRate(job.shiftRate, job.rateType)}
          </Text>
          
          <Text style={styles.modalNote}>
            กดยืนยันเพื่อบันทึกความสนใจ{'\n'}
            จากนั้นติดต่อผู้โพสต์โดยตรง
          </Text>

          <View style={styles.modalActions}>
            <Button
              title="ยกเลิก"
              variant="outline"
              onPress={() => setShowContactModal(false)}
              style={{ flex: 1, marginRight: SPACING.sm }}
            />
            <Button
              title={isContacting ? 'กำลังบันทึก...' : 'ยืนยัน'}
              onPress={submitContact}
              loading={isContacting}
              disabled={isContacting}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ModalContainer>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteModal}
        title="ลบประกาศ"
        message={`คุณต้องการลบประกาศ "${job.title}" หรือไม่?\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`}
        confirmText={isDeleting ? 'กำลังลบ...' : 'ลบประกาศ'}
        cancelText="ยกเลิก"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title="ลบสำเร็จ"
        message="ลบประกาศเรียบร้อยแล้ว"
        icon="✅"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title="เกิดข้อผิดพลาด"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />

      {/* Report Modal */}
      {user && (
        <ReportModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetType="job"
          targetId={job.id}
          targetName={job.title}
          targetDescription={job.description}
          reporterId={user.uid}
          reporterName={user.displayName || 'ผู้ใช้'}
          reporterEmail={user.email || ''}
        />
      )}

      {/* Contact Success Modal - แสดงหลังกดสนใจสำเร็จ */}
      <ModalContainer
        visible={showContactSuccessModal}
        onClose={() => setShowContactSuccessModal(false)}
        title="✅ บันทึกความสนใจแล้ว!"
      >
        <View style={styles.modalContent}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.modalTitle}>เยี่ยมมาก!</Text>
          <Text style={styles.modalSubtitle}>
            ระบบบันทึกความสนใจของคุณแล้ว{'\n'}
            ติดต่อผู้โพสต์ได้เลย
          </Text>
          
          <View style={styles.contactOptionsContainer}>
            {job.contactPhone && (
              <TouchableOpacity 
                style={[styles.contactOptionButton, { backgroundColor: colors.success }]}
                onPress={() => {
                  setShowContactSuccessModal(false);
                  callPhone(job.contactPhone!);
                }}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
                <Text style={styles.contactOptionText}>โทรเลย</Text>
                <Text style={styles.contactOptionSubtext}>{job.contactPhone}</Text>
              </TouchableOpacity>
            )}
            
            {job.contactLine && (
              <TouchableOpacity 
                style={[styles.contactOptionButton, { backgroundColor: '#00B900' }]}
                onPress={() => {
                  setShowContactSuccessModal(false);
                  openLine(job.contactLine!);
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
                <Text style={styles.contactOptionText}>LINE</Text>
                <Text style={styles.contactOptionSubtext}>{job.contactLine}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.contactOptionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setShowContactSuccessModal(false);
                handleStartChat();
              }}
            >
              <Ionicons name="chatbubbles" size={24} color="#FFFFFF" />
              <Text style={styles.contactOptionText}>แชทในแอพ</Text>
              <Text style={styles.contactOptionSubtext}>ส่งข้อความ</Text>
            </TouchableOpacity>
          </View>
          
          <Button
            title="ปิด"
            variant="outline"
            onPress={() => setShowContactSuccessModal(false)}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </ModalContainer>

      {/* Close Job Modal - สำหรับปิดรับสมัคร */}
      <ConfirmModal
        visible={showCloseModal}
        title="ปิดรับสมัคร"
        message={`คุณต้องการปิดรับสมัครประกาศ "${job.title}" หรือไม่?\n\nประกาศจะไม่แสดงในหน้าแรกอีกต่อไป แต่คุณยังสามารถเปิดรับสมัครอีกครั้งได้`}
        confirmText={isClosing ? 'กำลังปิด...' : 'ปิดรับสมัคร'}
        cancelText="ยกเลิก"
        onConfirm={handleCloseJob}
        onCancel={() => setShowCloseModal(false)}
        type="warning"
      />

      {/* Options Bottom Sheet for Owner */}
      <ModalContainer
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        title="จัดการประกาศ"
      >
        <View style={{ paddingBottom: 8 }}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); handleEdit(); }}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="create-outline" size={22} color="#3B82F6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>แก้ไขประกาศ</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>เปลี่ยนรายละเอียดประกาศ</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); setShowDeleteModal(true); }}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: '#EF4444' }]}>ลบประกาศ</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>ลบประกาศออกจากระบบถาวร</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ModalContainer>

      {/* CustomAlert */}
      <CustomAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onClose={() => setAlert(initialAlertState)}
      />
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? 0 : 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  retryButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },

  // Header
  headerCard: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: COLORS.white,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 18,
  },

  // Poster
  posterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  posterInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  posterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  posterName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.white,
  },
  posterTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    maxWidth: 140,
  },
  posterVerifyTag: {
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  posterTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.white,
    flexShrink: 1,
  },
  postedTime: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Title
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: SPACING.sm,
    lineHeight: 28,
  },

  // Badges
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },

  // Section
  section: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },

  // Detail row
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  detailIcon: {
    marginRight: SPACING.sm,
    marginTop: 2,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  detailValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
  },
  rateValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.success,
  },

  // Description
  description: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 24,
  },

  // Shift schedule rows (multi-date)
  shiftSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  shiftSlotIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  shiftSlotIndexText: {
    color: '#fff',
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  shiftSlotContent: {
    flex: 1,
  },
  shiftSlotDate: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  shiftSlotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  shiftSlotTime: {
    fontSize: FONT_SIZES.xs,
  },

  // Map button
  mapButton: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  mapButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.white,
    marginLeft: SPACING.xs,
  },

  // Contact buttons
  contactButtons: {
    gap: SPACING.sm,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  contactText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },

  // Views
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  viewsText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },

  // Options modal
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
  },
  optionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  optionSub: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  optionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 2,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.medium,
  },
  bottomRate: {
    flex: 1,
  },
  bottomRateLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  bottomRateValue: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.success,
  },
  bottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: SPACING.md,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryBackground,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: SPACING.sm,
  },
  chatButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: SPACING.xs,
  },
  contactMainButton: {
    flex: 1,
  },
  contactedButton: {
    backgroundColor: COLORS.textMuted,
  },

  // Modal
  modalContent: {
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  modalRate: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.success,
    marginTop: SPACING.sm,
  },
  modalNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
    marginTop: SPACING.lg,
  },

  // Locked Section
  lockedSection: {
    marginHorizontal: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  lockedContent: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  lockedIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  lockedTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  lockedDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 20,
  },

  // Owner Section
  ownerSection: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  ownerNote: {
    fontSize: FONT_SIZES.sm,
    color: '#92400e',
    marginBottom: SPACING.md,
  },
  ownerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ownerButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginHorizontal: SPACING.xs,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ownerButtonIcon: {
    fontSize: 24,
    marginBottom: SPACING.xs,
  },
  ownerButtonText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    color: COLORS.error,
  },

  // Report Modal
  reportModalContent: {
    padding: SPACING.lg,
  },
  reportHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  reportTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.sm,
  },
  reportSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  reportReasons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  reportReasonButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.backgroundSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportReasonButtonActive: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  reportReasonText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  reportReasonTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  reportButtons: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },
  
  // Owner Bottom Buttons
  ownerBottomButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  applicantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    gap: 4,
    flexShrink: 0,
  },
  applicantsButtonText: {
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  ownerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    gap: 4,
    minWidth: 80,
  },
  ownerActionBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  moreButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Contact Success Modal
  successIcon: {
    fontSize: 60,
    marginBottom: SPACING.md,
  },
  contactOptionsContainer: {
    width: '100%',
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  contactOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  contactOptionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: FONT_SIZES.md,
    flex: 1,
  },
  contactOptionSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FONT_SIZES.sm,
  },
  premiumBadge: {
    backgroundColor: COLORS.premium,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumBadgeText: {
    color: COLORS.black,
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
});

