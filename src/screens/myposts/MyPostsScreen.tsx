// ============================================
// MY POSTS SCREEN - ประกาศของฉัน
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
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Loading, EmptyState, KittenButton as Button, Avatar } from '../../components/common';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import { getUserPosts, updateJobStatus, deleteJob, subscribeToUserPosts } from '../../services/jobService';
import { canUseFreeUrgent, markFreeUrgentUsed } from '../../services/subscriptionService';
import { JobPost } from '../../types';
import { formatRelativeTime, formatDate } from '../../utils/helpers';
import { Timestamp } from 'firebase/firestore';

// ============================================
// Types
// ============================================
type StatusFilter = 'all' | 'active' | 'urgent' | 'closed' | 'expired' | 'deleted';

// ============================================
// Component
// ============================================
export default function MyPostsScreen() {
  const navigation = useNavigation();
  const { user, requireAuth } = useAuth();
  const { colors } = useTheme();
  
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedPost, setSelectedPost] = useState<JobPost | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);
  const [lastBackPressAt, setLastBackPressAt] = useState(0);

  const closeAlert = () => setAlert(initialAlertState);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;

      const onBackPress = () => {
        if ((navigation as any).canGoBack?.()) {
          navigation.goBack();
          return true;
        }

        const now = Date.now();
        if (now - lastBackPressAt < 2000) {
          BackHandler.exitApp();
          return true;
        }

        setLastBackPressAt(now);
        ToastAndroid.show('กดกลับอีกครั้งเพื่อออกจากแอพ', ToastAndroid.SHORT);
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [lastBackPressAt, navigation])
  );

  // Load user's posts
  const loadPosts = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const userPosts = await getUserPosts(user.uid);
      setPosts(userPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดประกาศได้'), visible: true });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid]);

  // Real-time subscription to user's posts
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToUserPosts(user.uid, (newPosts) => {
      setPosts(newPosts);
      setIsLoading(false);
      setIsRefreshing(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPosts();
  };

  // Filter posts by status
  const filteredPosts = posts.filter(post => {
    if (statusFilter === 'all') return true;
    return post.status === statusFilter;
  });

  // Stats
  const stats = {
    total: posts.length,
    active: posts.filter(p => p.status === 'active').length,
    urgent: posts.filter(p => p.status === 'urgent').length,
    closed: posts.filter(p => p.status === 'closed').length,
    expired: posts.filter(p => p.status === 'expired').length,
    deleted: posts.filter(p => p.status === 'deleted').length,
  };

  // Handle post actions
  const handlePostAction = (post: JobPost) => {
    setSelectedPost(post);
    setShowActionModal(true);
  };

  const handleClosePost = async () => {
    if (!selectedPost) return;

    setAlert({
      ...createAlert.warning('ปิดประกาศ', 'คุณต้องการปิดประกาศนี้หรือไม่?\nผู้คนจะไม่เห็นประกาศนี้อีก'),
      visible: true, // Ensure 'visible' is explicitly set
      buttons: [
        { text: 'ยกเลิก', style: 'cancel', onPress: closeAlert },
        {
          text: 'ปิดประกาศ',
          style: 'destructive',
          onPress: async () => {
            closeAlert();
            try {
              await updateJobStatus(selectedPost.id, 'closed');
              setPosts(prev =>
                prev.map(p => (p.id === selectedPost.id ? { ...p, status: 'closed' as const } : p))
              );
              setShowActionModal(false);
              setAlert({ ...createAlert.success('สำเร็จ', 'ประกาศถูกปิดเรียบร้อยแล้ว'), visible: true });
            } catch (error) {
              setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', 'ไม่สามารถปิดประกาศได้'), visible: true });
            }
          },
        },
      ],
    } as AlertState);
  };

  const handleReactivatePost = async () => {
    if (!selectedPost) return;

    try {
      await updateJobStatus(selectedPost.id, 'active');
      setPosts(prev =>
        prev.map(p => (p.id === selectedPost.id ? { ...p, status: 'active' as const } : p))
      );
      setShowActionModal(false);
      setAlert({ ...createAlert.success('สำเร็จ', 'เปิดประกาศใหม่เรียบร้อยแล้ว'), visible: true });
    } catch (error) {
      setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', 'ไม่สามารถเปิดประกาศได้'), visible: true });
    }
  };

  const handleMarkUrgent = async () => {
    if (!selectedPost || !user) return;

    try {
      const canUseFree = await canUseFreeUrgent(user.uid);
      
      if (canUseFree) {
        setAlert({
          ...createAlert.info('🎁 สิทธิ์พิเศษ Premium', 'คุณได้รับปุ่มด่วนฟรี 1 ครั้ง\nจากการเป็นสมาชิก Premium!\n\nต้องการใช้ตอนนี้หรือไม่?'),
          buttons: [
            { text: 'ยกเลิก', style: 'cancel', onPress: closeAlert },
            {
              text: '🎁 ใช้สิทธิ์ฟรี',
              onPress: async () => {
                closeAlert();
                try {
                  await updateJobStatus(selectedPost.id, 'urgent');
                  await markFreeUrgentUsed(user.uid);
                  setPosts(prev =>
                    prev.map(p => (p.id === selectedPost.id ? { ...p, status: 'urgent' as const } : p))
                  );
                  setShowActionModal(false);
                  setAlert({ ...createAlert.success('สำเร็จ', 'ทำเครื่องหมายด่วนเรียบร้อยแล้ว!'), visible: true });
                } catch (error) {
                  setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตได้'), visible: true });
                }
              },
            },
          ],
        } as AlertState);
      } else {
        setShowActionModal(false);
        setAlert({
          ...createAlert.warning('⚡ ทำเครื่องหมายด่วน', `ทำให้ประกาศ "${selectedPost.title}" โดดเด่นขึ้น!\n\nราคา: ฿49`),
          buttons: [
            { text: 'ยกเลิก', style: 'cancel', onPress: closeAlert },
            {
              text: 'ชำระเงิน ฿49',
              onPress: () => {
                closeAlert();
                setAlert({ ...createAlert.info('ระบบชำระเงิน', 'ระบบชำระเงินกำลังพัฒนา\นติดต่อ admin เพื่อทำเครื่องหมายด่วน'), visible: true });
              },
            },
          ],
        } as AlertState);
      }
    } catch (error) {
      setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', 'ไม่สามารถอัปเดตได้'), visible: true });
    }
  };

  const handleDeletePost = async () => {
    if (!selectedPost) return;

    setAlert({
      ...createAlert.error('🗑️ ลบประกาศ', 'คุณต้องการลบประกาศนี้ถาวรหรือไม่?\nการดำเนินการนี้ไม่สามารถย้อนกลับได้'),
      buttons: [
        { text: 'ยกเลิก', style: 'cancel', onPress: closeAlert },
        {
          text: 'ลบถาวร',
          style: 'destructive',
          onPress: async () => {
            closeAlert();
            try {
              await deleteJob(selectedPost.id);
              setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
              setShowActionModal(false);
              setAlert({ ...createAlert.success('สำเร็จ', 'ลบประกาศเรียบร้อยแล้ว'), visible: true });
            } catch (error) {
              setAlert({ ...createAlert.error('เกิดข้อผิดพลาด', 'ไม่สามารถลบประกาศได้'), visible: true });
            }
          },
        },
      ],
    } as AlertState);
  };

  const handleEditPost = () => {
    if (!selectedPost) return;
    setShowActionModal(false);
    const serialized = {
      ...selectedPost,
      shiftDate: (selectedPost as any).shiftDate ? ((selectedPost as any).shiftDate instanceof Date ? (selectedPost as any).shiftDate.toISOString() : (selectedPost as any).shiftDate) : undefined,
      shiftDateEnd: (selectedPost as any).shiftDateEnd ? ((selectedPost as any).shiftDateEnd instanceof Date ? (selectedPost as any).shiftDateEnd.toISOString() : (selectedPost as any).shiftDateEnd) : undefined,
    } as any;
    (navigation as any).navigate('Main', { screen: 'PostJob', params: { editJob: serialized } });
  };

  const handleExtendPost = () => {
    if (!selectedPost) return;
    setShowActionModal(false);
    setAlert({
      ...createAlert.info('⏰ ต่ออายุประกาศ', `ต่ออายุประกาศ "${selectedPost.title}\"\nเพิ่มอีก 1 วัน\n\nราคา: ฿19`),
      buttons: [
        { text: 'ยกเลิก', style: 'cancel', onPress: closeAlert },
        {
          text: 'ชำระเงิน ฿19',
          onPress: () => {
            closeAlert();
            setAlert({ ...createAlert.info('ระบบชำระเงิน', 'ระบบชำระเงินกำลังพัฒนา\นติดต่อ admin เพื่อต่ออายุ'), visible: true });
          },
        },
      ],
    } as AlertState);
  };

  const handleViewApplicants = () => {
    if (!selectedPost) return;
    setShowActionModal(false);
    (navigation as any).navigate('Applicants', { jobId: selectedPost.id });
  };

  const getPostDateLabel = (item: JobPost) => {
    if (item.postType === 'job') {
      return item.startDateNote || 'เริ่มงานตามตกลง';
    }
    return formatDate(item.shiftDate);
  };

  const getPostTimeLabel = (item: JobPost) => {
    if (item.postType === 'job') {
      return item.workHours || item.shiftTime || 'เวลางานตามตกลง';
    }
    return item.shiftTime;
  };

  const getRateLabel = (item: JobPost) => {
    return item.postType === 'job' ? 'เงินเดือน' : 'ค่าตอบแทน';
  };

  // Render post item
  const renderPostItem = ({ item }: { item: JobPost }) => {
    const statusConfig = {
      active: { label: 'กำลังเปิด', color: colors.success, bg: colors.successLight },
      urgent: { label: 'ด่วน', color: colors.error, bg: colors.errorLight || '#FFEBEE' },
      closed: { label: 'ปิดแล้ว', color: colors.textMuted, bg: colors.backgroundSecondary },
      expired: { label: 'หมดอายุ', color: colors.warning, bg: colors.warningLight },
      deleted: { label: 'ถูกลบ', color: colors.error, bg: colors.errorLight },
    };

    const status = statusConfig[item.status] || statusConfig.active;

    return (
      <TouchableOpacity
        style={[styles.postCard, item.status === 'closed' && styles.postCardClosed]}
        onPress={() => handlePostAction(item)}
        activeOpacity={0.7}
      >
        <View style={styles.postHeader}>
          <View style={styles.postInfo}>
            <Text style={styles.postTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.postLocation} numberOfLines={1}>
              📍 {item.location?.hospital || item.location?.province || 'ไม่ระบุ'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.postDetails}>
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                {getPostDateLabel(item)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.detailText}>{getPostTimeLabel(item)}</Text>
            </View>
          </View>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Ionicons name="medical-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.detailText}>{item.department}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.rateText}>{getRateLabel(item)} 💰 {item.shiftRate?.toLocaleString()} บาท/{item.rateType === 'hour' ? 'ชม.' : item.rateType === 'day' ? 'วัน' : item.rateType === 'month' ? 'เดือน' : 'เวร'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.postFooter}>
          <Text style={styles.postTime}>
            โพสต์ {formatRelativeTime(item.createdAt)}
          </Text>
          <View style={styles.postStats}>
            {/* Days remaining */}
            {item.status !== 'closed' && (() => {
              const now = new Date();
              let expiryDate: Date | null = null;
              
              // Try to get expiry date from various sources
              if (item.expiresAt) {
                if (item.expiresAt instanceof Date) {
                  expiryDate = item.expiresAt;
                } else if (typeof item.expiresAt === 'object' && item.expiresAt.toDate) {
                  expiryDate = item.expiresAt.toDate();
                } else if (typeof item.expiresAt === 'string' || typeof item.expiresAt === 'number') {
                  expiryDate = new Date(item.expiresAt);
                }
              }
              
              // If no expiresAt, calculate from createdAt (30 days default)
              if (!expiryDate && item.createdAt) {
                const createdDate = item.createdAt instanceof Timestamp
                  ? item.createdAt.toDate()
                  : item.createdAt;
                expiryDate = new Date(createdDate.getTime() + 30 * 24 * 60 * 60 * 1000);
              }
              
              if (!expiryDate || isNaN(expiryDate.getTime())) {
                return null;
              }
              
              const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysLeft <= 0) {
                return (
                  <View style={[styles.statItem, { marginRight: 8 }]}>
                    <Ionicons name="alert-circle" size={14} color={colors.error} />
                    <Text style={[styles.statText, { color: colors.error }]}>หมดอายุแล้ว</Text>
                  </View>
                );
              } else if (daysLeft <= 3) {
                return (
                  <View style={[styles.statItem, { marginRight: 8 }]}>
                    <Ionicons name="time" size={14} color={colors.warning} />
                    <Text style={[styles.statText, { color: colors.warning }]}>เหลือ {daysLeft} วัน</Text>
                  </View>
                );
              } else {
                return (
                  <View style={[styles.statItem, { marginRight: 8 }]}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={styles.statText}>เหลือ {daysLeft} วัน</Text>
                  </View>
                );
              }
            })()}
            <View style={styles.statItem}>
              <Ionicons name="eye-outline" size={14} color={colors.textMuted} />
              <Text style={styles.statText}>{item.viewsCount || 0}</Text>
            </View>
          </View>
        </View>

        {/* Action hint */}
        <View style={styles.actionHint}>
          <Text style={styles.actionHintText}>แตะเพื่อจัดการ</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>
    );
  };

  // Render header
  const renderHeader = () => (
    <View style={styles.statsContainer}>
      <TouchableOpacity
        style={[styles.statCard, statusFilter === 'all' && styles.statCardActive]}
        onPress={() => setStatusFilter('all')}
      >
        <Text style={styles.statNumber}>{stats.total}</Text>
        <Text style={styles.statLabel}>ทั้งหมด</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statCard, statusFilter === 'active' && styles.statCardActive]}
        onPress={() => setStatusFilter('active')}
      >
        <Text style={[styles.statNumber, { color: colors.success }]}>{stats.active}</Text>
        <Text style={styles.statLabel}>กำลังเปิด</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statCard, statusFilter === 'urgent' && styles.statCardActive]}
        onPress={() => setStatusFilter('urgent')}
      >
        <Text style={[styles.statNumber, { color: colors.error }]}>{stats.urgent}</Text>
        <Text style={styles.statLabel}>ด่วน</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statCard, statusFilter === 'closed' && styles.statCardActive]}
        onPress={() => setStatusFilter('closed')}
      >
        <Text style={[styles.statNumber, { color: colors.textMuted }]}>{stats.closed}</Text>
        <Text style={styles.statLabel}>ปิดแล้ว</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statCard, statusFilter === 'expired' && styles.statCardActive]}
        onPress={() => setStatusFilter('expired')}
      >
        <Text style={[styles.statNumber, { color: colors.warning }]}>{stats.expired}</Text>
        <Text style={styles.statLabel}>หมดอายุ</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statCard, statusFilter === 'deleted' && styles.statCardActive]}
        onPress={() => setStatusFilter('deleted')}
      >
        <Text style={[styles.statNumber, { color: colors.error }]}>{stats.deleted}</Text>
        <Text style={styles.statLabel}>ถูกลบ</Text>
      </TouchableOpacity>
    </View>
  );

  const safeGoBack = () => {
    try {
      if ((navigation as any)?.canGoBack && (navigation as any).canGoBack()) {
        (navigation as any).goBack();
      } else {
        (navigation as any).navigate('Main', { screen: 'Home' });
      }
    } catch (e) {
      // fallback
      (navigation as any).navigate('Main', { screen: 'Home' });
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={safeGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ประกาศของฉัน</Text>
          <View style={{ width: 40 }} />
        </View>
        <EmptyState
          icon="lock-closed-outline"
          title="กรุณาเข้าสู่ระบบ"
          description="เข้าสู่ระบบเพื่อดูประกาศของคุณ"
          actionText="เข้าสู่ระบบ"
          onAction={() => requireAuth(() => {})}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={safeGoBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ประกาศของฉัน</Text>
          <View style={{ width: 40 }} />
        </View>
        <Loading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={safeGoBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ประกาศของฉัน</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            // Navigate to PostJob screen
            (navigation as any).navigate('Main', { screen: 'PostJob' });
          }}
        >
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      {posts.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="ยังไม่มีประกาศ"
          description="คุณยังไม่ได้สร้างประกาศใดๆ ลองสร้างประกาศใหม่ดูสิ!"
          actionText="สร้างประกาศ"
          onAction={() => (navigation as any).navigate('Main', { screen: 'PostJob' })}
        />
      ) : (
        <FlatList
          data={filteredPosts}
          renderItem={renderPostItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyFilter}>
              <Text style={styles.emptyFilterText}>
                ไม่มีประกาศในหมวดนี้
              </Text>
            </View>
          }
        />
      )}

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            
            {selectedPost && (
              <>
                <Text style={styles.modalTitle}>{selectedPost.title}</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedPost.location?.hospital || selectedPost.location?.province}
                </Text>

                <View style={styles.modalActions}>
                  {/* View Applicants */}
                  <TouchableOpacity style={styles.modalAction} onPress={handleViewApplicants}>
                    <View style={[styles.modalActionIcon, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="people" size={22} color={colors.primary} />
                    </View>
                    <Text style={styles.modalActionText}>ดูผู้สนใจ</Text>
                  </TouchableOpacity>

                  {/* Edit */}
                  <TouchableOpacity style={styles.modalAction} onPress={handleEditPost}>
                    <View style={[styles.modalActionIcon, { backgroundColor: colors.infoLight || '#E3F2FD' }]}>
                      <Ionicons name="create" size={22} color={colors.info} />
                    </View>
                    <Text style={styles.modalActionText}>แก้ไข</Text>
                  </TouchableOpacity>

                  {/* Extend Post */}
                  {selectedPost.status !== 'closed' && (
                    <TouchableOpacity style={styles.modalAction} onPress={handleExtendPost}>
                      <View style={[styles.modalActionIcon, { backgroundColor: '#E8F5E9' }]}>
                        <Ionicons name="time" size={22} color="#4CAF50" />
                      </View>
                      <Text style={styles.modalActionText}>ต่ออายุ ฿19</Text>
                    </TouchableOpacity>
                  )}

                  {/* Mark Urgent */}
                  {selectedPost.status !== 'urgent' && selectedPost.status !== 'closed' && (
                    <TouchableOpacity style={styles.modalAction} onPress={handleMarkUrgent}>
                      <View style={[styles.modalActionIcon, { backgroundColor: colors.warningLight || '#FFF3E0' }]}>
                        <Ionicons name="flash" size={22} color={colors.warning} />
                      </View>
                      <Text style={styles.modalActionText}>ด่วน ฿49</Text>
                    </TouchableOpacity>
                  )}

                  {/* Close/Reactivate */}
                  {selectedPost.status === 'closed' ? (
                    <TouchableOpacity style={styles.modalAction} onPress={handleReactivatePost}>
                      <View style={[styles.modalActionIcon, { backgroundColor: colors.successLight }]}>
                        <Ionicons name="refresh" size={22} color={colors.success} />
                      </View>
                      <Text style={styles.modalActionText}>เปิดใหม่</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.modalAction} onPress={handleClosePost}>
                      <View style={[styles.modalActionIcon, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="close-circle" size={22} color={colors.textSecondary} />
                      </View>
                      <Text style={styles.modalActionText}>ปิดประกาศ</Text>
                    </TouchableOpacity>
                  )}

                  {/* Delete */}
                  <TouchableOpacity style={styles.modalAction} onPress={handleDeletePost}>
                    <View style={[styles.modalActionIcon, { backgroundColor: colors.errorLight || '#FFEBEE' }]}>
                      <Ionicons name="trash" size={22} color={colors.error} />
                    </View>
                    <Text style={[styles.modalActionText, { color: colors.error }]}>ลบถาวร</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setShowActionModal(false)}
                >
                  <Text style={styles.cancelButtonText}>ยกเลิก</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Custom Alert (SweetAlert style) */}
      <CustomAlert
        visible={alert.visible}
        type={alert.type}
        title={alert.title}
        message={alert.message}
        buttons={alert.buttons}
        onClose={closeAlert}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xxl,
  },

  // Stats
  statsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    ...SHADOWS.small,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  statCardActive: {
    borderColor: COLORS.primary,
  },
  statNumber: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Post Card
  postCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  postCardClosed: {
    opacity: 0.7,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  postInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  postTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  postLocation: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },

  // Post Details
  postDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  rateText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
  },

  // Post Footer
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  postTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  postStats: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },

  // Action Hint
  actionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
  },
  actionHintText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
  },

  // Empty Filter
  emptyFilter: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
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
    textAlign: 'center',
    marginTop: 4,
    marginBottom: SPACING.lg,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  modalAction: {
    width: '30%',
    alignItems: 'center',
  },
  modalActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  modalActionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});

