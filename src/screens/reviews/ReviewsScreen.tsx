// ============================================
// REVIEWS SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Loading, EmptyState, Avatar, KittenButton as Button } from '../../components/common';
import ReportModal from '../../components/report/ReportModal';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import {
  getReviewsForTarget,
  createReview,
  getUserReviewForTarget,
  markReviewHelpful,
  getTargetRating,
  canUserReviewTarget,
  Review,
  HospitalRating,
  ReviewEligibility,
} from '../../services/reviewsService';
import { formatRelativeTime } from '../../utils/helpers';
import { useI18n } from '../../i18n';

type ReviewsRouteParams = {
  hospitalId?: string;
  hospitalName?: string;
  targetUserId?: string;
  targetName?: string;
  targetRole?: string;
  completionId?: string;
  relatedJobId?: string;
};

// Star Rating Component
const StarRating = ({ 
  rating, 
  size = 20, 
  onRate,
  editable = false 
}: { 
  rating: number; 
  size?: number;
  onRate?: (rating: number) => void;
  editable?: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
  <View style={styles.starContainer}>
    {[1, 2, 3, 4, 5].map((star) => (
      <TouchableOpacity
        key={star}
        onPress={() => editable && onRate?.(star)}
        disabled={Boolean(!editable)}
      >
        <Ionicons
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? colors.warning : colors.border}
        />
      </TouchableOpacity>
    ))}
  </View>
  );
};

// Rating Bar Component
const RatingBar = ({ label, count, total }: { label: string; count: number; total: number }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <View style={styles.ratingBar}>
      <Text style={styles.ratingBarLabel}>{label}</Text>
      <View style={styles.ratingBarTrack}>
        <View style={[styles.ratingBarFill, { width: `${percentage}%` }]} />
      </View>
      <Text style={styles.ratingBarCount}>{count}</Text>
    </View>
  );
};

