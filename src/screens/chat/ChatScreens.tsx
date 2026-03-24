// ============================================
// CHAT SCREENS v2 — NurseGo Design System
// Feature-complete: swipe delete/hide, read receipts,
// in-app toast, push notifications
// ============================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  StatusBar,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PanGestureHandler, PinchGestureHandler, State, Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useChatNotification } from '../../context/ChatNotificationContext';
import { useOnboardingSurveyEnabled } from '../../hooks/useOnboardingSurveyEnabled';
import { useScreenPerformance } from '../../hooks/useScreenPerformance';
import { useTabRefresh } from '../../hooks/useTabRefresh';
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { formatRelativeTime } from '../../utils/helpers';
import FirstVisitTip from '../../components/common/FirstVisitTip';
import StickyInboxPanel from '../../components/common/StickyInboxPanel';
import {
  subscribeToMessages,
  subscribeToConversations,
  markConversationAsRead,
  sendMessage,
  deleteMessage,
  deleteConversation,
  hideConversation,
  sendImage,
  sendSavedDocument,
  sendLocationMessage,
  getConversationChatAvailability,
} from '../../services/chatService';
import { Message } from '../../types';
import { trackEvent } from '../../services/analyticsService';
import { StickyInboxItem, subscribeStickyInboxItems } from '../../services/communicationsService';
import { getUserDocuments, Document as SavedDocument, formatFileSize } from '../../services/documentsService';
import MapPickerModal, { PickedLocation } from '../../components/common/MapPickerModal';
import { useI18n, translate } from '../../i18n';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Helpers ────────────────────────────────
function formatTime(date: any, lang = 'th'): string {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return translate(lang as any, 'chat.yesterday');
  if (diffDays < 7) return translate(lang as any, 'chat.daysAgo', { count: String(diffDays) });
  return d.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short' });
}

// QUICK_REPLY_TEMPLATES is defined inside ChatRoomScreen (needs t() hook)

// ─── Simple Avatar fallback ─────────────────
function Avatar({ uri, name, size }: { uri?: string; name: string; size: number }) {
  const [imgError, setImgError] = React.useState(false);
  const initial = (name || '?')[0].toUpperCase();
  const colours = ['#0EA5E9','#10B981','#F59E0B','#8B5CF6','#EF4444'];
  const bg = colours[initial.charCodeAt(0) % colours.length];

  if (uri && !imgError) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setImgError(true)} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFF', fontSize: size * 0.4, fontWeight: '700' }}>{initial}</Text>
    </View>
  );
}

// ============================================
// SWIPEABLE CONVERSATION ROW
// ============================================
interface ConvItemProps {
  item: any;
  userId: string;
  onPress: () => void;
  onHide: () => void;
  onDelete: () => void;
  colors: any;
}

