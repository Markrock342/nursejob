import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc,
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDocs,
  limit,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Message, Conversation } from '../types';
import { assertAuthUser, isAuthUser } from './security/authGuards';
import { getJobById } from './jobService';
import { beginTrackedSubscription, PerformanceMetricOptions, recordQueryRead } from './performanceMetrics';

export interface ConversationChatAvailability {
  isLocked: boolean;
  reason?: string;
  jobId?: string;
  jobTitle?: string;
  jobStatus?: string;
}

export interface ConversationRecipientInfo {
  recipientId?: string;
  recipientName?: string;
  recipientPhoto?: string;
  jobTitle?: string;
}

const CONVERSATION_WINDOW_SIZE = 100;
const MESSAGE_WINDOW_SIZE = 200;
const PARTICIPANT_CACHE_TTL_MS = 5 * 60 * 1000;
const participantProfileCache = new Map<string, { displayName?: string; photoURL?: string; expiresAt: number }>();
const conversationSubscribers = new Map<string, Set<(conversations: Conversation[]) => void>>();
const conversationUnsubscribers = new Map<string, () => void>();
const latestConversationsByUser = new Map<string, Conversation[]>();

async function getCachedParticipantProfile(userId: string): Promise<{ displayName?: string; photoURL?: string } | null> {
  const cached = participantProfileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      participantProfileCache.set(userId, { expiresAt: Date.now() + 30_000 });
      return null;
    }

    const data = userDoc.data();
    const profile = {
      displayName: data.displayName,
      photoURL: data.photoURL,
    };

    participantProfileCache.set(userId, {
      ...profile,
      expiresAt: Date.now() + PARTICIPANT_CACHE_TTL_MS,
    });

    return profile;
  } catch {
    participantProfileCache.set(userId, { expiresAt: Date.now() + 30_000 });
    return null;
  }
}

async function getConversationDocOrThrow(conversationId: string) {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  if (!conversationDoc.exists()) {
    throw new Error('ไม่พบการสนทนา');
  }
  return { conversationRef, conversationDoc };
}

function isJobChatLocked(job: any): string | null {
  if (!job) return 'งานนี้ถูกลบหรือปิดไปแล้ว';
  const expired = Boolean(job.expiresAt && new Date(job.expiresAt as any) < new Date());
  if (job.status === 'closed') return 'แชทนี้ถูกปิดเพราะงานปิดรับแล้ว';
  if (job.status === 'deleted') return 'แชทนี้ถูกปิดเพราะงานถูกลบแล้ว';
  if (job.status === 'expired' || expired) return 'แชทนี้ถูกปิดเพราะงานหมดอายุแล้ว';
  return null;
}

async function assertConversationCanSend(conversationId: string) {
  const { conversationDoc } = await getConversationDocOrThrow(conversationId);
  const data = conversationDoc.data();
  if (!data.jobId) return;
  const job = await getJobById(data.jobId);
  const lockReason = isJobChatLocked(job);
  if (lockReason) {
    throw new Error(lockReason);
  }
}

export async function getConversationChatAvailability(
  conversationId: string
): Promise<ConversationChatAvailability> {
  try {
    const { conversationDoc } = await getConversationDocOrThrow(conversationId);
    const data = conversationDoc.data();
    if (!data.jobId) {
      return { isLocked: false };
    }
    const job = await getJobById(data.jobId);
    const reason = isJobChatLocked(job);
    return {
      isLocked: Boolean(reason),
      reason: reason || undefined,
      jobId: data.jobId,
      jobTitle: job?.title || data.jobTitle,
      jobStatus: job?.status,
    };
  } catch (error: any) {
    return {
      isLocked: true,
      reason: error?.message || 'ไม่สามารถตรวจสอบสถานะแชทได้',
    };
  }
}

