import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Loading, EmptyState } from '../../components/common';
import {
  getUserNotifications,
  subscribeToNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  Notification,
  NotificationType,
} from '../../services/notificationsService';
import { formatRelativeTime } from '../../utils/helpers';
import { getJobById } from '../../services/jobService';

// ============================================
// Helper Functions
// ============================================
const getNotificationIcon = (type: NotificationType): string => {
  const icons: Record<NotificationType, string> = {
    new_job: 'briefcase',
    application_sent: 'paper-plane',
    application_viewed: 'eye',
    application_accepted: 'checkmark-circle',
    application_rejected: 'close-circle',
    new_message: 'chatbubble',
    new_applicant: 'person-add',
    job_expired: 'time',
    profile_reminder: 'person',
    system: 'information-circle',
  };
  return icons[type] || 'notifications';
};

const getNotificationColor = (type: NotificationType): string => {
  const colorMap: Record<NotificationType, string> = {
    new_job: COLORS.primary,
    application_sent: COLORS.info,
    application_viewed: COLORS.secondary,
    application_accepted: COLORS.success,
    application_rejected: COLORS.error,
    new_message: COLORS.primary,
    new_applicant: COLORS.secondary,
    job_expired: COLORS.warning,
    profile_reminder: COLORS.info,
    system: COLORS.textSecondary,
  };
  return colorMap[type] || COLORS.primary;
};

// Group notifications by date
const groupNotificationsByDate = (notifications: Notification[]) => {
  const groups: { [key: string]: Notification[] } = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  notifications.forEach((notification) => {
    const date = notification.createdAt instanceof Date 
      ? notification.createdAt 
      : (notification.createdAt as any)?.toDate?.() || new Date(notification.createdAt as any);
    
    let dateKey: string;
    if (isSameDay(date, today)) {
      dateKey = 'วันนี้';
    } else if (isSameDay(date, yesterday)) {
      dateKey = 'เมื่อวาน';
    } else if (isThisWeek(date)) {
      dateKey = 'สัปดาห์นี้';
    } else {
      dateKey = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(notification);
  });
  
  // Convert to section format
  return Object.entries(groups).map(([title, data]) => ({
    title,
    data,
  }));
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
};

const isThisWeek = (date: Date) => {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  return date >= weekStart;
};

export default function NotificationsScreen() {
  // ============================================
  // 1. ALL HOOKS MUST BE AT THE TOP - ALWAYS CALLED UNCONDITIONALLY
  // ============================================
  
  // Context hooks
  const navigation = useNavigation();
  const { user, requireAuth } = useAuth();
  const { colors } = useTheme();
  
  // State hooks
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Callback hooks
  const loadNotifications = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await getUserNotifications(user.uid);
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(async (notification: Notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }
    const { type, data } = notification;
    if (type === 'new_message' && data?.conversationId) {
      (navigation as any).navigate('ChatRoom', {
        conversationId: data.conversationId,
      });
    } else if ((type === 'new_job' || type === 'application_accepted' || type === 'application_rejected') && data?.jobId) {
      try {
        const job = await getJobById(data.jobId);
        if (job) {
          (navigation as any).navigate('JobDetail', { job });
        }
      } catch (e) {
        // job may have been deleted, skip navigation
      }
    } else if (type === 'new_applicant' && data?.applicationId) {
      (navigation as any).navigate('Applicants');
    }
  }, [navigation]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await markAllAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถอ่านทั้งหมดได้');
    }
  }, [user?.uid]);

  const handleDelete = useCallback((notification: Notification) => {
    Alert.alert(
      'ลบการแจ้งเตือน',
      'ต้องการลบการแจ้งเตือนนี้หรือไม่?',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notification.id);
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
            } catch (error) {
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบได้');
            }
          },
        },
      ]
    );
  }, []);

  // Effect hooks
  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = subscribeToNotifications(user.uid, (newNotifications) => {
      setNotifications(newNotifications);
      setIsLoading(false);
      setIsRefreshing(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Memo hooks - MUST be before any conditional returns
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(notifications);
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  // Render function callbacks
  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  ), []);

  const renderNotification = useCallback(({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.isRead && styles.unread]}
      onPress={() => handleNotificationPress(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: getNotificationColor(item.type) + '20' },
        ]}
      >
        <Ionicons
          name={getNotificationIcon(item.type) as any}
          size={24}
          color={getNotificationColor(item.type)}
        />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, !item.isRead && styles.titleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  ), [handleNotificationPress, handleDelete]);

  // ============================================
  // 2. NOW CONDITIONAL RETURNS ARE SAFE
  // ============================================

  // Early return for unauthenticated users
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: colors.surface }]}> 
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>การแจ้งเตือน</Text>
          <View style={{ width: 80 }} />
        </View>
        <EmptyState
          icon="notifications-outline"
          title="เข้าสู่ระบบเพื่อดูการแจ้งเตือน"
          subtitle="รับการแจ้งเตือนงานใหม่และข้อความ"
          actionLabel="เข้าสู่ระบบ"
          onAction={() => (navigation as any).navigate('Auth')}
        />
      </SafeAreaView>
    );
  }

  // Early return for loading state
  if (isLoading) {
    return <Loading message="กำลังโหลด..." />;
  }

  // ============================================
  // 3. MAIN RENDER
  // ============================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>การแจ้งเตือน</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
            <Text style={styles.markAllRead}>อ่านทั้งหมด</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <SectionList
        sections={groupedNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
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
            icon="notifications-off-outline"
            title="ไม่มีการแจ้งเตือน"
            subtitle="เมื่อมีกิจกรรมใหม่ จะแสดงที่นี่"
          />
        }
      />
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    textAlign: 'center',
  },
  markAllButton: {
    width: 80,
    alignItems: 'flex-end',
  },
  markAllRead: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  list: {
    paddingBottom: 100,
  },
  sectionHeader: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  unread: {
    backgroundColor: COLORS.primaryBackground,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '600',
  },
  body: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  time: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
    marginLeft: SPACING.sm,
    alignSelf: 'center',
  },
});