function ConversationRow({ item, userId, onPress, onHide, onDelete, colors }: ConvItemProps) {
  const { t, resolvedLanguage } = useI18n();
  const swipeRef = useRef<Swipeable>(null);
  const other = item.participantDetails?.find((p: any) => p.id !== userId);
  const unread = item.unreadBy?.[userId] ?? item.unreadCount ?? 0;
  const isUnread = unread > 0;

  const renderLeft = () => (
    <TouchableOpacity
      style={[styles.swipeAction, { backgroundColor: '#64748B', borderTopLeftRadius: 16, borderBottomLeftRadius: 16 }]}
      onPress={() => { swipeRef.current?.close(); onHide(); }}
    >
      <Ionicons name="eye-off-outline" size={22} color="#FFF" />
      <Text style={styles.swipeLabel}>{t('chat.hide')}</Text>
    </TouchableOpacity>
  );

  const renderRight = () => (
    <TouchableOpacity
      style={[styles.swipeAction, { backgroundColor: '#EF4444', borderTopRightRadius: 16, borderBottomRightRadius: 16 }]}
      onPress={() => { swipeRef.current?.close(); onDelete(); }}
    >
      <Ionicons name="trash-outline" size={22} color="#FFF" />
      <Text style={styles.swipeLabel}>{t('chat.delete')}</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeft}
      renderRightActions={renderRight}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
    >
      <TouchableOpacity
        style={[
          styles.convRow,
          { backgroundColor: isUnread ? colors.primaryBackground : colors.card, borderBottomColor: colors.borderLight },
        ]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.convAvatarWrap}>
          <Avatar uri={other?.photoURL} name={other?.displayName || other?.name || '?'} size={52} />
          {isUnread && <View style={[styles.onlineDot, { backgroundColor: colors.primary, borderColor: colors.card }]} />}
        </View>

        <View style={styles.convContent}>
          <View style={styles.convTop}>
            <Text style={[styles.convName, { color: colors.text, fontWeight: isUnread ? '700' : '500' }]} numberOfLines={1}>
              {other?.displayName || other?.name || t('chat.unknownUser')}
            </Text>
            <Text style={[styles.convTime, { color: colors.textMuted }]}>
              {item.lastMessageAt ? formatTime(item.lastMessageAt, resolvedLanguage) : ''}
            </Text>
          </View>

          {item.jobTitle ? (
            <Text style={[styles.convJob, { color: colors.primary }]} numberOfLines={1}>📋 {item.jobTitle}</Text>
          ) : null}

          <View style={styles.convBottom}>
            <Text
              style={[styles.convMsg, { color: isUnread ? colors.text : colors.textSecondary, fontWeight: isUnread ? '600' : '400' }]}
              numberOfLines={1}
            >
              {item.lastMessage || t('chat.startConversation')}
            </Text>
            {isUnread && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ============================================
// CHAT LIST SCREEN
// ============================================
export function ChatListScreen({ navigation }: any) {
  const { t, resolvedLanguage } = useI18n();
  useScreenPerformance('ChatList');
  const { user } = useAuth();
  const { colors } = useTheme();
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  const insets = useSafeAreaInsets();
  const headerBackground = colors.primary;
  const listRef = useRef<FlatList<any>>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [stickyInboxItems, setStickyInboxItems] = useState<StickyInboxItem[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    const unsub = subscribeToConversations(user.uid, (convs: any[]) => {
      setConversations(convs);
      setIsLoading(false);
    }, {
      screenName: 'ChatList',
      source: 'chat:list_subscription',
    });
    return unsub;
  }, [user?.uid, refreshVersion]);

  useTabRefresh(() => {
    if (!user?.uid) return;
    setIsLoading(true);
    setRefreshVersion((value) => value + 1);
  }, {
    scrollToTop: () => listRef.current?.scrollToOffset({ offset: 0, animated: true }),
  });

  useEffect(() => {
    if (!user?.uid) return;
    trackEvent({
      eventName: 'chat_list_view',
      screenName: 'ChatList',
      subjectType: 'conversation_list',
      subjectId: user.uid,
    });
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = subscribeStickyInboxItems('chat', setStickyInboxItems);
    return () => unsubscribe();
  }, []);

  // Not logged in
  if (!user) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
        <StatusBar backgroundColor={headerBackground} barStyle="light-content" translucent={false} />
        <View style={[styles.chatHeader, { backgroundColor: headerBackground, paddingTop: insets.top + 14 }]}> 
          <Text style={styles.chatHeaderTitle}>{t('chat.messagesTitle')}</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="chatbubble-outline" size={56} color={colors.border} />
          <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>{t('chat.notLoggedIn')}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>{t('chat.loginToSeeMessages')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const visible = conversations.filter(
    c =>
      !c.deletedBy?.includes(user?.uid || '') &&
      !c.hiddenBy?.includes(user?.uid || '') &&
      (!search || (c.participantDetails?.find((p: any) => p.id !== user?.uid)?.displayName || '')
        .toLowerCase().includes(search.toLowerCase()))
  );

  const hidden = conversations.filter(
    c => c.hiddenBy?.includes(user?.uid || '') && !c.deletedBy?.includes(user?.uid || '')
  );

  const handlePress = (c: any) => {
    const other = c.participantDetails?.find((p: any) => p.id !== user?.uid);
    trackEvent({
      eventName: 'chat_room_view',
      screenName: 'ChatList',
      subjectType: 'conversation',
      subjectId: c.id,
      conversationId: c.id,
      jobId: c.jobId || undefined,
      props: {
        source: 'chat_list',
        hasUnread: Boolean(c.unreadBy?.[user?.uid || ''] ?? c.unreadCount ?? 0),
        jobTitle: c.jobTitle || null,
      },
    });

    navigation.navigate('ChatRoom', {
      conversationId: c.id,
      recipientId: other?.id,
      recipientName: other?.displayName || other?.name || t('chat.unknownUser'),
      recipientPhoto: other?.photoURL,
      jobTitle: c.jobTitle,
      jobId: c.jobId,
    });
  };

  const handleHide = async (c: any) => {
    if (!user?.uid) return;
    try { await hideConversation(c.id, user.uid); } catch {
      Alert.alert(t('chat.error'), t('common.alerts.hideError'));
    }
  };

  const handleDelete = (c: any) => {
    const other = c.participantDetails?.find((p: any) => p.id !== user?.uid);
    Alert.alert(
      t('chat.deleteConversationTitle'),
      t('chat.deleteConversationMessage', { name: other?.displayName || other?.name || t('chat.unknownUser') }),
      [
        { text: t('chat.cancel'), style: 'cancel' },
        {
          text: t('chat.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(c.id, user.uid);
            } catch (error: any) {
              Alert.alert(t('chat.error'), error?.message || t('chat.deleteConversationError'));
            }
          },
        },
      ]
    );
  };

  const unhide = async (c: any) => {
    if (!user?.uid) return;
    try {
      const { unhideConversation } = await import('../../services/chatService');
      await unhideConversation(c.id, user.uid);
    } catch {
      Alert.alert(t('chat.error'), t('common.alerts.unhideError'));
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
        <StatusBar backgroundColor={headerBackground} barStyle="light-content" translucent={false} />
        <View style={[styles.chatHeader, { backgroundColor: headerBackground, paddingTop: insets.top + 14 }]}> 
          <Text style={styles.chatHeaderTitle}>{t('chat.messagesTitle')}</Text>
        </View>
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
      <StatusBar backgroundColor={headerBackground} barStyle="light-content" translucent={false} />
      <View style={[styles.chatHeader, { backgroundColor: headerBackground, paddingTop: insets.top + 14 }]}> 
        <Text style={styles.chatHeaderTitle}>{t('chat.messagesTitle')}</Text>
        {hidden.length > 0 && (
          <TouchableOpacity onPress={() => setShowHidden(true)} style={styles.hiddenBtn}>
            <Ionicons name="eye-off-outline" size={18} color="rgba(255,255,255,0.85)" />
            <Text style={styles.hiddenBtnText}>{hidden.length}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('chat.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {user?.uid && (
        <FirstVisitTip
          storageKey={`first_tip_chat_${user.uid}`}
          icon="chatbubbles-outline"
          title={t('chat.firstVisitTipTitle')}
          description={t('chat.firstVisitTipDescription')}
          actionLabel={t('chat.viewGuide')}
          onAction={onboardingSurveyEnabled ? () => navigation.navigate('OnboardingSurvey') : undefined}
          containerStyle={{ marginHorizontal: SPACING.md, marginTop: SPACING.md, marginBottom: 4 }}
        />
      )}

      <StickyInboxPanel items={stickyInboxItems} maxItems={2} containerStyle={{ marginHorizontal: SPACING.md, marginTop: SPACING.sm, marginBottom: 4 }} />

      {visible.length === 0 && !search ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('chat.noMessages')}</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>{t('chat.noMessagesDescription')}</Text>
          <Text style={[styles.swipeHint, { color: colors.textMuted }]}>{t('chat.swipeHint')}</Text>
        </View>
      ) : (
        <>
          {visible.length > 0 && (
            <Text style={[styles.swipeHintInline, { color: colors.textMuted }]}>{t('chat.swipeHint')}</Text>
          )}
          <FlatList
            ref={listRef}
            data={visible}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <ConversationRow
                item={item}
                userId={user?.uid || ''}
                onPress={() => handlePress(item)}
                onHide={() => handleHide(item)}
                onDelete={() => handleDelete(item)}
                colors={colors}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        </>
      )}

      <Modal visible={showHidden} animationType="slide" onRequestClose={() => setShowHidden(false)}>
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
          <StatusBar backgroundColor={headerBackground} barStyle="light-content" translucent={false} />
          <View style={[styles.chatHeader, { backgroundColor: headerBackground, paddingTop: insets.top + 14 }]}> 
            <TouchableOpacity onPress={() => setShowHidden(false)} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={[styles.chatHeaderTitle, { marginLeft: 8 }]}>{t('chat.hiddenChatsTitle', { count: String(hidden.length) })}</Text>
            <View style={{ width: 32 }} />
          </View>
          {hidden.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>{t('chat.noHiddenChats')}</Text>
            </View>
          ) : (
            <FlatList
              data={hidden}
              keyExtractor={i => i.id}
              renderItem={({ item }) => {
                const other = item.participantDetails?.find((p: any) => p.id !== user?.uid);
                return (
                  <View style={[styles.convRow, { backgroundColor: colors.card, borderBottomColor: colors.borderLight }]}>
                    <Avatar uri={other?.photoURL} name={other?.displayName || '?'} size={48} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.convName, { color: colors.text }]}>{other?.displayName || other?.name || t('chat.unknownUser')}</Text>
                      <Text style={[styles.convMsg, { color: colors.textSecondary }]} numberOfLines={1}>{item.lastMessage || ''}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.unhideBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }]}
                      onPress={() => unhide(item)}
                    >
                      <Text style={[styles.unhideBtnText, { color: colors.primary }]}>{t('chat.unhide')}</Text>
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================
// MESSAGE BUBBLE
// ============================================
function MessageBubble({
  msg,
  isOwn,
  colors,
  onLongPress,
  onImagePress,
}: {
  msg: Message;
  isOwn: boolean;
  colors: any;
  onLongPress: () => void;
  onImagePress: (uri: string) => void;
}) {
  const { t, resolvedLanguage } = useI18n();
  const isDeleted = (msg as any).isDeleted;
  const hasImage = (msg as any).imageUrl;
  const hasDocument = Boolean((msg as any).fileUrl) && ['document', 'saved_document'].includes((msg as any).type || '');
  const hasLocation = (msg as any).type === 'location' && Boolean((msg as any).location);
  const time = msg.createdAt ? formatTime(msg.createdAt, resolvedLanguage) : ''

  return (
    <View style={[styles.bubbleWrap, isOwn ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}>
      <TouchableOpacity
        onLongPress={isOwn && !isDeleted ? onLongPress : undefined}
        activeOpacity={0.85}
        style={[
          styles.bubble,
          isOwn
            ? [styles.bubbleOwn, { backgroundColor: colors.primary }]
            : [styles.bubbleOther, { backgroundColor: colors.card, borderColor: colors.border }],
          isDeleted && { opacity: 0.5 },
        ]}
      >
        {isDeleted ? (
          <Text style={[styles.deletedText, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>{t('chat.messageDeleted')}</Text>
        ) : hasImage ? (
          <TouchableOpacity
            onPress={() => onImagePress((msg as any).imageUrl)}
            activeOpacity={0.9}
          >
            <Image source={{ uri: (msg as any).imageUrl }} style={styles.msgImage} resizeMode="cover" onError={() => {}} />
            <View style={styles.imageHintBadge}>
              <Ionicons name="open-outline" size={12} color="#FFF" />
              <Text style={styles.imageHintText}>{t('chat.tapToOpen')}</Text>
            </View>
          </TouchableOpacity>
        ) : hasDocument ? (
          <TouchableOpacity
            onPress={() => Linking.openURL((msg as any).fileUrl).catch(() => Alert.alert(t('chat.error'), t('chat.openDocError')))}
            activeOpacity={0.9}
            style={[styles.docBubble, { borderColor: isOwn ? 'rgba(255,255,255,0.25)' : colors.border }]}
          >
            <View style={[styles.docIconWrap, { backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : colors.primaryBackground }]}>
              <Ionicons name="document-text-outline" size={20} color={isOwn ? '#FFF' : colors.primary} />
            </View>
            <View style={styles.docMeta}>
              <Text style={[styles.docName, { color: isOwn ? '#FFF' : colors.text }]} numberOfLines={1}>{(msg as any).fileName || t('chat.attachedDocument')}</Text>
              <Text style={[styles.docHint, { color: isOwn ? 'rgba(255,255,255,0.72)' : colors.textMuted }]}>{t('chat.tapToOpenDocument')}</Text>
            </View>
          </TouchableOpacity>
        ) : hasLocation ? (
          <TouchableOpacity
            onPress={() => {
              const location = (msg as any).location;
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`).catch(() => Alert.alert(t('chat.error'), t('chat.openMapError')));
            }}
            activeOpacity={0.9}
            style={[styles.docBubble, { borderColor: isOwn ? 'rgba(255,255,255,0.25)' : colors.border }]}
          >
            <View style={[styles.docIconWrap, { backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : colors.primaryBackground }]}>
              <Ionicons name="location-outline" size={20} color={isOwn ? '#FFF' : colors.primary} />
            </View>
            <View style={styles.docMeta}>
              <Text style={[styles.docName, { color: isOwn ? '#FFF' : colors.text }]} numberOfLines={2}>{(msg as any).location.address || t('chat.pinnedLocation')}</Text>
              <Text style={[styles.docHint, { color: isOwn ? 'rgba(255,255,255,0.72)' : colors.textMuted }]}>{t('chat.tapToOpenMap')}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.bubbleText, { color: isOwn ? '#FFF' : colors.text }]}>{msg.text}</Text>
        )}
        <Text style={[styles.bubbleTime, { color: isOwn ? 'rgba(255,255,255,0.65)' : colors.textMuted }]}>
          {time}{isOwn ? ` ${(msg as any).isRead ? '✓✓' : '✓'}` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================
// CHAT ROOM SCREEN
// ============================================
export function ChatRoomScreen({ navigation, route }: any) {
  const { t, resolvedLanguage } = useI18n();
  const QUICK_REPLY_TEMPLATES = useMemo(() => [
    t('chat.quickReplyInterested'),
    t('chat.quickReplyDocsSent'),
    t('chat.quickReplyMoreDetails'),
    t('chat.quickReplyWhenToChat'),
  ], [t]);
  useScreenPerformance('ChatRoom');
  const { conversationId, recipientId, recipientName, recipientPhoto, jobTitle, jobId: routeJobId } = route.params;
  const { user } = useAuth();
  const { colors } = useTheme();
  const { setActiveConversationId } = useChatNotification();

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [imagePreviewUri, setImagePreviewUri] = useState<string | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [chatLockReason, setChatLockReason] = useState<string | null>(null);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showSavedDocsModal, setShowSavedDocsModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [savedDocuments, setSavedDocuments] = useState<SavedDocument[]>([]);
  const [isLoadingSavedDocs, setIsLoadingSavedDocs] = useState(false);
  const [conversationJobId, setConversationJobId] = useState<string | null>(routeJobId || null);
  const [conversationJobTitle, setConversationJobTitle] = useState<string | null>(jobTitle || null);
  const flatRef = useRef<FlatList>(null);

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const lastScale = useRef(1);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId]);

  useEffect(() => {
    trackEvent({
      eventName: 'chat_room_view',
      screenName: 'ChatRoom',
      subjectType: 'conversation',
      subjectId: conversationId,
      conversationId,
      props: {
        recipientName: recipientName || null,
        hasJobTitle: Boolean(jobTitle),
      },
    });
  }, [conversationId, jobTitle, recipientName]);

  useEffect(() => {
    const unsub = subscribeToMessages(conversationId, (msgs: Message[]) => {
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 80);
    }, {
      screenName: 'ChatRoom',
      source: 'chat:room_messages',
    });
    return unsub;
  }, [conversationId]);

  useEffect(() => {
    if (user?.uid) markConversationAsRead(conversationId, user.uid).catch(() => {});
  }, [conversationId, user?.uid]);

  useEffect(() => {
    let isMounted = true;
    const checkAvailability = async () => {
      const state = await getConversationChatAvailability(conversationId);
      if (!isMounted) return;
      setChatLockReason(state.isLocked ? (state.reason || t('chat.chatClosed')) : null);
      setConversationJobId(state.jobId || routeJobId || null);
      setConversationJobTitle(state.jobTitle || jobTitle || null);
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  const shouldLockChatFromError = (message?: string) => {
    if (!message) return false;
    return message.includes('แชทนี้ถูกปิด')
      || message.includes('งานปิดรับ')
      || message.includes('งานถูกลบ')
      || message.includes('งานหมดอายุ');
  };

  const sendTextMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed || isSending || !user?.uid || chatLockReason) return false;
    setIsSending(true);
    try {
      await trackEvent({
        eventName: 'message_sent',
        screenName: 'ChatRoom',
        subjectType: 'message',
        subjectId: conversationId,
        conversationId,
        props: {
          source: 'chat_room',
          messageType: 'text',
          textLength: trimmed.length,
        },
      });

      await sendMessage(conversationId, user.uid, user.displayName || t('chat.unknownUser'), trimmed);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
      return true;
    } catch (error: any) {
      const errorMessage = error?.message || t('chat.chatClosed');
      if (shouldLockChatFromError(errorMessage)) {
        setChatLockReason(errorMessage);
      }
      Alert.alert(t('chat.sendMessageFailed'), errorMessage);
      return false;
    } finally { setIsSending(false); }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || !user?.uid || chatLockReason) return;
    const sent = await sendTextMessage(trimmed);
    if (sent) {
      setText('');
    }
  };

  const handleQuickReplyPress = async (messageText: string) => {
    await sendTextMessage(messageText);
  };

  const handleImagePick = async () => {
    if (chatLockReason) return;
    setShowAttachmentSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0] && user?.uid) {
      setIsSending(true);
      try {
        await trackEvent({
          eventName: 'message_sent',
          screenName: 'ChatRoom',
          subjectType: 'message',
          subjectId: conversationId,
          conversationId,
          props: {
            source: 'chat_room',
            messageType: 'image',
          },
        });

        await sendImage(conversationId, user.uid, user.displayName || t('chat.unknownUser'), result.assets[0].uri, 'photo.jpg');
      } catch (error: any) {
        const errorMessage = error?.message || t('chat.chatClosed');
        if (shouldLockChatFromError(errorMessage)) {
          setChatLockReason(errorMessage);
        }
        Alert.alert(t('chat.sendImageFailed'), errorMessage);
      } finally { setIsSending(false); }
    }
  };

  const openRecipientProfile = () => {
    if (!recipientId) return;
    navigation.navigate('UserProfile', {
      userId: recipientId,
      userName: recipientName,
      userPhoto: recipientPhoto,
    });
  };

  const handleOpenConversationJob = () => {
    const targetJobId = conversationJobId || routeJobId;
    if (!targetJobId) return;

    if (user?.role === 'hospital') {
      navigation.navigate('Applicants', {
        jobId: targetJobId,
        applicantUserId: recipientId,
      });
      return;
    }

    navigation.navigate('JobDetail', {
      jobId: targetJobId,
      source: 'chat_room',
    });
  };

  const loadSavedDocuments = async () => {
    if (!user?.uid) return;
    setIsLoadingSavedDocs(true);
    try {
      const docs = await getUserDocuments(user.uid);
      setSavedDocuments(docs.filter((doc) => Boolean(doc.fileUrl)));
    } catch {
      setSavedDocuments([]);
    } finally {
      setIsLoadingSavedDocs(false);
    }
  };

  const handleOpenSavedDocuments = async () => {
    setShowAttachmentSheet(false);
    await loadSavedDocuments();
    setShowSavedDocsModal(true);
  };

  const handleSendSavedDocument = async (document: SavedDocument) => {
    if (!user?.uid) return;

    setIsSending(true);
    try {
      await trackEvent({
        eventName: 'message_sent',
        screenName: 'ChatRoom',
        subjectType: 'message',
        subjectId: conversationId,
        conversationId,
        props: {
          source: 'chat_room',
          messageType: 'saved_document',
          documentType: document.type,
          documentStatus: document.status,
        },
      });

      await sendSavedDocument(
        conversationId,
        user.uid,
        user.displayName || t('chat.unknownUser'),
        document.fileUrl,
        document.fileName || document.name,
        document.type,
      );

      setShowSavedDocsModal(false);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (error: any) {
      Alert.alert(t('chat.sendDocFailed'), error?.message || t('chat.pleaseTryAgain'));
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmLocation = async (picked: PickedLocation) => {
    if (!user?.uid) return;

    setShowMapPicker(false);
    setIsSending(true);
    try {
      await trackEvent({
        eventName: 'message_sent',
        screenName: 'ChatRoom',
        subjectType: 'message',
        subjectId: conversationId,
        conversationId,
        props: {
          source: 'chat_room',
          messageType: 'location',
        },
      });

      await sendLocationMessage(conversationId, user.uid, user.displayName || t('chat.unknownUser'), picked);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (error: any) {
      const errorMessage = error?.message || t('chat.pleaseTryAgain');
      if (shouldLockChatFromError(errorMessage)) {
        setChatLockReason(errorMessage);
      }
      Alert.alert(t('chat.sendLocationFailed'), errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMsg = async () => {
    if (!selectedMsg || !user?.uid) return;
    setShowActions(false);
    try { await deleteMessage(conversationId, selectedMsg.id, user.uid); }
    catch (e: any) { Alert.alert(t('chat.cannotDelete'), e.message); }
  };

  const resetImageViewer = () => {
    setImageScale(1);
    lastScale.current = 1;
    baseScale.setValue(1);
    pinchScale.setValue(1);
    lastOffset.current = { x: 0, y: 0 };
    translateX.setValue(0);
    translateY.setValue(0);
  };

  const handleCloseImageViewer = () => {
    setImagePreviewUri(null);
    resetImageViewer();
  };

  const setViewerScale = (next: number) => {
    const normalized = Math.max(1, Math.min(next, 4));
    lastScale.current = normalized;
    baseScale.setValue(normalized);
    pinchScale.setValue(1);
    setImageScale(normalized);
  };

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const next = lastScale.current * event.nativeEvent.scale;
      setViewerScale(next);
    }
  };

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.BEGAN) {
      translateX.setOffset(lastOffset.current.x);
      translateY.setOffset(lastOffset.current.y);
      translateX.setValue(0);
      translateY.setValue(0);
    }
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastOffset.current = {
        x: lastOffset.current.x + event.nativeEvent.translationX,
        y: lastOffset.current.y + event.nativeEvent.translationY,
      };
      translateX.setOffset(lastOffset.current.x);
      translateY.setOffset(lastOffset.current.y);
      translateX.setValue(0);
      translateY.setValue(0);
    }
  };

  const handleDownloadImage = async () => {
    if (!imagePreviewUri || isDownloadingImage) return;

    setIsDownloadingImage(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('chat.cannotSaveImage'), t('chat.grantPhotoPermission'));
        return;
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error(t('chat.storageNotFound'));
      }

      const localPath = `${baseDir}chat_${Date.now()}.jpg`;
      const downloaded = await FileSystem.downloadAsync(imagePreviewUri, localPath);
      const asset = await MediaLibrary.createAssetAsync(downloaded.uri);

      const albumName = 'NurseGo';
      const album = await MediaLibrary.getAlbumAsync(albumName);
      if (!album) {
        await MediaLibrary.createAlbumAsync(albumName, asset, false);
      } else {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      }

      Alert.alert(t('chat.savedSuccessfully'), t('chat.imageSavedToAlbum'));
    } catch (error: any) {
      Alert.alert(t('chat.cannotSaveImage'), error?.message || t('chat.pleaseTryAgain'));
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.uid;
    const prev = index > 0 ? messages[index - 1] : null;
    const toDate = (v: any) => v?.toDate ? v.toDate() : new Date(v);
    const showDate = !prev ||
      toDate(item.createdAt).toDateString() !== toDate(prev.createdAt).toDateString();
    return (
      <>
        {showDate && (
          <View style={styles.dateSep}>
            <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dateSepText, { color: colors.textMuted, backgroundColor: colors.background }]}>
              {toDate(item.createdAt).toLocaleDateString(resolvedLanguage === 'th' ? 'th-TH' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
            </Text>
            <View style={[styles.dateSepLine, { backgroundColor: colors.border }]} />
          </View>
        )}
        <MessageBubble
          msg={item}
          isOwn={isOwn}
          colors={colors}
          onLongPress={() => { setSelectedMsg(item); setShowActions(true); }}
          onImagePress={(uri) => {
            resetImageViewer();
            setImagePreviewUri(uri);
          }}
        />
      </>
    );
  };

  const insets = useSafeAreaInsets();
  const headerBackground = colors.primary;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['left', 'right', 'bottom']}>
      <StatusBar backgroundColor={headerBackground} barStyle="light-content" translucent={false} />
      <View style={[styles.roomHeader, { backgroundColor: headerBackground, paddingTop: insets.top + 12 }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.roomHeaderProfileTap} activeOpacity={0.85} onPress={openRecipientProfile} disabled={!recipientId}>
          <Avatar uri={recipientPhoto} name={recipientName || t('chat.unknownUser')} size={38} />
          <View style={styles.roomHeaderCenter}>
            <Text style={styles.roomHeaderName} numberOfLines={1}>{recipientName}</Text>
            {conversationJobTitle && <Text style={styles.roomHeaderSub} numberOfLines={1}>📋 {conversationJobTitle}</Text>}
          </View>
        </TouchableOpacity>
        {conversationJobId ? (
          <TouchableOpacity style={styles.roomHeaderActionBtn} onPress={handleOpenConversationJob}>
            <Ionicons name={user?.role === 'hospital' ? 'checkmark-circle-outline' : 'briefcase-outline'} size={16} color="#FFF" />
            <Text style={styles.roomHeaderActionText}>{user?.role === 'hospital' ? 'เลือกคนนี้' : 'ดูประกาศ'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderItem}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
        />

        {chatLockReason ? (
          <View style={[styles.chatLockBanner, { backgroundColor: colors.warningLight || '#FFF7ED', borderTopColor: colors.warning || '#F59E0B' }]}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.warning || '#F59E0B'} />
            <Text style={[styles.chatLockBannerText, { color: colors.warning || '#B45309' }]}>{chatLockReason}</Text>
          </View>
        ) : null}

        {!chatLockReason && (
          <View style={styles.quickReplySection}>
            <View style={styles.quickReplyHeader}>
              <View style={[styles.quickReplyHeaderIcon, { backgroundColor: colors.primaryBackground || '#E0F2FE' }]}>
                <Ionicons name="flash-outline" size={14} color={colors.primary} />
              </View>
              <Text style={[styles.quickReplyHeaderTitle, { color: colors.text }]}>{t('chat.quickReplies')}</Text>
              <Text style={[styles.quickReplyHeaderHint, { color: colors.textMuted }]}>{t('chat.tapToSendInstantly')}</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickReplyRow}
            >
              {QUICK_REPLY_TEMPLATES.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.quickReplyChip, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => handleQuickReplyPress(item)}
                  disabled={isSending}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles-outline" size={13} color={colors.primary} style={styles.quickReplyChipIcon} />
                  <Text style={[styles.quickReplyChipText, { color: colors.text }]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={[styles.inputBar, {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        }]}>
          <TouchableOpacity onPress={() => setShowAttachmentSheet(true)} style={styles.attBtn} disabled={Boolean(chatLockReason)}>
            <Ionicons name="add-circle-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={[styles.msgInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder={chatLockReason ? t('chat.chatClosed') : t('chat.inputPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            editable={!chatLockReason}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || isSending || Boolean(chatLockReason)}
            style={[styles.sendBtn, { backgroundColor: text.trim() && !chatLockReason ? colors.primary : colors.border }]}
          >
            {isSending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.actionOverlay} onPress={() => setShowActions(false)} activeOpacity={1}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.actionTitle, { color: colors.textSecondary }]}>{t('chat.manageMessage')}</Text>
            <TouchableOpacity style={styles.actionItem} onPress={handleDeleteMsg}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionItemText, { color: '#EF4444' }]}>{t('chat.deleteMessage')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionItem, { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={() => setShowActions(false)}
            >
              <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionItemText, { color: colors.textSecondary }]}>{t('chat.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showAttachmentSheet} transparent animationType="fade" onRequestClose={() => setShowAttachmentSheet(false)}>
        <TouchableOpacity style={styles.actionOverlay} onPress={() => setShowAttachmentSheet(false)} activeOpacity={1}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.actionTitle, { color: colors.textSecondary }]}>{t('chat.attachInChat')}</Text>
            <TouchableOpacity style={styles.actionItem} onPress={handleImagePick}>
              <Ionicons name="image-outline" size={20} color={colors.text} />
              <Text style={[styles.actionItemText, { color: colors.text }]}>{t('chat.choosePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={handleOpenSavedDocuments}>
              <Ionicons name="document-text-outline" size={20} color={colors.text} />
              <Text style={[styles.actionItemText, { color: colors.text }]}>{t('chat.sendFromMyDocuments')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={() => { setShowAttachmentSheet(false); setShowMapPicker(true); }}>
              <Ionicons name="location-outline" size={20} color={colors.text} />
              <Text style={[styles.actionItemText, { color: colors.text }]}>{t('chat.sendPinnedLocation')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionItem, { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={() => setShowAttachmentSheet(false)}
            >
              <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionItemText, { color: colors.textSecondary }]}>{t('chat.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={showSavedDocsModal} transparent animationType="slide" onRequestClose={() => setShowSavedDocsModal(false)}>
        <TouchableOpacity style={styles.actionOverlay} onPress={() => setShowSavedDocsModal(false)} activeOpacity={1}>
          <TouchableOpacity activeOpacity={1} style={[styles.savedDocsSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <Text style={[styles.actionTitle, { color: colors.textSecondary }]}>{t('chat.chooseUploadedDoc')}</Text>
            {isLoadingSavedDocs ? (
              <View style={styles.savedDocsLoading}><ActivityIndicator color={colors.primary} /></View>
            ) : savedDocuments.length === 0 ? (
              <View style={styles.savedDocsEmpty}>
                <Text style={[styles.savedDocsEmptyText, { color: colors.textSecondary }]}>{t('chat.noSavedDocuments')}</Text>
              </View>
            ) : (
              <FlatList
                data={savedDocuments}
                keyExtractor={(item) => item.id}
                style={styles.savedDocsList}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.savedDocRow, { borderBottomColor: colors.border }]} onPress={() => handleSendSavedDocument(item)}>
                    <View style={[styles.docIconWrap, { backgroundColor: colors.primaryBackground }]}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.savedDocMeta}>
                      <Text style={[styles.savedDocName, { color: colors.text }]} numberOfLines={1}>{item.fileName || item.name}</Text>
                      <Text style={[styles.savedDocSub, { color: colors.textMuted }]} numberOfLines={1}>{item.name} · {formatFileSize(item.fileSize)}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={!!imagePreviewUri}
        transparent
        animationType="fade"
        onRequestClose={handleCloseImageViewer}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={handleCloseImageViewer}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>

          <PanGestureHandler
            enabled={imageScale > 1.01}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanHandlerStateChange}
          >
            <Animated.View style={styles.imageViewerStage}>
              <PinchGestureHandler
                onGestureEvent={onPinchGestureEvent}
                onHandlerStateChange={onPinchHandlerStateChange}
              >
                <Animated.Image
                  source={imagePreviewUri ? { uri: imagePreviewUri } : undefined}
                  style={[
                    styles.imageViewerImage,
                    {
                      transform: [
                        { translateX },
                        { translateY },
                        { scale },
                      ],
                    },
                  ]}
                  resizeMode="contain"
                />
              </PinchGestureHandler>
            </Animated.View>
          </PanGestureHandler>

          <View style={styles.imageViewerFooter}>
            <View style={styles.imageViewerControls}>
              <TouchableOpacity style={styles.imageControlBtn} onPress={() => setViewerScale(imageScale - 0.25)}>
                <Ionicons name="remove" size={20} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.imageScaleText}>{Math.round(imageScale * 100)}%</Text>
              <TouchableOpacity style={styles.imageControlBtn} onPress={() => setViewerScale(imageScale + 0.25)}>
                <Ionicons name="add" size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.imageControlBtn, styles.imageResetBtn]} onPress={resetImageViewer}>
                <Text style={styles.imageControlText}>{t('chat.reset')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageControlBtn, styles.imageDownloadBtn]}
                onPress={handleDownloadImage}
                disabled={isDownloadingImage}
              >
                {isDownloadingImage
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Ionicons name="download-outline" size={18} color="#FFF" />}
              </TouchableOpacity>
            </View>
            <Text style={styles.imageViewerHint}>{t('chat.imageViewerHint')}</Text>
          </View>
        </View>
      </Modal>

      <MapPickerModal
        visible={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={handleConfirmLocation}
      />
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },

  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chatHeaderTitle: { fontSize: 22, fontWeight: '700', color: '#FFF', flex: 1 },
  hiddenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  hiddenBtnText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },

  swipeAction: { justifyContent: 'center', alignItems: 'center', width: 80, gap: 4 },
  swipeLabel: { fontSize: 11, color: '#FFF', fontWeight: '600' },

  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 10,
  },
  convAvatarWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 13, height: 13, borderRadius: 7,
    borderWidth: 2, borderColor: '#FFF', // overridden inline when needed
  },
  convContent: { flex: 1, minWidth: 0 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  convName: { fontSize: 15, flex: 1, marginRight: 8 },
  convTime: { fontSize: 11 },
  convJob: { fontSize: 12, marginBottom: 3 },
  convBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convMsg: { fontSize: 14, flex: 1 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 6 },
  unreadText: { fontSize: 10, color: '#FFF', fontWeight: '700' },

  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  emptyDesc: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  swipeHint: { fontSize: 12, marginTop: 16 },
  swipeHintInline: { fontSize: 11, textAlign: 'center', paddingVertical: 5 },

  unhideBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, borderWidth: 1 },
  unhideBtnText: { fontSize: 13, fontWeight: '600' },

  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  roomHeaderProfileTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  roomHeaderCenter: { flex: 1, minWidth: 0 },
  roomHeaderName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  roomHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  roomHeaderActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  roomHeaderActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  msgList: { paddingHorizontal: 8, paddingVertical: 12, gap: 2 },
  bubbleWrap: { flexDirection: 'row', marginVertical: 2 },
  bubbleWrapOwn: { justifyContent: 'flex-end' },
  bubbleWrapOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: SCREEN_W * 0.72, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, gap: 3 },
  bubbleOwn: { borderBottomRightRadius: 4 },
  bubbleOther: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  bubbleTime: { fontSize: 10, alignSelf: 'flex-end' },
  deletedText: { fontSize: 13, fontStyle: 'italic' },
  docBubble: {
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  docIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMeta: { flex: 1, minWidth: 0 },
  docName: { fontSize: 14, fontWeight: '700' },
  docHint: { marginTop: 2, fontSize: 12 },
  msgImage: { width: 200, height: 200, borderRadius: 12 },
  imageHintBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  imageHintText: { color: '#FFF', fontSize: 10, fontWeight: '600' },

  dateSep: { flexDirection: 'row', alignItems: 'center', marginVertical: 12, gap: 8 },
  dateSepLine: { flex: 1, height: 1 },
  dateSepText: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 6,
  },
  chatLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  chatLockBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  quickReplyRow: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  quickReplySection: {
    paddingTop: 10,
  },
  quickReplyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 2,
  },
  quickReplyHeaderIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  quickReplyHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  quickReplyHeaderHint: {
    marginLeft: 'auto',
    fontSize: 11,
  },
  quickReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  quickReplyChipIcon: {
    marginRight: 6,
  },
  quickReplyChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  attBtn: { padding: 6, alignSelf: 'flex-end', marginBottom: 4 },
  msgInput: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 15,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-end' },

  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  actionSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, overflow: 'hidden' },
  actionTitle: { textAlign: 'center', fontSize: 13, paddingVertical: 14 },
  actionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, gap: 14 },
  actionItemText: { fontSize: 15, fontWeight: '500' },
  savedDocsSheet: {
    marginTop: 'auto',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 6,
    paddingBottom: 24,
    maxHeight: '72%',
  },
  savedDocsLoading: {
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedDocsEmpty: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  savedDocsEmptyText: { fontSize: 14 },
  savedDocsList: { maxHeight: 420 },
  savedDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  savedDocMeta: { flex: 1, minWidth: 0 },
  savedDocName: { fontSize: 14, fontWeight: '700' },
  savedDocSub: { fontSize: 12, marginTop: 2 },

  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 3,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  imageViewerStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerImage: {
    width: SCREEN_W,
    height: '75%',
  },
  imageViewerFooter: {
    alignItems: 'center',
    paddingBottom: 28,
    paddingHorizontal: 16,
  },
  imageViewerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  imageControlBtn: {
    minWidth: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
  },
  imageResetBtn: {
    borderRadius: 14,
    minWidth: 62,
    height: 36,
  },
  imageDownloadBtn: {
    borderRadius: 14,
    minWidth: 46,
    height: 36,
    backgroundColor: 'rgba(14,165,233,0.75)',
  },
  imageControlText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  imageScaleText: {
    color: '#FFF',
    minWidth: 52,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  imageViewerHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
  },
});