async function enrichConversationParticipants(conversations: Conversation[]): Promise<Conversation[]> {
  const userIds = [...new Set(
    conversations.flatMap((conversation) =>
      (conversation.participantDetails || [])
        .filter((participant) => !participant.photoURL || !participant.displayName)
        .map((participant) => participant.id)
    )
  )];

  if (userIds.length === 0) return conversations;

  const profileEntries = await Promise.all(
    userIds.map(async (userId) => {
      try {
        return [userId, await getCachedParticipantProfile(userId)] as const;
      } catch {
        return [userId, null] as const;
      }
    })
  );

  const profileMap = new Map(profileEntries);

  return conversations.map((conversation) => ({
    ...conversation,
    participantDetails: conversation.participantDetails?.map((participant) => {
      const profile = profileMap.get(participant.id);
      if (!profile) return participant;

      return {
        ...participant,
        displayName: participant.displayName || participant.name || profile.displayName,
        photoURL: participant.photoURL || profile.photoURL,
      };
    }),
  }));
}

export async function getConversationRecipientInfo(
  conversationId: string,
  currentUserId: string
): Promise<ConversationRecipientInfo | null> {
  try {
    if (!isAuthUser(currentUserId)) return null;

    const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
    if (!conversationSnap.exists()) return null;

    const data = conversationSnap.data();
    const participants = Array.isArray(data.participantDetails) ? data.participantDetails : [];
    const otherParticipant = participants.find((participant: any) => participant?.id && participant.id !== currentUserId);

    if (!otherParticipant?.id) {
      return {
        jobTitle: data.jobTitle,
      };
    }

    let recipientName = otherParticipant.displayName || otherParticipant.name || '';
    let recipientPhoto = otherParticipant.photoURL || '';

    if (!recipientName || !recipientPhoto) {
      const userSnap = await getDoc(doc(db, 'users', otherParticipant.id));
      if (userSnap.exists()) {
        const userData = userSnap.data();
        recipientName = recipientName || userData.displayName || userData.username || 'ผู้ใช้';
        recipientPhoto = recipientPhoto || userData.photoURL || '';
      }
    }

    return {
      recipientId: otherParticipant.id,
      recipientName: recipientName || 'ผู้ใช้',
      recipientPhoto: recipientPhoto || undefined,
      jobTitle: data.jobTitle,
    };
  } catch {
    return null;
  }
}

