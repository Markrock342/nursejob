// ============================================
// CHAT SCREENS v2 — NurseGo Design System
// Feature-complete: swipe delete/hide, read receipts,
// in-app toast, push notifications
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
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
import { SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { formatRelativeTime } from '../../utils/helpers';
import {
  subscribeToMessages,
  subscribeToConversations,
  markConversationAsRead,
  sendMessage,
  deleteMessage,
  deleteConversation,
  hideConversation,
  sendImage,
} from '../../services/chatService';
import { Message } from '../../types';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Helpers ────────────────────────────────
function formatTime(date: any): string {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'เมื่อวาน';
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// ─── Simple Avatar fallback ─────────────────
function Avatar({ uri, name, size }: { uri?: string; name: string; size: number }) {
  const initial = (name || '?')[0].toUpperCase();
  const colours = ['#0EA5E9','#10B981','#F59E0B','#8B5CF6','#EF4444'];
  const bg = colours[initial.charCodeAt(0) % colours.length];

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
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
      <Text style={styles.swipeLabel}>ซ่อน</Text>
    </TouchableOpacity>
  );

  const renderRight = () => (
    <TouchableOpacity
      style={[styles.swipeAction, { backgroundColor: '#EF4444', borderTopRightRadius: 16, borderBottomRightRadius: 16 }]}
      onPress={() => { swipeRef.current?.close(); onDelete(); }}
    >
      <Ionicons name="trash-outline" size={22} color="#FFF" />
      <Text style={styles.swipeLabel}>ลบ</Text>
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
          {isUnread && <View style={[styles.onlineDot, { backgroundColor: colors.primary }]} />}
        </View>

        <View style={styles.convContent}>
          <View style={styles.convTop}>
            <Text style={[styles.convName, { color: colors.text, fontWeight: isUnread ? '700' : '500' }]} numberOfLines={1}>
              {other?.displayName || other?.name || 'ผู้ใช้'}
            </Text>
            <Text style={[styles.convTime, { color: colors.textMuted }]}>
              {item.lastMessageAt ? formatTime(item.lastMessageAt) : ''}
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
              {item.lastMessage || 'เริ่มต้นการสนทนา'}
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
  const { user } = useAuth();
  const { colors } = useTheme();
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setIsLoading(false);
      return;
    }
    const unsub = subscribeToConversations(user.uid, (convs: any[]) => {
      setConversations(convs);
      setIsLoading(false);
    });
    return unsub;
  }, [user?.uid]);

  // Not logged in
  if (!user) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.chatHeader, { backgroundColor: colors.primary }]}>
          <Text style={styles.chatHeaderTitle}>ข้อความ</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="chatbubble-outline" size={56} color={colors.border} />
          <Text style={{ color: colors.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '600' }}>ยังไม่ได้เข้าสู่ระบบ</Text>
          <Text style={{ color: colors.textMuted, marginTop: 8, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 }}>เข้าสู่ระบบเพื่อดูข้อความสนทนาของคุณ</Text>
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
    navigation.navigate('ChatRoom', {
      conversationId: c.id,
      recipientName: other?.displayName || other?.name || 'ผู้ใช้',
      jobTitle: c.jobTitle,
    });
  };

  const handleHide = async (c: any) => {
    if (!user?.uid) return;
    try { await hideConversation(c.id, user.uid); } catch {}
  };

  const handleDelete = (c: any) => {
    const other = c.participantDetails?.find((p: any) => p.id !== user?.uid);
    Alert.alert(
      'ลบการสนทนา',
      `ลบแชทกับ "${other?.displayName || 'ผู้ใช้'}" ออกจากรายการของคุณ?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConversation(c.id, user.uid);
            } catch (error: any) {
              Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถลบการสนทนาได้');
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
    } catch {}
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.chatHeader, { backgroundColor: colors.primary }]}>
          <Text style={styles.chatHeaderTitle}>ข้อความ</Text>
        </View>
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.chatHeader, { backgroundColor: colors.primary }]}>
        <Text style={styles.chatHeaderTitle}>ข้อความ</Text>
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
          placeholder="ค้นหาการสนทนา..."
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

      {visible.length === 0 && !search ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 12 }}>💬</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>ยังไม่มีข้อความ</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            เมื่อคุณติดต่อกับผู้โพสต์ ข้อความจะแสดงที่นี่
          </Text>
          <Text style={[styles.swipeHint, { color: colors.textMuted }]}>
            💡 ปัดซ้าย = ลบ · ปัดขวา = ซ่อน
          </Text>
        </View>
      ) : (
        <>
          {visible.length > 0 && (
            <Text style={[styles.swipeHintInline, { color: colors.textMuted }]}>
              💡 ปัดซ้าย = ลบ · ปัดขวา = ซ่อน
            </Text>
          )}
          <FlatList
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
        <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={[styles.chatHeader, { backgroundColor: colors.primary }]}>
            <TouchableOpacity onPress={() => setShowHidden(false)} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={[styles.chatHeaderTitle, { marginLeft: 8 }]}>แชทที่ซ่อน ({hidden.length})</Text>
            <View style={{ width: 32 }} />
          </View>
          {hidden.length === 0 ? (
            <View style={styles.centered}>
              <Text style={{ color: colors.textSecondary }}>ไม่มีแชทที่ซ่อน</Text>
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
                      <Text style={[styles.convName, { color: colors.text }]}>{other?.displayName || other?.name || 'ผู้ใช้'}</Text>
                      <Text style={[styles.convMsg, { color: colors.textSecondary }]} numberOfLines={1}>{item.lastMessage || ''}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.unhideBtn, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }]}
                      onPress={() => unhide(item)}
                    >
                      <Text style={[styles.unhideBtnText, { color: colors.primary }]}>นำกลับ</Text>
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
  const isDeleted = (msg as any).isDeleted;
  const hasImage = (msg as any).imageUrl;
  const time = msg.createdAt ? formatTime(msg.createdAt) : '';

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
          <Text style={[styles.deletedText, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>
            🗑 ข้อความนี้ถูกลบแล้ว
          </Text>
        ) : hasImage ? (
          <TouchableOpacity
            onPress={() => onImagePress((msg as any).imageUrl)}
            activeOpacity={0.9}
          >
            <Image source={{ uri: (msg as any).imageUrl }} style={styles.msgImage} resizeMode="cover" />
            <View style={styles.imageHintBadge}>
              <Ionicons name="open-outline" size={12} color="#FFF" />
              <Text style={styles.imageHintText}>แตะเพื่อเปิด</Text>
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
  const { conversationId, recipientName, jobTitle } = route.params;
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
    const unsub = subscribeToMessages(conversationId, (msgs: Message[]) => {
      setMessages(msgs);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 80);
    });
    return unsub;
  }, [conversationId]);

  useEffect(() => {
    if (user?.uid) markConversationAsRead(conversationId, user.uid).catch(() => {});
  }, [conversationId, user?.uid]);

  const handleSend = async () => {
    const t = text.trim();
    if (!t || isSending || !user?.uid) return;
    setText('');
    setIsSending(true);
    try {
      await sendMessage(conversationId, user.uid, user.displayName || 'ผู้ใช้', t);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    } finally { setIsSending(false); }
  };

  const handleImagePick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets[0] && user?.uid) {
      setIsSending(true);
      try { await sendImage(conversationId, user.uid, user.displayName || 'ผู้ใช้', result.assets[0].uri, 'photo.jpg'); }
      catch { Alert.alert('ข้อผิดพลาด', 'ส่งรูปภาพไม่สำเร็จ'); }
      finally { setIsSending(false); }
    }
  };

  const handleDeleteMsg = async () => {
    if (!selectedMsg || !user?.uid) return;
    setShowActions(false);
    try { await deleteMessage(conversationId, selectedMsg.id, user.uid); }
    catch (e: any) { Alert.alert('ไม่สามารถลบได้', e.message); }
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
        Alert.alert('บันทึกรูปไม่ได้', 'กรุณาอนุญาตสิทธิ์เข้าถึงรูปภาพก่อน');
        return;
      }

      const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!baseDir) {
        throw new Error('ไม่พบพื้นที่จัดเก็บไฟล์');
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

      Alert.alert('บันทึกสำเร็จ', 'รูปถูกบันทึกไว้ในอัลบั้ม NurseGo แล้ว');
    } catch (error: any) {
      Alert.alert('บันทึกรูปไม่ได้', error?.message || 'กรุณาลองใหม่อีกครั้ง');
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
              {toDate(item.createdAt).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' })}
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.roomHeader, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.roomHeaderCenter}>
          <Text style={styles.roomHeaderName} numberOfLines={1}>{recipientName}</Text>
          {jobTitle && <Text style={styles.roomHeaderSub} numberOfLines={1}>📋 {jobTitle}</Text>}
        </View>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
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

        <View style={[styles.inputBar, {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, 8),
        }]}>
          <TouchableOpacity onPress={handleImagePick} style={styles.attBtn}>
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={[styles.msgInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder="พิมพ์ข้อความ..."
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || isSending}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.border }]}
          >
            {isSending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={18} color="#FFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showActions} transparent animationType="fade" onRequestClose={() => setShowActions(false)}>
        <TouchableOpacity style={styles.actionOverlay} onPress={() => setShowActions(false)} activeOpacity={1}>
          <View style={[styles.actionSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.actionTitle, { color: colors.textSecondary }]}>จัดการข้อความ</Text>
            <TouchableOpacity style={styles.actionItem} onPress={handleDeleteMsg}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
              <Text style={[styles.actionItemText, { color: '#EF4444' }]}>ลบข้อความนี้</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionItem, { borderTopWidth: 1, borderTopColor: colors.border }]}
              onPress={() => setShowActions(false)}
            >
              <Ionicons name="close-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.actionItemText, { color: colors.textSecondary }]}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
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
                <Text style={styles.imageControlText}>รีเซ็ต</Text>
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
            <Text style={styles.imageViewerHint}>ใช้ 2 นิ้วซูม/ลาก หรือกดปุ่มซูมและดาวน์โหลดด้านบน</Text>
          </View>
        </View>
      </Modal>
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
    borderWidth: 2, borderColor: '#FFF',
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
  roomHeaderCenter: { flex: 1, minWidth: 0 },
  roomHeaderName: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  roomHeaderSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

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
