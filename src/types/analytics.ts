export type AnalyticsPrimitive = string | number | boolean | null;
export type AnalyticsValue = AnalyticsPrimitive | AnalyticsValue[] | { [key: string]: AnalyticsValue };

export type AnalyticsEventSource = 'client_sdk' | 'domain_trigger' | 'batch_snapshot' | 'admin_action';

export type AnalyticsEventName =
  | 'app_open'
  | 'screen_view'
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'role_selected'
  | 'otp_requested'
  | 'otp_verified'
  | 'job_detail_view'
  | 'chat_list_view'
  | 'chat_room_view'
  | 'search_filter_applied'
  | 'apply_cta_clicked'
  | 'chat_cta_clicked'
  | 'share_job_clicked'
  | 'notification_opened'
  | 'post_job_started'
  | 'post_job_submitted'
  | 'profile_viewed'
  | 'profile_updated'
  | 'profile_photo_updated'
  | 'user_registered'
  | 'job_post_created'
  | 'application_submitted'
  | 'message_sent'
  | 'verification_requested'
  | 'purchase_started'
  | 'purchase_completed';

export interface AnalyticsEventContext {
  sessionId?: string;
  platform?: string;
  appVersion?: string;
  currentRole?: string | null;
  currentPlan?: string | null;
  routePath?: string | null;
}

export interface TrackAnalyticsEventInput {
  eventName: AnalyticsEventName | (string & {});
  eventSource?: AnalyticsEventSource;
  screenName?: string;
  subjectType?: string;
  subjectId?: string;
  jobId?: string;
  conversationId?: string;
  province?: string;
  props?: Record<string, AnalyticsValue | undefined>;
  context?: AnalyticsEventContext;
}

export interface AnalyticsIngestionPayload extends TrackAnalyticsEventInput {
  eventId: string;
  occurredAt: string;
}