// Create or get existing conversation
export const getOrCreateConversation = async (
  userId: string,
  userName: string,
  otherUserId: string,
  otherUserName: string,
  jobId?: string,
  jobTitle?: string,
  hospitalName?: string
): Promise<string> => {
  assertAuthUser(userId, 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
  try {
    if (jobId) {
      const job = await getJobById(jobId);
      const lockReason = isJobChatLocked(job);
      if (lockReason) {
        throw new Error(lockReason);
      }
    }

    // Check if conversation already exists
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const snapshot = await getDocs(q);
    
    // Find existing conversation with both participants (and same job if specified)
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.participants.includes(otherUserId)) {
        if (jobId && data.jobId === jobId) {
          return doc.id;
        } else if (!jobId && !data.jobId) {
          return doc.id;
        }
      }
    }
    
    // Create new conversation
    const newConversation = {
      participants: [userId, otherUserId],
      participantDetails: [
        { id: userId, name: userName },
        { id: otherUserId, name: otherUserName },
      ],
      jobId: jobId || null,
      jobTitle: jobTitle || null,
      hospitalName: hospitalName || null,
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      unreadCount: 0,
    };
    
    const docRef = await addDoc(conversationsRef, newConversation);
    return docRef.id;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

export const getOrCreateConversationWithStatus = async (
  userId: string,
  userName: string,
  otherUserId: string,
  otherUserName: string,
  jobId?: string,
  jobTitle?: string,
  hospitalName?: string
): Promise<{ conversationId: string; created: boolean }> => {
  assertAuthUser(userId, 'เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
  try {
    if (jobId) {
      const job = await getJobById(jobId);
      const lockReason = isJobChatLocked(job);
      if (lockReason) {
        throw new Error(lockReason);
      }
    }

    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );

    const snapshot = await getDocs(q);

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.participants.includes(otherUserId)) {
        if (jobId && data.jobId === jobId) {
          return { conversationId: doc.id, created: false };
        } else if (!jobId && !data.jobId) {
          return { conversationId: doc.id, created: false };
        }
      }
    }

    const newConversation = {
      participants: [userId, otherUserId],
      participantDetails: [
        { id: userId, name: userName },
        { id: otherUserId, name: otherUserName },
      ],
      jobId: jobId || null,
      jobTitle: jobTitle || null,
      hospitalName: hospitalName || null,
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      unreadCount: 0,
    };

    const docRef = await addDoc(conversationsRef, newConversation);
    return { conversationId: docRef.id, created: true };
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

// Send a message
export const sendMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string
): Promise<void> => {
  try {
    assertAuthUser(senderId, 'ไม่สามารถส่งข้อความแทนผู้ใช้อื่นได้');
    await assertConversationCanSend(conversationId);

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    
    await addDoc(messagesRef, {
      senderId,
      senderName,
      text,
      createdAt: serverTimestamp(),
      isRead: false,
    });
    
    // Update conversation's last message and unread count for other participants
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      const data = conversationDoc.data();
      const participants = data.participants || [];
      
      // Increment unread count for all participants except sender
      const unreadBy = data.unreadBy || {};
      let totalUnread = 0;
      participants.forEach((pid: string) => {
        if (pid !== senderId) {
          unreadBy[pid] = (unreadBy[pid] || 0) + 1;
          totalUnread += unreadBy[pid];
        }
      });
      
      await updateDoc(conversationRef, {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: senderId,
        unreadBy,
        deletedBy: [],
        unreadCount: totalUnread, // Keep old field updated for backwards compatibility
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// Subscribe to messages in a conversation
export const subscribeToMessages = (
  conversationId: string,
  callback: (messages: Message[]) => void,
  metrics?: PerformanceMetricOptions
): (() => void) => {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGE_WINDOW_SIZE));
  const endMetric = beginTrackedSubscription({
    screenName: metrics?.screenName,
    source: metrics?.source || 'chat:messages',
  });

  const unsubscribe = onSnapshot(q, (snapshot) => {
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: `${metrics?.source || 'chat:messages'}:snapshot`,
    });
    const messages: Message[] = snapshot.docs.map(doc => {
      const data = doc.data();
      // Handle pending serverTimestamp (null) - use current time
      let createdAt: Date;
      if (data.createdAt) {
        createdAt = (data.createdAt as Timestamp).toDate();
      } else {
        // Pending timestamp - use current time for new messages
        createdAt = new Date();
      }
      
      return {
        id: doc.id,
        conversationId,
        ...data,
        createdAt,
      };
    }) as Message[];
    
    // Sort by createdAt on client side to ensure correct order
    // (handles pending timestamps correctly)
    messages.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return timeA - timeB; // ascending (old first, new last)
    });
    
    callback(messages);
  });

  return () => {
    endMetric();
    unsubscribe();
  };
};

