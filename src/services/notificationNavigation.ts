import { NavigationContainerRef } from '@react-navigation/native';
import { getConversationRecipientInfo } from './chatService';

type NavigationRefLike = { current?: NavigationContainerRef<any> | null } | null | undefined;

function getStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getNotificationType(value: unknown): string | undefined {
  return getStringValue(value);
}

export interface NotificationRoutePayload {
  type?: string;
  data?: {
    jobId?: string;
    shiftId?: string;
    applicationId?: string;
    conversationId?: string;
    senderName?: string;
    senderPhotoURL?: string;
    recipientName?: string;
    recipientPhoto?: string;
    jobTitle?: string;
    [key: string]: any;
  };
}

export async function navigateFromNotification(
  navigation: NavigationRefLike,
  notification: NotificationRoutePayload,
  currentUserId?: string
): Promise<boolean> {
  const navigator = navigation?.current;
  if (!navigator) return false;

  const type = getNotificationType(notification.type);
  const data = notification.data || {};
  const jobId = getStringValue(data.jobId) || getStringValue(data.shiftId);
  const conversationId = getStringValue(data.conversationId);
  const targetUserId = getStringValue(data.targetUserId);
  const hospitalId = getStringValue(data.hospitalId);
  const documentId = getStringValue(data.documentId);

  if (type === 'new_message' && conversationId && currentUserId) {
    const conversationMeta = currentUserId
      ? await getConversationRecipientInfo(conversationId, currentUserId)
      : null;

    navigator.navigate('ChatRoom', {
      conversationId,
      recipientId: getStringValue(data.recipientId) || conversationMeta?.recipientId,
      recipientName: getStringValue(data.recipientName) || getStringValue(data.senderName) || conversationMeta?.recipientName,
      recipientPhoto: getStringValue(data.recipientPhoto) || getStringValue(data.senderPhotoURL) || conversationMeta?.recipientPhoto,
      jobTitle: getStringValue(data.jobTitle) || conversationMeta?.jobTitle,
    });
    return true;
  }

  if (
    ['new_job', 'nearby_job', 'application_sent', 'application_viewed', 'application_accepted', 'application_rejected', 'job_expired', 'job_expiring'].includes(type || '')
    && jobId
  ) {
    navigator.navigate('JobDetail', { jobId, source: 'notification' });
    return true;
  }

  if (['new_applicant', 'new_application'].includes(type || '') && jobId) {
    navigator.navigate('Applicants', jobId ? { jobId } : undefined);
    return true;
  }

  if (type === 'job_completed_review' && targetUserId) {
    navigator.navigate('Reviews', {
      targetUserId,
      targetName: getStringValue(data.targetName),
      targetRole: getStringValue(data.targetRole),
      completionId: getStringValue(data.completionId),
      relatedJobId: jobId,
    });
    return true;
  }

  if (type === 'new_review') {
    if (getStringValue(data.targetType) === 'hospital' && hospitalId) {
      navigator.navigate('Reviews', {
        hospitalId,
        hospitalName: getStringValue(data.targetName),
      });
      return true;
    }

    if (targetUserId) {
      navigator.navigate('Reviews', {
        targetUserId,
        targetName: getStringValue(data.targetName),
      });
      return true;
    }
  }

  if (type === 'admin_verification_request') {
    navigator.navigate('AdminVerification');
    return true;
  }

  if (type === 'license_approved' || type === 'license_rejected') {
    if (getStringValue(data.source) === 'document_review' || documentId) {
      navigator.navigate('Documents');
      return true;
    }
    navigator.navigate('Verification');
    return true;
  }

  if (type === 'profile_reminder') {
    navigator.navigate('Main', { screen: 'Profile' });
    return true;
  }

  return false;
}