import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Loading, EmptyState, Avatar, StickyInboxPanel } from '../../components/common';
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
import { setBroadcastAttribution, trackEvent } from '../../services/analyticsService';
import { recordBroadcastOpen } from '../../services/adminService';
import { navigateFromNotification } from '../../services/notificationNavigation';
import { StickyInboxItem, subscribeStickyInboxItems } from '../../services/communicationsService';
import { useScreenPerformance } from '../../hooks/useScreenPerformance';
import { useI18n } from '../../i18n';

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
    new_application: 'person-add',
    nearby_job: 'location',
    job_expired: 'time',
    job_expiring: 'alarm',
    profile_reminder: 'person',
    job_completed_review: 'star',
    new_review: 'chatbox-ellipses',
    license_approved: 'shield-checkmark',
    license_rejected: 'shield-outline',
    admin_verification_request: 'document-text',
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
    new_application: COLORS.secondary,
    nearby_job: COLORS.primary,
    job_expired: COLORS.warning,
    job_expiring: COLORS.warning,
    profile_reminder: COLORS.info,
    job_completed_review: COLORS.warning,
    new_review: COLORS.primary,
    license_approved: COLORS.success,
    license_rejected: COLORS.error,
    admin_verification_request: COLORS.info,
    system: COLORS.textSecondary,
  };
  return colorMap[type] || COLORS.primary;
};