// Subscribe to user's conversations
export const subscribeToConversations = (
  userId: string,
  callback: (conversations: Conversation[]) => void,
  metrics?: PerformanceMetricOptions
): (() => void) => {
  if (!isAuthUser(userId)) {
    latestConversationsByUser.set(userId, []);
    callback([]);
    return () => {};
  }
  const listeners = conversationSubscribers.get(userId) || new Set<(conversations: Conversation[]) => void>();
  listeners.add(callback);
  conversationSubscribers.set(userId, listeners);

  const cachedConversations = latestConversationsByUser.get(userId);
  if (cachedConversations) {
    callback(cachedConversations);
  }

  if (!conversationUnsubscribers.has(userId)) {
    const conversationsRef = collection(db, 'conversations');
    const preferredQuery = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(CONVERSATION_WINDOW_SIZE)
    );
    const fallbackQuery = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      limit(CONVERSATION_WINDOW_SIZE)
    );
    const endMetric = beginTrackedSubscription({
      screenName: metrics?.screenName,
      source: metrics?.source || 'chat:conversations',
    });

    let fallbackUnsubscribe: (() => void) | null = null;

    const emitConversations = (snapshot: any) => {
      recordQueryRead(snapshot.size, {
        screenName: metrics?.screenName,
        source: `${metrics?.source || 'chat:conversations'}:snapshot`,
      });

      const conversations: Conversation[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
        lastMessageAt: (doc.data().lastMessageAt as Timestamp)?.toDate() || new Date(),
        createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
      })) as Conversation[];

      conversations.sort((a, b) => {
        const dateA = a.lastMessageAt instanceof Date ? a.lastMessageAt.getTime() : 0;
        const dateB = b.lastMessageAt instanceof Date ? b.lastMessageAt.getTime() : 0;
        return dateB - dateA;
      });

      enrichConversationParticipants(conversations)
        .then((enrichedConversations) => {
          latestConversationsByUser.set(userId, enrichedConversations);
          const activeListeners = conversationSubscribers.get(userId);
          activeListeners?.forEach((listener) => listener(enrichedConversations));
        })
        .catch(() => {
          latestConversationsByUser.set(userId, conversations);
          const activeListeners = conversationSubscribers.get(userId);
          activeListeners?.forEach((listener) => listener(conversations));
        });
    };

    const preferredUnsubscribe = onSnapshot(preferredQuery, emitConversations, (error: any) => {
      if (error?.code === 'permission-denied') {
        console.warn('[subscribeToConversations] permission-denied, will retry on next auth');
        latestConversationsByUser.set(userId, []);
        const activeListeners = conversationSubscribers.get(userId);
        activeListeners?.forEach((listener) => listener([]));
        return;
      }

      if (!fallbackUnsubscribe) {
        fallbackUnsubscribe = onSnapshot(fallbackQuery, emitConversations, () => {
          latestConversationsByUser.set(userId, []);
          const activeListeners = conversationSubscribers.get(userId);
          activeListeners?.forEach((listener) => listener([]));
        });
        return;
      }

      console.error('Error subscribing to conversations:', error);
      latestConversationsByUser.set(userId, []);
      const activeListeners = conversationSubscribers.get(userId);
      activeListeners?.forEach((listener) => listener([]));
    });

    conversationUnsubscribers.set(userId, () => {
      endMetric();
      preferredUnsubscribe();
      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
      }
    });
  }

  return () => {
    const activeListeners = conversationSubscribers.get(userId);
    if (!activeListeners) return;

    activeListeners.delete(callback);
    if (activeListeners.size > 0) return;

    conversationSubscribers.delete(userId);
    const unsubscribe = conversationUnsubscribers.get(userId);
    conversationUnsubscribers.delete(userId);
    unsubscribe?.();
  };
};

// Mark messages as read
export const markConversationAsRead = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    if (!isAuthUser(userId)) return;

    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      const data = conversationDoc.data();
      const unreadBy = data.unreadBy || {};
      
      // Set unread count for this user to 0
      unreadBy[userId] = 0;
      
      await updateDoc(conversationRef, {
        unreadBy,
        unreadCount: 0, // Also reset old field for backwards compatibility
      });
    }
  } catch (error) {
    console.error('Error marking as read:', error);
  }
};

// Get unread count for user
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    if (!isAuthUser(userId)) return 0;

    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const snapshot = await getDocs(q);
    let total = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const unreadBy = data.unreadBy || {};
      total += unreadBy[userId] || 0;
    });
    
    return total;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Delete conversation and all messages
export const deleteConversation = async (conversationId: string, userId: string): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    if (!conversationDoc.exists()) {
      throw new Error('ไม่พบการสนทนา');
    }

    const data = conversationDoc.data();
    const participants: string[] = Array.isArray(data.participants) ? data.participants : [];
    if (!participants.includes(userId)) {
      throw new Error('ไม่มีสิทธิ์ลบการสนทนานี้');
    }

    const deletedBy: string[] = Array.isArray(data.deletedBy) ? data.deletedBy : [];
    const hiddenBy: string[] = Array.isArray(data.hiddenBy) ? data.hiddenBy : [];
    const unreadBy = { ...(data.unreadBy || {}) };
    unreadBy[userId] = 0;

    if (!deletedBy.includes(userId)) {
      deletedBy.push(userId);
    }

    await updateDoc(conversationRef, {
      deletedBy,
      hiddenBy: hiddenBy.filter((id: string) => id !== userId),
      unreadBy,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw new Error('ไม่สามารถลบการสนทนาได้');
  }
};

