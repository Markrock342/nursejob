import { logger } from '../utils/logger';

type ScreenSession = {
  id: string;
  screenName: string;
  startedAt: number;
  renders: number;
  reads: number;
  subscriptionsStarted: number;
  activeSubscriptions: number;
  peakSubscriptions: number;
  sources: Record<string, number>;
};

export interface PerformanceMetricOptions {
  screenName?: string;
  source: string;
}

type SubscriptionMetric = PerformanceMetricOptions & {
  id: string;
};

const activeScreenSessions = new Map<string, string>();
const sessions = new Map<string, ScreenSession>();
const subscriptions = new Map<string, SubscriptionMetric>();
const latestSummaries = new Map<string, ScreenSession>();

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getSessionByScreen(screenName?: string): ScreenSession | null {
  if (!screenName) return null;
  const sessionId = activeScreenSessions.get(screenName);
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

function attachGlobalInspector() {
  if (!__DEV__) return;

  const globalRef = globalThis as typeof globalThis & {
    __NURSEGO_PERF__?: {
      getActiveSessions: () => ScreenSession[];
      getLatestSummary: (screenName?: string) => ScreenSession | ScreenSession[] | null;
      reset: () => void;
    };
  };

  globalRef.__NURSEGO_PERF__ = {
    getActiveSessions: () => Array.from(sessions.values()),
    getLatestSummary: (screenName?: string) => {
      if (screenName) {
        return latestSummaries.get(screenName) || null;
      }
      return Array.from(latestSummaries.values());
    },
    reset: () => {
      activeScreenSessions.clear();
      sessions.clear();
      subscriptions.clear();
      latestSummaries.clear();
    },
  };
}

attachGlobalInspector();

export function startScreenPerformanceSession(screenName: string): () => void {
  if (!__DEV__) return () => {};

  const sessionId = createId(screenName.toLowerCase());
  sessions.set(sessionId, {
    id: sessionId,
    screenName,
    startedAt: Date.now(),
    renders: 0,
    reads: 0,
    subscriptionsStarted: 0,
    activeSubscriptions: 0,
    peakSubscriptions: 0,
    sources: {},
  });
  activeScreenSessions.set(screenName, sessionId);
  logger.info(`[perf] ${screenName} session started`, { sessionId });

  return () => {
    const session = sessions.get(sessionId);
    if (!session) return;

    activeScreenSessions.delete(screenName);
    latestSummaries.set(screenName, {
      ...session,
      activeSubscriptions: 0,
    });
    sessions.delete(sessionId);

    logger.info(`[perf] ${screenName} session ended`, {
      sessionId,
      durationMs: Date.now() - session.startedAt,
      renders: session.renders,
      reads: session.reads,
      subscriptionsStarted: session.subscriptionsStarted,
      peakSubscriptions: session.peakSubscriptions,
      sources: session.sources,
    });
  };
}

export function recordScreenRender(screenName: string): void {
  if (!__DEV__) return;
  const session = getSessionByScreen(screenName);
  if (!session) return;
  session.renders += 1;
}

export function recordQueryRead(count: number, options: PerformanceMetricOptions): void {
  if (!__DEV__) return;
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;
  const session = getSessionByScreen(options.screenName);
  if (!session) return;
  session.reads += safeCount;
  session.sources[options.source] = (session.sources[options.source] || 0) + safeCount;
}

export function beginTrackedSubscription(options: PerformanceMetricOptions): () => void {
  if (!__DEV__) return () => {};

  const metric: SubscriptionMetric = {
    ...options,
    id: createId('sub'),
  };
  subscriptions.set(metric.id, metric);

  const session = getSessionByScreen(options.screenName);
  if (session) {
    session.subscriptionsStarted += 1;
    session.activeSubscriptions += 1;
    session.peakSubscriptions = Math.max(session.peakSubscriptions, session.activeSubscriptions);
  }

  return () => {
    const activeMetric = subscriptions.get(metric.id);
    subscriptions.delete(metric.id);
    if (!activeMetric) return;

    const activeSession = getSessionByScreen(activeMetric.screenName);
    if (activeSession) {
      activeSession.activeSubscriptions = Math.max(0, activeSession.activeSubscriptions - 1);
    }
  };
}