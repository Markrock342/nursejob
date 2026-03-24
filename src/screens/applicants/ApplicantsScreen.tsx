// ============================================
// APPLICANTS SCREEN - จัดการผู้สมัคร / ผู้สนใจงาน
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ScrollView,
  TextInput,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { EmptyState, Avatar, ModalContainer, Chip, Loading } from '../../components/common';
import CustomAlert, { AlertState, createAlert, initialAlertState } from '../../components/common/CustomAlert';
import {
  ApplicantDetails,
  ContactStatus,
  getHospitalApplications,
  updateApplicationStatus,
} from '../../services/applicantsService';
import { getOrCreateConversationWithStatus } from '../../services/chatService';
import { completeJobAssignment } from '../../services/jobCompletionService';
import { consumeFeatureUsage, getFeatureUsageStatus } from '../../services/subscriptionService';
import { formatDate, formatRelativeTime } from '../../utils/helpers';
import {
  getCareTypeThaiLabel,
  getHiringUrgencyThaiLabel,
  getOrgTypeThaiLabel,
  getStaffTypeThaiLabel,
  getThaiLabels,
  getWorkStyleThaiLabel,
} from '../../utils/profileLabels';
import { useI18n } from '../../i18n';
import { getRoleIconName, getRoleLabel, getRoleTagColors, getVerificationTagText } from '../../utils/verificationTag';

type ApplicantsRouteParams = {
  jobId?: string;
  applicantUserId?: string;
};

type ApplicantsViewMode = 'all' | 'byPost';

type ApplicantSection = {
  key: string;
  title: string;
  job?: ApplicantDetails['job'];
  data: ApplicantDetails[];
  stats: {
    total: number;
    interested: number;
    confirmed: number;
    cancelled: number;
  };
  lastContactedAt: Date;
};

const createStatusMeta = (t: any) => ({
  interested: { label: t('applicants.status.interested'), icon: 'hand-left-outline' as const },
  confirmed: { label: t('applicants.status.confirmed'), icon: 'checkmark-circle-outline' as const },
  cancelled: { label: t('applicants.status.cancelled'), icon: 'close-circle-outline' as const },
});

