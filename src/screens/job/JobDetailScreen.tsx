// ============================================
// SHIFT DETAIL SCREEN - รายละเอียดงาน
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
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
  Alert,
} from 'react-native';
import * as ExpoLinking from 'expo-linking';
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
import { contactForShift, deleteJob, updateJob, incrementViewCount, getShiftContacts, getUserShiftContacts, updateJobStatus, getJobById, boostJobPost } from '../../services/jobService';
import { canUseFreeUrgent, consumeFeatureUsage, extendPostExpiry, getFeatureUsageStatus, getUserSubscription, markFreeUrgentUsed } from '../../services/subscriptionService';
import { getOrCreateConversationWithStatus, sendMessage, sendSavedDocument } from '../../services/chatService';
import { toggleFavorite, isFavorited } from '../../services/favoritesService';
import { Document as UserDocument, getUserDocuments } from '../../services/documentsService';
import { useToast } from '../../context/ToastContext';
import { JobPost, PRICING, RootStackParamList, SubscriptionPlan, StaffType } from '../../types';
import { formatDate, formatRelativeTime, callPhone, openLine, openMapsDirections } from '../../utils/helpers';
import {
  formatPayment,
  getBenefitDisplayName,
  getDepartmentDisplayName,
  getEmploymentTypeLabel,
  getPaymentTypeDisplayName,
  getRateTypeShortLabel,
  getShiftTimeDisplayName,
  getStaffTypeLabel,
} from '../../constants/jobOptions';
import { getAdminDisplayTagColors, getIdentityDisplayTags, getPremiumTagColors, getPremiumTagText, getRoleIconName, getRoleLabel, getRoleTagColors, getVerificationTagText, hasPremiumTag, hasRoleTag } from '../../utils/verificationTag';
import { trackEvent } from '../../services/analyticsService';
import { getSafeContactMode } from '../../utils/jobPostIntelligence';
import { getCommerceAccessStatus } from '../../services/commerceService';
import { getCurrentResolvedLanguage, useI18n, translate } from '../../i18n';

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
  const locale = getCurrentResolvedLanguage() === 'th' ? 'th-TH' : 'en-US';
  const formattedRate = rate.toLocaleString(locale);
  const unit = getRateTypeShortLabel(type) || '';
  return `฿${formattedRate}${unit}`;
};

const formatShiftDate = (date: Date): string => {
  const d = new Date(date);
  const locale = getCurrentResolvedLanguage() === 'th' ? 'th-TH' : 'en-US';
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  };
  return d.toLocaleDateString(locale, options);
};

const getShiftTimeLabel = (time: string): string => {
  return getShiftTimeDisplayName(time, true);
};

const getJobStartLabel = (job: JobPost): string => {
  if (job.postType === 'job') {
    return job.startDateNote || translate(getCurrentResolvedLanguage(), 'jobDetail.negotiable');
  }
  return formatShiftDate(job.shiftDate);
};

const getJobTimeLabel = (job: JobPost): string => {
  if (job.postType === 'job') {
    return job.workHours || job.shiftTime || translate(getCurrentResolvedLanguage(), 'jobDetail.negotiable');
  }
  const key = (job.shiftDates?.[0] || (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : String(job.shiftDate)))?.slice(0, 10);
  const slot = key ? job.shiftTimeSlots?.[key] : undefined;
  return slot ? `${slot.start} – ${slot.end}` : (job.shiftTime || translate(getCurrentResolvedLanguage(), 'jobDetail.negotiable'));
};

const getCampaignSummary = (job: JobPost): string | null => {
  if (job.campaignSummary) return job.campaignSummary;
  if (job.postType === 'job') return null;
  const datesCount = job.shiftDates?.length || (job.shiftDate ? 1 : 0);
  const slotsNeeded = Math.max(1, Number(job.slotsNeeded || 1));
  if (!datesCount) return null;
  if (datesCount === 1) return translate(getCurrentResolvedLanguage(), 'jobDetail.campaignSlots', { slots: slotsNeeded });
  return translate(getCurrentResolvedLanguage(), 'jobDetail.campaignSlotsMultiDay', { slots: slotsNeeded, days: datesCount });
};