// Delete a single message
export const deleteMessage = async (
  conversationId: string, 
  messageId: string,
  userId: string
): Promise<void> => {
  try {
    assertAuthUser(userId, 'ไม่สามารถลบข้อความแทนผู้ใช้อื่นได้');

    const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
    const messageDoc = await getDoc(messageRef);
    
    if (!messageDoc.exists()) {
      throw new Error('ไม่พบข้อความ');
    }
    
    const messageData = messageDoc.data();
    
    // Only sender can delete their own message
    if (messageData.senderId !== userId) {
      throw new Error('คุณไม่สามารถลบข้อความของผู้อื่นได้');
    }
    
    // Mark as deleted instead of actually deleting (for audit trail)
    await updateDoc(messageRef, {
      isDeleted: true,
      deletedAt: serverTimestamp(),
      text: 'ข้อความนี้ถูกลบแล้ว',
    });
  } catch (error: any) {
    console.error('Error deleting message:', error);
    throw new Error(error.message || 'ไม่สามารถลบข้อความได้');
  }
};

// Report a message
export const reportMessage = async (
  conversationId: string,
  messageId: string,
  reporterId: string,
  reporterName: string,
  reason: string
): Promise<void> => {
  try {
    const reportsRef = collection(db, 'reports');
    await addDoc(reportsRef, {
      type: 'message',
      conversationId,
      messageId,
      reporterId,
      reporterName,
      reason,
      status: 'pending', // pending, reviewed, resolved
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error reporting message:', error);
    throw new Error('ไม่สามารถรายงานข้อความได้');
  }
};

// Report a job/post
export const reportJob = async (
  jobId: string,
  reporterId: string,
  reporterName: string,
  reason: string
): Promise<void> => {
  try {
    const reportsRef = collection(db, 'reports');
    await addDoc(reportsRef, {
      type: 'job',
      jobId,
      reporterId,
      reporterName,
      reason,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error reporting job:', error);
    throw new Error('ไม่สามารถรายงานโพสต์ได้');
  }
};

// Hide conversation (instead of delete)
export const hideConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('ไม่พบการสนทนา');
    }
    
    const data = conversationDoc.data();
    const hiddenBy = data.hiddenBy || [];
    
    if (!hiddenBy.includes(userId)) {
      await updateDoc(conversationRef, {
        hiddenBy: [...hiddenBy, userId],
      });
    }
  } catch (error) {
    console.error('Error hiding conversation:', error);
    throw new Error('ไม่สามารถซ่อนการสนทนาได้');
  }
};

// Unhide conversation for a user (remove from hiddenBy)
export const unhideConversation = async (
  conversationId: string,
  userId: string
): Promise<void> => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);

    if (!conversationDoc.exists()) {
      throw new Error('ไม่พบการสนทนา');
    }

    const data = conversationDoc.data();
    const hiddenBy = data.hiddenBy || [];

    if (hiddenBy.includes(userId)) {
      await updateDoc(conversationRef, {
        hiddenBy: hiddenBy.filter((id: string) => id !== userId),
      });
    }
  } catch (error) {
    console.error('Error unhiding conversation:', error);
    throw new Error('ไม่สามารถนำการสนทนาออกจากการซ่อนได้');
  }
};

