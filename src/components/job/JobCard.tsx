// ============================================
// JOB CARD COMPONENT — NurseGo Design System v2
// World-class nurse job marketplace card
// ============================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { JobPost } from '../../types';
import { Avatar } from '../common';
import { SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { formatRelativeTime } from '../../utils/helpers';
import { getStaffTypeLabel } from '../../constants/jobOptions';
import { StaffType } from '../../types';

// ============================================
// Helpers
// ============================================
const formatShiftRate = (rate: number, rateType: string): string => {
  const n = rate?.toLocaleString('th-TH') || '0';
  switch (rateType) {
    case 'hour'  : return `${n} บ./ชม.`;
    case 'day'   : return `${n} บ./วัน`;
    case 'month' : return `${n} บ./เดือน`;
    case 'shift' :
    default      : return `${n} บ./เวร`;
  }
};

const formatShiftDate = (date: Date): string => {
  if (!date) return 'ตามตกลง';
  const d = date instanceof Date ? date : new Date(date as any);
  if (isNaN(d.getTime())) return 'ตามตกลง';
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
};

// ============================================
// Props
// ============================================
interface JobCardProps {
  job: JobPost;
  onPress: () => void;
  onSave?: () => void;
  isSaved?: boolean;
  variant?: 'default' | 'compact';
  showPosterProfile?: boolean;
  style?: ViewStyle;
}

// ============================================
// Component
// ============================================
export function JobCard({
  job,
  onPress,
  onSave,
  isSaved = false,
  variant = 'default',
  showPosterProfile = true,
  style,
}: JobCardProps) {
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();

  const isUrgent = job.status === 'urgent' || job.isUrgent;
  const distanceKm: number | undefined = (job as any)._distanceKm;

  const handlePosterPress = () => {
    if (showPosterProfile && job.posterId) {
      (navigation as any).navigate('UserProfile', {
        userId: job.posterId,
        userName: job.posterName,
        userPhoto: job.posterPhoto,
      });
    }
  };

  // ─── Compact variant ───────────────────────
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[
          cStyles.card,
          { backgroundColor: colors.card, borderColor: isUrgent ? colors.urgent + '40' : colors.border },
          style,
        ]}
        onPress={onPress}
        activeOpacity={0.75}
      >
        <Avatar uri={job.posterPhoto} name={job.posterName} size={40} />
        <View style={cStyles.content}>
          <Text style={[cStyles.title, { color: colors.text }]} numberOfLines={1}>{job.title}</Text>
          <Text style={[cStyles.location, { color: colors.textSecondary }]} numberOfLines={1}>
            {job.location?.hospital || job.location?.district}
          </Text>
          <Text style={[cStyles.rate, { color: colors.success }]}>
            {formatShiftRate(job.shiftRate, job.rateType)}
          </Text>
        </View>
        {isUrgent && (
          <View style={[cStyles.urgentDot, { backgroundColor: colors.urgent }]} />
        )}
      </TouchableOpacity>
    );
  }

  // ─── Default (full) card ────────────────────
  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isUrgent ? colors.urgent + '30' : colors.border,
          shadowColor: isDark ? '#000' : '#1E293B',
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Urgent stripe */}
      {isUrgent && (
        <View style={[styles.urgentStripe, { backgroundColor: colors.urgent }]} />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handlePosterPress}
          disabled={!showPosterProfile || !job.posterId}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Avatar uri={job.posterPhoto} name={job.posterName} size={46} />
        </TouchableOpacity>

        <View style={styles.posterInfo}>
          <View style={styles.nameRow}>
            <TouchableOpacity
              onPress={handlePosterPress}
              disabled={!showPosterProfile || !job.posterId}
              style={styles.nameTouch}
            >
              <Text
                style={[
                  styles.posterName,
                  { color: job.posterVerified ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {job.posterName}
              </Text>
            </TouchableOpacity>
            {job.posterVerified ? (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primaryBackground }]}>
                <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                <Text style={[styles.verifiedText, { color: colors.primary }]}>ยืนยันแล้ว</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={colors.textMuted} />
            <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
              {[job.location?.hospital, job.location?.district, job.location?.province]
                .filter(Boolean)
                .join(', ')}
              {distanceKm !== undefined ? (
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {'  '}• {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} ม.` : `${distanceKm.toFixed(1)} กม.`}
                </Text>
              ) : null}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {isUrgent ? (
            <View style={[styles.urgentBadge, { backgroundColor: colors.urgent }]}>
              <Ionicons name="flash" size={10} color="#FFF" />
              <Text style={styles.urgentBadgeText}>ด่วน</Text>
            </View>
          ) : null}
          {onSave ? (
            <TouchableOpacity
              onPress={onSave}
              hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
              style={styles.saveBtn}
            >
              <Ionicons
                name={isSaved ? 'heart' : 'heart-outline'}
                size={22}
                color={isSaved ? colors.error : colors.textMuted}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Title */}
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {job.title}
      </Text>

      {/* "Looking for" summary — answers "what are they hiring?" */}
      {(() => {
        const postTypeLabel: Record<string, string> = {
          shift: 'หาคนแทนเวร',
          job: 'หาพนักงานประจำ',
          homecare: 'หาผู้ดูแลที่บ้าน',
        };
        const ptLabel = postTypeLabel[(job as any).postType || 'shift'];
        const stLabel = job.staffType ? getStaffTypeLabel(job.staffType as StaffType) : '';
        const deptLabel = job.department || '';
        const summary = [ptLabel, stLabel, deptLabel].filter(Boolean).join(' • ');
        return (
          <View style={[styles.lookingForRow, { backgroundColor: colors.primaryBackground }]}>
            <Ionicons name="search-outline" size={12} color={colors.primary} />
            <Text style={[styles.lookingForText, { color: colors.primaryDark }]} numberOfLines={1}>
              {summary}
            </Text>
          </View>
        );
      })()}

      {/* Tags */}
      <Text style={[styles.tagsLabel, { color: colors.textMuted }]}>คุณสมบัติที่ต้องการ</Text>
      <View style={styles.tags}>
        {job.department ? (
          <View style={[styles.tag, { backgroundColor: colors.primaryBackground }]}>
            <Text style={[styles.tagText, { color: colors.primaryDark }]}>{job.department}</Text>
          </View>
        ) : null}
        {job.staffType ? (
          <View style={[styles.tag, { backgroundColor: colors.infoLight }]}>
            <Text style={[styles.tagText, { color: colors.info }]}>
              {getStaffTypeLabel((job.staffType as StaffType) || 'OTHER')}
            </Text>
          </View>
        ) : null}
        {job.locationType === 'HOME' ? (
          <View style={[styles.tag, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.tagText, { color: colors.accentDark }]}>🏠 ดูแลบ้าน</Text>
          </View>
        ) : null}
        {job.paymentType === 'NET' ? (
          <View style={[styles.tag, { backgroundColor: colors.successLight }]}>
            <Text style={[styles.tagText, { color: colors.secondaryDark }]}>NET (รับเต็ม)</Text>
          </View>
        ) : null}
        {job.paymentType === 'DEDUCT_PERCENT' && (job as any).deductPercent ? (
          <View style={[styles.tag, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.tagText, { color: colors.error }]}>
              หัก {(job as any).deductPercent}%
            </Text>
          </View>
        ) : null}
      </View>

      {/* Shift date/time */}
      <View style={[styles.shiftRow, { borderTopColor: colors.borderLight }]}>
        <View style={styles.shiftItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.shiftItemText, { color: colors.text }]}>
            {formatShiftDate(job.shiftDate)}
          </Text>
        </View>
        <View style={[styles.shiftDivider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.shiftItem}>
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.shiftItemText, { color: colors.text }]}>
            {job.shiftTime || 'ตามตกลง'}
          </Text>
        </View>
      </View>

      {/* Rate + footer */}
      <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
        <View style={[styles.ratePill, { backgroundColor: colors.successLight }]}>
          <Ionicons name="cash-outline" size={14} color={colors.success} />
          <Text style={[styles.rateText, { color: colors.secondaryDark }]}>
            {formatShiftRate(job.shiftRate, job.rateType)}
          </Text>
        </View>

        <View style={styles.footerMeta}>
          {job.viewsCount !== undefined && job.viewsCount > 0 ? (
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {job.viewsCount} ดู
            </Text>
          ) : null}
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {formatRelativeTime(job.createdAt)}
          </Text>
          <Text style={[styles.viewMoreText, { color: colors.primary }]}>ดูเพิ่ม →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.xl,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  urgentStripe: {
    height: 3,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  posterInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
  },
  nameTouch: {
    flex: 1,
    minWidth: 0,
  },
  posterName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    flexShrink: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: FONT_SIZES.xs,
    flex: 1,
    flexShrink: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  saveBtn: {
    padding: 2,
  },
  title: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    lineHeight: 24,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
  },
  lookingForRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.md,
  },
  lookingForText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  tagsLabel: {
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: SPACING.md,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  shiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  shiftItemText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
  },
  shiftDivider: {
    width: 1,
    height: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
  },
  ratePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BORDER_RADIUS.full,
  },
  rateText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metaText: {
    fontSize: FONT_SIZES.xs,
  },
  viewMoreText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
});

// Compact styles
const cStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.xs,
    borderWidth: 1,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  content: { flex: 1, minWidth: 0 },
  title: { fontSize: FONT_SIZES.md, fontWeight: '600' },
  location: { fontSize: FONT_SIZES.xs, marginTop: 2 },
  rate: { fontSize: FONT_SIZES.sm, fontWeight: '700', marginTop: 3 },
  urgentDot: { width: 8, height: 8, borderRadius: 4 },
});

export default JobCard;