// ============================================
// Component
// ============================================
export default function JobDetailScreen({ navigation, route }: Props) {
  const routeJob = route.params?.job ?? null;
  const routeJobId = route.params?.jobId || routeJob?.id;
  const entrySource = route.params?.source || 'direct';
  const { user, requireAuth, isAuthenticated } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { t } = useI18n();

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
  const [isQuickApplying, setIsQuickApplying] = useState(false);
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
  const [isApplyingAddon, setIsApplyingAddon] = useState(false);
  const roleLabel = getRoleLabel(job?.posterRole, job?.posterOrgType, job?.posterStaffType);
  const showRoleTag = hasRoleTag(job?.posterRole, job?.posterOrgType, job?.posterStaffType);
  const roleTagColors = getRoleTagColors(job?.posterRole);
  const premiumTagText = getPremiumTagText(job?.posterPlan || posterPlan);
  const premiumTagColors = getPremiumTagColors();
  const adminDisplayTags = getIdentityDisplayTags({
    role: job?.posterRole,
    orgType: job?.posterOrgType,
    staffType: job?.posterStaffType,
    staffTypes: job?.posterStaffTypes,
    adminTags: job?.posterAdminTags,
    adminWarningTag: job?.posterWarningTag,
  });
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
  const resolvedContactMode = getSafeContactMode(job?.contactMode, Boolean(job?.contactPhone), Boolean(job?.contactLine));
  const canRevealExternalContact = Boolean(isOwner || hasContacted);

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

  useEffect(() => {
    const loadContactState = async () => {
      if (!user?.uid || !job?.id || isOwner) return;
      try {
        const contacts = await getUserShiftContacts(user.uid);
        setHasContacted(contacts.some((contact) => contact.jobId === job.id));
      } catch (error) {
        console.error('Error loading user contact state:', error);
      }
    };

    loadContactState();
  }, [isOwner, job?.id, user?.uid]);

  useEffect(() => {
    if (!job?.id) return;

    trackEvent({
      eventName: 'job_detail_view',
      screenName: 'JobDetail',
      subjectType: 'shift',
      subjectId: job.id,
      jobId: job.id,
      province: job.location?.province,
      props: {
        source: entrySource,
        postType: job.postType || 'shift',
        staffType: job.staffType || null,
        posterRole: job.posterRole || null,
        status: job.status,
        isUrgent: Boolean(job.isUrgent || job.status === 'urgent'),
      },
    });
  }, [entrySource, job?.id, job?.location?.province, job?.postType, job?.staffType, job?.posterRole, job?.status, job?.isUrgent]);

  if (isLoadingJob) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('jobDetail.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}> 
          <Ionicons name="document-text-outline" size={52} color={colors.textMuted} />
          <Text style={[styles.loadingText, { color: colors.text }]}>{t('jobDetail.notFound')}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={[styles.retryButtonText, { color: colors.white }]}>{t('jobDetail.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Handle contact poster
  const handleContact = () => {
    requireAuth(() => {
      if (hasContacted) {
        setAlert(createAlert.info(t('jobDetail.alerts.alreadyContacted'), t('jobDetail.alerts.alreadyContactedMessage')) as AlertState);
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
      const applyUsage = await getFeatureUsageStatus(user.uid, 'job_application');
      if (!applyUsage.canUse) {
        setAlert(createAlert.info(t('jobDetail.alerts.applyQuotaReached'), applyUsage.reason || t('jobDetail.alerts.applyQuotaReachedMessage')) as AlertState);
        return;
      }

      await trackEvent({
        eventName: 'apply_cta_clicked',
        screenName: 'JobDetail',
        subjectType: 'shift',
        subjectId: job.id,
        jobId: job.id,
        province: job.location?.province,
        props: {
          source: entrySource,
          postType: job.postType || 'shift',
          staffType: job.staffType || null,
          posterRole: job.posterRole || null,
        },
      });

      await contactForShift(
        job.id, 
        user.uid, 
        user.displayName || t('jobDetail.userFallback'),
        user.phone || ''
      );
      if (applyUsage.limit != null) {
        await consumeFeatureUsage(user.uid, 'job_application');
      }
      setShowContactModal(false);
      setHasContacted(true);
      // Show success modal with contact options
      setShowContactSuccessModal(true);
    } catch (error: any) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), error.message || t('jobDetail.alerts.errorRetry')) as AlertState);
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
      setAlert(createAlert.success(t('jobDetail.alerts.closedSuccess'), t('jobDetail.alerts.closedSuccessMessage')) as AlertState);
    } catch (error: any) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), error.message || t('jobDetail.alerts.errorRetry')) as AlertState);
    } finally {
      setIsClosing(false);
    }
  };

  // Handle reopen job (for owner)
  const handleReopenJob = async () => {
    try {
      await updateJobStatus(job.id, 'active');
      setJobStatus('active');
      setAlert(createAlert.success(t('jobDetail.alerts.reopenedSuccess'), t('jobDetail.alerts.reopenedSuccessMessage')) as AlertState);
    } catch (error: any) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), error.message || t('jobDetail.alerts.errorRetry')) as AlertState);
    }
  };

  // Navigate to applicants screen
  const handleViewApplicants = () => {
    (navigation as any).navigate('Applicants', { jobId: job.id });
  };

  // Handle call
  const handleCall = () => {
    if (!canRevealExternalContact) {
      setAlert(createAlert.info(t('jobDetail.alerts.contactLocked'), t('jobDetail.alerts.contactLockedMessage')) as AlertState);
      return;
    }
    if (job.contactPhone) {
      callPhone(job.contactPhone);
    } else {
      setAlert(createAlert.info(t('jobDetail.alerts.noPhone'), t('jobDetail.alerts.noPhoneMessage')) as AlertState);
    }
  };

  // Handle LINE
  const handleLine = () => {
    if (!canRevealExternalContact) {
      setAlert(createAlert.info(t('jobDetail.alerts.contactLocked'), t('jobDetail.alerts.contactLockedLine')) as AlertState);
      return;
    }
    if (job.contactLine) {
      openLine(job.contactLine);
    } else {
      setAlert(createAlert.info(t('jobDetail.alerts.noLine'), t('jobDetail.alerts.noLineMessage')) as AlertState);
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
      setAlert(createAlert.info(t('jobDetail.alerts.noAddress'), t('jobDetail.alerts.noAddressMessage')) as AlertState);
    }
  };

  // Handle share
  const handleShare = async () => {
    try {
      await trackEvent({
        eventName: 'share_job_clicked',
        screenName: 'JobDetail',
        subjectType: 'shift',
        subjectId: job.id,
        jobId: job.id,
        province: job.location?.province,
        props: {
          source: entrySource,
          postType: job.postType || 'shift',
          staffType: job.staffType || null,
          posterRole: job.posterRole || null,
        },
      });

      const rateText = formatShiftRate(job.shiftRate, job.rateType);
      const dateLabel = job.postType === 'job' ? t('jobDetail.share.dateLabel') : t('jobDetail.share.shiftDateLabel');
      const timeLabel = job.postType === 'job' ? t('jobDetail.share.timeLabel') : t('jobDetail.share.shiftTimeLabel');
      const dateText = getJobStartLabel(job);
      const timeText = getJobTimeLabel(job);
      const shareUrl = `https://nursego.co/job/${job.id}`;
      const appLink = ExpoLinking.createURL(`/job/${job.id}`);
      await Share.share({
        message: `${job.title}\n${dateLabel}: ${dateText}\n${timeLabel}: ${timeText}\n${job.postType === 'job' ? t('jobDetail.share.salary') : t('jobDetail.share.compensation')}: ${rateText}\n${t('jobDetail.share.location')}: ${job.location?.hospital || job.location?.province}\n\n${t('jobDetail.share.viewDetails')}: ${shareUrl}\n${t('jobDetail.share.openInApp')}: ${appLink}`,
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
          toast.success(t('jobDetail.save.saved', { title: job.title }), t('jobDetail.save.savedToast'));
        } else {
          toast.info(t('jobDetail.save.removed'), t('jobDetail.save.removedToast'));
        }
      } catch {
        setIsSaved(prev); // rollback
        toast.error(t('jobDetail.save.failed'));
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
        setAlert(createAlert.warning(t('jobDetail.alerts.cannotChatSelf'), t('jobDetail.alerts.cannotChatSelfMessage')) as AlertState);
        return;
      }
      
      setIsStartingChat(true);
      try {
        const chatUsage = await getFeatureUsageStatus(user.uid, 'chat_start');
        if (!chatUsage.canUse) {
          setAlert(createAlert.info(t('jobDetail.alerts.chatQuotaReached'), chatUsage.reason || t('jobDetail.alerts.chatQuotaReachedMessage')) as AlertState);
          return;
        }

        await trackEvent({
          eventName: 'chat_cta_clicked',
          screenName: 'JobDetail',
          subjectType: 'shift',
          subjectId: job.id,
          jobId: job.id,
          conversationId: undefined,
          province: job.location?.province,
          props: {
            source: entrySource,
            postType: job.postType || 'shift',
            staffType: job.staffType || null,
            posterRole: job.posterRole || null,
          },
        });

        const { conversationId, created } = await getOrCreateConversationWithStatus(
          user.uid,
          user.displayName || t('jobDetail.userFallback'),
          job.posterId,
          job.posterName || t('jobDetail.posterFallback'),
          job.id,
          job.title,
          job.location?.hospital || undefined
        );
        if (created && chatUsage.limit != null) {
          await consumeFeatureUsage(user.uid, 'chat_start');
        }
        
        // Navigate to chat room
        (navigation as any).navigate('ChatRoom', {
          conversationId,
          recipientId: job.posterId,
          recipientName: job.posterName || t('jobDetail.posterFallback'),
          recipientPhoto: job.posterPhoto || undefined,
          jobTitle: job.title,
          jobId: job.id,
        });
      } catch (error: any) {
        setErrorMessage(error.message || t('jobDetail.alerts.chatError'));
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
      setErrorMessage(error.message || t('jobDetail.alerts.deleteError'));
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

  const handleDuplicatePost = () => {
    const serialized = {
      ...job,
      shiftDate: job.shiftDate ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate) : undefined,
      shiftDateEnd: (job as any).shiftDateEnd ? ((job as any).shiftDateEnd instanceof Date ? (job as any).shiftDateEnd.toISOString() : (job as any).shiftDateEnd) : undefined,
    } as any;
    (navigation as any).navigate('Main', { screen: 'PostJob', params: { duplicateJob: serialized } });
  };

  const pickLatestQuickApplyDocument = (documents: UserDocument[]) => {
    return [...documents]
      .filter((item) => Boolean(item.fileUrl))
      .sort((left, right) => {
        const leftRank = left.status === 'approved' || left.isVerified ? 1 : 0;
        const rightRank = right.status === 'approved' || right.isVerified ? 1 : 0;
        if (leftRank !== rightRank) return rightRank - leftRank;
        const leftTime = left.updatedAt?.getTime?.() || left.verifiedAt?.getTime?.() || left.createdAt?.getTime?.() || 0;
        const rightTime = right.updatedAt?.getTime?.() || right.verifiedAt?.getTime?.() || right.createdAt?.getTime?.() || 0;
        return rightTime - leftTime;
      })[0];
  };

  const handleQuickApply = () => {
    requireAuth(async () => {
      if (!user || !job.posterId) return;
      if (hasContacted) {
        setAlert(createAlert.info(t('jobDetail.alerts.quickApplyAlreadyDone'), t('jobDetail.alerts.quickApplyAlreadyDoneMessage')) as AlertState);
        return;
      }

      setIsQuickApplying(true);
      try {
        const applyUsage = await getFeatureUsageStatus(user.uid, 'job_application');
        if (!applyUsage.canUse) {
          setAlert(createAlert.info(t('jobDetail.alerts.applyQuotaReached'), applyUsage.reason || t('jobDetail.alerts.applyQuotaReachedMessage')) as AlertState);
          return;
        }

        const documents = await getUserDocuments(user.uid);
        const latestDocument = pickLatestQuickApplyDocument(documents);
        const quickApplyMessage = latestDocument
          ? t('jobDetail.quickApply.messageWithDoc', { docName: latestDocument.name })
          : t('jobDetail.quickApply.messageNoDoc');

        await trackEvent({
          eventName: 'apply_cta_clicked',
          screenName: 'JobDetail',
          subjectType: 'shift',
          subjectId: job.id,
          jobId: job.id,
          province: job.location?.province,
          props: {
            source: `${entrySource}:quick_apply`,
            postType: job.postType || 'shift',
            staffType: job.staffType || null,
            hasLatestDocument: Boolean(latestDocument),
          },
        });

        await contactForShift(
          job.id,
          user.uid,
          user.displayName || t('jobDetail.userFallback'),
          user.phone || '',
          quickApplyMessage,
        );

        if (applyUsage.limit != null) {
          await consumeFeatureUsage(user.uid, 'job_application');
        }

        let openedConversationId: string | null = null;
        const chatUsage = await getFeatureUsageStatus(user.uid, 'chat_start').catch(() => null);
        if (chatUsage?.canUse !== false) {
          const { conversationId, created } = await getOrCreateConversationWithStatus(
            user.uid,
            user.displayName || t('jobDetail.userFallback'),
            job.posterId,
            job.posterName || t('jobDetail.posterFallback'),
            job.id,
            job.title,
            job.location?.hospital || undefined,
          );
          openedConversationId = conversationId;

          if (created && chatUsage?.limit != null) {
            await consumeFeatureUsage(user.uid, 'chat_start').catch(() => {});
          }

          await sendMessage(conversationId, user.uid, user.displayName || t('jobDetail.userFallback'), quickApplyMessage);
          if (latestDocument?.fileUrl) {
            await sendSavedDocument(
              conversationId,
              user.uid,
              user.displayName || t('jobDetail.userFallback'),
              latestDocument.fileUrl,
              latestDocument.fileName || latestDocument.name,
              latestDocument.type,
            );
          }
        }

        setHasContacted(true);
        setAlert(createAlert.success(
          t('jobDetail.alerts.quickApplySuccess'),
          openedConversationId
            ? t('jobDetail.alerts.quickApplySuccessWithChat')
            : t('jobDetail.alerts.quickApplySuccessNoChat')
        ) as AlertState);
      } catch (error: any) {
        setAlert(createAlert.error(t('jobDetail.alerts.quickApplyFailed'), error.message || t('jobDetail.alerts.errorRetry')) as AlertState);
      } finally {
        setIsQuickApplying(false);
      }
    });
  };

  // Handle mark as filled
  const handleMarkAsFilled = async () => {
    try {
      await updateJob(job.id, { status: 'closed' });
      setAlert(createAlert.success(t('jobDetail.alerts.markedFilled'), '') as AlertState);
      navigation.goBack();
    } catch (error) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), t('jobDetail.alerts.errorRetry')) as AlertState);
    }
  };

  const handleExtendAddon = async () => {
    if (!job) return;
    setIsApplyingAddon(true);
    try {
      const commerceStatus = await getCommerceAccessStatus();
      if (commerceStatus.freeAccessEnabled) {
        const usage = user?.uid ? await getFeatureUsageStatus(user.uid, 'extend_post') : null;
        if (usage && !usage.canUse) {
          setAlert(createAlert.info(t('jobDetail.alerts.extendQuotaReached'), usage.reason || t('jobDetail.alerts.extendQuotaReachedMessage')) as AlertState);
          return;
        }

        const newExpiry = await extendPostExpiry(job.id, 1);
        if (user?.uid && usage?.limit != null) {
          await consumeFeatureUsage(user.uid, 'extend_post');
        }
        setJob((prev) => (prev ? { ...prev, expiresAt: newExpiry, updatedAt: new Date() } : prev));
        setAlert(createAlert.success(t('jobDetail.alerts.extendedSuccess'), t('jobDetail.alerts.extendedSuccessMessage')) as AlertState);
        return;
      }

      navigation.navigate('Payment', {
        title: t('jobDetail.owner.paymentExtend'),
        amount: PRICING.extendPost,
        jobId: job.id,
        type: 'extend_post',
        description: t('jobDetail.owner.paymentExtendDesc'),
      });
    } catch (error: any) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), error?.message || t('jobDetail.alerts.errorRetry')) as AlertState);
    } finally {
      setIsApplyingAddon(false);
    }
  };

  const applyUrgentNow = async () => {
    if (!job || !user) return;
    await updateJobStatus(job.id, 'urgent');
    await markFreeUrgentUsed(user.uid);
    setJob((prev) => (prev ? { ...prev, status: 'urgent', isUrgent: true, updatedAt: new Date() } : prev));
    setJobStatus('urgent');
    setAlert(createAlert.success(t('jobDetail.alerts.urgentApplied'), t('jobDetail.alerts.urgentAppliedMessage')) as AlertState);
  };

  const handleUrgentAddon = async () => {
    if (!job || !user) return;
    setIsApplyingAddon(true);
    try {
      const commerceStatus = await getCommerceAccessStatus();
      if (commerceStatus.freeAccessEnabled) {
        const canUseUrgent = await canUseFreeUrgent(user.uid);
        if (!canUseUrgent) {
          setAlert(createAlert.info(t('jobDetail.alerts.urgentQuotaReached'), t('jobDetail.alerts.urgentQuotaReachedMessage')) as AlertState);
          return;
        }
        await applyUrgentNow();
        return;
      }

      navigation.navigate('Payment', {
        title: t('jobDetail.owner.paymentUrgent'),
        amount: PRICING.urgentPost,
        jobId: job.id,
        type: 'urgent_post',
        description: t('jobDetail.owner.paymentUrgentDesc'),
      });
    } catch (error: any) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), error?.message || t('jobDetail.alerts.errorRetry')) as AlertState);
    } finally {
      setIsApplyingAddon(false);
    }
  };

  const handleBoostAddon = async () => {
    if (!job || !user?.uid) return;
    setIsApplyingAddon(true);
    try {
      const commerceStatus = await getCommerceAccessStatus();
      if (commerceStatus.freeAccessEnabled) {
        const usage = await getFeatureUsageStatus(user.uid, 'boost_post');
        if (!usage.canUse) {
          setAlert(createAlert.info(t('jobDetail.alerts.boostQuotaReached'), usage.reason || t('jobDetail.alerts.boostQuotaReachedMessage')) as AlertState);
          return;
        }

        const boostedAt = await boostJobPost(job.id);
        if (usage.limit != null) {
          await consumeFeatureUsage(user.uid, 'boost_post');
        }
        setJob((prev) => (prev ? { ...prev, boostedAt, updatedAt: boostedAt } : prev));
        setAlert(createAlert.success(t('jobDetail.alerts.boostedSuccess'), t('jobDetail.alerts.boostedSuccessMessage')) as AlertState);
        return;
      }

      navigation.navigate('Payment', {
        title: t('jobDetail.owner.paymentBoost'),
        amount: PRICING.extraPost,
        jobId: job.id,
        type: 'boost_post',
        description: t('jobDetail.owner.paymentBoostDesc'),
      });
    } catch (error: any) {
      setAlert(createAlert.error(t('jobDetail.alerts.errorGeneric'), error?.message || t('jobDetail.alerts.errorRetry')) as AlertState);
    } finally {
      setIsApplyingAddon(false);
    }
  };

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
            <View style={styles.posterAvatarWrap}>
              <Avatar 
                uri={job.posterPhoto}
                name={job.posterName}
                size={60}
              />
              {job.posterVerified ? (
                <View style={[styles.posterVerifiedBadge, { backgroundColor: colors.card }]}> 
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                </View>
              ) : null}
            </View>
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
                {adminDisplayTags.map((tag) => {
                  const tone = getAdminDisplayTagColors(tag.tone);
                  return (
                    <View key={`${tag.tone}-${tag.label}`} style={[styles.posterTag, { backgroundColor: tone.backgroundColor }]}> 
                      <Ionicons
                        name={tag.tone === 'warning' ? 'alert-circle' : 'pricetag'}
                        size={11}
                        color={tone.textColor}
                      />
                      <Text style={[styles.posterTagText, { color: tone.textColor }]} numberOfLines={1}>{tag.label}</Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.postedTime}>{t('jobDetail.postedTime', { time: formatRelativeTime(job.createdAt) })}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Title */}
          <Text style={styles.title}>{job.title}</Text>

          {/* Badges */}
          <View style={styles.badges}>
            {(job.status === 'urgent' || job.isUrgent) && (
              <Badge text={t('jobDetail.badgeUrgent')} variant="danger" />
            )}
            {job.department ? (
              <Badge text={getDepartmentDisplayName(job.department)} variant="primary" />
            ) : null}
            {job.staffType ? (
              <Badge text={getStaffTypeLabel(job.staffType as StaffType)} variant="info" />
            ) : null}
            {job.locationType === 'HOME' ? (
              <Badge text={t('jobDetail.badgeHomeCare')} variant="warning" />
            ) : null}
            {job.paymentType === 'NET' ? (
              <Badge text={getPaymentTypeDisplayName(job.paymentType)} variant="success" />
            ) : null}
            {job.paymentType === 'DEDUCT_PERCENT' && job.deductPercent ? (
              <Badge text={getCurrentResolvedLanguage() === 'th' ? `หัก ${job.deductPercent}%` : `Deduct ${job.deductPercent}%`} variant="danger" />
            ) : null}
            {job.postType === 'job' && job.employmentType ? (
              <Badge
                text={getEmploymentTypeLabel(job.employmentType)}
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
            <Text style={styles.sectionTitle}>{t('jobDetail.sections.jobDetails')}</Text>
          </View>

          {job.postType === 'job' ? (
            <>
              {job.employmentType ? (
                <View style={styles.detailRow}>
                  <Ionicons name="briefcase-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>{t('jobDetail.sections.employmentType')}</Text>
                    <Text style={styles.detailValue}>{getEmploymentTypeLabel(job.employmentType)}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{t('jobDetail.sections.startDate')}</Text>
                  <Text style={styles.detailValue}>{getJobStartLabel(job)}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{t('jobDetail.sections.workSchedule')}</Text>
                  <Text style={styles.detailValue}>{getJobTimeLabel(job)}</Text>
                </View>
              </View>

              {job.benefits && job.benefits.length > 0 ? (
                <View style={styles.detailRow}>
                  <Ionicons name="gift-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>{t('jobDetail.sections.benefits')}</Text>
                    <Text style={styles.detailValue}>{job.benefits.map((benefit) => getBenefitDisplayName(benefit)).join(' • ')}</Text>
                  </View>
                </View>
              ) : null}
            </>
          ) : job.shiftDates && job.shiftDates.length > 1 ? (
            <View>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{t('jobDetail.sections.shiftSchedule', { count: job.shiftDates.length })}</Text>
                </View>
              </View>
              {job.shiftDates.map((isoDate, idx) => {
                const key = isoDate.slice(0, 10);
                const slot = job.shiftTimeSlots?.[key];
                const timeStr = slot ? `${slot.start} – ${slot.end}` : (job.shiftTime || translate(getCurrentResolvedLanguage(), 'jobDetail.negotiable'));
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
                  <Text style={styles.detailLabel}>{t('jobDetail.sections.date')}</Text>
                  <Text style={styles.detailValue}>{formatShiftDate(job.shiftDate)}</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={20} color={colors.primary} style={styles.detailIcon} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>{t('jobDetail.sections.time')}</Text>
                  <Text style={styles.detailValue}>{getJobTimeLabel(job)}</Text>
                </View>
              </View>
            </>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={20} color={colors.success} style={styles.detailIcon} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{job.postType === 'job' ? t('jobDetail.sections.salary') : t('jobDetail.sections.compensation')}</Text>
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
            <Text style={styles.sectionTitle}>{t('jobDetail.sections.location')}</Text>
          </View>
          
          {job.location?.hospital && (
            <View style={styles.detailRow}>
              <Ionicons name="business-outline" size={20} color={colors.primary} style={styles.detailIcon} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('jobDetail.sections.hospitalPlace')}</Text>
                <Text style={styles.detailValue}>{job.location.hospital}</Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <Ionicons name="map-outline" size={20} color={colors.primary} style={styles.detailIcon} />
            <View style={styles.detailContent}>
              <Text style={styles.detailLabel}>{t('jobDetail.sections.area')}</Text>
              <Text style={styles.detailValue}>
                {job.location?.district ? `${job.location.district}, ` : ''}
                {job.location?.province || t('jobDetail.sections.notSpecified')}
              </Text>
            </View>
          </View>

          {(job.location?.hospital || job.location?.address) && (
            <TouchableOpacity style={styles.mapButton} onPress={handleDirections}>
              <Ionicons name="navigate-outline" size={16} color={colors.white} />
              <Text style={styles.mapButtonText}>{t('jobDetail.sections.viewMap')}</Text>
            </TouchableOpacity>
          )}
        </Card>

        {/* Description - Only show for logged in users */}
        {job.description && isLoggedIn && (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('jobDetail.sections.additionalDetails')}</Text>
            </View>
            <Text style={styles.description}>{job.description}</Text>
          </Card>
        )}

        {getCampaignSummary(job) ? (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="layers-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('jobDetail.sections.campaignOverview')}</Text>
            </View>
            <Text style={styles.detailValue}>{getCampaignSummary(job)}</Text>
            {job.scheduleNote ? <Text style={styles.helperCopy}>{job.scheduleNote}</Text> : null}
          </Card>
        ) : null}

        {/* Owner Actions - Only show for job owner */}
        {isOwner && (
          <Card style={styles.ownerSection}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('jobDetail.sections.managePost')}</Text>
            </View>
            <Text style={styles.ownerNote}>{t('jobDetail.sections.ownerNote')}</Text>
            
            <View style={styles.ownerActions}>
              <TouchableOpacity style={styles.ownerButton} onPress={handleEdit}>
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
                <Text style={styles.ownerButtonText}>{t('jobDetail.owner.edit')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.ownerButton} onPress={handleMarkAsFilled}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} />
                <Text style={styles.ownerButtonText}>{t('jobDetail.owner.closeApplications')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.ownerButton, styles.deleteButton]} 
                onPress={() => setShowDeleteModal(true)}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
                <Text style={[styles.ownerButtonText, styles.deleteButtonText]}>{t('jobDetail.owner.delete')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.ownerAddonHeader}>
              <Text style={styles.ownerAddonTitle}>{t('jobDetail.owner.addons')}</Text>
              <Text style={styles.ownerAddonHint}>{t('jobDetail.owner.addonsHint')}</Text>
            </View>

            <View style={styles.ownerAddonGrid}>
              <TouchableOpacity style={styles.ownerAddonCard} onPress={handleBoostAddon} disabled={isApplyingAddon}>
                <View style={[styles.ownerAddonIcon, { backgroundColor: colors.primaryBackground }]}> 
                  <Ionicons name="arrow-up-circle-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.ownerAddonCardTitle}>{t('jobDetail.owner.boost')}</Text>
                <Text style={styles.ownerAddonCardSub}>{t('jobDetail.owner.boostSub')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ownerAddonCard} onPress={handleExtendAddon} disabled={isApplyingAddon || jobStatus === 'closed'}>
                <View style={[styles.ownerAddonIcon, { backgroundColor: colors.successLight }]}> 
                  <Ionicons name="time-outline" size={20} color={colors.success} />
                </View>
                <Text style={styles.ownerAddonCardTitle}>{t('jobDetail.owner.extend')}</Text>
                <Text style={styles.ownerAddonCardSub}>{t('jobDetail.owner.extendSub')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.ownerAddonCard} onPress={handleUrgentAddon} disabled={isApplyingAddon || jobStatus === 'closed' || jobStatus === 'urgent'}>
                <View style={[styles.ownerAddonIcon, { backgroundColor: colors.warningLight || '#FFF3E0' }]}> 
                  <Ionicons name="flash-outline" size={20} color={colors.warning} />
                </View>
                <Text style={styles.ownerAddonCardTitle}>{t('jobDetail.owner.urgentBadge')}</Text>
                <Text style={styles.ownerAddonCardSub}>{jobStatus === 'urgent' ? t('jobDetail.owner.urgentAlreadyActive') : t('jobDetail.owner.urgentBadgeSub')}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.ownerAddonNoteBox, { backgroundColor: colors.backgroundSecondary }]}> 
              <Text style={styles.ownerAddonNoteText}>
                {t('jobDetail.owner.urgentNote')}
              </Text>
            </View>
          </Card>
        )}

        {/* Contact - Only show for logged in users */}
        {isLoggedIn ? (
          <Card style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
              <Text style={styles.sectionTitle}>{t('jobDetail.sections.contactChannel')}</Text>
            </View>

            {!canRevealExternalContact ? (
              <View style={[styles.lockedInlineCard, { backgroundColor: colors.primaryBackground }]}> 
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lockedInlineTitle}>{t('jobDetail.sections.contactLocked.title')}</Text>
                  <Text style={styles.lockedInlineText}>{t('jobDetail.sections.contactLocked.text')}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.contactButtons}>
                {(resolvedContactMode === 'phone' || resolvedContactMode === 'phone_or_line') && job.contactPhone ? (
                  <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                    <Ionicons name="call" size={18} color={colors.primary} />
                    <Text style={styles.contactText}>{t('jobDetail.contact.phoneLabel', { phone: job.contactPhone })}</Text>
                  </TouchableOpacity>
                ) : null}

                {(resolvedContactMode === 'line' || resolvedContactMode === 'phone_or_line') && job.contactLine ? (
                  <TouchableOpacity style={styles.contactButton} onPress={handleLine}>
                    <Ionicons name="chatbubble-ellipses" size={18} color={colors.success} />
                    <Text style={styles.contactText}>{t('jobDetail.contact.lineLabel', { lineId: job.contactLine })}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </Card>
        ) : (
          <Card style={styles.lockedSection}>
            <View style={styles.lockedContent}>
              <Ionicons name="lock-closed" size={32} color={colors.textMuted} />
              <Text style={styles.lockedTitle}>{t('jobDetail.sections.loginToView')}</Text>
              <Text style={styles.lockedDescription}>
                {t('jobDetail.sections.loginDescription')}
              </Text>
              <Button
                title={t('jobDetail.sections.loginButton')}
                onPress={() => (navigation as any).navigate('Auth')}
                style={{ marginTop: SPACING.md }}
              />
            </View>
          </Card>
        )}

        {!isOwner && isAuthenticated && !hasContacted && (
          <Card style={styles.quickApplyCard}>
            <View style={styles.quickApplyBadge}>
              <Ionicons name="sparkles" size={14} color={colors.warning} />
              <Text style={styles.quickApplyBadgeText}>{t('jobDetail.quickApply.badge')}</Text>
            </View>
            <View style={styles.quickApplyRow}>
              <View style={styles.quickApplyCopy}>
                <Text style={styles.quickApplyTitle}>Quick Apply</Text>
                <Text style={styles.quickApplyDescription}>
                    {t('jobDetail.quickApply.description')}
                </Text>
                <View style={styles.quickApplyHighlights}>
                  <View style={styles.quickApplyHighlightPill}>
                    <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.warning} />
                    <Text style={styles.quickApplyHighlightText}>{t('jobDetail.quickApply.autoMessage')}</Text>
                  </View>
                  <View style={styles.quickApplyHighlightPill}>
                    <Ionicons name="document-text-outline" size={12} color={colors.warning} />
                    <Text style={styles.quickApplyHighlightText}>{t('jobDetail.quickApply.attachDocument')}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.quickApplyButton, { backgroundColor: colors.accent || COLORS.accent }]}
                onPress={handleQuickApply}
                disabled={isQuickApplying}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={16} color="#FFFFFF" />
                <Text style={styles.quickApplyButtonText}>{isQuickApplying ? t('jobDetail.quickApply.sending') : t('jobDetail.quickApply.send')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Views */}
        {viewsCount !== undefined && (
          <View style={styles.viewsRow}>
            <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
            <Text style={styles.viewsText}>{t('jobDetail.views', { count: viewsCount })}</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) + SPACING.md }]}>
        {!isOwner && (
          <View style={styles.bottomRate}>
            <Text style={styles.bottomRateLabel}>{job.postType === 'job' ? t('jobDetail.bottom.salary') : t('jobDetail.bottom.compensation')}</Text>
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
                {isStartingChat ? t('jobDetail.bottom.opening') : t('jobDetail.bottom.chat')}
              </Text>
            </TouchableOpacity>
            
            {/* Contact Button */}
            <Button
              title={hasContacted ? t('jobDetail.bottom.alreadyInterested') : t('jobDetail.bottom.interested')}
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
                {t('jobDetail.owner.applicants', { count: applicantsCount })}
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
                {jobStatus === 'closed' ? t('jobDetail.owner.reopenLabel') : t('jobDetail.owner.closeLabel')}
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
        title={t('jobDetail.modals.confirmInterest')}
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
            {t('jobDetail.modals.confirmNote')}{"\n"}
              {resolvedContactMode === 'in_app' ? t('jobDetail.modals.confirmNoteInApp') : t('jobDetail.modals.confirmNoteExternal')}
          </Text>

          <View style={styles.modalActions}>
            <Button
              title={t('jobDetail.modals.cancel')}
              variant="outline"
              onPress={() => setShowContactModal(false)}
              style={{ flex: 1, marginRight: SPACING.sm }}
            />
            <Button
              title={isContacting ? t('jobDetail.modals.confirming') : t('jobDetail.modals.confirm')}
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
        title={t('jobDetail.modals.deleteTitle')}
        message={t('jobDetail.modals.deleteMessage', { title: job.title })}
        confirmText={isDeleting ? t('jobDetail.modals.deleting') : t('jobDetail.modals.deleteConfirm')}
        cancelText={t('jobDetail.modals.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        type="danger"
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={t('jobDetail.modals.deleteSuccess')}
        message={t('jobDetail.modals.deleteSuccessMessage')}
        icon="✅"
        onClose={() => {
          setShowSuccessModal(false);
          navigation.goBack();
        }}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={t('jobDetail.modals.errorTitle')}
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
          reporterName={user.displayName || t('jobDetail.reporter')}
          reporterEmail={user.email || ''}
        />
      )}

      {/* Contact Success Modal - แสดงหลังกดสนใจสำเร็จ */}
      <ModalContainer
        visible={showContactSuccessModal}
        onClose={() => setShowContactSuccessModal(false)}
        title={t('jobDetail.modals.contactSuccess')}
      >
        <View style={styles.modalContent}>
          <Text style={styles.successIcon}>🎉</Text>
          <Text style={styles.modalTitle}>{t('jobDetail.modals.contactSuccessTitle')}</Text>
          <Text style={styles.modalSubtitle}>
            {t('jobDetail.modals.contactSuccessSubtitle')}
          </Text>
          
          <View style={styles.contactOptionsContainer}>
              {canRevealExternalContact && (resolvedContactMode === 'phone' || resolvedContactMode === 'phone_or_line') && job.contactPhone && (
              <TouchableOpacity 
                style={[styles.contactOptionButton, { backgroundColor: colors.success }]}
                onPress={() => {
                  setShowContactSuccessModal(false);
                  callPhone(job.contactPhone!);
                }}
              >
                <Ionicons name="call" size={24} color="#FFFFFF" />
                <Text style={styles.contactOptionText}>{t('jobDetail.modals.callNow')}</Text>
                <Text style={styles.contactOptionSubtext}>{job.contactPhone}</Text>
              </TouchableOpacity>
            )}
            
            {canRevealExternalContact && (resolvedContactMode === 'line' || resolvedContactMode === 'phone_or_line') && job.contactLine && (
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
              <Text style={styles.contactOptionText}>{t('jobDetail.modals.chatInAppOption')}</Text>
              <Text style={styles.contactOptionSubtext}>{t('jobDetail.contact.sendMessage')}</Text>
            </TouchableOpacity>
          </View>
          
          <Button
            title={t('jobDetail.modals.close')}
            variant="outline"
            onPress={() => setShowContactSuccessModal(false)}
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </ModalContainer>

      {/* Close Job Modal - สำหรับปิดรับสมัคร */}
      <ConfirmModal
        visible={showCloseModal}
        title={t('jobDetail.modals.closeTitle')}
        message={t('jobDetail.modals.closeMessage', { title: job.title })}
        confirmText={isClosing ? t('jobDetail.modals.closing') : t('jobDetail.modals.closeConfirm')}
        cancelText={t('jobDetail.modals.cancel')}
        onConfirm={handleCloseJob}
        onCancel={() => setShowCloseModal(false)}
        type="warning"
      />

      {/* Options Bottom Sheet for Owner */}
      <ModalContainer
        visible={showOptionsModal}
        onClose={() => setShowOptionsModal(false)}
        title={t('jobDetail.owner.moreOptions')}
      >
        <View style={{ paddingBottom: 8 }}>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); handleBoostAddon(); }}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: colors.primaryBackground }]}> 
              <Ionicons name="arrow-up-circle-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{t('jobDetail.owner.boost')}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>{t('jobDetail.owner.boostSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); handleExtendAddon(); }}
            disabled={jobStatus === 'closed'}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: colors.successLight }]}> 
              <Ionicons name="time-outline" size={22} color={colors.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{t('jobDetail.owner.extend')}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>{t('jobDetail.owner.extendSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); handleUrgentAddon(); }}
            disabled={jobStatus === 'closed' || jobStatus === 'urgent'}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: colors.warningLight || '#FFF3E0' }]}> 
              <Ionicons name="flash-outline" size={22} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{t('jobDetail.owner.urgentBadge')}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>{jobStatus === 'urgent' ? t('jobDetail.owner.urgentAlreadyActive') : t('jobDetail.owner.urgentBadgeSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); handleEdit(); }}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: colors.primaryBackground }]}>
              <Ionicons name="create-outline" size={22} color={colors.info} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{t('jobDetail.owner.editPost')}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>{t('jobDetail.owner.editPostSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); handleDuplicatePost(); }}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: colors.accentLight }]}> 
              <Ionicons name="copy-outline" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>{t('jobDetail.owner.duplicatePost')}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>{t('jobDetail.owner.duplicatePostSub')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={styles.optionDivider} />

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { setShowOptionsModal(false); setShowDeleteModal(true); }}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: colors.errorLight }]}>
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.error }]}>{t('jobDetail.owner.deletePost')}</Text>
              <Text style={[styles.optionSub, { color: colors.textMuted }]}>{t('jobDetail.owner.deletePostSub')}</Text>
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
// Styles (dynamic — receives theme colors)
// ============================================
const createStyles = (COLORS: any) => StyleSheet.create({
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
  posterAvatarWrap: {
    position: 'relative',
  },
  posterVerifiedBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: BORDER_RADIUS.full,
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
  helperCopy: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    lineHeight: 20,
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
  lockedInlineCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  lockedInlineTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  lockedInlineText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 20,
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
    backgroundColor: COLORS.backgroundSecondary,
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
  quickApplyCard: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  quickApplyBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.warningLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  quickApplyBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    color: COLORS.warning,
  },
  quickApplyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  quickApplyCopy: {
    flex: 1,
  },
  quickApplyTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  quickApplyDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  quickApplyHighlights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  quickApplyHighlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.warningLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickApplyHighlightText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.warning,
  },
  quickApplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: BORDER_RADIUS.lg,
    minWidth: 96,
  },
  quickApplyButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },

  // Owner Section
  ownerSection: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    backgroundColor: COLORS.accentLight,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  ownerNote: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.warning,
    marginBottom: SPACING.md,
  },
  ownerActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ownerAddonHeader: {
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  ownerAddonTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
  },
  ownerAddonHint: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  ownerAddonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  ownerAddonCard: {
    flex: 1,
    minWidth: 96,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  ownerAddonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  ownerAddonCardTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  ownerAddonCardSub: {
    marginTop: 4,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  ownerAddonNoteBox: {
    marginTop: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  ownerAddonNoteText: {
    fontSize: FONT_SIZES.xs + 1,
    color: COLORS.textSecondary,
    lineHeight: 18,
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
    backgroundColor: COLORS.errorLight,
    borderColor: COLORS.errorLight,
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
    backgroundColor: COLORS.primaryBackground,
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