export default function ReviewsScreen() {
  const { t } = useI18n();
  const route = useRoute<RouteProp<Record<string, ReviewsRouteParams>, string>>();
  const navigation = useNavigation();
  const { user, requireAuth } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerBackground = colors.surface;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  
  const { hospitalId, hospitalName, targetUserId, targetName, targetRole, completionId } = route.params || {};
  const targetType = targetUserId ? 'user' : 'hospital';
  const targetId = targetUserId || hospitalId;
  const screenName = targetUserId ? (targetName || t('reviews.userFallback')) : (hospitalName || t('reviews.workplaceFallback'));
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingData, setRatingData] = useState<HospitalRating | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState<ReviewEligibility | null>(null);
  const [reviewSort, setReviewSort] = useState<'latest' | 'highest' | 'lowest' | 'mostHelpful' | 'leastHelpful'>('latest');
  const [helpfulReviewIds, setHelpfulReviewIds] = useState<string[]>([]);
  const [reportingReview, setReportingReview] = useState<Review | null>(null);
  
  // New review form
  const [newRating, setNewRating] = useState(5);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newPros, setNewPros] = useState('');
  const [newCons, setNewCons] = useState('');
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);
  const closeAlert = () => setAlert(initialAlertState);

  const loadData = useCallback(async () => {
    if (!targetId) return;

    try {
      const [reviewsData, ratingInfo, eligibility] = await Promise.all([
        getReviewsForTarget(targetId, targetType),
        getTargetRating(targetId, targetType),
        user?.uid ? canUserReviewTarget(user.uid, targetId, completionId) : Promise.resolve(null),
      ]);
      
      setReviews(reviewsData);
      setRatingData(ratingInfo);
      setReviewEligibility(eligibility);
      
      // Check if user already reviewed
      if (user?.uid) {
        const existing = await getUserReviewForTarget(user.uid, targetId, targetType, {
          completionId: completionId || eligibility?.completionId,
          relatedJobId: route.params?.relatedJobId || eligibility?.relatedJobId,
        });
        setUserReview(existing);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [completionId, route.params?.relatedJobId, targetId, targetType, user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const sortedReviews = useMemo(() => {
    const nextReviews = [...reviews];

    switch (reviewSort) {
      case 'highest':
        nextReviews.sort((a, b) => (b.rating - a.rating) || (b.createdAt.getTime() - a.createdAt.getTime()));
        break;
      case 'lowest':
        nextReviews.sort((a, b) => (a.rating - b.rating) || (b.createdAt.getTime() - a.createdAt.getTime()));
        break;
      case 'mostHelpful':
        nextReviews.sort((a, b) => (b.helpful - a.helpful) || (b.createdAt.getTime() - a.createdAt.getTime()));
        break;
      case 'leastHelpful':
        nextReviews.sort((a, b) => (a.helpful - b.helpful) || (b.createdAt.getTime() - a.createdAt.getTime()));
        break;
      case 'latest':
      default:
        nextReviews.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        break;
    }

    return nextReviews;
  }, [reviewSort, reviews]);

  const handleWriteReview = () => {
    requireAuth(() => {
      if (userReview) {
        setAlert({ ...createAlert.info(t('reviews.alertNotice'), targetType === 'user' ? t('reviews.alreadyReviewedJob') : t('reviews.alreadyReviewedPlace')) } as AlertState);
        return;
      }
      if (!reviewEligibility?.canReview) {
        setAlert({ ...createAlert.warning(t('reviews.cannotReviewTitle'), t('reviews.cannotReviewMessage')) } as AlertState);
        return;
      }
      setShowWriteModal(true);
    });
  };

  const handleSubmitReview = async () => {
    if (!user?.uid || !targetId) return;
    
    if (!newTitle.trim()) {
      setAlert({ ...createAlert.warning(t('reviews.validationTitle'), t('reviews.validationTitleRequired')) } as AlertState);
      return;
    }
    if (!newContent.trim()) {
      setAlert({ ...createAlert.warning(t('reviews.validationTitle'), t('reviews.validationContentRequired')) } as AlertState);
      return;
    }

    setIsSubmitting(true);

    try {
      await createReview(
        targetId,
        user.uid,
        user.displayName || t('reviews.userFallback'),
        newRating,
        newTitle.trim(),
        newContent.trim(),
        {
          targetType,
          targetName: screenName,
          pros: newPros.trim() || undefined,
          cons: newCons.trim() || undefined,
          wouldRecommend,
          userPhotoURL: user.photoURL || undefined,
          relatedJobId: route.params?.relatedJobId || reviewEligibility?.relatedJobId,
          completionId: completionId || reviewEligibility?.completionId,
          isVerified: reviewEligibility?.isVerified ?? false,
        }
      );

      setShowWriteModal(false);
      resetForm();
      loadData();
      setAlert({ ...createAlert.success(t('reviews.successTitle'), t('reviews.successMessage')) } as AlertState);
    } catch (error: any) {
      setShowWriteModal(false);
      setAlert({ ...createAlert.error(t('reviews.errorTitle'), error.message || t('reviews.errorSubmitFallback')) } as AlertState);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewRating(5);
    setNewTitle('');
    setNewContent('');
    setNewPros('');
    setNewCons('');
    setWouldRecommend(true);
  };

  const handleHelpful = async (review: Review) => {
    if (!user?.uid) {
      setAlert({ ...createAlert.info(t('reviews.loginTitle'), t('reviews.loginHelpfulMessage')) } as AlertState);
      return;
    }

    if (helpfulReviewIds.includes(review.id) || review.helpfulVoterIds?.includes(user.uid)) {
      setAlert({ ...createAlert.info(t('reviews.alreadyHelpfulTitle'), t('reviews.alreadyHelpfulMessage')) } as AlertState);
      return;
    }

    try {
      const updated = await markReviewHelpful(review.id, user.uid);
      if (!updated) {
        setAlert({ ...createAlert.info(t('reviews.alreadyHelpfulTitle'), t('reviews.alreadyHelpfulMessage')) } as AlertState);
        setHelpfulReviewIds((prev) => [...prev, review.id]);
        return;
      }

      setHelpfulReviewIds((prev) => [...prev, review.id]);
      setReviews((prev) =>
        prev.map((r) => r.id === review.id
          ? {
              ...r,
              helpful: r.helpful + 1,
              helpfulVoterIds: [...(r.helpfulVoterIds || []), user.uid],
            }
          : r)
      );
    } catch (error: any) {
      setAlert({ ...createAlert.error(t('reviews.helpfulErrorTitle'), error?.message || t('reviews.helpfulErrorFallback')) } as AlertState);
    }
  };

  const handleReportReview = (review: Review) => {
    requireAuth(() => {
      setReportingReview(review);
    });
  };

  if (!targetId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
        <EmptyState
          icon="alert-circle-outline"
          title={targetType === 'user' ? t('reviews.noUserData') : t('reviews.noWorkplaceData')}
          actionLabel={t('reviews.goBack')}
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <Loading message={t('reviews.loading')} />;
  }

  const renderReview = ({ item }: { item: Review }) => {
    const hasMarkedHelpful = Boolean(user?.uid && (helpfulReviewIds.includes(item.id) || item.helpfulVoterIds?.includes(user.uid)));

    return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar
          uri={item.userPhotoURL}
          name={item.userName}
          size={44}
        />
        <View style={styles.reviewInfo}>
          <Text style={styles.reviewerName}>{item.userName}</Text>
          <View style={styles.reviewMeta}>
            <StarRating rating={item.rating} size={14} />
            <Text style={styles.reviewDate}>{formatRelativeTime(item.createdAt)}</Text>
          </View>
        </View>
        {item.isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.verifiedText}>{t('reviews.verified')}</Text>
          </View>
        )}
      </View>

      <Text style={styles.reviewTitle}>{item.title}</Text>
      <Text style={styles.reviewContent}>{item.content}</Text>

      {(item.pros || item.cons) && (
        <View style={styles.prosConsContainer}>
          {item.pros && (
            <View style={styles.prosItem}>
              <Ionicons name="thumbs-up" size={14} color={colors.success} />
              <Text style={styles.prosText}>{item.pros}</Text>
            </View>
          )}
          {item.cons && (
            <View style={styles.consItem}>
              <Ionicons name="thumbs-down" size={14} color={colors.error} />
              <Text style={styles.consText}>{item.cons}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.reviewFooter}>
        <View style={styles.recommendBadge}>
          <Ionicons
            name={item.wouldRecommend ? 'heart' : 'heart-outline'}
            size={14}
            color={item.wouldRecommend ? colors.error : colors.textMuted}
          />
          <Text style={[styles.recommendText, item.wouldRecommend && styles.recommendActive]}>
            {item.wouldRecommend ? t('reviews.recommend') : t('reviews.notRecommend')}
          </Text>
        </View>
        <TouchableOpacity style={[styles.helpfulButton, hasMarkedHelpful && styles.helpfulButtonActive]} onPress={() => handleHelpful(item)}>
          <Ionicons name={hasMarkedHelpful ? 'thumbs-up' : 'thumbs-up-outline'} size={16} color={hasMarkedHelpful ? colors.primary : colors.textSecondary} />
          <Text style={[styles.helpfulText, hasMarkedHelpful && styles.helpfulTextActive]}>
            {hasMarkedHelpful ? t('reviews.helpfulDone') : t('reviews.helpful')} ({item.helpful})
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.reportButton} onPress={() => handleReportReview(item)}>
        <Ionicons name="flag-outline" size={15} color={colors.textMuted} />
        <Text style={styles.reportButtonText}>{t('reviews.report')}</Text>
      </TouchableOpacity>

      {item.response && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>{targetType === 'user' ? t('reviews.responseFromUser') : t('reviews.responseFromWorkplace')}</Text>
          <Text style={styles.responseContent}>{item.response.content}</Text>
        </View>
      )}
    </View>
  );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
      <CustomAlert {...alert} onClose={closeAlert} />
      <ReportModal
        visible={!!reportingReview}
        onClose={() => setReportingReview(null)}
        targetType="review"
        targetId={reportingReview?.id || ''}
        targetName={reportingReview ? `${reportingReview.userName}: ${reportingReview.title}` : undefined}
        targetDescription={reportingReview?.content}
        reporterId={user?.uid || ''}
        reporterName={user?.displayName || t('reviews.userFallback')}
        reporterEmail={user?.email || ''}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{screenName}</Text>
          <Text style={styles.headerSubtitle}>{t('reviews.headerSubtitle')}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Rating Summary */}
      {ratingData && (
        <View style={styles.ratingSummary}>
          <View style={styles.ratingOverview}>
            <Text style={styles.ratingNumber}>{ratingData.averageRating.toFixed(1)}</Text>
            <StarRating rating={Math.round(ratingData.averageRating)} size={16} />
            <Text style={styles.ratingCount}>{t('reviews.reviewCount').replace('{count}', String(ratingData.totalReviews))}</Text>
          </View>
          <View style={styles.ratingBreakdown}>
            {[5, 4, 3, 2, 1].map((star) => (
              <RatingBar
                key={star}
                label={`${star}`}
                count={ratingData.ratingBreakdown[star as 1|2|3|4|5]}
                total={ratingData.totalReviews}
              />
            ))}
          </View>
        </View>
      )}

      {/* Write Review Button */}
      {!userReview && reviewEligibility?.canReview && (
        <TouchableOpacity style={styles.writeButton} onPress={handleWriteReview}>
          <Ionicons name="create-outline" size={20} color={colors.white} />
          <Text style={styles.writeButtonText}>{t('reviews.writeReview')}</Text>
        </TouchableOpacity>
      )}

      {!userReview && !reviewEligibility?.canReview ? (
        <View style={styles.reviewHintBox}>
          <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.reviewHintText}>{t('reviews.reviewHint')}</Text>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortBar}
        style={styles.sortScroll}
      >
        {[
          { key: 'latest', label: t('reviews.sortLatest') },
          { key: 'highest', label: t('reviews.sortHighest') },
          { key: 'lowest', label: t('reviews.sortLowest') },
          { key: 'mostHelpful', label: t('reviews.sortMostHelpful') },
          { key: 'leastHelpful', label: t('reviews.sortLeastHelpful') },
        ].map((option) => {
          const selected = reviewSort === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              onPress={() => setReviewSort(option.key as typeof reviewSort)}
              style={[styles.sortChip, selected && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, selected && styles.sortChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Reviews List */}
      <FlatList
        data={sortedReviews}
        keyExtractor={(item) => item.id}
        renderItem={renderReview}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title={t('reviews.emptyTitle')}
            subtitle={targetType === 'user' ? t('reviews.emptySubtitleUser') : t('reviews.emptySubtitlePlace')}
            actionLabel={t('reviews.writeReview')}
            onAction={handleWriteReview}
          />
        }
      />

      {/* Write Review Modal */}
      <Modal
        visible={showWriteModal}
        animationType="slide"
        onRequestClose={() => setShowWriteModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowWriteModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('reviews.writeReview')}</Text>
              <TouchableOpacity onPress={handleSubmitReview} disabled={isSubmitting}>
                <Text style={[styles.submitText, isSubmitting && styles.submitTextDisabled]}>
                  {isSubmitting ? t('reviews.submitting') : t('reviews.submit')}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Hospital Name */}
              <Text style={styles.hospitalLabel}>{screenName}</Text>

              {/* Rating */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('reviews.rateLabel')}</Text>
                <StarRating rating={newRating} size={32} onRate={setNewRating} editable={true} />
              </View>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('reviews.titleLabel')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('reviews.titlePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  maxLength={100}
                />
              </View>

              {/* Content */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('reviews.detailsLabel')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('reviews.detailsPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newContent}
                  onChangeText={setNewContent}
                  multiline={true}
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={1000}
                />
              </View>

              {/* Pros */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  <Ionicons name="thumbs-up" size={14} color={colors.success} />{t('reviews.prosLabel')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('reviews.prosPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newPros}
                  onChangeText={setNewPros}
                  maxLength={200}
                />
              </View>

              {/* Cons */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  <Ionicons name="thumbs-down" size={14} color={colors.error} />{t('reviews.consLabel')}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder={t('reviews.consPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={newCons}
                  onChangeText={setNewCons}
                  maxLength={200}
                />
              </View>

              {/* Recommend */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>{t('reviews.wouldRecommend')}</Text>
                <View style={styles.recommendOptions}>
                  <TouchableOpacity
                    style={[styles.recommendOption, wouldRecommend && styles.recommendOptionActive]}
                    onPress={() => setWouldRecommend(true)}
                  >
                    <Ionicons name="heart" size={20} color={wouldRecommend ? colors.white : colors.error} />
                    <Text style={[styles.recommendOptionText, wouldRecommend && styles.recommendOptionTextActive]}>{t('reviews.recommend')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.recommendOption, !wouldRecommend && styles.recommendOptionInactive]}
                    onPress={() => setWouldRecommend(false)}
                  >
                    <Ionicons name="heart-outline" size={20} color={!wouldRecommend ? colors.white : colors.textMuted} />
                    <Text style={[styles.recommendOptionText, !wouldRecommend && styles.recommendOptionTextActive]}>{t('reviews.notRecommend')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  ratingSummary: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  ratingOverview: {
    alignItems: 'center',
    marginRight: SPACING.xl,
  },
  ratingNumber: {
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.text,
  },
  ratingCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  ratingBreakdown: {
    flex: 1,
  },
  ratingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingBarLabel: {
    width: 16,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    marginHorizontal: SPACING.sm,
    overflow: 'hidden',
  },
  ratingBarFill: {
    height: '100%',
    backgroundColor: COLORS.warning,
  },
  ratingBarCount: {
    width: 24,
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
  },
  writeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  writeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.md,
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  sortScroll: {
    maxHeight: 56,
  },
  sortBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  sortChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    minHeight: 38,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  sortChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sortChipText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  sortChipTextActive: {
    color: COLORS.white,
  },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reviewInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  reviewerName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: SPACING.sm,
  },
  reviewDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    gap: 2,
  },
  verifiedText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '500',
  },
  reviewTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
  },
  reviewContent: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  reviewHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.warningLight,
  },
  reviewHintText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
  prosConsContainer: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  prosItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  prosText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.success,
  },
  consItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  consText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  recommendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recommendText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  recommendActive: {
    color: COLORS.error,
    fontWeight: '500',
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 999,
  },
  helpfulButtonActive: {
    backgroundColor: COLORS.primaryLight,
  },
  helpfulText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  helpfulTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  reportButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
  },
  reportButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  responseContainer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  responseLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  responseContent: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  starContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  submitText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
  },
  submitTextDisabled: {
    color: COLORS.textMuted,
  },
  modalBody: {
    flex: 1,
    padding: SPACING.lg,
  },
  hospitalLabel: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: SPACING.lg,
  },
  formLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  recommendOptions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  recommendOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  recommendOptionActive: {
    backgroundColor: COLORS.error,
  },
  recommendOptionInactive: {
    backgroundColor: COLORS.textMuted,
  },
  recommendOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  recommendOptionTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
});