export default function ApplicantsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const statusMeta = useMemo(() => createStatusMeta(t), [t]);

  const routeParams = (route.params || {}) as ApplicantsRouteParams;
  const targetJobId = routeParams.jobId;
  const targetApplicantUserId = routeParams.applicantUserId;

  const [contacts, setContacts] = useState<ApplicantDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ContactStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<ApplicantsViewMode>('all');
  const [selectedContact, setSelectedContact] = useState<ApplicantDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [isCompletingJob, setIsCompletingJob] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);

  const pageBackground = isDark ? colors.background : '#F4F7FB';
  const heroBackground = isDark ? colors.card : colors.primary;
  const heroSubtle = isDark ? colors.backgroundSecondary : colors.primaryBackground;
  const cardBackground = isDark ? colors.card : colors.surface;
  const mutedCard = isDark ? colors.backgroundSecondary : '#EEF4FF';
  const headerSurface = isDark ? colors.surface : colors.primary;
  const headerButton = isDark ? colors.backgroundSecondary : 'rgba(255,255,255,0.18)';
  const elevatedCard = isDark ? colors.backgroundSecondary : '#FAFCFF';

  const getApplicantName = useCallback((contact: ApplicantDetails) => {
    const profile = contact.userProfile;
    const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim();
    return fullName || contact.userName || profile?.displayName || t('applicants.card.unnamed');
  }, [t]);

  const getApplicantProvince = useCallback((contact: ApplicantDetails) => {
    const profile = contact.userProfile;
    return profile?.preferredProvince || profile?.location?.province || undefined;
  }, []);

  const getApplicantRoleText = useCallback((contact: ApplicantDetails) => {
    const profile = contact.userProfile;
    return getRoleLabel(profile?.role, profile?.orgType, profile?.staffType);
  }, []);

  const getRoleSpecificHighlights = useCallback((contact: ApplicantDetails) => {
    const profile = contact.userProfile;
    if (!profile) return [] as string[];

    if (profile.role === 'nurse') {
      const staffLabels = getThaiLabels(profile.staffTypes || (profile.staffType ? [profile.staffType] : []), getStaffTypeThaiLabel);
      const workStyleLabels = getThaiLabels(profile.workStyle || [], getWorkStyleThaiLabel);
      return [...staffLabels, ...workStyleLabels].slice(0, 4);
    }

    if (profile.role === 'hospital') {
      const orgLabel = profile.orgType ? [getOrgTypeThaiLabel(profile.orgType)] : [];
      const interestedLabels = getThaiLabels(profile.interestedStaffTypes || [], getStaffTypeThaiLabel);
      const urgencyLabels = profile.hiringUrgency ? [getHiringUrgencyThaiLabel(profile.hiringUrgency)] : [];
      return [...orgLabel, ...interestedLabels, ...urgencyLabels].slice(0, 4);
    }

    const careLabels = getThaiLabels((profile.careNeeds || profile.careTypes || []), getCareTypeThaiLabel);
    return careLabels.slice(0, 4);
  }, []);

  const getStatusTone = useCallback((status: ContactStatus) => {
    switch (status) {
      case 'confirmed':
        return { background: colors.successLight, text: colors.success, border: colors.success };
      case 'cancelled':
        return { background: colors.errorLight, text: colors.error, border: colors.error };
      default:
        return { background: colors.warningLight, text: colors.warning, border: colors.warning };
    }
  }, [colors.error, colors.errorLight, colors.success, colors.successLight, colors.warning, colors.warningLight]);

  const loadApplicants = useCallback(async () => {
    if (!user?.uid) {
      setContacts([]);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await getHospitalApplications(user.uid);
      setContacts(data);
    } catch (error) {
      console.error('Error loading applicants:', error);
      setAlert(createAlert.error(t('applicants.alerts.loadFailedTitle'), t('applicants.alerts.loadFailedMessage')) as AlertState);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const jobScopedContacts = useMemo(() => {
    if (!targetJobId) return contacts;
    return contacts.filter((contact) => contact.jobId === targetJobId);
  }, [contacts, targetJobId]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return jobScopedContacts.filter((contact) => {
      if (selectedFilter !== 'all' && contact.status !== selectedFilter) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        contact.userName,
        contact.userProfile?.displayName,
        contact.job?.title,
        contact.message,
        contact.userProfile?.bio,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [jobScopedContacts, searchQuery, selectedFilter]);

  useEffect(() => {
    if (!targetApplicantUserId || filteredContacts.length === 0 || showDetailModal) return;
    const matchedContact = filteredContacts.find((contact) => contact.userId === targetApplicantUserId);
    if (!matchedContact) return;
    setSelectedContact(matchedContact);
    setShowDetailModal(true);
  }, [filteredContacts, showDetailModal, targetApplicantUserId]);

  const stats = useMemo(() => {
    const total = jobScopedContacts.length;
    const interested = jobScopedContacts.filter((contact) => contact.status === 'interested').length;
    const confirmed = jobScopedContacts.filter((contact) => contact.status === 'confirmed').length;
    const cancelled = jobScopedContacts.filter((contact) => contact.status === 'cancelled').length;

    return { total, interested, confirmed, cancelled };
  }, [jobScopedContacts]);

  const focusedJob = useMemo(() => {
    if (!targetJobId) return null;
    return jobScopedContacts.find((contact) => contact.jobId === targetJobId)?.job || null;
  }, [jobScopedContacts, targetJobId]);

  const groupedSections = useMemo<ApplicantSection[]>(() => {
    const sectionsMap = new Map<string, ApplicantSection>();

    filteredContacts.forEach((contact) => {
      const sectionKey = contact.jobId || contact.id;
      const existing = sectionsMap.get(sectionKey);

      if (!existing) {
        sectionsMap.set(sectionKey, {
          key: sectionKey,
          title: contact.job?.title || t('applicants.card.untitledJob'),
          job: contact.job,
          data: [contact],
          stats: {
            total: 1,
            interested: contact.status === 'interested' ? 1 : 0,
            confirmed: contact.status === 'confirmed' ? 1 : 0,
            cancelled: contact.status === 'cancelled' ? 1 : 0,
          },
          lastContactedAt: contact.contactedAt,
        });
        return;
      }

      existing.data.push(contact);
      existing.stats.total += 1;
      if (contact.status === 'interested') existing.stats.interested += 1;
      if (contact.status === 'confirmed') existing.stats.confirmed += 1;
      if (contact.status === 'cancelled') existing.stats.cancelled += 1;
      if (contact.contactedAt.getTime() > existing.lastContactedAt.getTime()) {
        existing.lastContactedAt = contact.contactedAt;
      }
      if (!existing.job && contact.job) {
        existing.job = contact.job;
      }
    });

    return Array.from(sectionsMap.values()).sort(
      (left, right) => right.lastContactedAt.getTime() - left.lastContactedAt.getTime(),
    );
  }, [filteredContacts, t]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadApplicants();
  };

  const handleStatusChange = async (status: ContactStatus) => {
    if (!selectedContact) return;

    try {
      setStatusUpdating(true);
      await updateApplicationStatus(selectedContact.id, status, user?.displayName);
      setContacts((prev) => prev.map((contact) => (
        contact.id === selectedContact.id ? { ...contact, status } : contact
      )));
      setSelectedContact((prev) => prev ? { ...prev, status } : prev);
      setAlert(createAlert.success(t('applicants.alerts.updatedTitle'), statusMeta[status].label) as AlertState);
    } catch (error) {
      console.error('Error updating applicant status:', error);
      setAlert(createAlert.error(t('applicants.alerts.updateFailedTitle'), t('applicants.alerts.updateFailedMessage')) as AlertState);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCompleteJob = () => {
    if (!selectedContact || isCompletingJob) return;

    const applicantName = getApplicantName(selectedContact);
    const jobTitle = selectedContact.job?.title || t('applicants.card.untitledJob');

    Alert.alert(
      t('applicants.completeJob.title'),
      t('applicants.completeJob.message', { jobTitle, applicantName }),
      [
        { text: t('common.actions.cancel'), style: 'cancel' },
        {
          text: t('applicants.completeJob.confirm'),
          onPress: async () => {
            try {
              setIsCompletingJob(true);
              const result = await completeJobAssignment(selectedContact.jobId, selectedContact.id);
              await loadApplicants();
              setShowDetailModal(false);
              navigation.navigate('Reviews', {
                targetUserId: result.targetUserId,
                targetName: result.targetUserName || applicantName,
                completionId: result.completionId,
                relatedJobId: result.jobId,
              });
            } catch (error: any) {
              console.error('Error completing job:', error);
              Alert.alert(t('applicants.completeJob.failedTitle'), error?.message || t('applicants.completeJob.failedMessage'));
            } finally {
              setIsCompletingJob(false);
            }
          },
        },
      ],
    );
  };

  const handleCall = async (phone?: string) => {
    if (!phone) {
      setAlert(createAlert.warning(t('applicants.alerts.noPhoneTitle'), t('applicants.alerts.noPhoneMessage')) as AlertState);
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      setAlert(createAlert.error(t('applicants.alerts.callFailedTitle'), t('applicants.alerts.callFailedMessage')) as AlertState);
    }
  };

  const openApplicantDetail = (contact: ApplicantDetails) => {
    setSelectedContact(contact);
    setShowDetailModal(true);
  };

  const navigateToApplicantProfile = () => {
    if (!selectedContact) return;
    setShowDetailModal(false);
    navigation.navigate('UserProfile', {
      userId: selectedContact.userId,
      userName: selectedContact.userName || selectedContact.userProfile?.displayName,
      userPhoto: selectedContact.userProfile?.photoURL,
    });
  };

  const handleStartChat = async () => {
    if (!selectedContact || !user?.uid || isStartingChat) return;

    const contact = selectedContact;
    const recipientName = getApplicantName(contact);

    try {
      setIsStartingChat(true);
      const chatUsage = await getFeatureUsageStatus(user.uid, 'chat_start');
      if (!chatUsage.canUse) {
        setAlert(
          createAlert.info(
            t('applicants.alerts.chatQuotaTitle'),
            chatUsage.reason || t('applicants.alerts.chatQuotaMessage'),
          ) as AlertState,
        );
        return;
      }

      const { conversationId, created } = await getOrCreateConversationWithStatus(
        user.uid,
        user.displayName || t('applicants.card.unnamed'),
        contact.userId,
        recipientName,
        contact.jobId,
        contact.job?.title,
        user.displayName || t('applicants.card.unnamed'),
      );
      if (created && chatUsage.limit != null) {
        await consumeFeatureUsage(user.uid, 'chat_start');
      }

      setShowDetailModal(false);
      navigation.navigate('ChatRoom', {
        conversationId,
        recipientId: contact.userId,
        recipientName,
        recipientPhoto: contact.userProfile?.photoURL,
        jobTitle: contact.job?.title,
        jobId: contact.jobId,
      });
    } catch (error) {
      console.error('Error starting chat with applicant:', error);
      setAlert(createAlert.error(t('applicants.alerts.chatFailedTitle'), t('applicants.alerts.chatFailedMessage')) as AlertState);
    } finally {
      setIsStartingChat(false);
    }
  };

  const renderStatCard = (label: string, value: number, icon: keyof typeof Ionicons.glyphMap, tone: { background: string; text: string }) => (
    <View style={[styles.statCard, { backgroundColor: tone.background }]}> 
      <View style={[styles.statIconWrap, { backgroundColor: tone.text }]}> 
        <Ionicons name={icon} size={16} color={colors.white} />
      </View>
      <Text style={[styles.statValue, { color: tone.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tone.text }]}>{label}</Text>
    </View>
  );

  const renderCollectionHeader = () => (
    <View style={styles.listHeader}> 
      <View style={[styles.heroCard, { backgroundColor: heroBackground }]}> 
        <Text style={[styles.heroEyebrow, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.8)' }]}>
          {t('applicants.hero.eyebrow')}
        </Text>
        <Text style={[styles.heroTitle, { color: colors.white }]}> 
          {focusedJob?.title || t('applicants.hero.titleFallback')}
        </Text>
        <Text style={[styles.heroSubtitle, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.88)' }]}>
          {targetJobId
            ? t('applicants.hero.jobScopedCount', { count: stats.total })
            : t('applicants.hero.allCount', { count: stats.total })}
        </Text>

        <View style={styles.heroStatsRow}> 
          {renderStatCard(t('applicants.hero.waiting'), stats.interested, 'sparkles-outline', { background: 'rgba(255,255,255,0.14)', text: colors.white })}
          {renderStatCard(t('applicants.hero.confirmed'), stats.confirmed, 'checkmark-circle-outline', { background: 'rgba(255,255,255,0.14)', text: colors.white })}
          {renderStatCard(t('applicants.hero.cancelled'), stats.cancelled, 'close-circle-outline', { background: 'rgba(255,255,255,0.14)', text: colors.white })}
        </View>
      </View>

      <View style={[styles.toolsCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
        <View style={[styles.searchWrap, { backgroundColor: mutedCard, borderColor: colors.border }]}> 
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('applicants.filters.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.viewModeRow, { backgroundColor: mutedCard, borderColor: colors.border }]}> 
          <TouchableOpacity
            style={[
              styles.viewModeTab,
              { backgroundColor: viewMode === 'all' ? colors.surface : 'transparent' },
            ]}
            activeOpacity={0.85}
            onPress={() => setViewMode('all')}
          >
            <Ionicons name="list-outline" size={16} color={viewMode === 'all' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.viewModeTabText, { color: viewMode === 'all' ? colors.primary : colors.textSecondary }]}>ทั้งหมด</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeTab,
              { backgroundColor: viewMode === 'byPost' ? colors.surface : 'transparent' },
            ]}
            activeOpacity={0.85}
            onPress={() => setViewMode('byPost')}
          >
            <Ionicons name="albums-outline" size={16} color={viewMode === 'byPost' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.viewModeTabText, { color: viewMode === 'byPost' ? colors.primary : colors.textSecondary }]}>ตามโพสต์</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}> 
          <Chip label={t('applicants.filters.all', { count: stats.total })} selected={selectedFilter === 'all'} onPress={() => setSelectedFilter('all')} />
          <Chip label={t('applicants.filters.interested', { count: stats.interested })} selected={selectedFilter === 'interested'} onPress={() => setSelectedFilter('interested')} />
          <Chip label={t('applicants.filters.confirmed', { count: stats.confirmed })} selected={selectedFilter === 'confirmed'} onPress={() => setSelectedFilter('confirmed')} />
          <Chip label={t('applicants.filters.cancelled', { count: stats.cancelled })} selected={selectedFilter === 'cancelled'} onPress={() => setSelectedFilter('cancelled')} />
        </ScrollView>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }: { section: ApplicantSection }) => (
    <View style={styles.sectionHeaderWrap}>
      <View style={[styles.sectionHeaderCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
        <View style={styles.sectionHeaderTopRow}>
          <View style={styles.sectionHeaderTitleWrap}>
            <Text style={[styles.sectionHeaderTitle, { color: colors.text }]} numberOfLines={1}>{section.title}</Text>
            <Text style={[styles.sectionHeaderSubtitle, { color: colors.textSecondary }]}>
              ผู้สมัคร {section.stats.total} คน • อัปเดตล่าสุด {formatRelativeTime(section.lastContactedAt)}
            </Text>
          </View>
          <View style={[styles.inlineBadge, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name="briefcase-outline" size={12} color={colors.primary} />
            <Text style={[styles.inlineBadgeText, { color: colors.primary }]} numberOfLines={1}>
              {section.job?.department || 'โพสต์งาน'}
            </Text>
          </View>
        </View>

        <View style={styles.sectionMetaRow}>
          <View style={[styles.sectionMetaPill, { backgroundColor: mutedCard }]}> 
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={[styles.sectionMetaPillText, { color: colors.textSecondary }]}> 
              {section.job?.shiftDate ? formatDate(section.job.shiftDate) : t('applicants.card.unspecifiedDate')}
            </Text>
          </View>
          <View style={[styles.sectionMetaPill, { backgroundColor: mutedCard }]}> 
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.sectionMetaPillText, { color: colors.textSecondary }]}> 
              {section.job?.shiftTime || t('applicants.card.unspecifiedTime')}
            </Text>
          </View>
          <View style={[styles.sectionMetaPill, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name="cash-outline" size={14} color={colors.primary} />
            <Text style={[styles.sectionMetaPillText, { color: colors.primary }]}>฿{section.job?.shiftRate?.toLocaleString?.() || 0}</Text>
          </View>
        </View>

        <View style={styles.sectionStatsRow}>
          <View style={[styles.sectionStatChip, { backgroundColor: colors.warningLight }]}> 
            <Text style={[styles.sectionStatChipText, { color: colors.warning }]}>รอ {section.stats.interested}</Text>
          </View>
          <View style={[styles.sectionStatChip, { backgroundColor: colors.successLight }]}> 
            <Text style={[styles.sectionStatChipText, { color: colors.success }]}>ยืนยัน {section.stats.confirmed}</Text>
          </View>
          <View style={[styles.sectionStatChip, { backgroundColor: colors.errorLight }]}> 
            <Text style={[styles.sectionStatChipText, { color: colors.error }]}>ยกเลิก {section.stats.cancelled}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderApplicantCard = ({ item }: { item: ApplicantDetails }) => {
    const status = item.status || 'interested';
    const statusTone = getStatusTone(status);
    const phone = item.userPhone || item.userProfile?.phone;
    const name = getApplicantName(item);
    const skillPreview = item.userProfile?.skills?.slice(0, 3) || [];
    const province = getApplicantProvince(item);
    const roleText = getApplicantRoleText(item);
    const roleTone = getRoleTagColors(item.userProfile?.role);
    const verificationText = getVerificationTagText({
      isVerified: item.userProfile?.isVerified,
      role: item.userProfile?.role,
      orgType: item.userProfile?.orgType,
      staffType: item.userProfile?.staffType,
    });
    const roleHighlights = getRoleSpecificHighlights(item);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openApplicantDetail(item)}
        style={[styles.applicantCard, { backgroundColor: cardBackground, borderColor: colors.border }]}
      >
        <View style={styles.applicantHeader}> 
          <View style={styles.applicantIdentity}> 
            <Avatar uri={item.userProfile?.photoURL} name={name} size={62} />
            <View style={styles.applicantIdentityText}> 
              <View style={styles.nameRow}> 
                <Text style={[styles.applicantName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                {verificationText ? (
                  <View style={[styles.miniBadge, { backgroundColor: colors.successLight }]}> 
                    <Ionicons name="ribbon-outline" size={12} color={colors.success} />
                  </View>
                ) : null}
              </View>
              <View style={styles.identityBadgesRow}>
                <View style={[styles.inlineBadge, { backgroundColor: roleTone.backgroundColor }]}> 
                  <Ionicons name={getRoleIconName(item.userProfile?.role)} size={12} color={roleTone.textColor} />
                  <Text style={[styles.inlineBadgeText, { color: roleTone.textColor }]} numberOfLines={1}>{roleText}</Text>
                </View>
                {province ? (
                  <View style={[styles.inlineBadge, { backgroundColor: mutedCard }]}> 
                    <Ionicons name="location-outline" size={12} color={colors.primary} />
                    <Text style={[styles.inlineBadgeText, { color: colors.primary }]} numberOfLines={1}>{province}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.applicantMetaStrong, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.job?.title || t('applicants.card.untitledJob')}
              </Text>
              <Text style={[styles.applicantMeta, { color: colors.textMuted }]}>{t('applicants.card.contactedAt', { time: formatRelativeTime(item.contactedAt) })}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.statusPill, { backgroundColor: statusTone.background, borderColor: statusTone.border }]}
            onPress={() => openApplicantDetail(item)}
          >
            <Ionicons name={statusMeta[status].icon} size={13} color={statusTone.text} />
            <Text style={[styles.statusPillText, { color: statusTone.text }]}>{statusMeta[status].label}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardMetricsRow}> 
          <View style={[styles.metricBox, { backgroundColor: mutedCard }]}> 
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={[styles.metricText, { color: colors.textSecondary }]}>{item.job?.shiftDate ? formatDate(item.job.shiftDate) : t('applicants.card.unspecifiedDate')}</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: mutedCard }]}> 
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.metricText, { color: colors.textSecondary }]}>{item.job?.shiftTime || t('applicants.card.unspecifiedTime')}</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: colors.primaryBackground }]}> 
            <Ionicons name="cash-outline" size={14} color={colors.primary} />
            <Text style={[styles.metricText, { color: colors.primary }]}>฿{item.job?.shiftRate?.toLocaleString?.() || 0}</Text>
          </View>
        </View>

        {roleHighlights.length > 0 ? (
          <View style={styles.roleHighlightsRow}>
            {roleHighlights.map((label) => (
              <View key={label} style={[styles.subtleTag, { backgroundColor: elevatedCard, borderColor: colors.border }]}> 
                <Text style={[styles.subtleTagText, { color: colors.textSecondary }]}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.message ? (
          <View style={[styles.messageCard, { backgroundColor: heroSubtle }]}> 
            <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>{t('applicants.card.applicantMessage')}</Text>
            <Text style={[styles.messageBody, { color: colors.text }]} numberOfLines={2}>{item.message}</Text>
          </View>
        ) : null}

        <View style={styles.secondaryInfoRow}> 
          {item.userProfile?.experience ? (
            <View style={styles.inlineInfo}> 
              <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.inlineInfoText, { color: colors.textSecondary }]}>{t('applicants.card.yearExperience', { count: item.userProfile.experience })}</Text>
            </View>
          ) : null}
          {phone ? (
            <View style={styles.inlineInfo}> 
              <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.inlineInfoText, { color: colors.textSecondary }]} numberOfLines={1}>{phone}</Text>
            </View>
          ) : null}
        </View>

        {skillPreview.length > 0 ? (
          <View style={styles.skillsRow}> 
            {skillPreview.map((skill) => (
              <View key={skill} style={[styles.skillTag, { backgroundColor: colors.primaryBackground }]}> 
                <Text style={[styles.skillTagText, { color: colors.primary }]}>{skill}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.cardActions, { borderTopColor: colors.border }]}> 
          <TouchableOpacity style={[styles.secondaryAction, { backgroundColor: mutedCard }]} onPress={() => openApplicantDetail(item)}>
            <Ionicons name="eye-outline" size={16} color={colors.primary} />
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>{t('applicants.card.viewDetails')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: phone ? colors.success : colors.border }]} onPress={() => handleCall(phone)} disabled={!phone}>
            <Ionicons name="call-outline" size={16} color={colors.white} />
            <Text style={styles.primaryActionText}>{t('applicants.card.call')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: pageBackground }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'light-content'} backgroundColor={headerSurface} />
        <View style={[styles.screenHeader, { backgroundColor: headerSurface, borderBottomColor: isDark ? colors.border : 'transparent', paddingTop: insets.top + SPACING.sm }]}>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: headerButton }]} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.white }]}>{t('applicants.header.title')}</Text>
            <Text style={[styles.headerSubtitle, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.82)' }]}>{t('applicants.header.loadingSubtitle')}</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <Loading message={t('applicants.header.loadingMessage')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBackground }]} edges={['left', 'right', 'bottom']}> 
      <StatusBar
        barStyle={showDetailModal ? (isDark ? 'light-content' : 'dark-content') : 'light-content'}
        backgroundColor={showDetailModal ? pageBackground : headerSurface}
      />
      <View style={[styles.screenHeader, { backgroundColor: headerSurface, borderBottomColor: isDark ? colors.border : 'transparent', paddingTop: insets.top + SPACING.sm }]}> 
        <TouchableOpacity style={[styles.backButton, { backgroundColor: headerButton }]} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={colors.white} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.headerTitle, { color: colors.white }]}>{t('applicants.header.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.82)' }]}>
            {targetJobId ? t('applicants.header.jobScopedSubtitle') : t('applicants.header.allSubtitle')}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      {viewMode === 'all' ? (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={renderApplicantCard}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={renderCollectionHeader}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title={searchQuery ? t('applicants.empty.searchTitle') : t('applicants.empty.defaultTitle')}
              subtitle={
                searchQuery
                  ? t('applicants.empty.searchSubtitle')
                  : targetJobId
                    ? t('applicants.empty.jobScopedSubtitle')
                    : t('applicants.empty.allSubtitle')
              }
            />
          }
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, SPACING.lg) + 120 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => item.id}
          renderItem={renderApplicantCard}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={renderCollectionHeader}
          ListEmptyComponent={
            <EmptyState
              icon="albums-outline"
              title={searchQuery ? t('applicants.empty.searchTitle') : t('applicants.empty.defaultTitle')}
              subtitle={
                searchQuery
                  ? t('applicants.empty.searchSubtitle')
                  : targetJobId
                    ? t('applicants.empty.jobScopedSubtitle')
                    : t('applicants.empty.allSubtitle')
              }
            />
          }
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, SPACING.lg) + 120 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ModalContainer
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={t('applicants.modal.title')}
        fullScreen
      >
        {selectedContact ? (() => {
          const profile = selectedContact.userProfile;
          const phone = selectedContact.userPhone || profile?.phone;
          const status = selectedContact.status || 'interested';
          const statusTone = getStatusTone(status);
          const name = getApplicantName(selectedContact);
          const roleTone = getRoleTagColors(profile?.role);
          const roleText = getApplicantRoleText(selectedContact);
          const verificationText = getVerificationTagText({
            isVerified: profile?.isVerified,
            role: profile?.role,
            orgType: profile?.orgType,
            staffType: profile?.staffType,
          });
          const staffTypeLabels = getThaiLabels(profile?.staffTypes || (profile?.staffType ? [profile.staffType] : []), getStaffTypeThaiLabel);
          const workStyleLabels = getThaiLabels(profile?.workStyle || [], getWorkStyleThaiLabel);
          const interestedStaffLabels = getThaiLabels(profile?.interestedStaffTypes || [], getStaffTypeThaiLabel);
          const careLabels = getThaiLabels((profile?.careNeeds || profile?.careTypes || []), getCareTypeThaiLabel);
          const province = profile?.preferredProvince || profile?.location?.province;
          const district = profile?.location?.district;

          return (
            <View style={styles.detailModalLayout}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ width: '100%' }}
                contentContainerStyle={{ padding: SPACING.md, paddingBottom: Math.max(insets.bottom, SPACING.lg) + 120 }}
              >
                <View style={[styles.detailHeroCard, { backgroundColor: elevatedCard, borderColor: colors.border }]}> 
                  <Avatar uri={profile?.photoURL} name={name} size={88} />
                  <Text style={[styles.detailName, { color: colors.text }]}>{name}</Text>
                  <View style={styles.detailHeroBadges}> 
                    <View style={[styles.inlineBadge, { backgroundColor: roleTone.backgroundColor }]}> 
                      <Ionicons name={getRoleIconName(profile?.role)} size={13} color={roleTone.textColor} />
                      <Text style={[styles.inlineBadgeText, { color: roleTone.textColor }]}>{roleText}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: statusTone.background, borderColor: statusTone.border }]}> 
                      <Ionicons name={statusMeta[status].icon} size={14} color={statusTone.text} />
                      <Text style={[styles.statusPillText, { color: statusTone.text }]}>{statusMeta[status].label}</Text>
                    </View>
                    {verificationText ? (
                      <View style={[styles.inlineBadge, { backgroundColor: colors.successLight }]}> 
                        <Ionicons name="shield-checkmark-outline" size={13} color={colors.success} />
                        <Text style={[styles.inlineBadgeText, { color: colors.success }]}>{verificationText}</Text>
                      </View>
                    ) : null}
                  </View>
                  {(province || district) ? (
                    <Text style={[styles.detailHeroMeta, { color: colors.textSecondary }]}> 
                      {district ? `${district}, ${province}` : province}
                    </Text>
                  ) : null}
                </View>

                <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                  {[
                    { icon: 'briefcase-outline', label: t('applicants.rows.jobTitle'), value: selectedContact.job?.title || '-' },
                    { icon: 'calendar-outline', label: t('applicants.rows.shiftDate'), value: selectedContact.job?.shiftDate ? formatDate(selectedContact.job.shiftDate) : '-' },
                    { icon: 'time-outline', label: t('applicants.rows.time'), value: selectedContact.job?.shiftTime || '-' },
                    { icon: 'cash-outline', label: t('applicants.rows.compensation'), value: `฿${selectedContact.job?.shiftRate?.toLocaleString?.() || 0}` },
                    { icon: 'call-outline', label: t('applicants.rows.phone'), value: phone || '-' },
                    { icon: 'mail-outline', label: t('applicants.rows.email'), value: profile?.email || '-' },
                    { icon: 'ribbon-outline', label: t('applicants.rows.license'), value: profile?.licenseNumber || t('applicants.rows.licenseMissing') },
                    { icon: 'briefcase-outline', label: t('applicants.rows.experience'), value: profile?.experience ? t('applicants.rows.experienceYears', { count: profile.experience }) : t('applicants.rows.experienceMissing') },
                  ].map((row, index) => (
                    <View key={`${row.label}-${index}`} style={[styles.detailRow, index > 0 && { borderTopColor: colors.border }]}> 
                      <View style={styles.detailRowLabelWrap}> 
                        <Ionicons name={row.icon as any} size={16} color={colors.primary} />
                        <Text style={[styles.detailRowLabel, { color: colors.textSecondary }]}>{row.label}</Text>
                      </View>
                      <Text style={[styles.detailRowValue, { color: colors.text }]}>{row.value}</Text>
                    </View>
                  ))}
                </View>

                {profile ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>{t('applicants.modal.profileSection')}</Text>
                    <View style={styles.roleDetailGrid}> 
                      {profile.role === 'nurse' ? (
                        <>
                          {staffTypeLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>{t('applicants.rows.profession')}</Text>
                              <View style={styles.skillsRow}>
                                {staffTypeLabels.map((label) => (
                                  <View key={label} style={[styles.subtleTag, { backgroundColor: elevatedCard, borderColor: colors.border }]}> 
                                    <Text style={[styles.subtleTagText, { color: colors.text }]}>{label}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ) : null}
                          {workStyleLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>{t('applicants.rows.workStyle')}</Text>
                              <View style={styles.skillsRow}>
                                {workStyleLabels.map((label) => (
                                  <View key={label} style={[styles.subtleTag, { backgroundColor: elevatedCard, borderColor: colors.border }]}> 
                                    <Text style={[styles.subtleTagText, { color: colors.text }]}>{label}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ) : null}
                        </>
                      ) : null}

                      {profile.role === 'hospital' ? (
                        <>
                          {profile.orgType ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>{t('applicants.rows.organizationType')}</Text>
                              <Text style={[styles.roleDetailValue, { color: colors.text }]}>{getOrgTypeThaiLabel(profile.orgType)}</Text>
                            </View>
                          ) : null}
                          {interestedStaffLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>{t('applicants.rows.staffNeeded')}</Text>
                              <View style={styles.skillsRow}>
                                {interestedStaffLabels.map((label) => (
                                  <View key={label} style={[styles.subtleTag, { backgroundColor: elevatedCard, borderColor: colors.border }]}> 
                                    <Text style={[styles.subtleTagText, { color: colors.text }]}>{label}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ) : null}
                          {profile.hiringUrgency ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>{t('applicants.rows.urgency')}</Text>
                              <Text style={[styles.roleDetailValue, { color: colors.text }]}>{getHiringUrgencyThaiLabel(profile.hiringUrgency)}</Text>
                            </View>
                          ) : null}
                        </>
                      ) : null}

                      {profile.role === 'user' ? (
                        <>
                          {careLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>{t('applicants.rows.careNeeds')}</Text>
                              <View style={styles.skillsRow}>
                                {careLabels.map((label) => (
                                  <View key={label} style={[styles.subtleTag, { backgroundColor: elevatedCard, borderColor: colors.border }]}> 
                                    <Text style={[styles.subtleTagText, { color: colors.text }]}>{label}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {selectedContact.message ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: heroSubtle, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.primary }]}>{t('applicants.modal.applicantMessage')}</Text>
                    <Text style={[styles.detailBoxBody, { color: colors.text }]}>{selectedContact.message}</Text>
                  </View>
                ) : null}

                {profile?.bio ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>{t('applicants.modal.aboutApplicant')}</Text>
                    <Text style={[styles.detailBoxBody, { color: colors.textSecondary }]}>{profile.bio}</Text>
                  </View>
                ) : null}

                {profile?.skills && profile.skills.length > 0 ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>{t('applicants.modal.skills')}</Text>
                    <View style={styles.skillsRow}> 
                      {profile.skills.map((skill) => (
                        <View key={skill} style={[styles.skillTag, { backgroundColor: colors.primaryBackground }]}> 
                          <Text style={[styles.skillTagText, { color: colors.primary }]}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Action buttons based on current status */}
                {selectedContact.job?.status !== 'closed' && (
                <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                  <Text style={[styles.detailBoxTitle, { color: colors.text }]}>{t('applicants.modal.manageApplicant')}</Text>

                  {status === 'interested' && (
                    <View style={styles.statusOptionWrap}>
                      <TouchableOpacity
                        style={[styles.statusOptionBtn, { backgroundColor: colors.primary, borderColor: colors.primary, flex: 1, opacity: statusUpdating ? 0.6 : 1 }]}
                        disabled={statusUpdating}
                        onPress={() => handleStatusChange('confirmed')}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color={colors.white} />
                        <Text style={[styles.statusOptionBtnText, { color: colors.white }]}>{t('applicants.actions.selectThis')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.statusOptionBtn, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, opacity: statusUpdating ? 0.6 : 1 }]}
                        disabled={statusUpdating}
                        onPress={() => handleStatusChange('cancelled')}
                      >
                        <Ionicons name="close-circle-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.statusOptionBtnText, { color: colors.textSecondary }]}>{t('applicants.actions.reject')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {status === 'confirmed' && (
                    <View>
                      <View style={[styles.statusBadgeRow, { backgroundColor: '#E8F5E9', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm }]}>
                        <Ionicons name="checkmark-circle" size={18} color="#2E7D32" />
                        <Text style={{ color: '#2E7D32', fontWeight: '600', marginLeft: SPACING.xs }}>{t('applicants.actions.selectedHint')}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.statusOptionBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: statusUpdating ? 0.6 : 1 }]}
                        disabled={statusUpdating}
                        onPress={() => handleStatusChange('interested')}
                      >
                        <Ionicons name="arrow-undo-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.statusOptionBtnText, { color: colors.textSecondary }]}>{t('applicants.actions.undoSelection')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {status === 'cancelled' && (
                    <View>
                      <View style={[styles.statusBadgeRow, { backgroundColor: '#FFEBEE', borderRadius: BORDER_RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm }]}>
                        <Ionicons name="close-circle" size={18} color="#C62828" />
                        <Text style={{ color: '#C62828', fontWeight: '600', marginLeft: SPACING.xs }}>{t('applicants.actions.rejected')}</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.statusOptionBtn, { backgroundColor: colors.surface, borderColor: colors.border, opacity: statusUpdating ? 0.6 : 1 }]}
                        disabled={statusUpdating}
                        onPress={() => handleStatusChange('interested')}
                      >
                        <Ionicons name="arrow-undo-outline" size={16} color={colors.textSecondary} />
                        <Text style={[styles.statusOptionBtnText, { color: colors.textSecondary }]}>{t('applicants.actions.reconsider')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                )}

                {selectedContact.job?.status !== 'closed' && status === 'confirmed' ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>{t('applicants.modal.completeReviewTitle')}</Text>
                    <Text style={[styles.detailBoxBody, { color: colors.textSecondary }]}>{t('applicants.modal.completeReviewBody')}</Text>
                    <TouchableOpacity
                      style={[
                        styles.primaryAction,
                        { backgroundColor: isCompletingJob ? colors.border : colors.primary, marginTop: SPACING.md }
                      ]}
                      onPress={handleCompleteJob}
                      disabled={isCompletingJob}
                    >
                      <Ionicons name="checkmark-done-outline" size={18} color={colors.white} />
                      <Text style={styles.primaryActionText}>{isCompletingJob ? t('applicants.actions.completing') : t('applicants.actions.completeReview')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </ScrollView>

              <View style={[styles.detailFooterBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}> 
                <TouchableOpacity
                  style={[styles.detailSecondaryAction, { backgroundColor: mutedCard, borderColor: colors.border }]}
                  onPress={navigateToApplicantProfile}
                >
                  <Ionicons name="person-outline" size={16} color={colors.primary} />
                  <Text style={[styles.detailSecondaryActionText, { color: colors.primary }]}>{t('applicants.modal.profile')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailChatAction, { backgroundColor: isStartingChat ? colors.border : colors.primary }]}
                  onPress={handleStartChat}
                  disabled={isStartingChat}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.white} />
                  <Text style={styles.detailPrimaryActionText}>{t('applicants.modal.chat')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailPrimaryAction, { backgroundColor: phone ? colors.success : colors.border }]}
                  onPress={() => handleCall(phone)}
                  disabled={!phone}
                >
                  <Ionicons name="call-outline" size={16} color={colors.white} />
                  <Text style={styles.detailPrimaryActionText}>{t('applicants.modal.call')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })() : null}
      </ModalContainer>

      <CustomAlert {...alert} onClose={() => setAlert(initialAlertState)} />
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },
  headerSpacer: {
    width: 42,
  },
  listHeader: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.lg,
  },
  heroCard: {
    borderRadius: 30,
    padding: SPACING.xl,
    ...SHADOWS.md,
  },
  heroEyebrow: {
    fontSize: FONT_SIZES.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: '800',
    lineHeight: 38,
  },
  heroSubtitle: {
    fontSize: FONT_SIZES.md,
    marginTop: 8,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    padding: SPACING.md,
    minHeight: 104,
  },
  statIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    marginTop: 4,
    opacity: 0.92,
  },
  toolsCard: {
    borderRadius: 26,
    padding: SPACING.lg,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    marginLeft: 8,
    paddingVertical: 0,
  },
  viewModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 4,
    marginTop: SPACING.md,
    gap: 4,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  viewModeTabText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  filterRow: {
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    paddingBottom: 2,
  },
  sectionHeaderWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  sectionHeaderCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  sectionHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  sectionHeaderTitleWrap: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
  },
  sectionHeaderSubtitle: {
    fontSize: FONT_SIZES.sm,
    marginTop: 4,
  },
  sectionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  sectionMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sectionMetaPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  sectionStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  sectionStatChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sectionStatChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
  },
  applicantCard: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 28,
    padding: SPACING.lg,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  applicantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  applicantIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  applicantIdentityText: {
    flex: 1,
    marginLeft: SPACING.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  applicantName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    flexShrink: 1,
  },
  identityBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: 7,
  },
  inlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineBadgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    maxWidth: 160,
  },
  applicantMetaStrong: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    marginTop: 8,
  },
  applicantMeta: {
    fontSize: FONT_SIZES.sm,
    marginTop: 4,
  },
  miniBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusPillText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  cardMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  metricBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  messageCard: {
    borderRadius: 18,
    padding: SPACING.md,
    marginTop: SPACING.lg,
  },
  messageLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageBody: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  secondaryInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  roleHighlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  subtleTag: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
  },
  subtleTagText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  inlineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  inlineInfoText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  skillTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skillTagText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 12,
  },
  secondaryActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 12,
  },
  primaryActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
  detailHero: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    gap: 8,
  },
  detailModalLayout: {
    flex: 1,
  },
  detailHeroCard: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderRadius: 24,
    marginBottom: SPACING.md,
  },
  detailName: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  detailHeroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  detailHeroMeta: {
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  detailSectionCard: {
    borderRadius: 22,
    padding: SPACING.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  detailRowLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailRowLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  detailRowValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  detailBoxTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '800',
    marginBottom: 10,
  },
  detailBoxBody: {
    fontSize: FONT_SIZES.sm,
    lineHeight: 22,
  },
  roleDetailGrid: {
    gap: SPACING.md,
  },
  roleDetailBlock: {
    gap: SPACING.xs,
  },
  roleDetailLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  roleDetailValue: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  statusOptionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statusOptionBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  detailActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  detailFooterBar: {
    flexDirection: 'row',
    gap: SPACING.sm,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
  },
  detailSecondaryAction: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
  },
  detailSecondaryActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  detailPrimaryAction: {
    flex: 1.2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 13,
  },
  detailChatAction: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    paddingVertical: 13,
  },
  detailPrimaryActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.white,
  },
});