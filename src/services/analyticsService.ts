import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from '../config/firebase';
import { logger } from '../utils/logger';
import {
  AnalyticsEventContext,
  AnalyticsEventName,
  AnalyticsIngestionPayload,
  AnalyticsValue,
  TrackAnalyticsEventInput,
} from '../types/analytics';

const analyticsFn = httpsCallable(getFunctions(), 'trackAnalyticsEvent');

let sessionId = createEventId();
let activeBroadcastAttribution: {
  broadcastId: string;
  variantId?: string;
  targetScreen?: string;
  openedAt: string;
} | null = null;
let attributionClearTimer: ReturnType<typeof setTimeout> | null = null;

const ATTRIBUTION_TTL_MS = 5 * 60 * 1000; // 5 minutes

function createEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function compactRecord<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as T;
}

function sanitizeValue(value: AnalyticsValue | undefined, depth = 0): AnalyticsValue | undefined {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (depth >= 3) {
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item) => item !== undefined) as AnalyticsValue[];
  }

  return compactRecord(
    Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, item]) => [key, sanitizeValue(item as AnalyticsValue, depth + 1)])
        .filter(([, item]) => item !== undefined)
    )
  );
}

function getAppVersion(): string {
  return Constants.expoConfig?.version || 'dev';
}

function buildContext(context?: AnalyticsEventContext): AnalyticsEventContext {
  return compactRecord({
    sessionId,
    platform: Platform.OS,
    appVersion: getAppVersion(),
    ...context,
  });
}

export function resetAnalyticsSession(): void {
  sessionId = createEventId();
}

export function setBroadcastAttribution(payload: {
  broadcastId: string;
  variantId?: string;
  targetScreen?: string;
}): void {
  if (!payload.broadcastId) return;
  if (attributionClearTimer) clearTimeout(attributionClearTimer);
  activeBroadcastAttribution = {
    broadcastId: payload.broadcastId,
    variantId: payload.variantId,
    targetScreen: payload.targetScreen,
    openedAt: new Date().toISOString(),
  };
  attributionClearTimer = setTimeout(() => {
    activeBroadcastAttribution = null;
    attributionClearTimer = null;
  }, ATTRIBUTION_TTL_MS);
}

export function clearBroadcastAttribution(): void {
  if (attributionClearTimer) {
    clearTimeout(attributionClearTimer);
    attributionClearTimer = null;
  }
  activeBroadcastAttribution = null;
}

export async function trackEvent(input: TrackAnalyticsEventInput): Promise<void> {
  const attributionProps = activeBroadcastAttribution
    ? {
        attributedBroadcastId: activeBroadcastAttribution.broadcastId,
        attributedBroadcastVariantId: activeBroadcastAttribution.variantId,
        attributedBroadcastTargetScreen: activeBroadcastAttribution.targetScreen,
        attributedBroadcastOpenedAt: activeBroadcastAttribution.openedAt,
      }
    : undefined;

  const payload: AnalyticsIngestionPayload = compactRecord({
    eventId: createEventId(),
    occurredAt: new Date().toISOString(),
    eventName: input.eventName,
    eventSource: input.eventSource || 'client_sdk',
    screenName: input.screenName,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    jobId: input.jobId,
    conversationId: input.conversationId,
    province: input.province,
    context: buildContext(input.context),
    props: input.props
      ? compactRecord(
          Object.fromEntries(
            Object.entries({ ...attributionProps, ...input.props }).map(([key, value]) => [key, sanitizeValue(value)])
          )
        )
      : attributionProps,
  });

  try {
    await analyticsFn(payload);
  } catch (error) {
    logger.warn('Analytics event failed', {
      eventName: input.eventName,
      userId: auth.currentUser?.uid || null,
      error,
    });
  }
}

export function trackScreenView(
  screenName: string,
  props?: Record<string, AnalyticsValue | undefined>
): Promise<void> {
  return trackEvent({
    eventName: 'screen_view',
    screenName,
    props,
  });
}

export function trackAction(
  eventName: AnalyticsEventName | (string & {}),
  props?: Record<string, AnalyticsValue | undefined>
): Promise<void> {
  return trackEvent({
    eventName,
    props,
  });
}

export function trackAppOpened(): Promise<void> {
  return trackEvent({
    eventName: 'app_open',
    props: {
      hasAuthenticatedUser: Boolean(auth.currentUser?.uid),
    },
  });
}