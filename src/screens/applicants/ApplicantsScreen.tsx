// ============================================
// APPLICANTS SCREEN - จัดการผู้สมัคร / ผู้สนใจงาน
// ============================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ScrollView,
  TextInput,
  StatusBar,
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
import { getOrCreateConversation } from '../../services/chatService';
import { formatDate, formatRelativeTime } from '../../utils/helpers';
import {
  getCareTypeThaiLabel,
  getHiringUrgencyThaiLabel,
  getOrgTypeThaiLabel,
  getStaffTypeThaiLabel,
  getThaiLabels,
  getWorkStyleThaiLabel,
} from '../../utils/profileLabels';
import { getRoleIconName, getRoleLabel, getRoleTagColors, getVerificationTagText } from '../../utils/verificationTag';

type ApplicantsRouteParams = {
  jobId?: string;
};

const STATUS_META: Record<ContactStatus, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  interested: { label: 'สนใจ', icon: 'sparkles-outline' },
  confirmed: { label: 'ยืนยันแล้ว', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'ยกเลิก', icon: 'close-circle-outline' },
};

export default function ApplicantsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const routeParams = (route.params || {}) as ApplicantsRouteParams;
  const targetJobId = routeParams.jobId;

  const [contacts, setContacts] = useState<ApplicantDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<ContactStatus | 'all'>('all');
  const [selectedContact, setSelectedContact] = useState<ApplicantDetails | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
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
    return fullName || contact.userName || profile?.displayName || 'ไม่ระบุชื่อ';
  }, []);

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
      setAlert(createAlert.error('โหลดข้อมูลไม่สำเร็จ', 'ไม่สามารถดึงข้อมูลผู้สมัครได้ กรุณาลองใหม่') as AlertState);
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
      setAlert(createAlert.success('อัปเดตแล้ว', `เปลี่ยนสถานะเป็น ${STATUS_META[status].label} เรียบร้อย`) as AlertState);
    } catch (error) {
      console.error('Error updating applicant status:', error);
      setAlert(createAlert.error('อัปเดตไม่สำเร็จ', 'ไม่สามารถเปลี่ยนสถานะผู้สมัครได้') as AlertState);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCall = async (phone?: string) => {
    if (!phone) {
      setAlert(createAlert.warning('ไม่มีเบอร์โทร', 'ผู้สมัครรายนี้ไม่ได้ระบุเบอร์โทรศัพท์') as AlertState);
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      setAlert(createAlert.error('โทรออกไม่ได้', 'อุปกรณ์ไม่สามารถเปิดหน้าการโทรได้') as AlertState);
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
    if (!selectedContact || !user?.uid) return;

    try {
      const recipientName = getApplicantName(selectedContact);
      const conversationId = await getOrCreateConversation(
        user.uid,
        user.displayName || 'ไม่ระบุชื่อ',
        selectedContact.userId,
        recipientName,
        selectedContact.jobId,
        selectedContact.job?.title,
        user.displayName || 'ไม่ระบุชื่อ',
      );

      setShowDetailModal(false);
      navigation.navigate('ChatRoom', {
        conversationId,
        recipientName,
        recipientPhoto: selectedContact.userProfile?.photoURL,
        jobTitle: selectedContact.job?.title,
      });
    } catch (error) {
      console.error('Error starting chat with applicant:', error);
      setAlert(createAlert.error('เริ่มแชตไม่สำเร็จ', 'ไม่สามารถเปิดห้องแชตกับผู้สมัครได้') as AlertState);
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
                {item.job?.title || 'ประกาศงานไม่ระบุชื่อ'}
              </Text>
              <Text style={[styles.applicantMeta, { color: colors.textMuted }]}>ติดต่อเมื่อ {formatRelativeTime(item.contactedAt)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.statusPill, { backgroundColor: statusTone.background, borderColor: statusTone.border }]}
            onPress={() => openApplicantDetail(item)}
          >
            <Ionicons name={STATUS_META[status].icon} size={13} color={statusTone.text} />
            <Text style={[styles.statusPillText, { color: statusTone.text }]}>{STATUS_META[status].label}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cardMetricsRow}> 
          <View style={[styles.metricBox, { backgroundColor: mutedCard }]}> 
            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
            <Text style={[styles.metricText, { color: colors.textSecondary }]}>{item.job?.shiftDate ? formatDate(item.job.shiftDate) : 'ไม่ระบุวันที่'}</Text>
          </View>
          <View style={[styles.metricBox, { backgroundColor: mutedCard }]}> 
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={[styles.metricText, { color: colors.textSecondary }]}>{item.job?.shiftTime || 'ไม่ระบุเวลา'}</Text>
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
            <Text style={[styles.messageLabel, { color: colors.textSecondary }]}>ข้อความจากผู้สมัคร</Text>
            <Text style={[styles.messageBody, { color: colors.text }]} numberOfLines={2}>{item.message}</Text>
          </View>
        ) : null}

        <View style={styles.secondaryInfoRow}> 
          {item.userProfile?.experience ? (
            <View style={styles.inlineInfo}> 
              <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.inlineInfoText, { color: colors.textSecondary }]}>{item.userProfile.experience} ปี</Text>
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
            <Text style={[styles.secondaryActionText, { color: colors.primary }]}>ดูรายละเอียด</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryAction, { backgroundColor: phone ? colors.success : colors.border }]} onPress={() => handleCall(phone)} disabled={!phone}>
            <Ionicons name="call-outline" size={16} color={colors.white} />
            <Text style={styles.primaryActionText}>โทร</Text>
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
            <Text style={[styles.headerTitle, { color: colors.white }]}>จัดการผู้สมัคร</Text>
            <Text style={[styles.headerSubtitle, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.82)' }]}>กำลังโหลดข้อมูลผู้สนใจงาน</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <Loading message="กำลังโหลดผู้สมัคร..." />
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
          <Text style={[styles.headerTitle, { color: colors.white }]}>จัดการผู้สมัคร</Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.82)' }]}>
            {targetJobId ? 'ดูผู้สมัครของประกาศนี้' : 'รวมผู้สมัครทั้งหมดของคุณ'}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>
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
        ListHeaderComponent={
          <View style={styles.listHeader}> 
            <View style={[styles.heroCard, { backgroundColor: heroBackground }]}> 
              <Text style={[styles.heroEyebrow, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.8)' }]}>
                จัดการผู้สมัคร
              </Text>
              <Text style={[styles.heroTitle, { color: colors.white }]}> 
                {focusedJob?.title || 'ผู้สนใจงานของคุณ'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: isDark ? colors.textSecondary : 'rgba(255,255,255,0.88)' }]}>
                {targetJobId
                  ? `ดูผู้สมัครเฉพาะประกาศนี้ ${stats.total} คน`
                  : `รวมผู้สนใจทุกประกาศ ${stats.total} คน`}
              </Text>

              <View style={styles.heroStatsRow}> 
                {renderStatCard('รอคัดเลือก', stats.interested, 'sparkles-outline', { background: 'rgba(255,255,255,0.14)', text: colors.white })}
                {renderStatCard('ยืนยันแล้ว', stats.confirmed, 'checkmark-circle-outline', { background: 'rgba(255,255,255,0.14)', text: colors.white })}
                {renderStatCard('ยกเลิก', stats.cancelled, 'close-circle-outline', { background: 'rgba(255,255,255,0.14)', text: colors.white })}
              </View>
            </View>

            <View style={[styles.toolsCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
              <View style={[styles.searchWrap, { backgroundColor: mutedCard, borderColor: colors.border }]}> 
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="ค้นหาชื่อผู้สมัคร ชื่องาน หรือข้อความ"
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}> 
                <Chip label={`ทั้งหมด ${stats.total}`} selected={selectedFilter === 'all'} onPress={() => setSelectedFilter('all')} />
                <Chip label={`สนใจ ${stats.interested}`} selected={selectedFilter === 'interested'} onPress={() => setSelectedFilter('interested')} />
                <Chip label={`ยืนยันแล้ว ${stats.confirmed}`} selected={selectedFilter === 'confirmed'} onPress={() => setSelectedFilter('confirmed')} />
                <Chip label={`ยกเลิก ${stats.cancelled}`} selected={selectedFilter === 'cancelled'} onPress={() => setSelectedFilter('cancelled')} />
              </ScrollView>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={searchQuery ? 'ไม่พบผู้สมัครที่ค้นหา' : 'ยังไม่มีผู้สมัคร'}
            subtitle={
              searchQuery
                ? 'ลองเปลี่ยนคำค้น หรือสลับสถานะที่กำลังกรอง'
                : targetJobId
                  ? 'เมื่อมีคนสนใจประกาศนี้ รายชื่อจะแสดงที่นี่'
                  : 'เมื่อมีคนสนใจประกาศของคุณ รายชื่อจะแสดงที่นี่'
            }
          />
        }
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, SPACING.lg) + 120 }}
        showsVerticalScrollIndicator={false}
      />

      <ModalContainer
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="รายละเอียดผู้สมัคร"
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
                      <Ionicons name={STATUS_META[status].icon} size={14} color={statusTone.text} />
                      <Text style={[styles.statusPillText, { color: statusTone.text }]}>{STATUS_META[status].label}</Text>
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
                    { icon: 'briefcase-outline', label: 'งานที่สนใจ', value: selectedContact.job?.title || '-' },
                    { icon: 'calendar-outline', label: 'วันที่งาน', value: selectedContact.job?.shiftDate ? formatDate(selectedContact.job.shiftDate) : '-' },
                    { icon: 'time-outline', label: 'เวลา', value: selectedContact.job?.shiftTime || '-' },
                    { icon: 'cash-outline', label: 'ค่าตอบแทน', value: `฿${selectedContact.job?.shiftRate?.toLocaleString?.() || 0}` },
                    { icon: 'call-outline', label: 'เบอร์โทร', value: phone || '-' },
                    { icon: 'mail-outline', label: 'อีเมล', value: profile?.email || '-' },
                    { icon: 'ribbon-outline', label: 'ใบประกอบวิชาชีพ', value: profile?.licenseNumber || 'ยังไม่ระบุ' },
                    { icon: 'briefcase-outline', label: 'ประสบการณ์', value: profile?.experience ? `${profile.experience} ปี` : 'ยังไม่ระบุ' },
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
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>ข้อมูลโปรไฟล์ผู้สมัคร</Text>
                    <View style={styles.roleDetailGrid}> 
                      {profile.role === 'nurse' ? (
                        <>
                          {staffTypeLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>สายงาน / ใบประกอบ</Text>
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
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>รูปแบบงานที่สะดวก</Text>
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
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>ประเภทองค์กร</Text>
                              <Text style={[styles.roleDetailValue, { color: colors.text }]}>{getOrgTypeThaiLabel(profile.orgType)}</Text>
                            </View>
                          ) : null}
                          {interestedStaffLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>กำลังมองหาบุคลากร</Text>
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
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>ความเร่งด่วนในการจ้าง</Text>
                              <Text style={[styles.roleDetailValue, { color: colors.text }]}>{getHiringUrgencyThaiLabel(profile.hiringUrgency)}</Text>
                            </View>
                          ) : null}
                        </>
                      ) : null}

                      {profile.role === 'user' ? (
                        <>
                          {careLabels.length > 0 ? (
                            <View style={styles.roleDetailBlock}> 
                              <Text style={[styles.roleDetailLabel, { color: colors.textSecondary }]}>ประเภทการดูแลที่ต้องการ</Text>
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
                    <Text style={[styles.detailBoxTitle, { color: colors.primary }]}>ข้อความจากผู้สมัคร</Text>
                    <Text style={[styles.detailBoxBody, { color: colors.text }]}>{selectedContact.message}</Text>
                  </View>
                ) : null}

                {profile?.bio ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>เกี่ยวกับผู้สมัคร</Text>
                    <Text style={[styles.detailBoxBody, { color: colors.textSecondary }]}>{profile.bio}</Text>
                  </View>
                ) : null}

                {profile?.skills && profile.skills.length > 0 ? (
                  <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                    <Text style={[styles.detailBoxTitle, { color: colors.text }]}>ทักษะ</Text>
                    <View style={styles.skillsRow}> 
                      {profile.skills.map((skill) => (
                        <View key={skill} style={[styles.skillTag, { backgroundColor: colors.primaryBackground }]}> 
                          <Text style={[styles.skillTagText, { color: colors.primary }]}>{skill}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={[styles.detailSectionCard, { backgroundColor: cardBackground, borderColor: colors.border }]}> 
                  <Text style={[styles.detailBoxTitle, { color: colors.text }]}>อัปเดตสถานะผู้สมัคร</Text>
                  <View style={styles.statusOptionWrap}> 
                    {(Object.keys(STATUS_META) as ContactStatus[]).map((option) => {
                      const optionTone = getStatusTone(option);
                      const selected = status === option;
                      return (
                        <TouchableOpacity
                          key={option}
                          style={[
                            styles.statusOptionBtn,
                            {
                              backgroundColor: selected ? optionTone.border : optionTone.background,
                              borderColor: optionTone.border,
                              opacity: statusUpdating ? 0.6 : 1,
                            },
                          ]}
                          disabled={statusUpdating}
                          onPress={() => handleStatusChange(option)}
                        >
                          <Ionicons name={STATUS_META[option].icon} size={16} color={selected ? colors.white : optionTone.text} />
                          <Text style={[styles.statusOptionBtnText, { color: selected ? colors.white : optionTone.text }]}>{STATUS_META[option].label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              <View style={[styles.detailFooterBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, SPACING.md) }]}> 
                <TouchableOpacity
                  style={[styles.detailSecondaryAction, { backgroundColor: mutedCard, borderColor: colors.border }]}
                  onPress={navigateToApplicantProfile}
                >
                  <Ionicons name="person-outline" size={16} color={colors.primary} />
                  <Text style={[styles.detailSecondaryActionText, { color: colors.primary }]}>โปรไฟล์</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailChatAction, { backgroundColor: colors.primary }]}
                  onPress={handleStartChat}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.white} />
                  <Text style={styles.detailPrimaryActionText}>คุย</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.detailPrimaryAction, { backgroundColor: phone ? colors.success : colors.border }]}
                  onPress={() => handleCall(phone)}
                  disabled={!phone}
                >
                  <Ionicons name="call-outline" size={16} color={colors.white} />
                  <Text style={styles.detailPrimaryActionText}>โทร</Text>
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

const styles = StyleSheet.create({
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
  filterRow: {
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    paddingBottom: 2,
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