// Group notifications by date
const groupNotificationsByDate = (notifications: Notification[], t: any, resolvedLanguage: string) => {
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
      dateKey = t('notifications.today');
    } else if (isSameDay(date, yesterday)) {
      dateKey = t('notifications.yesterday');
    } else if (isThisWeek(date)) {
      dateKey = t('notifications.thisWeek');
    } else {
      dateKey = date.toLocaleDateString(resolvedLanguage === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const { t, resolvedLanguage } = useI18n();
  useScreenPerformance('Notifications');
  // ============================================
  // 1. ALL HOOKS MUST BE AT THE TOP - ALWAYS CALLED UNCONDITIONALLY
  // ============================================
  
  // Context hooks
  const navigation = useNavigation();
  const { user, requireAuth } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const panelBackground = colors.surface;
  const sectionBackground = colors.backgroundSecondary;
  const unreadBackground = colors.primaryBackground;
  const headerBackground = isDark ? colors.surface : colors.primary;
  const headerTextColor = isDark ? colors.text : colors.white;
  
  // State hooks
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stickyInboxItems, setStickyInboxItems] = useState<StickyInboxItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Callback hooks
  const loadNotifications = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const data = await getUserNotifications(user.uid, {
        screenName: 'Notifications',
        source: 'notifications:screen_load',
      });
      setNotifications(data);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert(t('common.alerts.loadErrorTitle'), t('common.alerts.loadErrorMessage'));
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
    if (notification.data?.broadcastId) {
      setBroadcastAttribution({
        broadcastId: String(notification.data.broadcastId),
        variantId: notification.data?.variantId ? String(notification.data.variantId) : undefined,
        targetScreen: notification.data?.targetScreen ? String(notification.data.targetScreen) : undefined,
      });
      await recordBroadcastOpen({
        broadcastId: String(notification.data.broadcastId),
        variantId: notification.data?.variantId ? String(notification.data.variantId) : undefined,
        targetScreen: notification.data?.targetScreen ? String(notification.data.targetScreen) : undefined,
      });
    }

    await trackEvent({
      eventName: 'notification_opened',
      screenName: 'Notifications',
      subjectType: 'notification',
      subjectId: notification.id,
      jobId: notification.data?.jobId,
      conversationId: notification.data?.conversationId,
      props: {
        notificationType: notification.type,
        wasRead: notification.isRead,
        broadcastId: notification.data?.broadcastId,
        variantId: notification.data?.variantId,
      },
    });

    if (!notification.isRead) {
      await markAsRead(notification.id);
      setNotifications(prev =>
        prev.map(n => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
    }
    await navigateFromNotification({ current: navigation as any }, notification, user?.uid);
  }, [navigation, user?.uid]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await trackEvent({
        eventName: 'notification_opened',
        screenName: 'Notifications',
        subjectType: 'notification_batch',
        subjectId: user.uid,
        props: {
          action: 'mark_all_read',
          unreadCount,
        },
      });

      await markAllAsRead(user.uid);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      Alert.alert(t('notifications.error'), t('notifications.markAllReadError'));
    }
  }, [unreadCount, user?.uid]);

  const handleDelete = useCallback((notification: Notification) => {
    Alert.alert(
      t('notifications.deleteNotificationTitle'),
      t('notifications.deleteNotificationMessage'),
      [
        { text: t('notifications.cancel'), style: 'cancel' },
        {
          text: t('notifications.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteNotification(notification.id);
              setNotifications(prev => prev.filter(n => n.id !== notification.id));
            } catch (error) {
              Alert.alert(t('notifications.error'), t('notifications.deleteError'));
            }
          },
        },
      ]
    );
  }, []);

  // Effect hooks
  useEffect(() => {
    const unsubscribe = subscribeStickyInboxItems('notifications', setStickyInboxItems);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    const unsubscribe = subscribeToNotifications(user.uid, (newNotifications) => {
      setNotifications(newNotifications);
      setIsLoading(false);
      setIsRefreshing(false);
    }, {
      screenName: 'Notifications',
      source: 'notifications:screen_subscription',
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Memo hooks - MUST be before any conditional returns
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByDate(notifications, t, resolvedLanguage);
  }, [notifications]);

  // Render function callbacks
  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: sectionBackground, borderBottomColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</Text>
    </View>
  ), [colors.border, colors.textSecondary, sectionBackground]);

  const renderNotification = useCallback(({ item }: { item: Notification }) => (
    <TouchableOpacity
      style={[
        styles.notificationItem,
        { backgroundColor: item.isRead ? panelBackground : unreadBackground, borderBottomColor: colors.borderLight },
      ]}
      onPress={() => handleNotificationPress(item)}
      onLongPress={() => handleDelete(item)}
      activeOpacity={0.7}
    >
      {(item.type === 'new_message' || item.data?.senderPhotoURL || item.data?.targetUserPhoto) ? (
        <View style={styles.iconContainer}>
          <Avatar
            uri={item.data?.senderPhotoURL || item.data?.targetUserPhoto}
            name={item.data?.senderName || item.data?.targetName || item.title || t('notifications.unknownUser')}
            size={48}
          />
        </View>
      ) : (
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
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }, !item.isRead && styles.titleUnread]}>
          {item.title}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{formatRelativeTime(item.createdAt)}</Text>
      </View>
      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
    </TouchableOpacity>
  ), [colors.borderLight, colors.primary, colors.text, colors.textMuted, colors.textSecondary, handleDelete, handleNotificationPress, panelBackground, unreadBackground]);

  // ============================================
  // 2. NOW CONDITIONAL RETURNS ARE SAFE
  // ============================================

  // Early return for unauthenticated users
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={headerBackground} translucent={false} />
        <View style={[styles.header, { backgroundColor: headerBackground, borderBottomColor: 'transparent' }]}> 
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={headerTextColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: headerTextColor }]}>{t('notifications.title')}</Text>
          <View style={{ width: 80 }} />
        </View>
        <EmptyState
          icon="notifications-outline"
          title={t('notifications.loginToView')}
          subtitle={t('notifications.loginSubtitle')}
          actionLabel={t('notifications.login')}
          onAction={() => (navigation as any).navigate('Auth')}
        />
      </SafeAreaView>
    );
  }

  // Early return for loading state
  if (isLoading) {
    return <Loading message={t('notifications.loading')} />;
  }

  // ============================================
  // 3. MAIN RENDER
  // ============================================

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={headerBackground} translucent={false} />
      <View style={[styles.header, { backgroundColor: headerBackground, borderBottomColor: 'transparent' }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={headerTextColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: headerTextColor }]}>{t('notifications.title')}</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllButton}>
            <Text style={[styles.markAllRead, { color: isDark ? colors.primary : 'rgba(255,255,255,0.9)' }]}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      <View style={{ flex: 1, backgroundColor: colors.background }}>

      <StickyInboxPanel items={stickyInboxItems} maxItems={3} containerStyle={styles.announcementWrap} />

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
            title={t('notifications.empty')}
            subtitle={t('notifications.emptySubtitle')}
          />
        }
      />
      </View>
    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const createStyles = (COLORS: any) => StyleSheet.create({
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
  announcementWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
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