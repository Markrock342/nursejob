// ============================================
// REVIEWS SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Loading, EmptyState, Avatar, KittenButton as Button } from '../../components/common';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import {
  getHospitalReviews,
  createReview,
  getUserReviewForHospital,
  markReviewHelpful,
  getHospitalRating,
  Review,
  HospitalRating,
} from '../../services/reviewsService';
import { formatRelativeTime } from '../../utils/helpers';

type ReviewsRouteParams = {
  hospitalId: string;
  hospitalName: string;
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
}) => (
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
          color={star <= rating ? COLORS.warning : COLORS.border}
        />
      </TouchableOpacity>
    ))}
  </View>
);

// Rating Bar Component
const RatingBar = ({ label, count, total }: { label: string; count: number; total: number }) => {
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
  const route = useRoute<RouteProp<Record<string, ReviewsRouteParams>, string>>();
  const navigation = useNavigation();
  const { user, requireAuth } = useAuth();
  const { colors } = useTheme();
  
  const { hospitalId, hospitalName } = route.params || {};
  
  const [reviews, setReviews] = useState<Review[]>([]);
  const [ratingData, setRatingData] = useState<HospitalRating | null>(null);
  const [userReview, setUserReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);
  
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
    if (!hospitalId) return;

    try {
      const [reviewsData, ratingInfo] = await Promise.all([
        getHospitalReviews(hospitalId),
        getHospitalRating(hospitalId),
      ]);
      
      setReviews(reviewsData);
      setRatingData(ratingInfo);
      
      // Check if user already reviewed
      if (user?.uid) {
        const existing = await getUserReviewForHospital(user.uid, hospitalId);
        setUserReview(existing);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [hospitalId, user?.uid]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleWriteReview = () => {
    requireAuth(() => {
      if (userReview) {
        setAlert({ ...createAlert.info('แจ้งเตือน', 'คุณได้รีวิวโรงพยาบาลนี้แล้ว') } as AlertState);
        return;
      }
      setShowWriteModal(true);
    });
  };

  const handleSubmitReview = async () => {
    if (!user?.uid || !hospitalId) return;
    
    if (!newTitle.trim()) {
      setAlert({ ...createAlert.warning('กรุณากรอกข้อมูล', 'กรุณาใส่หัวข้อรีวิว') } as AlertState);
      return;
    }
    if (!newContent.trim()) {
      setAlert({ ...createAlert.warning('กรุณากรอกข้อมูล', 'กรุณาใส่เนื้อหารีวิว') } as AlertState);
      return;
    }

    setIsSubmitting(true);

    try {
      await createReview(
        hospitalId,
        user.uid,
        user.displayName || 'ผู้ใช้',
        newRating,
        newTitle.trim(),
        newContent.trim(),
        {
          pros: newPros.trim() || undefined,
          cons: newCons.trim() || undefined,
          wouldRecommend,
          userPhotoURL: user.photoURL || undefined,
        }
      );

      setShowWriteModal(false);
      resetForm();
      loadData();
      setAlert({ ...createAlert.success('สำเร็จ', 'ขอบคุณสำหรับรีวิวของคุณ') } as AlertState);
    } catch (error: any) {
      setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', error.message || 'ไม่สามารถส่งรีวิวได้') } as AlertState);
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
    await markReviewHelpful(review.id);
    setReviews(prev =>
      prev.map(r => (r.id === review.id ? { ...r, helpful: r.helpful + 1 } : r))
    );
  };

  if (!hospitalId) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <EmptyState
          icon="alert-circle-outline"
          title="ไม่พบข้อมูลโรงพยาบาล"
          actionLabel="กลับ"
          onAction={() => navigation.goBack()}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <Loading message="กำลังโหลดรีวิว..." />;
  }

  const renderReview = ({ item }: { item: Review }) => (
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
            <Text style={styles.verifiedText}>ยืนยันแล้ว</Text>
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
            {item.wouldRecommend ? 'แนะนำ' : 'ไม่แนะนำ'}
          </Text>
        </View>
        <TouchableOpacity style={styles.helpfulButton} onPress={() => handleHelpful(item)}>
          <Ionicons name="thumbs-up-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.helpfulText}>เป็นประโยชน์ ({item.helpful})</Text>
        </TouchableOpacity>
      </View>

      {item.response && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>คำตอบจากโรงพยาบาล</Text>
          <Text style={styles.responseContent}>{item.response.content}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CustomAlert {...alert} onClose={closeAlert} />}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{hospitalName}</Text>
          <Text style={styles.headerSubtitle}>รีวิว</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Rating Summary */}
      {ratingData && (
        <View style={styles.ratingSummary}>
          <View style={styles.ratingOverview}>
            <Text style={styles.ratingNumber}>{ratingData.averageRating.toFixed(1)}</Text>
            <StarRating rating={Math.round(ratingData.averageRating)} size={16} />
            <Text style={styles.ratingCount}>{ratingData.totalReviews} รีวิว</Text>
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
      {!userReview && (
        <TouchableOpacity style={styles.writeButton} onPress={handleWriteReview}>
          <Ionicons name="create-outline" size={20} color={colors.white} />
          <Text style={styles.writeButtonText}>เขียนรีวิว</Text>
        </TouchableOpacity>
      )}

      {/* Reviews List */}
      <FlatList
        data={reviews}
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
            title="ยังไม่มีรีวิว"
            subtitle="เป็นคนแรกที่รีวิวโรงพยาบาลนี้"
            actionLabel="เขียนรีวิว"
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
              <Text style={styles.modalTitle}>เขียนรีวิว</Text>
              <TouchableOpacity onPress={handleSubmitReview} disabled={isSubmitting}>
                <Text style={[styles.submitText, isSubmitting && styles.submitTextDisabled]}>
                  {isSubmitting ? 'กำลังส่ง...' : 'ส่ง'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Hospital Name */}
              <Text style={styles.hospitalLabel}>{hospitalName}</Text>

              {/* Rating */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>ให้คะแนน</Text>
                <StarRating rating={newRating} size={32} onRate={setNewRating} editable={true} />
              </View>

              {/* Title */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>หัวข้อ *</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="เช่น ประสบการณ์ทำงานที่ดี"
                  placeholderTextColor={colors.textMuted}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  maxLength={100}
                />
              </View>

              {/* Content */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>รายละเอียด *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
                  placeholder="บอกเล่าประสบการณ์ของคุณ..."
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
                  <Ionicons name="thumbs-up" size={14} color={colors.success} /> ข้อดี
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="สิ่งที่ชอบ..."
                  placeholderTextColor={colors.textMuted}
                  value={newPros}
                  onChangeText={setNewPros}
                  maxLength={200}
                />
              </View>

              {/* Cons */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  <Ionicons name="thumbs-down" size={14} color={colors.error} /> ข้อเสีย
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="สิ่งที่ควรปรับปรุง..."
                  placeholderTextColor={colors.textMuted}
                  value={newCons}
                  onChangeText={setNewCons}
                  maxLength={200}
                />
              </View>

              {/* Recommend */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>คุณจะแนะนำให้ผู้อื่นหรือไม่?</Text>
                <View style={styles.recommendOptions}>
                  <TouchableOpacity
                    style={[styles.recommendOption, wouldRecommend && styles.recommendOptionActive]}
                    onPress={() => setWouldRecommend(true)}
                  >
                    <Ionicons name="heart" size={20} color={wouldRecommend ? colors.white : colors.error} />
                    <Text style={[styles.recommendOptionText, wouldRecommend && styles.recommendOptionTextActive]}>
                      แนะนำ
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.recommendOption, !wouldRecommend && styles.recommendOptionInactive]}
                    onPress={() => setWouldRecommend(false)}
                  >
                    <Ionicons name="heart-outline" size={20} color={!wouldRecommend ? colors.white : colors.textMuted} />
                    <Text style={[styles.recommendOptionText, !wouldRecommend && styles.recommendOptionTextActive]}>
                      ไม่แนะนำ
                    </Text>
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

const styles = StyleSheet.create({
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
  },
  helpfulText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
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

