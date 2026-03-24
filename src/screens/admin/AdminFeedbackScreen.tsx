// ============================================
// ADMIN FEEDBACK SCREEN - ดู Feedback ทั้งหมด
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar, Button, Card, ModalContainer } from '../../components/common';
import {
  getAllFeedback,
  getFeedbackByStatus,
  updateFeedbackStatus,
  respondToFeedback,
  getFeedbackStats,
  AppFeedback,
  FeedbackStatus,
  FeedbackStats,
  FEEDBACK_TYPES,
  FEEDBACK_STATUS_LABELS,
} from '../../services/feedbackService';
import { formatRelativeTime } from '../../utils/helpers';

type FilterType = 'all' | FeedbackStatus;

export default function AdminFeedbackScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  const { colors } = useTheme();
  
  const [feedback, setFeedback] = useState<AppFeedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<AppFeedback[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<AppFeedback | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [feedback, filter]);

  const loadData = async () => {
    try {
      const [feedbackData, statsData] = await Promise.all([
        getAllFeedback(200),
        getFeedbackStats(),
      ]);
      setFeedback(feedbackData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading feedback:', error);
      Alert.alert('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const applyFilter = () => {
    if (filter === 'all') {
      setFilteredFeedback(feedback);
    } else {
      setFilteredFeedback(feedback.filter(f => f.status === filter));
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleMarkAsRead = async (item: AppFeedback) => {
    if (item.status !== 'pending') return;
    
    try {
      await updateFeedbackStatus(item.id!, 'read');
      setFeedback(prev => prev.map(f => 
        f.id === item.id ? { ...f, status: 'read' as FeedbackStatus } : f
      ));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleRespond = async () => {
    if (!selectedFeedback || !user?.uid || !response.trim()) return;
    
    setIsSubmitting(true);
    try {
      await respondToFeedback(selectedFeedback.id!, user.uid, response.trim());
      
      setFeedback(prev => prev.map(f => 
        f.id === selectedFeedback.id 
          ? { ...f, status: 'responded' as FeedbackStatus, adminResponse: response.trim() }
          : f
      ));
      
      setShowRespondModal(false);
      setShowDetailModal(false);
      setSelectedFeedback(null);
      setResponse('');
      
      Alert.alert('✅ ตอบกลับสำเร็จ');
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkResolved = async () => {
    if (!selectedFeedback) return;
    
    try {
      await updateFeedbackStatus(selectedFeedback.id!, 'resolved');
      
      setFeedback(prev => prev.map(f => 
        f.id === selectedFeedback.id 
          ? { ...f, status: 'resolved' as FeedbackStatus }
          : f
      ));
      
      setShowDetailModal(false);
      setSelectedFeedback(null);
      
      Alert.alert('✅ ทำเครื่องหมายแก้ไขแล้ว');
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message);
    }
  };

  const getTypeLabel = (type: string) => {
    const found = FEEDBACK_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  const getTypeIcon = (type: string) => {
    const found = FEEDBACK_TYPES.find(t => t.value === type);
    return found?.icon || 'chatbox';
  };

  const getStatusColor = (status: FeedbackStatus) => {
    switch (status) {
      case 'pending': return COLORS.warning;
      case 'read': return COLORS.info;
      case 'responded': return COLORS.success;
      case 'resolved': return COLORS.primary;
      default: return COLORS.textMuted;
    }
  };

  const renderStars = (rating: number, size: number = 16) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={size}
          color={star <= rating ? '#FFD700' : COLORS.textMuted}
        />
      ))}
    </View>
  );

  const renderFeedback = ({ item }: { item: AppFeedback }) => (
    <TouchableOpacity
      style={styles.feedbackCard}
      onPress={() => {
        setSelectedFeedback(item);
        setShowDetailModal(true);
        handleMarkAsRead(item);
      }}
    >
      <View style={styles.feedbackHeader}>
        <Avatar name={item.userName} size={40} />
        <View style={styles.feedbackInfo}>
          <Text style={styles.feedbackUserName}>{item.userName}</Text>
          {renderStars(item.rating, 14)}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {FEEDBACK_STATUS_LABELS[item.status]}
          </Text>
        </View>
      </View>
      
      <View style={styles.typeRow}>
        <Ionicons name={getTypeIcon(item.type) as any} size={16} color={COLORS.primary} />
        <Text style={styles.typeText}>{getTypeLabel(item.type)}</Text>
      </View>
      
      <Text style={styles.feedbackTitle}>{item.title}</Text>
      <Text style={styles.feedbackMessage} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.feedbackDate}>{formatRelativeTime(item.createdAt)}</Text>
    </TouchableOpacity>
  );

  const FilterButton = ({ type, label, count }: { type: FilterType; label: string; count?: number }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterButtonText, filter === type && styles.filterButtonTextActive]}>
        {label} {count !== undefined && `(${count})`}
      </Text>
    </TouchableOpacity>
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={COLORS.error} />
          <Text style={styles.accessDeniedText}>ไม่มีสิทธิ์เข้าถึง</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback ผู้ใช้</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.total}</Text>
            <Text style={styles.statLabel}>ทั้งหมด</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: COLORS.warning }]}>{stats.pending}</Text>
            <Text style={styles.statLabel}>รอตรวจ</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={[styles.statNumber, { color: '#FFD700' }]}>
                {stats.avgRating.toFixed(1)}
              </Text>
            </View>
            <Text style={styles.statLabel}>เฉลี่ย</Text>
          </View>
        </View>
      )}

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FilterButton type="all" label="ทั้งหมด" count={feedback.length} />
        <FilterButton type="pending" label="รอตรวจ" count={feedback.filter(f => f.status === 'pending').length} />
        <FilterButton type="read" label="อ่านแล้ว" />
        <FilterButton type="responded" label="ตอบแล้ว" />
      </View>

      {/* Feedback List */}
      {filteredFeedback.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbox-outline" size={64} color={COLORS.textMuted} />
          <Text style={styles.emptyText}>ไม่มี feedback</Text>
        </View>
      ) : (
        <FlatList
          data={filteredFeedback}
          renderItem={renderFeedback}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Detail Modal */}
      <ModalContainer
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="รายละเอียด Feedback"
        fullScreen
      >
        {selectedFeedback && (
          <View style={styles.modalContent}>
            {/* User Info */}
            <Card style={styles.modalCard}>
              <View style={styles.modalUserRow}>
                <Avatar name={selectedFeedback.userName} size={50} />
                <View style={styles.modalUserInfo}>
                  <Text style={styles.modalUserName}>{selectedFeedback.userName}</Text>
                  <Text style={styles.modalUserEmail}>{selectedFeedback.userEmail}</Text>
                </View>
              </View>
              {renderStars(selectedFeedback.rating, 24)}
            </Card>

            {/* Feedback Content */}
            <Card style={styles.modalCard}>
              <View style={styles.typeRow}>
                <Ionicons name={getTypeIcon(selectedFeedback.type) as any} size={20} color={COLORS.primary} />
                <Text style={styles.modalTypeText}>{getTypeLabel(selectedFeedback.type)}</Text>
              </View>
              
              <Text style={styles.modalTitle}>{selectedFeedback.title}</Text>
              <Text style={styles.modalMessage}>{selectedFeedback.message}</Text>
              
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  📱 {selectedFeedback.platform} v{selectedFeedback.appVersion}
                </Text>
                <Text style={styles.metaText}>
                  {formatRelativeTime(selectedFeedback.createdAt)}
                </Text>
              </View>
            </Card>

            {/* Admin Response */}
            {selectedFeedback.adminResponse && (
              <Card style={styles.modalCard}>
                <Text style={styles.responseLabel}>📢 การตอบกลับ:</Text>
                <Text style={styles.responseText}>{selectedFeedback.adminResponse}</Text>
              </Card>
            )}

            {/* Actions */}
            {selectedFeedback.status !== 'resolved' && (
              <View style={styles.actionButtons}>
                {!selectedFeedback.adminResponse && (
                  <Button
                    title="💬 ตอบกลับ"
                    onPress={() => setShowRespondModal(true)}
                    style={styles.actionButton}
                  />
                )}
                <Button
                  title="✅ แก้ไขแล้ว"
                  variant="outline"
                  onPress={handleMarkResolved}
                  style={styles.actionButton}
                />
              </View>
            )}
          </View>
        )}
      </ModalContainer>

      {/* Respond Modal */}
      <ModalContainer
        visible={showRespondModal}
        onClose={() => setShowRespondModal(false)}
        title="ตอบกลับ Feedback"
      >
        <View style={styles.respondContent}>
          <TextInput
            style={[styles.respondInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            placeholder="พิมพ์ข้อความตอบกลับ..."
            placeholderTextColor={colors.textMuted}
            value={response}
            onChangeText={setResponse}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{response.length}/500</Text>
          
          <View style={styles.respondButtons}>
            <Button
              title="ยกเลิก"
              variant="outline"
              onPress={() => {
                setShowRespondModal(false);
                setResponse('');
              }}
              style={{ flex: 1 }}
            />
            <Button
              title="ส่ง"
              onPress={handleRespond}
              loading={isSubmitting}
              disabled={!response.trim()}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </ModalContainer>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  feedbackCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  feedbackInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  feedbackUserName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  typeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  feedbackTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  feedbackMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  feedbackDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.lg,
    color: COLORS.error,
    fontWeight: '600',
  },
  modalContent: {
    padding: SPACING.md,
  },
  modalCard: {
    marginBottom: SPACING.md,
  },
  modalUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalUserInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  modalUserName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalUserEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  modalTypeText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  modalMessage: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  responseLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: SPACING.sm,
  },
  responseText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
  },
  respondContent: {
    padding: SPACING.md,
  },
  respondInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  charCount: {
    textAlign: 'right',
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  respondButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
});