// Send image in chat
export const sendImage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  imageUri: string,
  fileName: string
): Promise<void> => {
  try {
    assertAuthUser(senderId, 'ไม่สามารถส่งรูปแทนผู้ใช้อื่นได้');
    await assertConversationCanSend(conversationId);

    // Convert URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `chats/${conversationId}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
    const imageUrl = await getDownloadURL(storageRef);
    
    // Send message with image
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      senderName,
      text: '📷 รูปภาพ',
      imageUrl,
      type: 'image',
      createdAt: serverTimestamp(),
      isRead: false,
    });
    
    // Update conversation's last message
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      const data = conversationDoc.data();
      await updateDoc(conversationRef, {
        lastMessage: '📷 รูปภาพ',
        lastMessageAt: serverTimestamp(),
        deletedBy: [],
        unreadCount: (data.unreadCount || 0) + 1,
      });
    }
  } catch (error) {
    console.error('Error sending image:', error);
    throw new Error('ไม่สามารถส่งรูปภาพได้');
  }
};

// Send document in chat
export const sendDocument = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  documentUri: string,
  fileName: string,
  fileSize: number,
  mimeType: string
): Promise<void> => {
  try {
    assertAuthUser(senderId, 'ไม่สามารถส่งไฟล์แทนผู้ใช้อื่นได้');
    await assertConversationCanSend(conversationId);

    // Convert URI to blob
    const response = await fetch(documentUri);
    const blob = await response.blob();
    
    // Upload to Firebase Storage
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `chats/${conversationId}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, blob, { contentType: mimeType });
    const fileUrl = await getDownloadURL(storageRef);
    
    // Send message with document
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      senderName,
      text: `📎 ${fileName}`,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      type: 'document',
      createdAt: serverTimestamp(),
      isRead: false,
    });
    
    // Update conversation's last message
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      const data = conversationDoc.data();
      await updateDoc(conversationRef, {
        lastMessage: `📎 ${fileName}`,
        lastMessageAt: serverTimestamp(),
        unreadCount: (data.unreadCount || 0) + 1,
      });
    }
  } catch (error) {
    console.error('Error sending document:', error);
    throw new Error('ไม่สามารถส่งเอกสารได้');
  }
};

// Send saved document from profile
export const sendSavedDocument = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  documentUrl: string,
  documentName: string,
  documentType: string
): Promise<void> => {
  try {
    await assertConversationCanSend(conversationId);
    // Send message with saved document link
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      senderName,
      text: `📄 ${documentName}`,
      fileUrl: documentUrl,
      fileName: documentName,
      documentType,
      type: 'saved_document',
      createdAt: serverTimestamp(),
      isRead: false,
    });
    
    // Update conversation's last message
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (conversationDoc.exists()) {
      const data = conversationDoc.data();
      await updateDoc(conversationRef, {
        lastMessage: `📄 ${documentName}`,
        lastMessageAt: serverTimestamp(),
        unreadCount: (data.unreadCount || 0) + 1,
      });
    }
  } catch (error) {
    console.error('Error sending saved document:', error);
    throw new Error('ไม่สามารถส่งเอกสารได้');
  }
};

export const sendLocationMessage = async (
  conversationId: string,
  senderId: string,
  senderName: string,
  location: {
    lat: number;
    lng: number;
    address: string;
    province?: string;
    district?: string;
  }
): Promise<void> => {
  try {
    assertAuthUser(senderId, 'ไม่สามารถส่งพิกัดแทนผู้ใช้อื่นได้');
    await assertConversationCanSend(conversationId);

    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    await addDoc(messagesRef, {
      senderId,
      senderName,
      text: `📍 ${location.address || 'ตำแหน่งที่ปักหมุด'}`,
      type: 'location',
      location,
      createdAt: serverTimestamp(),
      isRead: false,
    });

    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);

    if (conversationDoc.exists()) {
      const data = conversationDoc.data();
      await updateDoc(conversationRef, {
        lastMessage: '📍 ตำแหน่งที่ส่งมา',
        lastMessageAt: serverTimestamp(),
        deletedBy: [],
        unreadCount: (data.unreadCount || 0) + 1,
      });
    }
  } catch (error) {
    console.error('Error sending location:', error);
    throw new Error('ไม่สามารถส่งตำแหน่งได้');
  }
};
