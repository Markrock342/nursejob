// ============================================
// FIREBASE CLOUD FUNCTIONS
// ระบบ Automation อัตโนมัติ
// ============================================
// 
// วิธีใช้งาน:
// 1. cd functions
// 2. npm install
// 3. firebase deploy --only functions
//
// ============================================

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { defineString } = require('firebase-functions/params');

let BigQuery = null;
try {
  ({ BigQuery } = require('@google-cloud/bigquery'));
} catch (error) {
  console.warn('[analytics] BigQuery package is not available:', error?.message || error);
}

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
const ANALYTICS_COLLECTION = 'analytics_events';
const ANALYTICS_REPORTS_COLLECTION = 'analytics_reports';

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  POST_EXPIRE_HOURS: 48, // 2 days
  FREE_DAILY_POST_LIMIT: 2,
  CHECK_INTERVAL_HOURS: 6,
};

const RETENTION_DAYS = {
  notifications: 30,
  analyticsEvents: 90,
  analyticsReports: 365,
  broadcastOpens: 180,
  broadcasts: 365,
  scheduledBroadcasts: 180,
  automationLogs: 45,
  fraudFlags: 180,
  archivedTemplates: 30,
};

const ANALYTICS_CACHE_TTL_HOURS = {
  executiveSummary: 6,
  broadcastSummary: 6,
};

const MONETIZATION_REVIEW_GATES = {
  minActivatedUsers7d: 25,
  minJobsPosted7d: 12,
  minJobsWithApplicants7d: 8,
  minLiquidityRate: 0.35,
  minUniqueApplicants7d: 12,
  minConversationStarts7d: 10,
};

const FEATURE_USAGE_DEFINITIONS = [
  {
    key: 'job_discovery',
    label: 'ดูรายละเอียดงาน',
    eventName: 'job_detail_view',
    monetizationPriority: 'indirect',
    hotShareThreshold: 0.18,
    lowUsageThreshold: 2,
    pricingModelHint: 'คงฟรีไว้ แล้วขายการดันโพสต์หรือปักหมุดฝั่งผู้ลงประกาศ',
  },
  {
    key: 'search_filters',
    label: 'ใช้ตัวกรองค้นหา',
    eventName: 'search_filter_applied',
    monetizationPriority: 'medium',
    hotShareThreshold: 0.08,
    lowUsageThreshold: 2,
    pricingModelHint: 'ถ้าจะคิดเงิน ควรแยก advanced filter เป็น add-on ไม่ใช่ล็อกการค้นหาพื้นฐาน',
  },
  {
    key: 'apply_intent',
    label: 'กดสมัครงาน',
    eventName: 'apply_cta_clicked',
    monetizationPriority: 'medium',
    hotShareThreshold: 0.08,
    lowUsageThreshold: 2,
    pricingModelHint: 'เหมาะกับ free quota ต่อเดือน หรือรวมไว้ในแพ็ก premium',
  },
  {
    key: 'chat_intent',
    label: 'กดเริ่มแชท',
    eventName: 'chat_cta_clicked',
    monetizationPriority: 'high',
    hotShareThreshold: 0.08,
    lowUsageThreshold: 2,
    pricingModelHint: 'เหมาะกับจำกัดจำนวนการเริ่มแชท หรือปลดล็อกแชทไม่จำกัดในแพ็กเสียเงิน',
  },
  {
    key: 'chat_usage',
    label: 'เปิดห้องแชท',
    eventName: 'chat_room_view',
    monetizationPriority: 'medium',
    hotShareThreshold: 0.08,
    lowUsageThreshold: 2,
    pricingModelHint: 'ใช้ดูความเหนียวหลังเริ่มคุย ไม่ควร paywall กลางบทสนทนา',
  },
  {
    key: 'post_job_flow',
    label: 'เริ่มลงประกาศงาน',
    eventName: 'post_job_started',
    monetizationPriority: 'high',
    hotShareThreshold: 0.06,
    lowUsageThreshold: 1,
    pricingModelHint: 'เหมาะกับ pricing ฝั่งผู้ลงประกาศทั้งรายโพสต์ รายเดือน และบริการด่วน',
  },
  {
    key: 'share_jobs',
    label: 'กดแชร์ประกาศ',
    eventName: 'share_job_clicked',
    monetizationPriority: 'medium',
    hotShareThreshold: 0.04,
    lowUsageThreshold: 1,
    pricingModelHint: 'เป็นสัญญาณว่าฟีเจอร์ boost หรือ urgent มีคุณค่าในการกระจายโพสต์',
  },
  {
    key: 'profile_views',
    label: 'เปิดโปรไฟล์',
    eventName: 'profile_viewed',
    monetizationPriority: 'low',
    hotShareThreshold: 0.04,
    lowUsageThreshold: 1,
    pricingModelHint: 'ถ้าจะคิดเงิน ควรไปทาง badge หรือ visibility ไม่ใช่ล็อกการดูโปรไฟล์ทั้งหมด',
  },
  {
    key: 'package_interest',
    label: 'เริ่มดูแพ็กหรือซื้อ',
    eventName: 'purchase_started',
    monetizationPriority: 'high',
    hotShareThreshold: 0.03,
    lowUsageThreshold: 1,
    pricingModelHint: 'มีคนสนใจแพ็กแล้ว ควรทดลองราคา หน้าแพ็กเกจ และข้อความขายให้ชัดขึ้น',
  },
  {
    key: 'notification_reopen',
    label: 'กลับเข้ามาจากแจ้งเตือน',
    eventName: 'notification_opened',
    monetizationPriority: 'low',
    hotShareThreshold: 0.04,
    lowUsageThreshold: 1,
    pricingModelHint: 'ใช้กับ re-engagement มากกว่าการตั้งราคาโดยตรง',
  },
];

const ADMIN_USERNAME = defineString('ADMIN_USERNAME');
const ADMIN_PASSWORD_HASH = defineString('ADMIN_PASSWORD_HASH');
const ADMIN_EMAIL = defineString('ADMIN_EMAIL');
const ADMIN_DISPLAY_NAME = defineString('ADMIN_DISPLAY_NAME');
const ENFORCE_ADMIN_APP_CHECK = defineString('ENFORCE_ADMIN_APP_CHECK');
const BIGQUERY_SYNC_ENABLED = defineString('BIGQUERY_SYNC_ENABLED');
const BIGQUERY_PROJECT_ID = defineString('BIGQUERY_PROJECT_ID');
const BIGQUERY_DATASET = defineString('BIGQUERY_DATASET');
const BIGQUERY_EVENTS_TABLE = defineString('BIGQUERY_EVENTS_TABLE');
const BIGQUERY_DAILY_SUMMARY_TABLE = defineString('BIGQUERY_DAILY_SUMMARY_TABLE');

const ADMIN_LOGIN_RATE_LIMIT_COLLECTION = 'admin_login_rate_limits';
const ADMIN_LOGIN_AUDIT_COLLECTION = 'admin_login_attempts';
const ADMIN_LOGIN_GUARD_RETENTION_DAYS = 7;
const ADMIN_LOGIN_AUDIT_RETENTION_DAYS = 30;
const ADMIN_LOGIN_LIMITS = {
  usernameMaxFailures: 5,
  clientMaxFailures: 12,
  windowMinutes: 15,
  lockoutMinutes: 30,
};

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function safeEqualHex(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function getAdminEnvConfig() {
  return {
    username: (ADMIN_USERNAME.value() || process.env.ADMIN_USERNAME || '').trim(),
    passwordHash: (ADMIN_PASSWORD_HASH.value() || process.env.ADMIN_PASSWORD_HASH || '').toLowerCase(),
    email: (ADMIN_EMAIL.value() || process.env.ADMIN_EMAIL || 'admin@nursego.admin').trim(),
    displayName: (ADMIN_DISPLAY_NAME.value() || process.env.ADMIN_DISPLAY_NAME || 'Administrator').trim(),
  };
}

function shouldEnforceAdminAppCheck() {
  return String(ENFORCE_ADMIN_APP_CHECK.value() || process.env.ENFORCE_ADMIN_APP_CHECK || 'false').toLowerCase() === 'true';
}

function getAnalyticsEnvConfig() {
  return {
    bigQuerySyncEnabled: String(BIGQUERY_SYNC_ENABLED.value() || process.env.BIGQUERY_SYNC_ENABLED || 'false').toLowerCase() === 'true',
    bigQueryProjectId: (BIGQUERY_PROJECT_ID.value() || process.env.BIGQUERY_PROJECT_ID || '').trim(),
    bigQueryDataset: (BIGQUERY_DATASET.value() || process.env.BIGQUERY_DATASET || 'nursego_analytics').trim(),
    bigQueryEventsTable: (BIGQUERY_EVENTS_TABLE.value() || process.env.BIGQUERY_EVENTS_TABLE || 'analytics_events').trim(),
    bigQueryDailySummaryTable: (BIGQUERY_DAILY_SUMMARY_TABLE.value() || process.env.BIGQUERY_DAILY_SUMMARY_TABLE || 'analytics_daily_summaries').trim(),
  };
}

function compactObject(obj) {
  return Object.fromEntries(
    Object.entries(obj || {}).filter(([, value]) => value !== undefined)
  );
}

function sanitizeAnalyticsValue(value, depth = 0) {
  if (value === undefined) return undefined;
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (depth >= 3) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item) => sanitizeAnalyticsValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (typeof value === 'object') {
    return compactObject(
      Object.fromEntries(
        Object.entries(value)
          .slice(0, 40)
          .map(([key, item]) => [key, sanitizeAnalyticsValue(item, depth + 1)])
          .filter(([, item]) => item !== undefined)
      )
    );
  }

  return String(value);
}

function sanitizeAnalyticsProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  return compactObject(
    Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, sanitizeAnalyticsValue(value)])
    )
  );
}

function toEventDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
}

function buildAnalyticsReportDocId(type, key) {
  return `${String(type || 'report').trim()}__${String(key || 'default').trim().replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
}

function isFreshTimestamp(value, maxAgeHours) {
  const date = getTimestampDate(value);
  if (!date) return false;
  return (Date.now() - date.getTime()) <= maxAgeHours * 60 * 60 * 1000;
}

function getBigQueryClient() {
  const analyticsConfig = getAnalyticsEnvConfig();
  if (!analyticsConfig.bigQuerySyncEnabled || !analyticsConfig.bigQueryProjectId || !BigQuery) {
    return null;
  }

  return new BigQuery({
    projectId: analyticsConfig.bigQueryProjectId,
  });
}

async function getBigQueryResourceStatus(tableName) {
  const analyticsConfig = getAnalyticsEnvConfig();
  const bigQueryClient = getBigQueryClient();

  if (!analyticsConfig.bigQuerySyncEnabled) {
    return { enabled: false, datasetExists: null, tableExists: null };
  }

  if (!BigQuery || !bigQueryClient) {
    return {
      enabled: true,
      datasetExists: false,
      tableExists: false,
      error: 'BigQuery client is not available in Cloud Functions runtime',
    };
  }

  try {
    const dataset = bigQueryClient.dataset(analyticsConfig.bigQueryDataset);
    const [datasetExists] = await dataset.exists();
    if (!datasetExists) {
      return {
        enabled: true,
        datasetExists: false,
        tableExists: false,
        error: `BigQuery dataset ${analyticsConfig.bigQueryDataset} is missing`,
      };
    }

    const [tableExists] = await dataset.table(tableName).exists();
    return {
      enabled: true,
      datasetExists: true,
      tableExists,
      error: tableExists ? null : `BigQuery table ${analyticsConfig.bigQueryDataset}.${tableName} is missing`,
    };
  } catch (error) {
    return {
      enabled: true,
      datasetExists: false,
      tableExists: false,
      error: error?.message || String(error),
    };
  }
}

async function getAnalyticsDeploymentReadinessInternal(now = new Date()) {
  const analyticsConfig = getAnalyticsEnvConfig();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayDocId = buildAnalyticsReportDocId('daily_executive_summary', toEventDate(yesterday));
  const executiveSummaryDocId = buildAnalyticsReportDocId('executive_summary_cache', 'latest');

  const [dailySummaryDoc, executiveSummaryDoc, eventsTableStatus, summariesTableStatus] = await Promise.all([
    db.collection(ANALYTICS_REPORTS_COLLECTION).doc(yesterdayDocId).get(),
    db.collection(ANALYTICS_REPORTS_COLLECTION).doc(executiveSummaryDocId).get(),
    getBigQueryResourceStatus(analyticsConfig.bigQueryEventsTable),
    getBigQueryResourceStatus(analyticsConfig.bigQueryDailySummaryTable),
  ]);

  const blockers = [];
  const warnings = [];

  if (analyticsConfig.bigQuerySyncEnabled) {
    if (!analyticsConfig.bigQueryProjectId) {
      blockers.push('BIGQUERY_PROJECT_ID is missing');
    }
    if (!eventsTableStatus.datasetExists) {
      blockers.push(eventsTableStatus.error || 'BigQuery dataset for analytics events is missing');
    }
    if (eventsTableStatus.datasetExists && !eventsTableStatus.tableExists) {
      blockers.push(eventsTableStatus.error || 'BigQuery analytics events table is missing');
    }
    if (summariesTableStatus.datasetExists && !summariesTableStatus.tableExists) {
      blockers.push(summariesTableStatus.error || 'BigQuery daily summaries table is missing');
    }
    if (!summariesTableStatus.datasetExists) {
      blockers.push(summariesTableStatus.error || 'BigQuery dataset for analytics summaries is missing');
    }
  } else {
    warnings.push('BIGQUERY_SYNC_ENABLED=false so analytics warehouse sync is still disabled');
  }

  const dailySummaryData = dailySummaryDoc.exists ? dailySummaryDoc.data() || {} : null;
  const executiveSummaryData = executiveSummaryDoc.exists ? executiveSummaryDoc.data() || {} : null;
  const executiveSummaryFresh = isFreshTimestamp(executiveSummaryData?.generatedAt, ANALYTICS_CACHE_TTL_HOURS.executiveSummary);

  if (!dailySummaryDoc.exists) {
    blockers.push(`Missing daily analytics summary for ${toEventDate(yesterday)}`);
  }
  if (!executiveSummaryDoc.exists) {
    blockers.push('Missing executive analytics cache document');
  } else if (!executiveSummaryFresh) {
    warnings.push('Executive analytics cache is stale and should be rebuilt before release review');
  }

  return {
    checkedAt: now.toISOString(),
    bigQuerySyncEnabled: analyticsConfig.bigQuerySyncEnabled,
    bigQueryPackageAvailable: Boolean(BigQuery),
    bigQueryProjectId: analyticsConfig.bigQueryProjectId || null,
    bigQueryDataset: analyticsConfig.bigQueryDataset,
    bigQueryEventsTable: analyticsConfig.bigQueryEventsTable,
    bigQueryDailySummaryTable: analyticsConfig.bigQueryDailySummaryTable,
    eventsTableStatus,
    summariesTableStatus,
    latestDailySummaryEventDate: dailySummaryData?.eventDate || null,
    latestExecutiveSummaryGeneratedAt: executiveSummaryData?.generatedAt || null,
    blockers,
    warnings,
    ready: blockers.length === 0,
  };
}

async function insertBigQueryRows(tableName, rows) {
  const analyticsConfig = getAnalyticsEnvConfig();
  const bigQueryClient = getBigQueryClient();
  if (!bigQueryClient || !tableName || !rows?.length) return false;

  await bigQueryClient
    .dataset(analyticsConfig.bigQueryDataset)
    .table(tableName)
    .insert(rows, { ignoreUnknownValues: true, skipInvalidRows: false });

  return true;
}

function serializeAnalyticsRow(row) {
  return compactObject({
    ...row,
    countsByEventName: row.countsByEventName ? JSON.stringify(row.countsByEventName) : row.countsByEventName,
    context_json: row.context ? JSON.stringify(row.context) : null,
    props_json: row.props ? JSON.stringify(row.props) : null,
  });
}

async function mirrorAnalyticsEventToBigQuery(event) {
  try {
    const analyticsConfig = getAnalyticsEnvConfig();
    await insertBigQueryRows(analyticsConfig.bigQueryEventsTable, [serializeAnalyticsRow(event)]);
  } catch (error) {
    console.error('[analytics] Failed to mirror event to BigQuery:', error);
  }
}

async function mirrorDailySummaryToBigQuery(summary) {
  try {
    const analyticsConfig = getAnalyticsEnvConfig();
    await insertBigQueryRows(analyticsConfig.bigQueryDailySummaryTable, [serializeAnalyticsRow(summary)]);
  } catch (error) {
    console.error('[analytics] Failed to mirror daily summary to BigQuery:', error);
  }
}

async function writeAnalyticsEvent(event) {
  const mirroredCreatedAt = new Date().toISOString();
  const sanitizedEvent = compactObject({
    ...event,
    context: sanitizeAnalyticsProps(event.context),
    props: sanitizeAnalyticsProps(event.props),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(RETENTION_DAYS.analyticsEvents),
  });

  const docRef = await db.collection(ANALYTICS_COLLECTION).add(sanitizedEvent);

  await mirrorAnalyticsEventToBigQuery({
    firestoreDocId: docRef.id,
    ...sanitizedEvent,
    createdAt: mirroredCreatedAt,
  });
}

async function emitDomainAnalyticsEvent(eventName, payload = {}) {
  await writeAnalyticsEvent({
    eventName,
    eventSource: 'domain_trigger',
    occurredAt: new Date().toISOString(),
    eventDate: new Date().toISOString().slice(0, 10),
    ...payload,
  });
}

const ALLOWED_SHIFT_CONTACT_MODES = new Set(['in_app', 'phone', 'line', 'phone_or_line']);
const EXTERNAL_CONTACT_PATTERNS = [
  /(?:\+66|0)\d(?:[\s-]?\d){7,9}/,
  /(?:https?:\/\/|www\.)\S+/i,
  /(?:line\s*id|ไลน์)\s*[:：]?\s*@?[a-z0-9._-]{3,}/i,
  /@[a-z0-9._-]{3,}/i,
];

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function textHasExternalContact(text = '') {
  const value = String(text || '');
  return EXTERNAL_CONTACT_PATTERNS.some((pattern) => pattern.test(value));
}

function shiftPostHasExternalContact(shift = {}) {
  return textHasExternalContact(shift.title)
    || textHasExternalContact(shift.description)
    || textHasExternalContact(shift.sourceText);
}

function resolveShiftContactMode(shift = {}) {
  const explicitMode = hasNonEmptyString(shift.contactMode) ? String(shift.contactMode) : '';
  if (ALLOWED_SHIFT_CONTACT_MODES.has(explicitMode)) {
    return explicitMode;
  }

  return hasNonEmptyString(shift.contactPhone) || hasNonEmptyString(shift.contactLine)
    ? 'phone_or_line'
    : 'in_app';
}

function validateShiftPublishingPolicy(shift = {}) {
  const status = String(shift.status || 'active');
  if (!['active', 'urgent'].includes(status)) {
    return {
      valid: true,
      mode: resolveShiftContactMode(shift),
      violations: [],
      message: '',
      dangerous: false,
    };
  }

  const mode = resolveShiftContactMode(shift);
  const violations = [];
  const hasPhone = hasNonEmptyString(shift.contactPhone);
  const hasLine = hasNonEmptyString(shift.contactLine);
  const hasExternalContact = shiftPostHasExternalContact(shift);

  if (!ALLOWED_SHIFT_CONTACT_MODES.has(mode)) {
    violations.push('invalid_contact_mode');
  }

  if (mode === 'in_app') {
    if (hasPhone || hasLine) {
      violations.push('in_app_has_direct_contact_fields');
    }
    if (hasExternalContact) {
      violations.push('in_app_has_external_contact');
    }
  }

  if (mode === 'phone' && !hasPhone) {
    violations.push('phone_mode_missing_phone');
  }

  if (mode === 'line' && !hasLine) {
    violations.push('line_mode_missing_line');
  }

  if (mode === 'phone_or_line' && !hasPhone && !hasLine) {
    violations.push('phone_or_line_missing_contact');
  }

  const violationMessages = {
    invalid_contact_mode: 'โหมดการติดต่อของประกาศนี้ไม่ถูกต้อง',
    in_app_has_direct_contact_fields: 'ประกาศแบบเริ่มคุยผ่านแอปก่อนควรเก็บเบอร์โทรหรือ LINE ไว้ในช่องติดต่อ',
    in_app_has_external_contact: 'ประกาศแบบเริ่มคุยผ่านแอปก่อนควรย้ายเบอร์โทร, LINE หรือ link ออกจากรายละเอียดโพสต์',
    phone_mode_missing_phone: 'ประกาศที่ตั้งเป็นโหมดโทรศัพท์ต้องมีเบอร์โทรติดต่อ',
    line_mode_missing_line: 'ประกาศที่ตั้งเป็นโหมด LINE ต้องมี LINE ID',
    phone_or_line_missing_contact: 'ประกาศที่ตั้งเป็นโหมดเบอร์หรือ LINE ต้องมีช่องทางติดต่ออย่างน้อย 1 ช่อง',
  };

  return {
    valid: violations.length === 0,
    mode,
    violations,
    message: violations.map((code) => violationMessages[code] || code).join(' | '),
    dangerous: violations.includes('in_app_has_direct_contact_fields') || violations.includes('in_app_has_external_contact'),
  };
}

async function countAnalyticsEventsByNameSince(eventName, since) {
  const snapshot = await db.collection(ANALYTICS_COLLECTION)
    .where('eventName', '==', eventName)
    .where('createdAt', '>=', since)
    .get();
  return snapshot.size;
}

async function countDistinctFieldByEventSince(eventName, fieldName, since) {
  const snapshot = await db.collection(ANALYTICS_COLLECTION)
    .where('eventName', '==', eventName)
    .where('createdAt', '>=', since)
    .get();

  const values = new Set();
  snapshot.docs.forEach((doc) => {
    const value = doc.data()?.[fieldName];
    if (value) values.add(value);
  });
  return values.size;
}

function buildMonetizationReadiness(overview) {
  const checks = [
    {
      key: 'activated_users_7d',
      label: 'ผู้ใช้ที่เปิดใช้งานสำเร็จ 7 วัน',
      current: overview.activatedUsers7d || 0,
      target: MONETIZATION_REVIEW_GATES.minActivatedUsers7d,
      passed: (overview.activatedUsers7d || 0) >= MONETIZATION_REVIEW_GATES.minActivatedUsers7d,
      unit: 'count',
    },
    {
      key: 'jobs_posted_7d',
      label: 'ประกาศงานใหม่ 7 วัน',
      current: overview.jobsPosted7d || 0,
      target: MONETIZATION_REVIEW_GATES.minJobsPosted7d,
      passed: (overview.jobsPosted7d || 0) >= MONETIZATION_REVIEW_GATES.minJobsPosted7d,
      unit: 'count',
    },
    {
      key: 'jobs_with_applicants_7d',
      label: 'งานที่มีผู้สมัคร 7 วัน',
      current: overview.jobsWithApplicants7d || 0,
      target: MONETIZATION_REVIEW_GATES.minJobsWithApplicants7d,
      passed: (overview.jobsWithApplicants7d || 0) >= MONETIZATION_REVIEW_GATES.minJobsWithApplicants7d,
      unit: 'count',
    },
    {
      key: 'liquidity_rate',
      label: 'สัดส่วนงานที่มีผู้สมัคร',
      current: overview.liquidityRate || 0,
      target: MONETIZATION_REVIEW_GATES.minLiquidityRate,
      passed: (overview.liquidityRate || 0) >= MONETIZATION_REVIEW_GATES.minLiquidityRate,
      unit: 'ratio',
    },
    {
      key: 'unique_applicants_7d',
      label: 'ผู้สมัครไม่ซ้ำ 7 วัน',
      current: overview.uniqueApplicants7d || 0,
      target: MONETIZATION_REVIEW_GATES.minUniqueApplicants7d,
      passed: (overview.uniqueApplicants7d || 0) >= MONETIZATION_REVIEW_GATES.minUniqueApplicants7d,
      unit: 'count',
    },
    {
      key: 'conversation_starts_7d',
      label: 'ห้องแชทที่เริ่มคุยจริง 7 วัน',
      current: overview.conversationStarts7d || 0,
      target: MONETIZATION_REVIEW_GATES.minConversationStarts7d,
      passed: (overview.conversationStarts7d || 0) >= MONETIZATION_REVIEW_GATES.minConversationStarts7d,
      unit: 'count',
    },
  ];

  const passedCount = checks.filter((check) => check.passed).length;
  return {
    recommended: passedCount === checks.length,
    score: checks.length > 0 ? passedCount / checks.length : 0,
    blockers: checks.filter((check) => !check.passed).map((check) => check.label),
    checks,
  };
}

function getFeatureConversionSummary(featureKey, metric, overview, purchaseCompleted7d) {
  switch (featureKey) {
    case 'apply_intent':
      return {
        conversionLabel: 'กดสมัคร -> ส่งใบสมัคร',
        conversionRate7d: overview.applyClicks7d > 0 ? overview.applications7d / overview.applyClicks7d : null,
      };
    case 'chat_intent':
      return {
        conversionLabel: 'กดแชท -> เริ่มคุยจริง',
        conversionRate7d: overview.chatClicks7d > 0 ? overview.conversationStarts7d / overview.chatClicks7d : null,
      };
    case 'post_job_flow':
      return {
        conversionLabel: 'เริ่มโพสต์ -> โพสต์สำเร็จ',
        conversionRate7d: metric.usageCount7d > 0 ? overview.jobsPosted7d / metric.usageCount7d : null,
      };
    case 'package_interest':
      return {
        conversionLabel: 'เริ่มซื้อ -> จ่ายสำเร็จ',
        conversionRate7d: metric.usageCount7d > 0 ? purchaseCompleted7d / metric.usageCount7d : null,
      };
    default:
      return {
        conversionLabel: null,
        conversionRate7d: null,
      };
  }
}

function buildFeatureRecommendation(definition, metric) {
  if (metric.usageCount7d === 0) {
    return {
      recommendation: 'review_for_removal',
      recommendationLabel: 'ยังไม่มีคนใช้',
      businessNote: '7 วันล่าสุดยังไม่พบการใช้งาน ควรซ่อน รวมเมนู หรือหยุดลงทุนเพิ่มจนกว่าจะมี demand',
    };
  }

  const isLowUsage = metric.usageCount7d <= definition.lowUsageThreshold || metric.uniqueUsers7d <= 1;
  const isPricingCandidate = (
    definition.monetizationPriority === 'high' && metric.usageCount7d >= 3 && metric.uniqueUsers7d >= 2
  ) || (
    definition.monetizationPriority === 'medium' && metric.usageCount7d >= 5 && metric.uniqueUsers7d >= 3 && metric.shareOfTrackedEvents >= 0.04
  );
  const isHot = metric.shareOfTrackedEvents >= definition.hotShareThreshold && metric.uniqueUsers7d >= 3;

  if (isPricingCandidate) {
    return {
      recommendation: 'price_candidate',
      recommendationLabel: 'น่าทดลองคิดเงิน',
      businessNote: `${metric.usageCount7d.toLocaleString()} ครั้ง จาก ${metric.uniqueUsers7d.toLocaleString()} คนใน 7 วัน เหมาะกับการทำโควตา แพ็กเกจ หรือ add-on`,
    };
  }

  if (isLowUsage) {
    return {
      recommendation: 'review_for_removal',
      recommendationLabel: 'ควรทบทวน',
      businessNote: `ใช้งานต่ำใน 7 วันล่าสุด (${metric.usageCount7d.toLocaleString()} ครั้ง จาก ${metric.uniqueUsers7d.toLocaleString()} คน) ควรถามก่อนว่าจะซ่อน รวมเมนู หรือหยุดพัฒนาต่อ`,
    };
  }

  if (isHot) {
    return {
      recommendation: 'retain_and_optimize',
      recommendationLabel: 'ฟีเจอร์หลัก',
      businessNote: `เป็นฟีเจอร์ใช้งานหลัก กินสัดส่วน ${Math.round(metric.shareOfTrackedEvents * 100)}% ของ usage ที่ track ได้ใน 7 วัน ควรรักษาและปรับ flow ให้ลื่น`,
    };
  }

  return {
    recommendation: 'watchlist',
    recommendationLabel: 'ติดตามต่อ',
    businessNote: `ยังมีการใช้งานระดับกลาง ควรวัดต่ออีก 2-4 สัปดาห์ก่อนตัดสินใจว่าจะคิดเงินหรือถอดออก`,
  };
}

async function buildFeatureUsageSummary(since, overview) {
  const trackedEventNames = FEATURE_USAGE_DEFINITIONS.map((item) => item.eventName);
  const [featureSnapshot, purchaseCompleted7d] = await Promise.all([
    db.collection(ANALYTICS_COLLECTION)
      .where('eventName', 'in', trackedEventNames)
      .where('createdAt', '>=', since)
      .get(),
    countAnalyticsEventsByNameSince('purchase_completed', since),
  ]);

  const countsByEventName = {};
  const uniqueUsersByEventName = {};
  const allTrackedUsers = new Set();

  FEATURE_USAGE_DEFINITIONS.forEach((definition) => {
    countsByEventName[definition.eventName] = 0;
    uniqueUsersByEventName[definition.eventName] = new Set();
  });

  featureSnapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const eventName = data.eventName;
    if (!countsByEventName[eventName] && countsByEventName[eventName] !== 0) {
      return;
    }

    countsByEventName[eventName] += 1;
    if (data.actorUserId) {
      uniqueUsersByEventName[eventName].add(data.actorUserId);
      allTrackedUsers.add(data.actorUserId);
    }
  });

  const totalTrackedEvents7d = Object.values(countsByEventName).reduce((sum, value) => sum + value, 0);

  const allFeatures = FEATURE_USAGE_DEFINITIONS.map((definition) => {
    const usageCount7d = countsByEventName[definition.eventName] || 0;
    const uniqueUsers7d = uniqueUsersByEventName[definition.eventName]?.size || 0;
    const metric = {
      key: definition.key,
      label: definition.label,
      usageCount7d,
      uniqueUsers7d,
      shareOfTrackedEvents: totalTrackedEvents7d > 0 ? usageCount7d / totalTrackedEvents7d : 0,
      avgUsagePerUser7d: uniqueUsers7d > 0 ? usageCount7d / uniqueUsers7d : 0,
    };
    const conversion = getFeatureConversionSummary(definition.key, metric, overview, purchaseCompleted7d);
    const recommendation = buildFeatureRecommendation(definition, metric);

    return {
      ...metric,
      ...conversion,
      ...recommendation,
      pricingModelHint: definition.pricingModelHint,
    };
  }).sort((left, right) => {
    if (right.usageCount7d !== left.usageCount7d) {
      return right.usageCount7d - left.usageCount7d;
    }
    return right.uniqueUsers7d - left.uniqueUsers7d;
  });

  const pricingPriorityOrder = {
    high: 0,
    medium: 1,
    indirect: 2,
    low: 3,
  };
  const definitionByKey = Object.fromEntries(FEATURE_USAGE_DEFINITIONS.map((item) => [item.key, item]));

  const pricingCandidates = allFeatures
    .filter((item) => item.recommendation === 'price_candidate')
    .sort((left, right) => {
      const leftPriority = pricingPriorityOrder[definitionByKey[left.key]?.monetizationPriority] ?? 99;
      const rightPriority = pricingPriorityOrder[definitionByKey[right.key]?.monetizationPriority] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return right.usageCount7d - left.usageCount7d;
    })
    .slice(0, 4);

  const lowUsageFeatures = allFeatures
    .filter((item) => item.recommendation === 'review_for_removal')
    .sort((left, right) => {
      if (left.usageCount7d !== right.usageCount7d) {
        return left.usageCount7d - right.usageCount7d;
      }
      return left.uniqueUsers7d - right.uniqueUsers7d;
    })
    .slice(0, 4);

  return {
    trackedWindowDays: 7,
    totalTrackedEvents7d,
    totalTrackedUsers7d: allTrackedUsers.size,
    allFeatures,
    topFeatures: allFeatures.filter((item) => item.usageCount7d > 0).slice(0, 5),
    pricingCandidates,
    lowUsageFeatures,
  };
}

exports.trackAnalyticsEvent = functions.https.onCall(async (data, context) => {
  const eventName = String(data?.eventName || '').trim();
  if (!eventName) {
    throw new functions.https.HttpsError('invalid-argument', 'eventName is required');
  }

  const eventSource = ['client_sdk', 'admin_action', 'batch_snapshot', 'domain_trigger'].includes(data?.eventSource)
    ? data.eventSource
    : 'client_sdk';

  await writeAnalyticsEvent({
    eventId: String(data?.eventId || `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
    eventName,
    eventSource,
    occurredAt: String(data?.occurredAt || new Date().toISOString()),
    eventDate: String(data?.occurredAt || new Date().toISOString()).slice(0, 10),
    actorUserId: context.auth?.uid || null,
    isAuthenticated: Boolean(context.auth?.uid),
    screenName: data?.screenName ? String(data.screenName).slice(0, 120) : undefined,
    subjectType: data?.subjectType ? String(data.subjectType).slice(0, 80) : undefined,
    subjectId: data?.subjectId ? String(data.subjectId).slice(0, 200) : undefined,
    jobId: data?.jobId ? String(data.jobId).slice(0, 200) : undefined,
    conversationId: data?.conversationId ? String(data.conversationId).slice(0, 200) : undefined,
    province: data?.province ? String(data.province).slice(0, 120) : undefined,
    context: data?.context,
    props: data?.props,
  });

  return { ok: true };
});

exports.getExecutiveAnalyticsSummary = functions.https.onCall(async (_data, context) => {
  const uid = requireCallableAuth(context);
  const adminDoc = await db.collection('users').doc(uid).get();
  const isAdminUser = adminDoc.exists && (adminDoc.data()?.role === 'admin' || adminDoc.data()?.isAdmin === true);
  if (!isAdminUser) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  return await getOrBuildExecutiveAnalyticsSummary(new Date());
});

async function buildDailyAnalyticsSummaryReport(targetDate, source = 'scheduled_summary_job') {
  const eventDate = toEventDate(targetDate);

  const snapshot = await db.collection(ANALYTICS_COLLECTION)
    .where('eventDate', '==', eventDate)
    .get();

  const countsByEventName = {};
  const dailyActiveUsers = new Set();
  const activatedUsers = new Set();
  const uniqueApplicants = new Set();
  const uniquePosters = new Set();
  const jobsWithApplicants = new Set();
  const conversationStarts = new Set();

  snapshot.docs.forEach((doc) => {
    const data = doc.data() || {};
    const eventName = data.eventName || 'unknown';
    countsByEventName[eventName] = (countsByEventName[eventName] || 0) + 1;
    if (data.eventName === 'screen_view' && data.actorUserId) {
      dailyActiveUsers.add(data.actorUserId);
    }
    if (data.eventName === 'onboarding_completed' && data.actorUserId) {
      activatedUsers.add(data.actorUserId);
    }
    if (data.eventName === 'application_submitted') {
      if (data.actorUserId) uniqueApplicants.add(data.actorUserId);
      if (data.jobId) jobsWithApplicants.add(data.jobId);
    }
    if (data.eventName === 'job_post_created' && data.actorUserId) {
      uniquePosters.add(data.actorUserId);
    }
    if (data.eventName === 'message_sent' && data.conversationId) {
      conversationStarts.add(data.conversationId);
    }
  });

  const jobDetailViews = countsByEventName.job_detail_view || 0;
  const applyClicks = countsByEventName.apply_cta_clicked || 0;
  const applications = countsByEventName.application_submitted || 0;
  const chatStarts = countsByEventName.chat_cta_clicked || 0;
  const jobsPosted = countsByEventName.job_post_created || 0;
  const jobsWithApplicantsCount = jobsWithApplicants.size;

  const overview = {
    dau: dailyActiveUsers.size,
    newUsers: countsByEventName.user_registered || 0,
    activatedUsers: activatedUsers.size,
    jobsPosted,
    jobsWithApplicants: jobsWithApplicantsCount,
    uniqueApplicants: uniqueApplicants.size,
    uniquePosters: uniquePosters.size,
    applyClicks,
    jobDetailViews,
    applications,
    shares: countsByEventName.share_job_clicked || 0,
    chatStarts,
    conversationStarts: conversationStarts.size,
    messagesSent: countsByEventName.message_sent || 0,
    verificationRequests: countsByEventName.verification_requested || 0,
    notificationOpens: countsByEventName.notification_opened || 0,
    applyRate: jobDetailViews > 0 ? applications / jobDetailViews : 0,
    applyCompletionRate: applyClicks > 0 ? applications / applyClicks : 0,
    chatStartRate: jobDetailViews > 0 ? chatStarts / jobDetailViews : 0,
    liquidityRate: jobsPosted > 0 ? jobsWithApplicantsCount / jobsPosted : 0,
  };

  return {
    type: 'daily_executive_summary',
    eventDate,
    generatedAt: new Date().toISOString(),
    source,
    overview,
    monetizationReadiness: buildMonetizationReadiness({
      activatedUsers7d: overview.activatedUsers,
      jobsPosted7d: overview.jobsPosted,
      jobsWithApplicants7d: overview.jobsWithApplicants,
      liquidityRate: overview.liquidityRate,
      uniqueApplicants7d: overview.uniqueApplicants,
      conversationStarts7d: overview.conversationStarts,
    }),
    countsByEventName,
  };
}

async function persistDailyAnalyticsSummary(report) {
  const docId = buildAnalyticsReportDocId('daily_executive_summary', report.eventDate);
  await db.collection(ANALYTICS_REPORTS_COLLECTION).doc(docId).set({
    ...report,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(RETENTION_DAYS.analyticsReports),
  }, { merge: true });

  await mirrorDailySummaryToBigQuery(report);
}

async function buildExecutiveSummaryFromSnapshots(now = new Date()) {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    dau,
    wau,
    mau,
    newUsers7d,
    activatedUsers7d,
    jobsPosted7d,
    jobsWithApplicants7d,
    uniqueApplicants7d,
    uniquePosters7d,
    applyClicks7d,
    applications7d,
    jobDetailViews7d,
    shareClicks7d,
    chatClicks7d,
    conversationStarts7d,
    notificationOpens7d,
  ] = await Promise.all([
    countDistinctFieldByEventSince('screen_view', 'actorUserId', new Date(now.getTime() - 24 * 60 * 60 * 1000)),
    countDistinctFieldByEventSince('screen_view', 'actorUserId', sevenDaysAgo),
    countDistinctFieldByEventSince('screen_view', 'actorUserId', thirtyDaysAgo),
    countAnalyticsEventsByNameSince('user_registered', sevenDaysAgo),
    countDistinctFieldByEventSince('onboarding_completed', 'actorUserId', sevenDaysAgo),
    countAnalyticsEventsByNameSince('job_post_created', sevenDaysAgo),
    countDistinctFieldByEventSince('application_submitted', 'jobId', sevenDaysAgo),
    countDistinctFieldByEventSince('application_submitted', 'actorUserId', sevenDaysAgo),
    countDistinctFieldByEventSince('job_post_created', 'actorUserId', sevenDaysAgo),
    countAnalyticsEventsByNameSince('apply_cta_clicked', sevenDaysAgo),
    countAnalyticsEventsByNameSince('application_submitted', sevenDaysAgo),
    countAnalyticsEventsByNameSince('job_detail_view', sevenDaysAgo),
    countAnalyticsEventsByNameSince('share_job_clicked', sevenDaysAgo),
    countAnalyticsEventsByNameSince('chat_cta_clicked', sevenDaysAgo),
    countDistinctFieldByEventSince('message_sent', 'conversationId', sevenDaysAgo),
    countAnalyticsEventsByNameSince('notification_opened', sevenDaysAgo),
  ]);

  const overview = {
    dau,
    wau,
    mau,
    newUsers7d,
    activatedUsers7d,
    jobsPosted7d,
    jobsWithApplicants7d,
    uniqueApplicants7d,
    uniquePosters7d,
    applyClicks7d,
    applications7d,
    jobDetailViews7d,
    shareClicks7d,
    chatClicks7d,
    conversationStarts7d,
    notificationOpens7d,
    applicationRate: jobDetailViews7d > 0 ? applications7d / jobDetailViews7d : 0,
    applyCompletionRate: applyClicks7d > 0 ? applications7d / applyClicks7d : 0,
    chatStartRate: jobDetailViews7d > 0 ? chatClicks7d / jobDetailViews7d : 0,
    liquidityRate: jobsPosted7d > 0 ? jobsWithApplicants7d / jobsPosted7d : 0,
  };

  const featureUsage = await buildFeatureUsageSummary(sevenDaysAgo, overview);

  return {
    generatedAt: now.toISOString(),
    generatedFrom: 'cached_exact_summary',
    freshness: now.toISOString(),
    windows: {
      last7DaysStart: sevenDaysAgo.toISOString(),
      last30DaysStart: thirtyDaysAgo.toISOString(),
    },
    overview,
    monetizationReadiness: buildMonetizationReadiness(overview),
    featureUsage,
  };
}

async function getOrBuildExecutiveAnalyticsSummary(now = new Date()) {
  const docId = buildAnalyticsReportDocId('executive_summary_cache', 'latest');
  const reportRef = db.collection(ANALYTICS_REPORTS_COLLECTION).doc(docId);
  const cached = await reportRef.get();
  if (cached.exists && isFreshTimestamp(cached.data()?.generatedAt, ANALYTICS_CACHE_TTL_HOURS.executiveSummary)) {
    return cached.data();
  }

  const summary = await buildExecutiveSummaryFromSnapshots(now);
  await reportRef.set({
    ...summary,
    type: 'executive_summary_cache',
    cacheKey: 'latest',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    generatedAt: new Date().toISOString(),
    expireAt: getDateAfterDays(RETENTION_DAYS.analyticsReports),
  }, { merge: true });
  return summary;
}

async function getOrBuildBroadcastAnalyticsSummary(broadcastId) {
  const docId = buildAnalyticsReportDocId('broadcast_analytics_cache', broadcastId);
  const reportRef = db.collection(ANALYTICS_REPORTS_COLLECTION).doc(docId);
  const cached = await reportRef.get();
  if (cached.exists && isFreshTimestamp(cached.data()?.generatedAt, ANALYTICS_CACHE_TTL_HOURS.broadcastSummary)) {
    return cached.data()?.analytics || cached.data();
  }

  const analytics = await buildBroadcastAnalyticsSummary(broadcastId);
  await reportRef.set({
    type: 'broadcast_analytics_cache',
    cacheKey: broadcastId,
    generatedAt: new Date().toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(RETENTION_DAYS.analyticsReports),
    analytics,
  }, { merge: true });
  return analytics;
}

exports.runDailyAnalyticsSummaryNow = functions.https.onCall(async (data, context) => {
  const uid = requireCallableAuth(context);
  const adminDoc = await db.collection('users').doc(uid).get();
  const isAdminUser = adminDoc.exists && (adminDoc.data()?.role === 'admin' || adminDoc.data()?.isAdmin === true);
  if (!isAdminUser) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const targetDate = data?.eventDate ? new Date(String(data.eventDate)) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (Number.isNaN(targetDate.getTime())) {
    throw new functions.https.HttpsError('invalid-argument', 'eventDate must be a valid ISO date');
  }

  const report = await buildDailyAnalyticsSummaryReport(targetDate, 'manual_admin_trigger');
  await persistDailyAnalyticsSummary(report);
  return { ok: true, report };
});

exports.getAnalyticsDeploymentReadiness = functions.https.onCall(async (_data, context) => {
  await requireAdminCaller(context);
  return await getAnalyticsDeploymentReadinessInternal(new Date());
});

exports.generateDailyAnalyticsSummary = functions.pubsub
  .schedule('every day 02:10')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    const targetDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const report = await buildDailyAnalyticsSummaryReport(targetDate, 'scheduled_summary_job');
    await persistDailyAnalyticsSummary(report);

    console.log(`[analytics] Daily summary generated for ${report.eventDate}`);
    return null;
  });

// ============================================
// PRODUCTION ADMIN LOGIN
// - If caller already has Firebase auth (anonymous/session), elevate that UID to admin
// - Fallback to custom token flow for backward compatibility
// ============================================
exports.verifyAdminLogin = functions.https.onCall(async (data, context) => {
  const { username, password } = data || {};
  if (!username || !password) {
    throw new functions.https.HttpsError('invalid-argument', 'username and password are required');
  }

  if (shouldEnforceAdminAppCheck() && !context.app) {
    await recordAdminLoginAttempt({
      username,
      context,
      success: false,
      reason: 'missing_app_check',
    });
    throw new functions.https.HttpsError('permission-denied', 'Admin login requires App Check');
  }

  const guardState = await assertAdminLoginAllowed(username, context);

  const cfg = getAdminEnvConfig();
  if (!cfg.username || !cfg.passwordHash) {
    throw new functions.https.HttpsError('failed-precondition', 'Admin env is not configured');
  }

  const validUser = String(username).trim().toLowerCase() === cfg.username.toLowerCase();
  const inputHash = sha256(password);
  const validPass = safeEqualHex(inputHash, cfg.passwordHash);

  if (!validUser || !validPass) {
    await recordAdminLoginAttempt({
      username,
      context,
      success: false,
      reason: 'invalid_credentials',
      guardState,
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    throw new functions.https.HttpsError('unauthenticated', 'Invalid admin credentials');
  }

  const desiredAdminUid = `admin_${sha256(cfg.username).slice(0, 20)}`;
  let authUser;

  try {
    authUser = await admin.auth().getUserByEmail(cfg.email);
    await admin.auth().updateUser(authUser.uid, {
      password: String(password),
      displayName: cfg.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      authUser = await admin.auth().createUser({
        uid: desiredAdminUid,
        email: cfg.email,
        password: String(password),
        displayName: cfg.displayName,
        emailVerified: true,
        disabled: false,
      });
    } else {
      throw error;
    }
  }

  const adminUid = authUser.uid;

  await db.collection('users').doc(adminUid).set({
    uid: adminUid,
    email: cfg.email,
    displayName: cfg.displayName,
    role: 'admin',
    isAdmin: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await admin.auth().setCustomUserClaims(adminUid, {
    admin: true,
    role: 'admin',
  });

  await recordAdminLoginAttempt({
    username,
    context,
    success: true,
    reason: 'success',
    guardState,
  });

  return {
    email: cfg.email,
    signInMethod: 'password',
    profile: {
      id: adminUid,
      uid: adminUid,
      email: cfg.email,
      displayName: cfg.displayName,
      role: 'admin',
      isAdmin: true,
    },
  };
});

exports.adminVerifyUser = functions.https.onCall(async (data, context) => {
  const uid = requireCallableAuth(context);
  const adminDoc = await db.collection('users').doc(uid).get();
  const isAdminUser = adminDoc.exists && (adminDoc.data()?.role === 'admin' || adminDoc.data()?.isAdmin === true);
  if (!isAdminUser) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { userId, isVerified } = data || {};
  if (!userId || typeof userId !== 'string' || typeof isVerified !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'userId and isVerified are required');
  }

  await db.collection('users').doc(userId).set({
    isVerified,
    role: isVerified ? 'nurse' : 'user',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.adminUpdateUserRole = functions.https.onCall(async (data, context) => {
  const uid = requireCallableAuth(context);
  const adminDoc = await db.collection('users').doc(uid).get();
  const isAdminUser = adminDoc.exists && (adminDoc.data()?.role === 'admin' || adminDoc.data()?.isAdmin === true);
  if (!isAdminUser) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const { userId, role } = data || {};
  if (!userId || typeof userId !== 'string' || !['user', 'nurse', 'hospital', 'admin'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'userId and valid role are required');
  }

  await db.collection('users').doc(userId).set({
    role,
    isAdmin: role === 'admin',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.deleteCurrentUserAccount = functions.https.onCall(async (_data, context) => {
  const userId = requireCallableAuth(context);
  const authTimeSeconds = Number(context?.auth?.token?.auth_time || 0);
  const authAgeSeconds = authTimeSeconds ? Math.max(0, Math.floor(Date.now() / 1000) - authTimeSeconds) : Number.POSITIVE_INFINITY;

  if (!authTimeSeconds || authAgeSeconds > 10 * 60) {
    throw new functions.https.HttpsError('unauthenticated', 'กรุณาเข้าสู่ระบบใหม่ก่อนลบบัญชี');
  }

  return await deleteCurrentUserAccountInternal(userId);
});

exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const targetUserId = String(data?.userId || '').trim();

  if (!targetUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId is required');
  }
  if (targetUserId === adminUid) {
    throw new functions.https.HttpsError('failed-precondition', 'ไม่สามารถลบบัญชีของตนเองผ่าน Admin panel');
  }

  // Verify target user exists and is not another admin
  const targetSnap = await db.collection('users').doc(targetUserId).get();
  if (!targetSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'ไม่พบผู้ใช้ที่ต้องการลบ');
  }
  const targetData = targetSnap.data();
  if (targetData?.role === 'admin' || targetData?.isAdmin === true) {
    throw new functions.https.HttpsError('permission-denied', 'ไม่สามารถลบบัญชี Admin ได้');
  }

  const result = await deleteCurrentUserAccountInternal(targetUserId);

  await db.collection('admin_audit_logs').add({
    action: 'admin_delete_user',
    adminUid,
    targetUserId,
    targetRole: targetData?.role || null,
    deletionSummary: result,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return result;
});

exports.sendBroadcastNotification = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  return sendBroadcastNotificationInternal(adminUid, data || {}, 'manual');
});

exports.previewBroadcastAudience = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const {
    targetRole = 'all',
    onlyVerified = false,
    activeOnly = true,
    targetProvince = '',
    targetProvinces = [],
    targetStaffTypes = [],
    activeWithinDays = 0,
    neverPosted = false,
  } = data || {};

  if (!['all', 'user', 'nurse', 'hospital', 'admin'].includes(targetRole)) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid targetRole');
  }

  const usersSnapshot = await db.collection('users').get();
  const normalizedTargetProvinces = normalizeProvinceList(targetProvinces);
  const normalizedTargetStaffTypes = normalizeStringList(targetStaffTypes);
  const lookups = await buildAudienceLookups({ activeWithinDays, neverPosted });
  const targetUsers = filterBroadcastTargets(usersSnapshot.docs, {
    targetRole,
    onlyVerified,
    activeOnly,
    targetProvince,
    targetProvinces: normalizedTargetProvinces,
    targetStaffTypes: normalizedTargetStaffTypes,
    activeWithinDays,
    neverPosted,
    lookups,
  });

  const breakdown = buildAudienceBreakdown(targetUsers);

  return {
    ok: true,
    matchedCount: targetUsers.length,
    pushReadyCount: breakdown.pushReadyCount,
    targetProvince: normalizedTargetProvinces[0] || normalizeProvince(targetProvince) || null,
    targetProvinces: normalizedTargetProvinces,
    targetStaffTypes: normalizedTargetStaffTypes,
    activeWithinDays: Number(activeWithinDays || 0),
    neverPosted: Boolean(neverPosted),
    breakdown,
  };
});

exports.recordBroadcastOpen = functions.https.onCall(async (data, context) => {
  const userId = requireCallableAuth(context);
  const { broadcastId, variantId = '', targetScreen = '' } = data || {};
  if (!broadcastId || typeof broadcastId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'broadcastId is required');
  }

  await recordBroadcastOpenInternal({
    userId,
    broadcastId,
    variantId: String(variantId || '').trim() || null,
    targetScreen: String(targetScreen || '').trim() || null,
  });

  return { ok: true };
});

exports.getBroadcastAnalytics = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const { broadcastId } = data || {};
  if (!broadcastId || typeof broadcastId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'broadcastId is required');
  }

  const analytics = await getOrBuildBroadcastAnalyticsSummary(broadcastId);
  return { ok: true, analytics };
});

exports.getRetentionMonitor = functions.https.onCall(async (_data, context) => {
  await requireAdminCaller(context);
  const now = new Date();
  const [
    notificationsCount,
    analyticsEventsCount,
    analyticsReportsCount,
    automationLogsCount,
    fraudFlagsCount,
    scheduledCampaignsCount,
    broadcastCount,
    templateCount,
    openCount,
    adminLoginRateLimitCount,
    adminLoginAuditCount,
  ] = await Promise.all([
    db.collection('notifications').count().get(),
    db.collection(ANALYTICS_COLLECTION).count().get(),
    db.collection(ANALYTICS_REPORTS_COLLECTION).count().get(),
    db.collection('communication_automation_logs').count().get(),
    db.collection('admin_fraud_flags').count().get(),
    db.collection('scheduled_broadcasts').count().get(),
    db.collection('admin_broadcasts').count().get(),
    db.collection('broadcast_templates').count().get(),
    db.collectionGroup('opens').count().get(),
    db.collection(ADMIN_LOGIN_RATE_LIMIT_COLLECTION).count().get(),
    db.collection(ADMIN_LOGIN_AUDIT_COLLECTION).count().get(),
  ]);

  return {
    ok: true,
    generatedAt: now.toISOString(),
    collections: [
      { key: 'notifications', label: 'Notifications', count: Number(notificationsCount.data().count || 0), retentionDays: RETENTION_DAYS.notifications },
      { key: 'analytics_events', label: 'Analytics Events', count: Number(analyticsEventsCount.data().count || 0), retentionDays: RETENTION_DAYS.analyticsEvents },
      { key: 'analytics_reports', label: 'Analytics Reports', count: Number(analyticsReportsCount.data().count || 0), retentionDays: RETENTION_DAYS.analyticsReports },
      { key: 'broadcast_opens', label: 'Broadcast Opens', count: Number(openCount.data().count || 0), retentionDays: RETENTION_DAYS.broadcastOpens },
      { key: 'communication_automation_logs', label: 'Automation Logs', count: Number(automationLogsCount.data().count || 0), retentionDays: RETENTION_DAYS.automationLogs },
      { key: 'admin_fraud_flags', label: 'Fraud Flags', count: Number(fraudFlagsCount.data().count || 0), retentionDays: RETENTION_DAYS.fraudFlags },
      { key: ADMIN_LOGIN_RATE_LIMIT_COLLECTION, label: 'Admin Login Rate Limits', count: Number(adminLoginRateLimitCount.data().count || 0), retentionDays: ADMIN_LOGIN_GUARD_RETENTION_DAYS },
      { key: ADMIN_LOGIN_AUDIT_COLLECTION, label: 'Admin Login Audit', count: Number(adminLoginAuditCount.data().count || 0), retentionDays: ADMIN_LOGIN_AUDIT_RETENTION_DAYS },
      { key: 'scheduled_broadcasts', label: 'Scheduled Broadcasts', count: Number(scheduledCampaignsCount.data().count || 0), retentionDays: RETENTION_DAYS.scheduledBroadcasts },
      { key: 'admin_broadcasts', label: 'Broadcast History', count: Number(broadcastCount.data().count || 0), retentionDays: RETENTION_DAYS.broadcasts },
      { key: 'broadcast_templates', label: 'Broadcast Templates', count: Number(templateCount.data().count || 0), retentionDays: RETENTION_DAYS.archivedTemplates },
    ],
  };
});

exports.saveBroadcastTemplate = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const { templateId = '', name, title, body, type = 'system', targetScreen = '' } = data || {};
  if (!name || !title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'name, title, and body are required');
  }

  const templateRef = templateId
    ? db.collection('broadcast_templates').doc(String(templateId))
    : db.collection('broadcast_templates').doc();

  await templateRef.set({
    name: String(name).trim(),
    title: String(title).trim(),
    body: String(body).trim(),
    type: String(type).trim() || 'system',
    targetScreen: String(targetScreen).trim() || null,
    archivedAt: null,
    expireAt: null,
    updatedBy: adminUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    ...(templateId ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: adminUid }),
  }, { merge: true });

  return { ok: true, templateId: templateRef.id };
});

exports.listBroadcastTemplates = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const snapshot = await db.collection('broadcast_templates').orderBy('updatedAt', 'desc').get();
  return {
    ok: true,
    templates: snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((item) => !item.archivedAt),
  };
});

exports.archiveBroadcastTemplate = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const { templateId } = data || {};
  if (!templateId || typeof templateId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'templateId is required');
  }

  await db.collection('broadcast_templates').doc(templateId).set({
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    archivedBy: adminUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(RETENTION_DAYS.archivedTemplates),
  }, { merge: true });

  return { ok: true };
});

exports.scheduleBroadcastCampaign = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const {
    title,
    body,
    scheduledAt,
    type = 'system',
    targetRole = 'all',
    onlyVerified = false,
    activeOnly = true,
    targetProvince = '',
    targetProvinces = [],
    targetStaffTypes = [],
    activeWithinDays = 0,
    neverPosted = false,
    targetScreen = '',
    targetParams = {},
    templateKey = '',
    variants = [],
    campaignName = '',
  } = data || {};

  if (!title || !body || !scheduledAt) {
    throw new functions.https.HttpsError('invalid-argument', 'title, body, and scheduledAt are required');
  }

  const scheduledDate = getTimestampDate(scheduledAt);
  if (!scheduledDate || scheduledDate <= new Date()) {
    throw new functions.https.HttpsError('invalid-argument', 'scheduledAt must be in the future');
  }

  const campaignRef = db.collection('scheduled_broadcasts').doc();
  await campaignRef.set({
    title: String(title).trim(),
    body: String(body).trim(),
    type,
    targetRole,
    onlyVerified: Boolean(onlyVerified),
    activeOnly: Boolean(activeOnly),
    targetProvince: normalizeProvince(targetProvince) || null,
    targetProvinces: normalizeProvinceList(targetProvinces),
    targetStaffTypes: normalizeStringList(targetStaffTypes),
    activeWithinDays: Number(activeWithinDays || 0),
    neverPosted: Boolean(neverPosted),
    targetScreen: String(targetScreen || '').trim() || null,
    targetParams: typeof targetParams === 'object' && targetParams ? targetParams : {},
    templateKey: String(templateKey || '').trim() || null,
    variants: normalizeBroadcastVariants(variants),
    campaignName: String(campaignName || '').trim() || null,
    status: 'scheduled',
    scheduledAt: scheduledDate,
    archivedAt: null,
    expireAt: getDateAfterDays(RETENTION_DAYS.scheduledBroadcasts, scheduledDate),
    createdBy: adminUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { ok: true, campaignId: campaignRef.id };
});

exports.listScheduledBroadcastCampaigns = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const snapshot = await db.collection('scheduled_broadcasts').orderBy('scheduledAt', 'asc').limit(50).get();
  return {
    ok: true,
    campaigns: snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((item) => !item.archivedAt),
  };
});

exports.deleteScheduledBroadcastCampaign = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const { campaignId } = data || {};
  if (!campaignId || typeof campaignId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'campaignId is required');
  }

  await db.collection('scheduled_broadcasts').doc(campaignId).set({
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    archivedBy: adminUid,
    status: 'archived',
    expireAt: getDateAfterDays(RETENTION_DAYS.archivedTemplates),
  }, { merge: true });

  return { ok: true };
});

exports.runCommunicationAutomation = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const { ruleKey } = data || {};
  if (!ruleKey || typeof ruleKey !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'ruleKey is required');
  }
  const result = await runCommunicationAutomationRule(ruleKey);
  return { ok: true, result };
});

exports.runOperationalAction = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const { actionKey } = data || {};
  if (!actionKey || typeof actionKey !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'actionKey is required');
  }
  const result = await runOperationalActionInternal(actionKey);
  return { ok: true, result };
});

exports.getFraudAlertCenter = functions.https.onCall(async (data, context) => {
  await requireAdminCaller(context);
  const [flagsSnapshot, reportsSnapshot, config] = await Promise.all([
    db.collection('admin_fraud_flags').orderBy('createdAt', 'desc').limit(50).get(),
    db.collection('reports').orderBy('createdAt', 'desc').limit(50).get(),
    getFraudControlsConfig(),
  ]);

  const pendingFlags = flagsSnapshot.docs.filter((docSnap) => (docSnap.data()?.status || 'pending') === 'pending').length;
  const recentScamReports = reportsSnapshot.docs.filter((docSnap) => {
    const reason = String(docSnap.data()?.reason || docSnap.data()?.category || '').toLowerCase();
    return reason.includes('scam') || reason.includes('โกง') || reason.includes('fraud');
  }).length;

  return {
    ok: true,
    summary: {
      pendingFlags,
      recentScamReports,
      keywordCount: config.blacklistKeywords.length,
      transferWarningTitle: config.transferWarningTitle,
      transferWarningBody: config.transferWarningBody,
    },
    config: {
      blacklistKeywords: config.blacklistKeywords,
      transferWarningTitle: config.transferWarningTitle,
      transferWarningBody: config.transferWarningBody,
    },
    flags: flagsSnapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((item) => item.status !== 'resolved' && item.status !== 'dismissed'),
  };
});

exports.updateFraudControls = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const {
    blacklistKeywords = [],
    transferWarningTitle = '',
    transferWarningBody = '',
  } = data || {};

  await db.collection('app_config').doc('fraud_controls').set({
    blacklistKeywords: normalizeStringList(blacklistKeywords),
    transferWarningTitle: String(transferWarningTitle || '').trim(),
    transferWarningBody: String(transferWarningBody || '').trim(),
    updatedBy: adminUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  return { ok: true };
});

exports.updateFraudAlertFlagStatus = functions.https.onCall(async (data, context) => {
  const adminUid = await requireAdminCaller(context);
  const { flagId, status } = data || {};
  if (!flagId || typeof flagId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'flagId is required');
  }
  if (!['resolved', 'dismissed'].includes(String(status || ''))) {
    throw new functions.https.HttpsError('invalid-argument', 'valid status is required');
  }

  await db.collection('admin_fraud_flags').doc(flagId).set({
    status: String(status),
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedBy: adminUid,
    expireAt: getDateAfterDays(RETENTION_DAYS.archivedTemplates),
  }, { merge: true });

  return { ok: true };
});

// ============================================
// 1. AUTO-EXPIRE JOBS - ทุก 6 ชั่วโมง
// ปิดงานที่หมดอายุอัตโนมัติ
// ============================================
exports.expireOldJobs = functions.pubsub
  .schedule('every 6 hours')
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('🔄 Running expireOldJobs...');
    
    const cutoffDate = new Date(Date.now() - CONFIG.POST_EXPIRE_HOURS * 60 * 60 * 1000);
    
    try {
      // Query shifts that are active and older than cutoff
      const snapshot = await db.collection('shifts')
        .where('status', '==', 'active')
        .where('createdAt', '<', cutoffDate)
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No jobs to expire');
        return null;
      }
      
      const batch = db.batch();
      let count = 0;
      
      snapshot.docs.forEach((doc) => {
        // Check if job has extended expiry
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate();
        
        if (expiresAt && expiresAt > new Date()) {
          // Job has been extended, skip
          console.log(`⏭️ Skipping extended job: ${doc.id}`);
          return;
        }
        
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          autoExpired: true,
        });
        count++;
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`✅ Expired ${count} jobs`);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error expiring jobs:', error);
      return null;
    }
  });

// ============================================
// 2. AUTO-NOTIFY ON NEW APPLICATION
// ส่ง notification เมื่อมีคนรับงาน
// ============================================
exports.onNewApplication = functions.firestore
  .document('shift_contacts/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data();
    console.log('📬 New application:', context.params.applicationId);
    
    try {
      await emitDomainAnalyticsEvent('application_submitted', {
        actorUserId: application.interestedUserId || null,
        subjectType: 'shift_contact',
        subjectId: context.params.applicationId,
        jobId: application.jobId || null,
        props: {
          applicationStatus: application.status || 'interested',
          posterId: application.posterId || null,
        },
      });

      // Get shift details
      const jobDoc = await db.collection('shifts').doc(application.jobId).get();
      if (!jobDoc.exists) {
        console.log('❌ Job not found');
        return null;
      }
      
      const job = jobDoc.data();
      
      // Get poster's FCM token
      const posterDoc = await db.collection('users').doc(job.posterId).get();
      if (!posterDoc.exists) {
        console.log('❌ Poster not found');
        return null;
      }
      
      const poster = posterDoc.data();
      const fcmToken = poster.fcmToken;
      const allowApplicationsPush = canSendPushForPreference(poster, 'applications');
      
      // Get applicant photo for notification display
      const applicantPhoto = application.interestedUserPhoto || '';
      
      if (!fcmToken || !allowApplicationsPush) {
        console.log('⚠️ No FCM token for poster');
        // Create in-app notification instead
        await createInAppNotification(job.posterId, {
          type: 'new_applicant',
          title: '📩 มีคนรับงานของคุณ!',
          body: `${application.interestedUserName || 'ผู้สมัคร'} รับงาน "${job.title}"`,
          data: {
            jobId: application.jobId,
            applicationId: context.params.applicationId,
            senderName: application.interestedUserName || 'ผู้สมัคร',
            senderPhotoURL: applicantPhoto,
          },
        });
        return null;
      }
      
      // Send FCM push notification
      const message = {
        notification: {
          title: '📩 มีคนรับงานของคุณ!',
          body: `${application.interestedUserName || 'ผู้สมัคร'} รับงาน "${job.title}"`,
        },
        data: {
          type: 'new_applicant',
          jobId: application.jobId,
          applicationId: context.params.applicationId,
          senderName: application.interestedUserName || 'ผู้สมัคร',
          senderPhotoURL: applicantPhoto,
        },
        token: fcmToken,
      };
      
      await admin.messaging().send(message);
      console.log('✅ Push notification sent');
      
      // Also create in-app notification
      await createInAppNotification(job.posterId, {
        type: 'new_applicant',
        title: '📩 มีคนรับงานของคุณ!',
        body: `${application.interestedUserName || 'ผู้สมัคร'} รับงาน "${job.title}"`,
        data: {
          jobId: application.jobId,
          applicationId: context.params.applicationId,
          senderName: application.interestedUserName || 'ผู้สมัคร',
          senderPhotoURL: applicantPhoto,
        },
      });
      
      return null;
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      return null;
    }
  });

// ============================================
// 3. DAILY LIMIT RESET - ทุกวันเที่ยงคืน
// Reset โควต้าโพสต์ประจำวัน
// ============================================
exports.resetDailyLimits = functions.pubsub
  .schedule('0 0 * * *') // Every day at midnight
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('🔄 Running resetDailyLimits...');
    
    try {
      // Get all user plans
      const snapshot = await db.collection('userPlans').get();
      
      if (snapshot.empty) {
        console.log('✅ No user plans to reset');
        return null;
      }
      
      const batch = db.batch();
      let count = 0;
      
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          postsToday: 0,
          lastResetDate: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      });
      
      await batch.commit();
      console.log(`✅ Reset daily limits for ${count} users`);
      
      return null;
    } catch (error) {
      console.error('❌ Error resetting limits:', error);
      return null;
    }
  });

// ============================================
// 4. AUTO-NOTIFY ON NEW MESSAGE
// ส่ง notification เมื่อมีข้อความใหม่
// ============================================
exports.onNewMessage = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const { conversationId } = context.params;
    
    console.log('💬 New message in:', conversationId);
    
    try {
      await emitDomainAnalyticsEvent('message_sent', {
        actorUserId: message.senderId || null,
        subjectType: 'message',
        subjectId: context.params.messageId,
        conversationId,
        props: {
          hasText: Boolean(message.text),
          messageType: message.type || 'text',
          textLength: message.text ? String(message.text).length : 0,
        },
      });

      await maybeFlagFraudMessage({
        conversationId,
        messageId: context.params.messageId,
        message,
      });

      // Get conversation
      const convDoc = await db.collection('conversations').doc(conversationId).get();
      if (!convDoc.exists) return null;
      
      const conversation = convDoc.data();
      
      // Find recipient (the other participant)
      const recipientId = conversation.participants.find(
        (p) => p !== message.senderId
      );
      
      if (!recipientId) return null;

      const senderDoc = await db.collection('users').doc(message.senderId).get();
      const senderProfile = senderDoc.exists ? senderDoc.data() || {} : {};
      const senderPhotoURL = senderProfile.photoURL || null;

      // Get recipient's push tokens
      const recipientDoc = await db.collection('users').doc(recipientId).get();
      if (!recipientDoc.exists) return null;
      
      const recipient = recipientDoc.data();
      const allowMessagesPush = canSendPushForPreference(recipient, 'messages');
      const messageData = {
        conversationId,
        jobId: conversation.jobId || null,
        jobTitle: conversation.jobTitle || null,
        senderName: message.senderName || senderProfile.displayName || 'ผู้ใช้',
        senderPhotoURL,
      };
      
      // Create in-app notification
      await createInAppNotification(recipientId, {
        type: 'new_message',
        title: `💬 ${message.senderName}`,
        body: message.text?.substring(0, 100) || 'ส่งข้อความถึงคุณ',
        data: messageData,
      });

      if (allowMessagesPush && recipient.pushToken) {
        await sendExpoPush(
          recipient.pushToken,
          `💬 ${message.senderName}`,
          message.text?.substring(0, 100) || 'ส่งข้อความถึงคุณ',
          {
            type: 'new_message',
            ...messageData,
          },
          'messages'
        );
      }
      
      // Send FCM if available
      if (allowMessagesPush && recipient.fcmToken) {
        const fcmMessage = {
          notification: {
            title: `💬 ${message.senderName}`,
            body: message.text?.substring(0, 100) || 'ส่งข้อความถึงคุณ',
            ...(senderPhotoURL ? { imageUrl: senderPhotoURL } : {}),
          },
          data: {
            type: 'new_message',
            conversationId,
            jobId: conversation.jobId || '',
            jobTitle: conversation.jobTitle || '',
            senderName: message.senderName || senderProfile.displayName || 'ผู้ใช้',
            senderPhotoURL: senderPhotoURL || '',
          },
          token: recipient.fcmToken,
        };
        
        await admin.messaging().send(fcmMessage);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error on new message:', error);
      return null;
    }
  });

exports.processScheduledBroadcastCampaigns = functions.pubsub
  .schedule('*/10 * * * *')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    const now = new Date();
    const snapshot = await db.collection('scheduled_broadcasts')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .limit(10)
      .get();

    for (const docSnap of snapshot.docs) {
      const campaign = docSnap.data() || {};
      try {
        await sendBroadcastNotificationInternal(campaign.createdBy || 'system', campaign, 'scheduled');
        await docSnap.ref.set({
          status: 'sent',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        console.error('❌ Error processing scheduled campaign:', docSnap.id, error);
        await docSnap.ref.set({
          status: 'failed',
          lastError: error.message || 'unknown error',
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    return null;
  });

exports.runScheduledCommunicationAutomations = functions.pubsub
  .schedule('0 */6 * * *')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    const config = await getAutomationConfig();
    const rules = [
      config.inactive7d ? 'inactive7d' : null,
      config.applicantNoChat ? 'applicantNoChat' : null,
      config.postNoApplicants ? 'postNoApplicants' : null,
      config.unreadChat ? 'unreadChat' : null,
    ].filter(Boolean);

    for (const ruleKey of rules) {
      try {
        await runCommunicationAutomationRule(ruleKey);
      } catch (error) {
        console.error('❌ Communication automation failed:', ruleKey, error);
      }
    }

    return null;
  });

// ============================================
// 5. SUBSCRIPTION EXPIRY CHECK - ทุก 6 ชั่วโมง
// ตรวจสอบ subscription ที่หมดอายุ
// ============================================
exports.checkSubscriptionExpiry = functions.pubsub
  .schedule('every 6 hours')
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('🔄 Checking subscription expiry...');
    
    const now = new Date();
    
    try {
      // Find premium users with expired subscriptions
      const snapshot = await db.collection('userPlans')
        .where('planType', '==', 'premium')
        .where('subscriptionEnd', '<', now)
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No expired subscriptions');
        return null;
      }
      
      const batch = db.batch();
      let count = 0;
      
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          planType: 'free',
          dailyPostLimit: CONFIG.FREE_DAILY_POST_LIMIT,
          subscriptionExpiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        // Notify user
        createInAppNotification(doc.data().userId, {
          type: 'subscription_expired',
          title: '⚠️ Premium หมดอายุแล้ว',
          body: 'แพ็คเกจ Premium ของคุณหมดอายุแล้ว ต่ออายุเพื่อโพสต์ไม่จำกัด',
          data: {},
        });
        
        count++;
      });
      
      await batch.commit();
      console.log(`✅ Downgraded ${count} expired subscriptions`);
      
      return null;
    } catch (error) {
      console.error('❌ Error checking subscriptions:', error);
      return null;
    }
  });

// ============================================
// 6. AUTO-CLOSE FILLED JOBS
// ปิดงานที่ได้คนครบแล้วอัตโนมัติ
// ============================================
exports.autoCloseFilledJobs = functions.pubsub
  .schedule('every 12 hours')
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('🔄 Checking for filled jobs...');
    
    try {
      const snapshot = await db.collection('shifts')
        .where('status', '==', 'active')
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No filled jobs to close');
        return null;
      }
      
      const batch = db.batch();
      let count = 0;
      
      snapshot.docs.forEach((doc) => {
        const job = doc.data();
        
        // Close when filled slots reach required slots.
        const filled = Number(job.filledShifts || job.acceptedApplicants || 0);
        const required = Number(job.totalShifts || job.positions || 1);
        if (filled >= required && required > 0) {
          batch.update(doc.ref, {
            status: 'closed',
            closedAt: admin.firestore.FieldValue.serverTimestamp(),
            closedReason: 'auto_filled',
          });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`✅ Auto-closed ${count} filled jobs`);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error closing jobs:', error);
      return null;
    }
  });

// ============================================
// 6B. AUTO-COMPLETE PAST JOBS + REMINDER
// ปิดงานอัตโนมัติหลังวันทำงาน 1 วัน + แจ้งเตือน
// ============================================

function getJobLastWorkDate(jobData) {
  // Multi-date: shiftDates array of ISO strings
  if (Array.isArray(jobData.shiftDates) && jobData.shiftDates.length > 0) {
    const dates = jobData.shiftDates.map((d) => new Date(d)).filter((d) => !isNaN(d.getTime()));
    if (dates.length > 0) return dates.reduce((a, b) => (b > a ? b : a));
  }
  // Homecare end date
  if (jobData.shiftDateEnd) {
    const d = typeof jobData.shiftDateEnd.toDate === 'function' ? jobData.shiftDateEnd.toDate() : new Date(jobData.shiftDateEnd);
    if (!isNaN(d.getTime())) return d;
  }
  // Single shift date
  if (jobData.shiftDate) {
    const d = typeof jobData.shiftDate.toDate === 'function' ? jobData.shiftDate.toDate() : new Date(jobData.shiftDate);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

exports.autoCompleteAndRemindPastJobs = functions.pubsub
  .schedule('every 6 hours')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    console.log('🔄 Running autoCompleteAndRemindPastJobs...');

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Get active/urgent jobs that have confirmed applicants
      const jobsSnap = await db.collection('shifts')
        .where('status', 'in', ['active', 'urgent'])
        .get();

      if (jobsSnap.empty) {
        console.log('✅ No active jobs to check');
        return null;
      }

      let remindCount = 0;
      let autoCompleteCount = 0;

      for (const jobDoc of jobsSnap.docs) {
        const job = jobDoc.data();
        const lastWorkDate = getJobLastWorkDate(job);
        if (!lastWorkDate) continue;

        const workDayStart = new Date(lastWorkDate.getFullYear(), lastWorkDate.getMonth(), lastWorkDate.getDate());
        const daysPast = Math.floor((todayStart - workDayStart) / (24 * 60 * 60 * 1000));
        if (daysPast < 1) continue; // Work date hasn't passed yet

        // Find confirmed applicant for this job
        const confirmedSnap = await db.collection('shift_contacts')
          .where('jobId', '==', jobDoc.id)
          .where('status', '==', 'confirmed')
          .limit(1)
          .get();

        if (confirmedSnap.empty) continue; // No confirmed applicant

        const confirmedApp = confirmedSnap.docs[0];
        const confirmedAppData = confirmedApp.data();

        // Check if completion already exists
        const completionRef = db.collection('job_completions').doc(jobDoc.id);
        const completionSnap = await completionRef.get();
        if (completionSnap.exists) continue; // Already completed

        if (daysPast >= 2) {
          // Auto-complete: 2+ days past work date
          const hiredUserId = confirmedAppData.interestedUserId;
          if (!hiredUserId) continue;

          // Get all contacts for this job to reject others
          const allContactsSnap = await db.collection('shift_contacts')
            .where('jobId', '==', jobDoc.id)
            .get();

          const batch = db.batch();

          batch.update(jobDoc.ref, {
            status: 'closed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedBy: 'system',
            selectedApplicationId: confirmedApp.id,
            selectedApplicantId: hiredUserId,
          });

          allContactsSnap.docs.forEach((contactDoc) => {
            const isSelected = contactDoc.id === confirmedApp.id;
            batch.update(contactDoc.ref, {
              status: isSelected ? 'confirmed' : 'cancelled',
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedBy: 'system',
              completionOutcome: isSelected ? 'hired' : 'auto_rejected',
            });
          });

          batch.set(completionRef, {
            jobId: jobDoc.id,
            jobTitle: job.title || null,
            posterId: job.posterId,
            posterName: job.posterName || null,
            posterPhotoURL: job.posterPhoto || null,
            hiredUserId,
            hiredUserName: confirmedAppData.interestedUserName || null,
            hiredUserPhotoURL: null,
            selectedApplicationId: confirmedApp.id,
            participantIds: [job.posterId, hiredUserId].filter(Boolean),
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedBy: 'system',
            autoCompleted: true,
            needsNotification: true,
          });

          await batch.commit();
          autoCompleteCount++;
          console.log(`✅ Auto-completed job ${jobDoc.id}`);

        } else if (daysPast === 1) {
          // Remind poster: 1 day past work date
          await createInAppNotification(job.posterId, {
            type: 'job_completion_reminder',
            title: '⏰ อย่าลืมปิดงานและรีวิว',
            body: `งาน "${job.title || 'งานของคุณ'}" ผ่านวันทำงานแล้ว กดจบงานเพื่อเปิดรีวิว — ถ้าไม่กด ระบบจะปิดให้อัตโนมัติภายในพรุ่งนี้`,
            data: { jobId: jobDoc.id },
          });
          remindCount++;
        }
      }

      console.log(`✅ autoCompleteAndRemindPastJobs: reminded=${remindCount}, autoCompleted=${autoCompleteCount}`);
      return null;
    } catch (error) {
      console.error('❌ Error in autoCompleteAndRemindPastJobs:', error);
      return null;
    }
  });

// ============================================
// 7. WEEKLY STATS REPORT
// สร้างรายงานสถิติประจำสัปดาห์
// ============================================
exports.weeklyStatsReport = functions.pubsub
  .schedule('0 9 * * 1') // Every Monday at 9 AM
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('📊 Generating weekly stats...');
    
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    try {
      // Count new users
      const newUsersSnapshot = await db.collection('users')
        .where('createdAt', '>=', oneWeekAgo)
        .get();
      
      // Count new shifts
      const newJobsSnapshot = await db.collection('shifts')
        .where('createdAt', '>=', oneWeekAgo)
        .get();
      
      // Count completed purchases
      const purchasesSnapshot = await db.collection('purchases')
        .where('createdAt', '>=', oneWeekAgo)
        .where('status', '==', 'completed')
        .get();
      
      let totalRevenue = 0;
      purchasesSnapshot.docs.forEach((doc) => {
        totalRevenue += doc.data().amount || 0;
      });
      
      // Save weekly analytics summary separately from moderation reports.
      await db.collection('analytics_reports').add({
        type: 'weekly',
        period: {
          start: oneWeekAgo,
          end: new Date(),
        },
        stats: {
          newUsers: newUsersSnapshot.size,
          newJobs: newJobsSnapshot.size,
          totalPurchases: purchasesSnapshot.size,
          totalRevenue,
        },
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: getDateAfterDays(RETENTION_DAYS.analyticsReports),
      });
      
      console.log(`📊 Weekly report: ${newUsersSnapshot.size} users, ${newJobsSnapshot.size} jobs, ฿${totalRevenue} revenue`);
      
      // Notify admin
      const adminsSnapshot = await db.collection('users')
        .where('isAdmin', '==', true)
        .get();
      
      adminsSnapshot.docs.forEach(async (adminDoc) => {
        await createInAppNotification(adminDoc.id, {
          type: 'weekly_report',
          title: '📊 รายงานประจำสัปดาห์',
          body: `ผู้ใช้ใหม่: ${newUsersSnapshot.size} | งานใหม่: ${newJobsSnapshot.size} | รายได้: ฿${totalRevenue}`,
          data: {},
        });
      });
      
      return null;
    } catch (error) {
      console.error('❌ Error generating report:', error);
      return null;
    }
  });

// ============================================
// 8. CLEANUP OLD NOTIFICATIONS - ทุกสัปดาห์
// ลบ notification เก่า
// ============================================
exports.cleanupOldNotifications = functions.pubsub
  .schedule('0 3 * * 0') // Every Sunday at 3 AM
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('🧹 Cleaning up old notifications...');

    try {
      const deletedCount = await deleteByQueryInBatches(
        () => db.collection('notifications').where('expireAt', '<=', new Date()).limit(450),
        40
      );
      console.log(`🧹 Deleted ${deletedCount} old notifications`);
      return null;
    } catch (error) {
      console.error('❌ Error cleaning up:', error);
      return null;
    }
  });

exports.cleanupOperationalRetentionData = functions.pubsub
  .schedule('30 3 * * *')
  .timeZone('Asia/Bangkok')
  .onRun(async () => {
    console.log('🧹 Cleaning retention-managed collections...');
    const now = new Date();
    const results = await Promise.allSettled([
      deleteByQueryInBatches(() => db.collection(ANALYTICS_COLLECTION).where('expireAt', '<=', now).limit(450), 50),
      deleteByQueryInBatches(() => db.collection(ANALYTICS_REPORTS_COLLECTION).where('expireAt', '<=', now).limit(450), 10),
      deleteByQueryInBatches(() => db.collectionGroup('opens').where('expireAt', '<=', now).limit(450), 50),
      deleteByQueryInBatches(() => db.collection('communication_automation_logs').where('expireAt', '<=', now).limit(450), 25),
      deleteByQueryInBatches(() => db.collection('admin_fraud_flags').where('expireAt', '<=', now).limit(450), 25),
      deleteByQueryInBatches(() => db.collection(ADMIN_LOGIN_RATE_LIMIT_COLLECTION).where('expireAt', '<=', now).limit(450), 10),
      deleteByQueryInBatches(() => db.collection(ADMIN_LOGIN_AUDIT_COLLECTION).where('expireAt', '<=', now).limit(450), 10),
      deleteByQueryInBatches(() => db.collection('scheduled_broadcasts').where('expireAt', '<=', now).limit(450), 10),
      deleteByQueryInBatches(() => db.collection('admin_broadcasts').where('expireAt', '<=', now).limit(450), 10),
      deleteByQueryInBatches(() => db.collection('broadcast_templates').where('expireAt', '<=', now).limit(450), 10),
    ]);

    console.log('🧹 Retention cleanup results:', results.map((result) => (
      result.status === 'fulfilled' ? result.value : `error:${result.reason?.message || result.reason}`
    )));
    return null;
  });

// ============================================
// GEOHASH HELPERS (pure JS, no dependency)
// ============================================
const GEO_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encodeGeohash(lat, lng, precision = 4) {
  let idx = 0, bit = 0, evenBit = true, geohash = '';
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  while (geohash.length < precision) {
    if (evenBit) {
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) { idx = idx * 2 + 1; lngMin = lngMid; }
      else { idx = idx * 2; lngMax = lngMid; }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) { idx = idx * 2 + 1; latMin = latMid; }
      else { idx = idx * 2; latMax = latMid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) { geohash += GEO_BASE32[idx]; bit = 0; idx = 0; }
  }
  return geohash;
}

function decodeGeohash(geohash) {
  let evenBit = true;
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  for (const char of geohash) {
    const ci = GEO_BASE32.indexOf(char);
    for (let bits = 4; bits >= 0; bits--) {
      const bitN = (ci >> bits) & 1;
      if (evenBit) {
        const lngMid = (lngMin + lngMax) / 2;
        if (bitN === 1) lngMin = lngMid; else lngMax = lngMid;
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitN === 1) latMin = latMid; else latMax = latMid;
      }
      evenBit = !evenBit;
    }
  }
  return { lat: (latMin + latMax) / 2, lng: (lngMin + lngMax) / 2 };
}

function getGeohashNeighbors(geohash) {
  const { lat, lng } = decodeGeohash(geohash);
  const precision = geohash.length;
  const latErr = 45 / Math.pow(2, 2.5 * precision - 0.5);
  const lngErr = 45 / Math.pow(2, 2.5 * precision);
  return [
    encodeGeohash(lat + latErr * 2, lng, precision),
    encodeGeohash(lat + latErr * 2, lng + lngErr * 2, precision),
    encodeGeohash(lat, lng + lngErr * 2, precision),
    encodeGeohash(lat - latErr * 2, lng + lngErr * 2, precision),
    encodeGeohash(lat - latErr * 2, lng, precision),
    encodeGeohash(lat - latErr * 2, lng - lngErr * 2, precision),
    encodeGeohash(lat, lng - lngErr * 2, precision),
    encodeGeohash(lat + latErr * 2, lng - lngErr * 2, precision),
  ];
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getUserNotificationPreferences(userData = {}) {
  const stored = userData.notificationPreferences || {};
  const legacySettings = userData.settings || {};

  return {
    pushEnabled: stored.pushEnabled !== false && legacySettings.notifications !== false,
    newJobs: stored.newJobs !== false && legacySettings.jobAlerts !== false,
    messages: stored.messages !== false,
    applications: stored.applications !== false,
    marketing: stored.marketing !== false,
  };
}

function canSendPushForPreference(userData = {}, preferenceKey) {
  const preferences = getUserNotificationPreferences(userData);
  if (!preferences.pushEnabled) return false;
  if (!preferenceKey) return true;
  return preferences[preferenceKey] !== false;
}

// ============================================
// HELPER: Send Expo Push Notification
// Uses Expo Push API (works with Expo push tokens)
// ============================================
async function sendExpoPush(pushToken, title, body, data = {}, channelId = 'default') {
  if (!pushToken) return false;
  const validExpoToken =
    pushToken.startsWith('ExponentPushToken') ||
    pushToken.startsWith('ExpoPushToken');
  if (!validExpoToken) return false;
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId,
        ...(data?.senderPhotoURL ? { richContent: { image: data.senderPhotoURL } } : {}),
      }),
    });
    const result = await response.json();
    if (result.data?.status === 'error') {
      console.warn('⚠️ Expo push error:', result.data.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('❌ Expo push failed:', err.message);
    return false;
  }
}

// ============================================
// 10. ON NEW SHIFT — แจ้งเตือน "งานใกล้ฉัน"
// Trigger: shifts/{shiftId} onCreate
// ============================================
exports.onNewShift = functions.firestore
  .document('shifts/{shiftId}')
  .onCreate(async (snap, context) => {
    const shift = snap.data();
    const shiftId = context.params.shiftId;

    console.log('📍 New shift posted:', shiftId);

    await emitDomainAnalyticsEvent('job_post_created', {
      actorUserId: shift.posterId || null,
      actorRole: shift.posterRole || null,
      subjectType: 'shift',
      subjectId: shiftId,
      jobId: shiftId,
      province: shift.location?.province || shift.province || null,
      props: {
        postType: shift.postType || 'shift',
        staffType: shift.staffType || null,
        department: shift.department || null,
        status: shift.status || 'active',
        isUrgent: Boolean(shift.isUrgent || shift.status === 'urgent'),
        shiftRate: Number(shift.shiftRate || 0),
      },
    });

    // ── ต้องมี lat/lng จึงจะทำงานได้ ──
    const shiftLat = shift.lat ?? shift.location?.lat ?? shift.location?.coordinates?.lat;
    const shiftLng = shift.lng ?? shift.location?.lng ?? shift.location?.coordinates?.lng;

    if (shiftLat == null || shiftLng == null) {
      console.log('⚠️ No lat/lng on shift, skipping nearby alerts');
      return null;
    }

    // ── คำนวณ geohash4 รอบงานนี้ (center + 8 neighbors) ──
    const centerHash = encodeGeohash(shiftLat, shiftLng, 4);
    const neighborHashes = getGeohashNeighbors(centerHash);
    // รวม 9 cells ครอบคลุม ~120km รอบจุดศูนย์กลาง
    // Firestore 'in' รองรับ ≤ 10 values
    const queryHashes = [centerHash, ...neighborHashes].slice(0, 9);

    console.log(`🗺️ Shift at [${shiftLat},${shiftLng}], geohash4: ${centerHash}`);

    try {
      // ── ดึง users ที่เปิด nearbyJobAlert และอยู่ในพื้นที่ใกล้เคียง ──
      const usersSnap = await db.collection('users')
        .where('nearbyJobAlert.enabled', '==', true)
        .where('nearbyJobAlert.geohash4', 'in', queryHashes)
        .get();

      if (usersSnap.empty) {
        console.log('ℹ️ No nearby-alert users in range');
        return null;
      }

      console.log(`👥 Found ${usersSnap.size} candidate users`);

      // ── กรองด้วย Haversine และส่ง push ──
      const locationLabel =
        shift.location?.province ??
        shift.province ??
        shift.address ??
        'ไม่ระบุสถานที่';

      const shiftTitle = shift.title || 'งานพยาบาล';
      const shiftProvince = normalizeProvince(shift.location?.province || shift.province || '');
      const shiftStaffTypes = normalizeStringList(
        Array.isArray(shift.staffTypes)
          ? shift.staffTypes
          : shift.staffType
            ? [shift.staffType]
            : []
      );
      const shiftRate = Number(shift.shiftRate ?? shift.salary ?? 0);

      let notifiedCount = 0;

      for (const userDoc of usersSnap.docs) {
        // อย่าแจ้งเตือน poster ตัวเอง
        if (userDoc.id === shift.posterId) continue;

        const userData = userDoc.data();
        const alert = userData.nearbyJobAlert;
        const userLat = alert?.lat;
        const userLng = alert?.lng;
        const radiusKm = alert.radiusKm ?? 5;
        const preferredProvince = normalizeProvince(alert?.province || '');
        const preferredStaffTypes = normalizeStringList(alert?.staffTypes);
        const minRate = Number(alert?.minRate ?? 0);
        const maxRate = Number(alert?.maxRate ?? 0);

        if (userLat == null || userLng == null) {
          continue;
        }

        if (preferredProvince && preferredProvince !== shiftProvince) {
          console.log(`  ↩️ ${userDoc.id}: province mismatch (${preferredProvince} != ${shiftProvince || 'unknown'}), skip`);
          continue;
        }

        if (preferredStaffTypes.length > 0 && !preferredStaffTypes.some((item) => shiftStaffTypes.includes(item))) {
          console.log(`  ↩️ ${userDoc.id}: staff type mismatch, skip`);
          continue;
        }

        if (minRate > 0 && shiftRate <= 0) {
          console.log(`  ↩️ ${userDoc.id}: missing shift rate for min ${minRate}, skip`);
          continue;
        }

        if (minRate > 0 && shiftRate < minRate) {
          console.log(`  ↩️ ${userDoc.id}: shift rate ${shiftRate} < min ${minRate}, skip`);
          continue;
        }

        if (maxRate > 0 && shiftRate <= 0) {
          console.log(`  ↩️ ${userDoc.id}: missing shift rate for max ${maxRate}, skip`);
          continue;
        }

        if (maxRate > 0 && shiftRate > maxRate) {
          console.log(`  ↩️ ${userDoc.id}: shift rate ${shiftRate} > max ${maxRate}, skip`);
          continue;
        }

        const distKm = haversineKm(userLat, userLng, shiftLat, shiftLng);

        if (distKm > radiusKm) {
          console.log(`  ↩️ ${userDoc.id}: ${distKm.toFixed(1)}km > ${radiusKm}km, skip`);
          continue;
        }

        console.log(`  ✉️ ${userDoc.id}: ${distKm.toFixed(1)}km <= ${radiusKm}km, notify`);

        const notifTitle = '📍 มีงานใหม่ใกล้คุณ!';
        const notifBody = `${shiftTitle} · ${locationLabel} · ห่างจากคุณ ${distKm.toFixed(1)} กม.`;
        const notifData = { type: 'nearby_job', shiftId, jobId: shiftId };

        // ── Expo Push (ถ้ามี token) ──
        const allowNewJobsPush = canSendPushForPreference(userData, 'newJobs');
        const pushToken = userData.pushToken;
        if (allowNewJobsPush && pushToken) {
          await sendExpoPush(pushToken, notifTitle, notifBody, notifData, 'jobs');
        }

        // ── FCM fallback (ถ้ามี fcmToken) ──
        const fcmToken = userData.fcmToken;
        if (allowNewJobsPush && fcmToken && !pushToken) {
          try {
            await admin.messaging().send({
              notification: { title: notifTitle, body: notifBody },
              data: { type: 'nearby_job', shiftId },
              token: fcmToken,
              android: { channelId: 'jobs', priority: 'high' },
            });
          } catch (fcmErr) {
            console.warn('FCM error:', fcmErr.message);
          }
        }

        // ── In-app notification ──
        await createInAppNotification(userDoc.id, {
          type: 'nearby_job',
          title: notifTitle,
          body: notifBody,
          data: notifData,
        });

        notifiedCount++;
      }

      console.log(`✅ Notified ${notifiedCount} users for shift ${shiftId}`);
      return null;
    } catch (error) {
      console.error('❌ onNewShift error:', error);
      return null;
    }
  });

exports.enforceShiftPublishingPolicy = functions.firestore
  .document('shifts/{shiftId}')
  .onWrite(async (change, context) => {
    if (!change.after.exists) {
      return null;
    }

    const after = change.after.data() || {};
    const shiftId = context.params.shiftId;
    const validation = validateShiftPublishingPolicy(after);

    if (validation.valid) {
      return null;
    }

    const currentCodes = Array.isArray(after.policyViolationCodes)
      ? [...after.policyViolationCodes].sort()
      : [];
    const nextCodes = [...validation.violations].sort();
    const alreadyBlocked = after.postingPolicyStatus === 'blocked'
      && after.status === 'closed'
      && JSON.stringify(currentCodes) === JSON.stringify(nextCodes);

    if (alreadyBlocked) {
      return null;
    }

    const updatePayload = {
      postingPolicyStatus: 'blocked',
      policyViolationCode: validation.violations[0],
      policyViolationCodes: validation.violations,
      policyViolationReason: validation.message,
      policyViolationAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'closed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(validation.dangerous ? {
        title: 'ประกาศนี้ถูกซ่อนอัตโนมัติ',
        description: 'ระบบซ่อนประกาศนี้อัตโนมัติเนื่องจากพบข้อมูลติดต่อภายนอกที่ผิดนโยบาย กรุณาแก้ไขแล้วโพสต์ใหม่ในแอป',
        campaignSummary: 'ประกาศนี้ถูกซ่อนอัตโนมัติเพราะผิดนโยบายการติดต่อ',
        contactPhone: admin.firestore.FieldValue.delete(),
        contactLine: admin.firestore.FieldValue.delete(),
        sourceText: admin.firestore.FieldValue.delete(),
      } : {}),
    };

    await change.after.ref.set(updatePayload, { merge: true });

    if (after.posterId) {
      await createInAppNotification(after.posterId, {
        type: 'system',
        title: 'ประกาศถูกซ่อนอัตโนมัติ',
        body: validation.message,
        data: {
          type: 'posting_policy_blocked',
          jobId: shiftId,
          policyViolationCode: validation.violations[0],
        },
      });
    }

    await emitDomainAnalyticsEvent('posting_policy_blocked', {
      actorUserId: after.posterId || null,
      actorRole: after.posterRole || null,
      subjectType: 'shift',
      subjectId: shiftId,
      jobId: shiftId,
      province: after.location?.province || after.province || null,
      props: {
        violations: validation.violations,
        contactMode: validation.mode,
        dangerous: validation.dangerous,
      },
    });

    return null;
  });

// ============================================
// HELPER: Create In-App Notification
// ============================================
async function createInAppNotification(userId, notification) {
  try {
    await db.collection('notifications').add({
      userId,
      ...notification,
      isRead: false,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: getDateAfterDays(RETENTION_DAYS.notifications),
    });
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

async function getUserSnapshot(userId) {
  if (!userId) return null;
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return null;
  return userDoc.data() || null;
}

function requireCallableAuth(context) {
  const uid = context?.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  return uid;
}

async function requireHttpBearerAuth(req) {
  const authHeader = String(req.headers?.authorization || '');
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }

  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch (error) {
    throw new functions.https.HttpsError('unauthenticated', 'Invalid or expired token');
  }
}

async function requireAdminCaller(context) {
  const uid = requireCallableAuth(context);
  const adminDoc = await db.collection('users').doc(uid).get();
  const isAdminUser = adminDoc.exists && (adminDoc.data()?.role === 'admin' || adminDoc.data()?.isAdmin === true);
  if (!isAdminUser) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }
  return uid;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function normalizeProvince(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeProvinceList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => normalizeProvince(item)).filter(Boolean))];
}

function resolveUserProvince(userData) {
  return normalizeProvince(
    userData?.province ||
    userData?.location?.province ||
    userData?.preferredProvince ||
    ''
  );
}

function resolveUserStaffTypes(userData) {
  const values = Array.isArray(userData?.staffTypes)
    ? userData.staffTypes
    : userData?.staffType
      ? [userData.staffType]
      : [];

  return [...new Set(values.map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
}

function getTimestampDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildDateKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 10);
}

function getDateAfterDays(days, fromDate = new Date()) {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function normalizeIpAddress(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'unknown';
  if (raw === '::1') return '127.0.0.1';
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

function getRequestIp(context) {
  const request = context?.rawRequest;
  const forwardedFor = request?.headers?.['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return normalizeIpAddress(forwardedFor.split(',')[0]);
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return normalizeIpAddress(forwardedFor[0]);
  }
  return normalizeIpAddress(
    request?.ip ||
    request?.socket?.remoteAddress ||
    request?.connection?.remoteAddress ||
    ''
  );
}

function getRequestUserAgent(context) {
  return String(context?.rawRequest?.headers?.['user-agent'] || 'unknown').slice(0, 240);
}

function getAdminLoginScope(username, context) {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const ipAddress = getRequestIp(context);
  const userAgent = getRequestUserAgent(context);
  const clientFingerprint = sha256(`${ipAddress}|${userAgent}`).slice(0, 32);

  return {
    normalizedUsername,
    normalizedUsernameHash: sha256(normalizedUsername),
    ipAddress,
    ipAddressHash: sha256(ipAddress),
    userAgent,
    clientFingerprint,
    usernameDocId: `username_${sha256(normalizedUsername)}`,
    clientDocId: `client_${clientFingerprint}`,
  };
}

function getActiveLockout(data, now = new Date()) {
  const lockoutUntil = getTimestampDate(data?.lockoutUntil);
  return lockoutUntil && lockoutUntil > now ? lockoutUntil : null;
}

function getRateLimitDocumentUpdate(existingData, now, maxFailures, scopeInfo) {
  const windowMs = ADMIN_LOGIN_LIMITS.windowMinutes * 60 * 1000;
  const firstAttemptAt = getTimestampDate(existingData?.firstAttemptAt);
  const withinWindow = firstAttemptAt && (now.getTime() - firstAttemptAt.getTime()) <= windowMs;
  const failureCount = withinWindow ? Number(existingData?.failureCount || 0) + 1 : 1;
  const lockoutUntil = failureCount >= maxFailures
    ? new Date(now.getTime() + ADMIN_LOGIN_LIMITS.lockoutMinutes * 60 * 1000)
    : null;

  return {
    scope: scopeInfo.scope,
    normalizedUsernameHash: scopeInfo.normalizedUsernameHash,
    clientFingerprint: scopeInfo.clientFingerprint,
    ipAddressHash: scopeInfo.ipAddressHash,
    firstAttemptAt: withinWindow ? firstAttemptAt : now,
    lastAttemptAt: now,
    lastFailureAt: now,
    failureCount,
    lockoutUntil,
    expireAt: getDateAfterDays(ADMIN_LOGIN_GUARD_RETENTION_DAYS, now),
  };
}

async function assertAdminLoginAllowed(username, context) {
  const scope = getAdminLoginScope(username, context);
  const usernameRef = db.collection(ADMIN_LOGIN_RATE_LIMIT_COLLECTION).doc(scope.usernameDocId);
  const clientRef = db.collection(ADMIN_LOGIN_RATE_LIMIT_COLLECTION).doc(scope.clientDocId);
  const now = new Date();

  const [usernameSnap, clientSnap] = await Promise.all([
    usernameRef.get(),
    clientRef.get(),
  ]);

  const activeLockout = [
    getActiveLockout(usernameSnap.data(), now),
    getActiveLockout(clientSnap.data(), now),
  ]
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;

  if (activeLockout) {
    const waitMinutes = Math.max(1, Math.ceil((activeLockout.getTime() - now.getTime()) / (60 * 1000)));
    throw new functions.https.HttpsError(
      'resource-exhausted',
      `Admin login ถูกล็อกชั่วคราว กรุณาลองใหม่ในอีกประมาณ ${waitMinutes} นาที`
    );
  }

  return {
    scope,
    usernameRef,
    clientRef,
  };
}

async function recordAdminLoginAttempt({ username, context, success, reason, guardState = null }) {
  const now = new Date();
  const scope = guardState?.scope || getAdminLoginScope(username, context);
  const usernameRef = guardState?.usernameRef || db.collection(ADMIN_LOGIN_RATE_LIMIT_COLLECTION).doc(scope.usernameDocId);
  const clientRef = guardState?.clientRef || db.collection(ADMIN_LOGIN_RATE_LIMIT_COLLECTION).doc(scope.clientDocId);

  if (success) {
    await db.runTransaction(async (transaction) => {
      transaction.set(usernameRef, {
        scope: 'username',
        normalizedUsernameHash: scope.normalizedUsernameHash,
        clientFingerprint: scope.clientFingerprint,
        ipAddressHash: scope.ipAddressHash,
        failureCount: 0,
        lockoutUntil: null,
        firstAttemptAt: null,
        lastAttemptAt: now,
        lastSuccessAt: now,
        expireAt: getDateAfterDays(ADMIN_LOGIN_GUARD_RETENTION_DAYS, now),
      }, { merge: true });
      transaction.set(clientRef, {
        scope: 'client',
        normalizedUsernameHash: scope.normalizedUsernameHash,
        clientFingerprint: scope.clientFingerprint,
        ipAddressHash: scope.ipAddressHash,
        failureCount: 0,
        lockoutUntil: null,
        firstAttemptAt: null,
        lastAttemptAt: now,
        lastSuccessAt: now,
        expireAt: getDateAfterDays(ADMIN_LOGIN_GUARD_RETENTION_DAYS, now),
      }, { merge: true });
    });
  } else {
    await db.runTransaction(async (transaction) => {
      const [usernameSnap, clientSnap] = await Promise.all([
        transaction.get(usernameRef),
        transaction.get(clientRef),
      ]);

      transaction.set(usernameRef, getRateLimitDocumentUpdate(usernameSnap.data(), now, ADMIN_LOGIN_LIMITS.usernameMaxFailures, {
        scope: 'username',
        normalizedUsernameHash: scope.normalizedUsernameHash,
        clientFingerprint: scope.clientFingerprint,
        ipAddressHash: scope.ipAddressHash,
      }), { merge: true });

      transaction.set(clientRef, getRateLimitDocumentUpdate(clientSnap.data(), now, ADMIN_LOGIN_LIMITS.clientMaxFailures, {
        scope: 'client',
        normalizedUsernameHash: scope.normalizedUsernameHash,
        clientFingerprint: scope.clientFingerprint,
        ipAddressHash: scope.ipAddressHash,
      }), { merge: true });
    });
  }

  await db.collection(ADMIN_LOGIN_AUDIT_COLLECTION).add({
    success,
    reason: String(reason || (success ? 'success' : 'invalid_credentials')).slice(0, 80),
    normalizedUsernameHash: scope.normalizedUsernameHash,
    ipAddressHash: scope.ipAddressHash,
    clientFingerprint: scope.clientFingerprint,
    userAgent: scope.userAgent,
    appCheckVerified: Boolean(context?.app),
    callerUid: context?.auth?.uid || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(ADMIN_LOGIN_AUDIT_RETENTION_DAYS, now),
  });
}

async function deleteByQueryInBatches(queryFactory, maxBatches = 20) {
  let deletedCount = 0;
  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const snapshot = await queryFactory().get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deletedCount += snapshot.size;

    if (snapshot.size < 450) break;
  }
  return deletedCount;
}

async function deleteStorageFileByPath(storagePath) {
  if (!storagePath) return false;
  try {
    await admin.storage().bucket().file(String(storagePath)).delete({ ignoreNotFound: true });
    return true;
  } catch (error) {
    console.warn('[deleteCurrentUserAccount] failed to delete storage file:', storagePath, error?.message || error);
    return false;
  }
}

async function deleteDocumentsForUser(userId) {
  let deletedCount = 0;
  let deletedFiles = 0;

  for (let batchIndex = 0; batchIndex < 20; batchIndex += 1) {
    const snapshot = await db.collection('documents').where('userId', '==', userId).limit(100).get();
    if (snapshot.empty) break;

    await Promise.all(snapshot.docs.map((docSnap) => deleteStorageFileByPath(docSnap.data()?.storagePath)));
    deletedFiles += snapshot.docs.filter((docSnap) => Boolean(docSnap.data()?.storagePath)).length;

    const batch = db.batch();
    snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deletedCount += snapshot.size;

    if (snapshot.size < 100) break;
  }

  return { deletedCount, deletedFiles };
}

async function deleteConversationWithMessages(conversationRef) {
  const deletedMessages = await deleteByQueryInBatches(() => conversationRef.collection('messages').limit(450), 25);
  await conversationRef.delete();
  return deletedMessages;
}

async function deleteConversationsForUser(userId) {
  let deletedConversations = 0;
  let deletedMessages = 0;

  for (let batchIndex = 0; batchIndex < 20; batchIndex += 1) {
    const snapshot = await db.collection('conversations').where('participants', 'array-contains', userId).limit(25).get();
    if (snapshot.empty) break;

    for (const docSnap of snapshot.docs) {
      deletedMessages += await deleteConversationWithMessages(docSnap.ref);
      deletedConversations += 1;
    }

    if (snapshot.size < 25) break;
  }

  return { deletedConversations, deletedMessages };
}

async function deletePostedShiftsForUser(userId) {
  let deletedShifts = 0;
  let deletedApplications = 0;
  let deletedFavorites = 0;
  let deletedJobReports = 0;
  let deletedJobCompletions = 0;

  for (let batchIndex = 0; batchIndex < 20; batchIndex += 1) {
    const snapshot = await db.collection('shifts').where('posterId', '==', userId).limit(50).get();
    if (snapshot.empty) break;

    const batch = db.batch();

    for (const docSnap of snapshot.docs) {
      const shiftId = docSnap.id;
      deletedApplications += await deleteByQueryInBatches(() => db.collection('shift_contacts').where('jobId', '==', shiftId).limit(450), 25);
      deletedFavorites += await deleteByQueryInBatches(() => db.collection('favorites').where('jobId', '==', shiftId).limit(450), 25);
      deletedJobReports += await deleteByQueryInBatches(() => db.collection('reports').where('targetId', '==', shiftId).limit(450), 25);

      try {
        await db.collection('job_completions').doc(shiftId).delete();
        deletedJobCompletions += 1;
      } catch {
      }

      batch.delete(docSnap.ref);
      deletedShifts += 1;
    }

    await batch.commit();

    if (snapshot.size < 50) break;
  }

  return {
    deletedShifts,
    deletedApplications,
    deletedFavorites,
    deletedJobReports,
    deletedJobCompletions,
  };
}

async function deleteCurrentUserAccountInternal(userId) {
  const summary = {
    userId,
    deletedDocuments: 0,
    deletedDocumentFiles: 0,
    deletedConversations: 0,
    deletedMessages: 0,
    deletedPostedShifts: 0,
    deletedShiftContacts: 0,
    deletedFavorites: 0,
    deletedNotifications: 0,
    deletedVerifications: 0,
    deletedReports: 0,
    deletedFeedback: 0,
    deletedReviews: 0,
    deletedJobCompletions: 0,
    deletedReferrals: 0,
    deletedUserPlans: 0,
    deletedPurchases: 0,
    deletedCampaignRedemptions: 0,
    deletedAnalyticsEvents: 0,
  };

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();

  const documentSummary = await deleteDocumentsForUser(userId);
  summary.deletedDocuments += documentSummary.deletedCount;
  summary.deletedDocumentFiles += documentSummary.deletedFiles;

  const conversationSummary = await deleteConversationsForUser(userId);
  summary.deletedConversations += conversationSummary.deletedConversations;
  summary.deletedMessages += conversationSummary.deletedMessages;

  const shiftSummary = await deletePostedShiftsForUser(userId);
  summary.deletedPostedShifts += shiftSummary.deletedShifts;
  summary.deletedShiftContacts += shiftSummary.deletedApplications;
  summary.deletedFavorites += shiftSummary.deletedFavorites;
  summary.deletedReports += shiftSummary.deletedJobReports;
  summary.deletedJobCompletions += shiftSummary.deletedJobCompletions;

  const [
    applicantContacts,
    favorites,
    notifications,
    verifications,
    reporterReports,
    targetedReports,
    feedback,
    reviewsByReviewer,
    reviewsByUserField,
    reviewsByReviewee,
    reviewsByHospital,
    jobCompletions,
    referralsByReferrer,
    referralsByReferee,
    userPlans,
    purchases,
    campaignRedemptions,
    analyticsEvents,
  ] = await Promise.all([
    deleteByQueryInBatches(() => db.collection('shift_contacts').where('interestedUserId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('favorites').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('notifications').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('verifications').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('reports').where('reporterId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('reports').where('targetId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('feedback').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('reviews').where('reviewerId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('reviews').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('reviews').where('revieweeId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('reviews').where('hospitalId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('job_completions').where('participantIds', 'array-contains', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('referrals').where('referrerUid', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('referrals').where('refereeUid', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('userPlans').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('purchases').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection('campaign_code_redemptions').where('userId', '==', userId).limit(450), 25),
    deleteByQueryInBatches(() => db.collection(ANALYTICS_COLLECTION).where('actorUserId', '==', userId).limit(450), 25),
  ]);

  summary.deletedShiftContacts += applicantContacts;
  summary.deletedFavorites += favorites;
  summary.deletedNotifications += notifications;
  summary.deletedVerifications += verifications;
  summary.deletedReports += reporterReports + targetedReports;
  summary.deletedFeedback += feedback;
  summary.deletedReviews += reviewsByReviewer + reviewsByUserField + reviewsByReviewee + reviewsByHospital;
  summary.deletedJobCompletions += jobCompletions;
  summary.deletedReferrals += referralsByReferrer + referralsByReferee;
  summary.deletedUserPlans += userPlans;
  summary.deletedPurchases += purchases;
  summary.deletedCampaignRedemptions += campaignRedemptions;
  summary.deletedAnalyticsEvents += analyticsEvents;

  if (userSnap.exists) {
    await userRef.delete();
  }

  await admin.auth().deleteUser(userId);

  return {
    ok: true,
    ...summary,
  };
}

function stableHash(input) {
  const value = String(input || '');
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeBroadcastVariants(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .map((item, index) => ({
      id: String(item?.id || String.fromCharCode(65 + index)).trim().slice(0, 12),
      title: String(item?.title || '').trim().slice(0, 120),
      body: String(item?.body || '').trim().slice(0, 240),
    }))
    .filter((item) => item.title && item.body)
    .slice(0, 2);
}

function chooseBroadcastVariant(userId, defaultTitle, defaultBody, variants) {
  const normalizedVariants = normalizeBroadcastVariants(variants);
  if (normalizedVariants.length < 2) {
    return {
      id: normalizedVariants[0]?.id || 'A',
      title: normalizedVariants[0]?.title || defaultTitle,
      body: normalizedVariants[0]?.body || defaultBody,
      isAbTest: false,
    };
  }

  const selectedVariant = normalizedVariants[stableHash(userId) % normalizedVariants.length];
  return {
    ...selectedVariant,
    isAbTest: true,
  };
}

async function buildAudienceLookups(options = {}) {
  const lookups = {
    activeUserIds: null,
    postedUserIds: null,
  };

  const activeWithinDays = Number(options.activeWithinDays || 0);
  if (activeWithinDays > 0) {
    const since = new Date(Date.now() - activeWithinDays * 24 * 60 * 60 * 1000);
    const analyticsSnapshot = await db.collection(ANALYTICS_COLLECTION)
      .where('createdAt', '>=', since)
      .select('actorUserId')
      .get();
    lookups.activeUserIds = new Set(
      analyticsSnapshot.docs
        .map((docSnap) => docSnap.data()?.actorUserId)
        .filter(Boolean)
    );
  }

  if (options.neverPosted) {
    const shiftsSnapshot = await db.collection('shifts').select('posterId').get();
    lookups.postedUserIds = new Set(
      shiftsSnapshot.docs
        .map((docSnap) => docSnap.data()?.posterId)
        .filter(Boolean)
    );
  }

  return lookups;
}

function buildAudienceBreakdown(targetUsers) {
  const roleBreakdown = {};
  const provinceBreakdown = {};
  const staffTypeBreakdown = {};
  let verifiedCount = 0;
  let pushReadyCount = 0;

  targetUsers.forEach((userDoc) => {
    const userData = userDoc.data() || {};
    const role = userData.role || 'user';
    roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;

    const province = resolveUserProvince(userData) || 'ไม่ระบุ';
    provinceBreakdown[province] = (provinceBreakdown[province] || 0) + 1;

    resolveUserStaffTypes(userData).forEach((staffType) => {
      staffTypeBreakdown[staffType] = (staffTypeBreakdown[staffType] || 0) + 1;
    });

    if (userData.isVerified === true) verifiedCount += 1;
    if (userData.pushToken || userData.fcmToken) pushReadyCount += 1;
  });

  const sortEntries = (input) => Object.entries(input)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    roleBreakdown,
    provinceBreakdown: sortEntries(provinceBreakdown),
    staffTypeBreakdown: sortEntries(staffTypeBreakdown),
    verifiedCount,
    pushReadyCount,
  };
}

function filterBroadcastTargets(userDocs, options = {}) {
  const {
    targetRole = 'all',
    onlyVerified = false,
    activeOnly = true,
    targetProvince = '',
    targetProvinces = [],
    targetStaffTypes = [],
    activeWithinDays = 0,
    neverPosted = false,
    lookups = {},
  } = options;

  const normalizedProvinces = normalizeProvinceList(targetProvinces);
  const normalizedProvince = normalizedProvinces[0] || normalizeProvince(targetProvince);
  const normalizedStaffTypes = normalizeStringList(targetStaffTypes);
  const activeUserIds = lookups.activeUserIds instanceof Set ? lookups.activeUserIds : null;
  const postedUserIds = lookups.postedUserIds instanceof Set ? lookups.postedUserIds : null;

  return userDocs.filter((userDoc) => {
    const userData = userDoc.data() || {};
    if (targetRole !== 'all' && userData.role !== targetRole) return false;
    if (activeOnly && userData.isActive === false) return false;
    if (onlyVerified && userData.isVerified !== true) return false;
    if (normalizedProvince) {
      const userProvince = resolveUserProvince(userData);
      if (!normalizedProvinces.includes(userProvince) && userProvince !== normalizedProvince) return false;
    }
    if (normalizedStaffTypes.length > 0) {
      const userStaffTypes = resolveUserStaffTypes(userData);
      if (!normalizedStaffTypes.some((staffType) => userStaffTypes.includes(staffType))) return false;
    }
    if (Number(activeWithinDays) > 0) {
      const lastActiveAt = getTimestampDate(userData.lastActiveAt);
      const thresholdDate = new Date(Date.now() - Number(activeWithinDays) * 24 * 60 * 60 * 1000);
      const hasRecentActivity = (lastActiveAt && lastActiveAt >= thresholdDate)
        || (activeUserIds ? activeUserIds.has(userDoc.id) : false);
      if (!hasRecentActivity) return false;
    }
    if (neverPosted && postedUserIds && postedUserIds.has(userDoc.id)) return false;
    return true;
  });
}

async function createAutomationLog(ruleKey, entityId, payload = {}) {
  const logId = `${ruleKey}_${entityId}_${buildDateKey()}`;
  const logRef = db.collection('communication_automation_logs').doc(logId);
  const existing = await logRef.get();
  if (existing.exists) return false;
  await logRef.set({
    ruleKey,
    entityId,
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(RETENTION_DAYS.automationLogs),
  });
  return true;
}

async function getFraudControlsConfig() {
  const configDoc = await db.collection('app_config').doc('fraud_controls').get();
  const data = configDoc.exists ? configDoc.data() || {} : {};
  return {
    blacklistKeywords: normalizeStringList(data.blacklistKeywords || []),
    transferWarningTitle: String(data.transferWarningTitle || 'คำเตือนภัยมิจฉาชีพ').trim() || 'คำเตือนภัยมิจฉาชีพ',
    transferWarningBody: String(data.transferWarningBody || 'อย่าโอนเงินก่อนเริ่มงาน และหลีกเลี่ยงการสนทนานอกระบบเมื่อยังไม่ตรวจสอบบัญชี').trim() || 'อย่าโอนเงินก่อนเริ่มงาน และหลีกเลี่ยงการสนทนานอกระบบเมื่อยังไม่ตรวจสอบบัญชี',
    updatedAt: getTimestampDate(data.updatedAt),
  };
}

async function maybeFlagFraudMessage({ conversationId, messageId, message }) {
  const text = String(message?.text || '').trim().toLowerCase();
  if (!text) return;

  const fraudConfig = await getFraudControlsConfig();
  if (fraudConfig.blacklistKeywords.length === 0) return;

  const matchedKeywords = fraudConfig.blacklistKeywords.filter((keyword) => text.includes(keyword.toLowerCase()));
  if (matchedKeywords.length === 0) return;

  await db.collection('admin_fraud_flags').add({
    type: 'message_keyword',
    conversationId,
    messageId,
    senderId: message?.senderId || null,
    senderName: message?.senderName || null,
    matchedKeywords,
    textPreview: text.slice(0, 180),
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: getDateAfterDays(RETENTION_DAYS.fraudFlags),
  });

  const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').get();
  await Promise.all(adminsSnapshot.docs.map((adminDoc) => createInAppNotification(adminDoc.id, {
    type: 'system',
    title: 'ตรวจพบข้อความเสี่ยงมิจฉาชีพ',
    body: `พบ keyword เสี่ยงในแชท ${matchedKeywords.join(', ')}`,
    data: {
      type: 'fraud_keyword_detected',
      conversationId,
      messageId,
      matchedKeywords,
    },
  })));
}

async function recordBroadcastOpenInternal({ userId, broadcastId, variantId, targetScreen }) {
  const broadcastRef = db.collection('admin_broadcasts').doc(broadcastId);
  const openRef = broadcastRef.collection('opens').doc(userId);

  const [broadcastSnap, openSnap] = await Promise.all([
    broadcastRef.get(),
    openRef.get(),
  ]);

  if (!broadcastSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Broadcast not found');
  }

  if (!openSnap.exists) {
    const batch = db.batch();
    batch.set(openRef, {
      userId,
      variantId: variantId || null,
      targetScreen: targetScreen || null,
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: getDateAfterDays(RETENTION_DAYS.broadcastOpens),
    });
    batch.update(broadcastRef, {
      openCount: admin.firestore.FieldValue.increment(1),
      lastOpenedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(variantId
        ? { [`variantStats.${variantId}.openCount`]: admin.firestore.FieldValue.increment(1) }
        : {}),
      ...(targetScreen
        ? { [`destinationOpenCounts.${targetScreen}`]: admin.firestore.FieldValue.increment(1) }
        : {}),
    });
    await batch.commit();
  }

  const userRef = db.collection('users').doc(userId);
  await userRef.set({
    lastBroadcastInteraction: {
      broadcastId,
      variantId: variantId || null,
      targetScreen: targetScreen || null,
      openedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
  }, { merge: true });
}

async function buildBroadcastAnalyticsSummary(broadcastId) {
  const broadcastDoc = await db.collection('admin_broadcasts').doc(broadcastId).get();
  if (!broadcastDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Broadcast not found');
  }

  const broadcastData = broadcastDoc.data() || {};
  const opensAggregate = await db.collection('admin_broadcasts').doc(broadcastId)
    .collection('opens')
    .count()
    .get();
  const openedUserCount = Number(opensAggregate.data().count || 0);
  const createdAt = getTimestampDate(broadcastData.createdAt) || new Date(0);
  const conversionWindowStart = createdAt;

  const conversionEvents = ['apply_cta_clicked', 'post_job_submitted', 'purchase_completed'];
  const conversionCounts = {
    apply_cta_clicked: 0,
    post_job_submitted: 0,
    purchase_completed: 0,
  };

  for (const eventName of conversionEvents) {
    const aggregate = await db.collection(ANALYTICS_COLLECTION)
      .where('eventName', '==', eventName)
      .where('props.attributedBroadcastId', '==', broadcastId)
      .where('createdAt', '>=', conversionWindowStart)
      .count()
      .get();
    conversionCounts[eventName] = Number(aggregate.data().count || 0);
  }

  return {
    broadcastId,
    sentCount: Number(broadcastData.sentCount || 0),
    inAppCount: Number(broadcastData.inAppCount || 0),
    pushSentCount: Number(broadcastData.pushSentCount || 0),
    pushFailedCount: Number(broadcastData.pushFailedCount || 0),
    openCount: Number(broadcastData.openCount || 0),
    openRate: Number(broadcastData.sentCount || 0) > 0 ? Number(broadcastData.openCount || 0) / Number(broadcastData.sentCount || 0) : 0,
    targetScreen: broadcastData.targetScreen || null,
    destinationOpenCounts: broadcastData.destinationOpenCounts || {},
    variantStats: broadcastData.variantStats || {},
    conversions: {
      applyCount: conversionCounts.apply_cta_clicked,
      postCount: conversionCounts.post_job_submitted,
      purchaseCount: conversionCounts.purchase_completed,
    },
    openedUserCount,
  };
}

async function sendBroadcastNotificationInternal(adminUid, data = {}, source = 'manual') {
  const {
    title,
    body,
    type = 'system',
    targetRole = 'all',
    onlyVerified = false,
    activeOnly = true,
    targetProvince = '',
    targetProvinces = [],
    targetStaffTypes = [],
    activeWithinDays = 0,
    neverPosted = false,
    targetScreen = '',
    targetParams = {},
    templateKey = '',
    variants = [],
    campaignName = '',
  } = data || {};

  if (!title || typeof title !== 'string' || !body || typeof body !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'title and body are required');
  }

  if (!['system', 'promotion'].includes(type)) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid type');
  }

  if (!['all', 'user', 'nurse', 'hospital', 'admin'].includes(targetRole)) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid targetRole');
  }

  const usersSnapshot = await db.collection('users').get();
  const normalizedTargetProvinces = normalizeProvinceList(targetProvinces);
  const normalizedTargetStaffTypes = normalizeStringList(targetStaffTypes);
  const lookups = await buildAudienceLookups({ activeWithinDays, neverPosted });
  const targetUsers = filterBroadcastTargets(usersSnapshot.docs, {
    targetRole,
    onlyVerified,
    activeOnly,
    targetProvince,
    targetProvinces: normalizedTargetProvinces,
    targetStaffTypes: normalizedTargetStaffTypes,
    activeWithinDays,
    neverPosted,
    lookups,
  });

  const audienceBreakdown = buildAudienceBreakdown(targetUsers);
  const normalizedVariants = normalizeBroadcastVariants(variants);
  const trimmedTitle = String(title).trim();
  const trimmedBody = String(body).trim();
  const notificationType = type === 'promotion' ? 'promotion' : 'system';

  const broadcastRef = db.collection('admin_broadcasts').doc();
  await broadcastRef.set({
    title: trimmedTitle,
    body: trimmedBody,
    type: notificationType,
    targetRole,
    targetProvince: normalizedTargetProvinces[0] || normalizeProvince(targetProvince) || null,
    targetProvinces: normalizedTargetProvinces,
    targetStaffTypes: normalizedTargetStaffTypes,
    activeWithinDays: Number(activeWithinDays || 0),
    neverPosted: Boolean(neverPosted),
    onlyVerified: Boolean(onlyVerified),
    activeOnly: Boolean(activeOnly),
    targetScreen: String(targetScreen || '').trim() || null,
    targetParams: typeof targetParams === 'object' && targetParams ? targetParams : {},
    templateKey: String(templateKey || '').trim() || null,
    campaignName: String(campaignName || '').trim() || null,
    source,
    sentCount: targetUsers.length,
    inAppCount: targetUsers.length,
    pushSentCount: 0,
    pushFailedCount: 0,
    openCount: 0,
    destinationOpenCounts: {},
    audienceBreakdown,
    variantStats: normalizedVariants.reduce((acc, item) => {
      acc[item.id] = {
        title: item.title,
        body: item.body,
        sentCount: 0,
        openCount: 0,
      };
      return acc;
    }, {}),
    expireAt: getDateAfterDays(RETENTION_DAYS.broadcasts),
    createdBy: adminUid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  if (targetUsers.length === 0) {
    return {
      ok: true,
      broadcastId: broadcastRef.id,
      sentCount: 0,
      inAppCount: 0,
      pushSentCount: 0,
      pushFailedCount: 0,
      breakdown: audienceBreakdown,
    };
  }

  const payloadBaseData = {
    type: 'admin_broadcast',
    category: notificationType,
    source: source === 'scheduled' ? 'campaign_scheduler' : 'admin_dashboard',
    province: normalizedTargetProvinces[0] || normalizeProvince(targetProvince) || 'all',
    provinces: normalizedTargetProvinces,
    broadcastId: broadcastRef.id,
    targetScreen: String(targetScreen || '').trim() || '',
    targetParams: typeof targetParams === 'object' && targetParams ? targetParams : {},
    templateKey: String(templateKey || '').trim() || '',
  };

  const notificationRecords = targetUsers.map((userDoc) => {
    const variant = chooseBroadcastVariant(userDoc.id, trimmedTitle, trimmedBody, normalizedVariants);
    return {
      userDoc,
      variant,
      notification: {
        type: notificationType,
        title: variant.title,
        body: variant.body,
        data: {
          ...payloadBaseData,
          variantId: variant.id,
        },
      },
    };
  });

  const variantSentCounts = {};
  notificationRecords.forEach((item) => {
    variantSentCounts[item.variant.id] = (variantSentCounts[item.variant.id] || 0) + 1;
  });

  for (const group of chunkArray(notificationRecords, 400)) {
    const batch = db.batch();
    for (const item of group) {
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        userId: item.userDoc.id,
        ...item.notification,
        isRead: false,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: getDateAfterDays(RETENTION_DAYS.notifications),
      });
    }
    await batch.commit();
  }

  let pushSentCount = 0;
  let pushFailedCount = 0;

  for (const group of chunkArray(notificationRecords, 25)) {
    await Promise.all(group.map(async ({ userDoc, notification }) => {
      const userData = userDoc.data() || {};
      const preferenceKey = notification.type === 'promotion' ? 'marketing' : null;

      if (!canSendPushForPreference(userData, preferenceKey)) {
        return;
      }

      if (userData.pushToken) {
        const ok = await sendExpoPush(userData.pushToken, notification.title, notification.body, notification.data, 'default');
        if (ok) {
          pushSentCount += 1;
        } else {
          pushFailedCount += 1;
        }
        return;
      }

      if (userData.fcmToken) {
        try {
          await admin.messaging().send({
            notification: { title: notification.title, body: notification.body },
            data: Object.fromEntries(Object.entries(notification.data).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)])),
            token: userData.fcmToken,
            android: { channelId: 'default', priority: 'high' },
          });
          pushSentCount += 1;
        } catch (error) {
          console.warn('FCM broadcast push failed:', error.message);
          pushFailedCount += 1;
        }
      }
    }));
  }

  const variantStatsUpdate = Object.fromEntries(
    Object.entries(variantSentCounts).map(([variantId, sentCount]) => [`variantStats.${variantId}.sentCount`, sentCount])
  );

  await broadcastRef.set({
    pushSentCount,
    pushFailedCount,
    ...variantStatsUpdate,
  }, { merge: true });

  return {
    ok: true,
    broadcastId: broadcastRef.id,
    sentCount: targetUsers.length,
    inAppCount: targetUsers.length,
    pushSentCount,
    pushFailedCount,
    breakdown: audienceBreakdown,
  };
}

async function sendOperationalNotificationToUser(userId, notification) {
  await createInAppNotification(userId, notification);

  const userSnap = await db.collection('users').doc(userId).get();
  if (!userSnap.exists) return;
  const userData = userSnap.data() || {};
  if (userData.pushToken) {
    await sendExpoPush(userData.pushToken, notification.title, notification.body, notification.data || {}, 'default');
  }
}

async function runOperationalActionInternal(actionKey) {
  if (actionKey === 'close_expired_jobs_now') {
    const cutoffDate = new Date(Date.now() - CONFIG.POST_EXPIRE_HOURS * 60 * 60 * 1000);
    const snapshot = await db.collection('shifts')
      .where('status', '==', 'active')
      .where('createdAt', '<', cutoffDate)
      .get();

    const updates = [];
    snapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const expiresAt = getTimestampDate(data.expiresAt);
      if (expiresAt && expiresAt > new Date()) return;
      updates.push(docSnap.ref);
    });

    for (const chunk of chunkArray(updates, 499)) {
      const batch = db.batch();
      chunk.forEach((ref) => {
        batch.update(ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          autoExpired: true,
        });
      });
      await batch.commit();
    }
    return { actionKey, affectedCount: updates.length };
  }

  if (actionKey === 'remind_pending_documents') {
    const snapshot = await db.collection('documents').get();
    const pendingDocs = snapshot.docs.filter((docSnap) => {
      const data = docSnap.data() || {};
      const status = data.status || (data.isVerified ? 'approved' : 'pending');
      return status === 'pending' && data.userId;
    });

    let count = 0;
    for (const docSnap of pendingDocs) {
      const data = docSnap.data() || {};
      const deduped = await createAutomationLog('pending_document_reminder', docSnap.id, { userId: data.userId });
      if (!deduped) continue;
      await sendOperationalNotificationToUser(data.userId, {
        type: 'profile_reminder',
        title: 'เอกสารของคุณยังรอตรวจสอบ',
        body: 'กรุณาเปิดหน้าเอกสารเพื่อตรวจสอบและอัปเดตข้อมูลที่ค้างอยู่',
        data: { type: 'profile_reminder', source: 'pending_documents' },
      });
      count += 1;
    }
    return { actionKey, affectedCount: count };
  }

  if (actionKey === 'remind_enable_nearby_alert') {
    const snapshot = await db.collection('users')
      .where('role', 'not-in', ['hospital', 'admin'])
      .select('role', 'nearbyJobAlert')
      .get();
    let count = 0;
    for (const userDoc of snapshot.docs) {
      const data = userDoc.data() || {};
      if (data.nearbyJobAlert?.enabled === true) continue;
      const deduped = await createAutomationLog('nearby_alert_reminder', userDoc.id);
      if (!deduped) continue;
      await sendOperationalNotificationToUser(userDoc.id, {
        type: 'nearby_job',
        title: 'เปิด Nearby Job Alert ไว้ก่อน',
        body: 'ตั้งค่างานใกล้คุณเพื่อรับการแจ้งเตือนทันทีเมื่อมีประกาศใหม่',
        data: { type: 'nearby_job', source: 'operational_reminder', targetScreen: 'NearbyJobAlert' },
      });
      count += 1;
    }
    return { actionKey, affectedCount: count };
  }

  if (actionKey === 'remind_incomplete_hospital_profiles') {
    const snapshot = await db.collection('users').where('role', '==', 'hospital').get();
    let count = 0;
    for (const userDoc of snapshot.docs) {
      const data = userDoc.data() || {};
      const incomplete = !data.displayName || !data.phone || !resolveUserProvince(data) || !data.orgType;
      if (!incomplete) continue;
      const deduped = await createAutomationLog('hospital_profile_reminder', userDoc.id);
      if (!deduped) continue;
      await sendOperationalNotificationToUser(userDoc.id, {
        type: 'profile_reminder',
        title: 'โปรไฟล์องค์กรยังไม่ครบ',
        body: 'กรอกข้อมูลโรงพยาบาล/องค์กรให้ครบเพื่อเพิ่มความน่าเชื่อถือและ conversion ของประกาศ',
        data: { type: 'profile_reminder', source: 'hospital_profile' },
      });
      count += 1;
    }
    return { actionKey, affectedCount: count };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown operational action');
}

async function getAutomationConfig() {
  const configDoc = await db.collection('app_config').doc('communication_automations').get();
  const rules = configDoc.exists ? configDoc.data()?.rules || {} : {};
  return {
    inactive7d: rules.inactive7d?.enabled !== false,
    applicantNoChat: rules.applicantNoChat?.enabled !== false,
    postNoApplicants: rules.postNoApplicants?.enabled !== false,
    unreadChat: rules.unreadChat?.enabled !== false,
  };
}

async function runCommunicationAutomationRule(ruleKey) {
  if (ruleKey === 'inactive7d') {
    const thresholdDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const snapshot = await db.collection('users')
      .where('lastActiveAt', '<', thresholdDate)
      .select('role', 'lastActiveAt', 'isActive')
      .get();
    let count = 0;
    for (const userDoc of snapshot.docs) {
      const data = userDoc.data() || {};
      if (data.role === 'admin' || data.isActive === false) continue;
      const deduped = await createAutomationLog('inactive7d', userDoc.id);
      if (!deduped) continue;
      await sendOperationalNotificationToUser(userDoc.id, {
        type: 'system',
        title: 'คิดถึงคุณนะ',
        body: 'กลับมาเช็กงานใหม่และประกาศล่าสุดใน NurseGo ได้เลย',
        data: { type: 'profile_reminder', source: 'automation_inactive7d' },
      });
      count += 1;
    }
    return { ruleKey, affectedCount: count };
  }

  if (ruleKey === 'applicantNoChat') {
    const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const applicationsSnapshot = await db.collection('shift_contacts')
      .where('contactedAt', '>=', cutoffDate)
      .where('contactedAt', '<=', thresholdDate)
      .get();
    let count = 0;

    for (const appDoc of applicationsSnapshot.docs) {
      const data = appDoc.data() || {};
      if (!data.interestedUserId || !data.jobId) continue;
      const conversationSnapshot = await db.collection('conversations')
        .where('jobId', '==', data.jobId)
        .where('participants', 'array-contains', data.interestedUserId)
        .limit(1)
        .get();
      if (!conversationSnapshot.empty) continue;
      const deduped = await createAutomationLog('applicant_no_chat', appDoc.id, { userId: data.interestedUserId });
      if (!deduped) continue;
      await sendOperationalNotificationToUser(data.interestedUserId, {
        type: 'system',
        title: 'คุณสมัครแล้ว ลองทักแชทต่อได้เลย',
        body: 'การเริ่มคุยต่อช่วยให้ปิดงานได้เร็วขึ้นและเพิ่มโอกาสถูกเลือก',
        data: { type: 'new_message', jobId: data.jobId || '', source: 'automation_applicant_no_chat' },
      });
      count += 1;
    }
    return { ruleKey, affectedCount: count };
  }

  if (ruleKey === 'postNoApplicants') {
    const thresholdDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const shiftsSnapshot = await db.collection('shifts').where('status', '==', 'active').get();
    let count = 0;
    for (const shiftDoc of shiftsSnapshot.docs) {
      const data = shiftDoc.data() || {};
      const createdAt = getTimestampDate(data.createdAt);
      if (!createdAt || createdAt > thresholdDate) continue;
      const applicantCount = Number(data.applicantsCount || data.contactsCount || 0);
      if (applicantCount > 0 || !data.posterId) continue;
      const deduped = await createAutomationLog('post_no_applicants', shiftDoc.id, { userId: data.posterId });
      if (!deduped) continue;
      await sendOperationalNotificationToUser(data.posterId, {
        type: 'job_expiring',
        title: 'ประกาศนี้ยังไม่มีคนสมัคร',
        body: 'ลองแก้หัวข้อ เพิ่มรายละเอียด หรือเปิดป้ายด่วนเพื่อดันประกาศนี้',
        data: { type: 'job_expiring', jobId: shiftDoc.id, source: 'automation_post_no_applicants' },
      });
      count += 1;
    }
    return { ruleKey, affectedCount: count };
  }

  if (ruleKey === 'unreadChat') {
    const thresholdDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const conversationsSnapshot = await db.collection('conversations')
      .where('lastMessageAt', '<=', thresholdDate)
      .select('lastMessageAt', 'unreadBy')
      .get();
    let count = 0;
    for (const conversationDoc of conversationsSnapshot.docs) {
      const data = conversationDoc.data() || {};
      const lastMessageAt = getTimestampDate(data.lastMessageAt);
      if (!lastMessageAt || lastMessageAt > thresholdDate) continue;
      const unreadBy = data.unreadBy || {};
      for (const [userId, unreadCount] of Object.entries(unreadBy)) {
        if (!userId || Number(unreadCount || 0) <= 0) continue;
        const deduped = await createAutomationLog('unread_chat', `${conversationDoc.id}_${userId}`);
        if (!deduped) continue;
        await sendOperationalNotificationToUser(userId, {
          type: 'new_message',
          title: 'คุณมีแชทที่ยังไม่ได้อ่าน',
          body: 'กลับไปตอบแชทค้างอ่านเพื่อไม่พลาดโอกาสสำคัญ',
          data: { type: 'new_message', conversationId: conversationDoc.id, source: 'automation_unread_chat' },
        });
        count += 1;
      }
    }
    return { ruleKey, affectedCount: count };
  }

  throw new functions.https.HttpsError('invalid-argument', 'Unknown automation rule');
}

// ============================================
// SECURE NOTIFICATION CALLABLES (cross-user)
// ============================================
exports.notifyNewApplicant = functions.https.onCall(async (data, context) => {
  const callerUid = requireCallableAuth(context);
  const { applicationId, jobId, applicantName, hospitalUserId } = data || {};

  if (!applicationId || typeof applicationId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'applicationId required');
  }

  const appDoc = await db.collection('shift_contacts').doc(applicationId).get();
  if (!appDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Application not found');
  }

  const appData = appDoc.data() || {};
  if (appData.interestedUserId !== callerUid) {
    throw new functions.https.HttpsError('permission-denied', 'Only applicant can trigger this notification');
  }

  let posterId = appData.posterId;
  if (!posterId && appData.jobId) {
    const shiftDoc = await db.collection('shifts').doc(appData.jobId).get();
    if (shiftDoc.exists) posterId = shiftDoc.data()?.posterId;
  }
  if (!posterId) {
    throw new functions.https.HttpsError('failed-precondition', 'Application is missing posterId');
  }
  if (hospitalUserId && hospitalUserId !== posterId) {
    throw new functions.https.HttpsError('invalid-argument', 'hospitalUserId mismatch');
  }

  let resolvedJobTitle = jobId || appData.jobId;
  const shiftId = appData.jobId;
  if (shiftId) {
    const shiftDoc = await db.collection('shifts').doc(shiftId).get();
    if (shiftDoc.exists) {
      resolvedJobTitle = shiftDoc.data()?.title || resolvedJobTitle;
    }
  }

  await createInAppNotification(posterId, {
    type: 'new_applicant',
    title: 'มีผู้สมัครงานใหม่',
    body: `${applicantName || appData.interestedUserName || 'ผู้สมัคร'} สมัครตำแหน่ง ${resolvedJobTitle || 'ที่คุณประกาศ'}`,
    data: {
      applicationId,
      jobId: appData.jobId || null,
    },
  });

  return { ok: true };
});

exports.notifyApplicationStatus = functions.https.onCall(async (data, context) => {
  const callerUid = requireCallableAuth(context);
  const { applicationId, status, jobTitle, hospitalName, nurseUserId } = data || {};

  if (!applicationId || typeof applicationId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'applicationId required');
  }
  if (!['accepted', 'rejected'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'status must be accepted or rejected');
  }

  const appDoc = await db.collection('shift_contacts').doc(applicationId).get();
  if (!appDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Application not found');
  }

  const appData = appDoc.data() || {};
  let posterId = appData.posterId;
  if (!posterId && appData.jobId) {
    const shiftDoc = await db.collection('shifts').doc(appData.jobId).get();
    if (shiftDoc.exists) posterId = shiftDoc.data()?.posterId;
  }

  if (posterId !== callerUid) {
    throw new functions.https.HttpsError('permission-denied', 'Only poster can trigger this notification');
  }

  const targetNurseId = appData.interestedUserId;
  if (!targetNurseId) {
    throw new functions.https.HttpsError('failed-precondition', 'Application is missing interestedUserId');
  }
  if (nurseUserId && nurseUserId !== targetNurseId) {
    throw new functions.https.HttpsError('invalid-argument', 'nurseUserId mismatch');
  }

  let resolvedTitle = jobTitle;
  if (!resolvedTitle && appData.jobId) {
    const shiftDoc = await db.collection('shifts').doc(appData.jobId).get();
    if (shiftDoc.exists) resolvedTitle = shiftDoc.data()?.title;
  }

  let resolvedHospitalName = hospitalName;
  if (!resolvedHospitalName) {
    const posterDoc = await db.collection('users').doc(callerUid).get();
    if (posterDoc.exists) resolvedHospitalName = posterDoc.data()?.displayName;
  }

  const type = status === 'accepted' ? 'application_accepted' : 'application_rejected';
  const title = status === 'accepted' ? 'ยินดีด้วย! 🎉' : 'ผลการสมัครงาน';
  const body = status === 'accepted'
    ? `${resolvedHospitalName || 'ผู้ว่าจ้าง'} ตอบรับใบสมัครตำแหน่ง ${resolvedTitle || 'งานที่สมัคร'} ของคุณแล้ว`
    : `${resolvedHospitalName || 'ผู้ว่าจ้าง'} ไม่สามารถรับสมัครตำแหน่ง ${resolvedTitle || 'งานที่สมัคร'} ได้ในขณะนี้`;

  await createInAppNotification(targetNurseId, {
    type,
    title,
    body,
    data: {
      applicationId,
      jobId: appData.jobId || null,
    },
  });

  const nurseDoc = await db.collection('users').doc(targetNurseId).get();
  if (nurseDoc.exists) {
    const nurseData = nurseDoc.data() || {};
    if (canSendPushForPreference(nurseData, 'applications')) {
      if (nurseData.pushToken) {
        await sendExpoPush(nurseData.pushToken, title, body, {
          type,
          applicationId,
          jobId: appData.jobId || null,
        }, 'applications');
      } else if (nurseData.fcmToken) {
        await admin.messaging().send({
          notification: { title, body },
          data: {
            type,
            applicationId,
            jobId: String(appData.jobId || ''),
          },
          token: nurseData.fcmToken,
          android: { channelId: 'applications', priority: 'high' },
        });
      }
    }
  }

  return { ok: true };
});

async function executeCompleteJobAssignment(callerUid, data) {
  function getLastWorkDate(jobData) {
    if (Array.isArray(jobData?.shiftDates) && jobData.shiftDates.length > 0) {
      const dates = jobData.shiftDates
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()));
      if (dates.length > 0) {
        return dates.reduce((latest, value) => (value > latest ? value : latest));
      }
    }

    if (jobData?.shiftTimeSlots && typeof jobData.shiftTimeSlots === 'object') {
      const dates = Object.keys(jobData.shiftTimeSlots)
        .map((value) => new Date(value))
        .filter((value) => !Number.isNaN(value.getTime()));
      if (dates.length > 0) {
        return dates.reduce((latest, value) => (value > latest ? value : latest));
      }
    }

    const endDate = getTimestampDate(jobData?.shiftDateEnd);
    if (endDate) return endDate;

    const shiftDate = getTimestampDate(jobData?.shiftDate);
    if (shiftDate) return shiftDate;

    return null;
  }

  function getCompletionAllowedAfter(jobData, selectedAppData) {
    const lastWorkDate = getLastWorkDate(jobData);
    if (lastWorkDate) {
      return {
        allowedAfter: new Date(lastWorkDate.getFullYear(), lastWorkDate.getMonth(), lastWorkDate.getDate() + 1),
        reason: `วันทำงาน ${lastWorkDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`,
      };
    }

    const fallbackDate = getTimestampDate(selectedAppData?.confirmedAt)
      || getTimestampDate(selectedAppData?.contactedAt)
      || getTimestampDate(jobData?.createdAt)
      || new Date();

    return {
      allowedAfter: new Date(fallbackDate.getTime() + 24 * 60 * 60 * 1000),
      reason: 'ต้องรออย่างน้อย 24 ชั่วโมงหลังเลือกผู้สมัคร',
    };
  }

  const jobId = String(data?.jobId || '').trim();
  const selectedApplicationId = String(data?.selectedApplicationId || '').trim();

  if (!jobId) {
    throw new functions.https.HttpsError('invalid-argument', 'jobId required');
  }
  if (!selectedApplicationId) {
    throw new functions.https.HttpsError('invalid-argument', 'selectedApplicationId required');
  }

  const jobRef = db.collection('shifts').doc(jobId);
  const selectedAppRef = db.collection('shift_contacts').doc(selectedApplicationId);
  const completionRef = db.collection('job_completions').doc(jobId);

  const result = await db.runTransaction(async (transaction) => {
    const [jobSnap, selectedAppSnap, completionSnap] = await Promise.all([
      transaction.get(jobRef),
      transaction.get(selectedAppRef),
      transaction.get(completionRef),
    ]);

    if (!jobSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Job not found');
    }
    if (!selectedAppSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Application not found');
    }
    if (completionSnap.exists) {
      throw new functions.https.HttpsError('already-exists', 'Job already completed');
    }

    const jobData = jobSnap.data() || {};
    const selectedAppData = selectedAppSnap.data() || {};

    if (jobData.posterId !== callerUid) {
      throw new functions.https.HttpsError('permission-denied', 'Only poster can complete this job');
    }
    if (selectedAppData.jobId !== jobId) {
      throw new functions.https.HttpsError('invalid-argument', 'Application does not belong to this job');
    }
    if (['deleted', 'expired'].includes(jobData.status)) {
      throw new functions.https.HttpsError('failed-precondition', 'This job can no longer be completed');
    }
    if (!selectedAppData.interestedUserId) {
      throw new functions.https.HttpsError('failed-precondition', 'Application is missing interestedUserId');
    }
    if (selectedAppData.status !== 'confirmed') {
      throw new functions.https.HttpsError('failed-precondition', 'กรุณากดเลือกผู้สมัครก่อนจบงาน');
    }

    const completionWindow = getCompletionAllowedAfter(jobData, selectedAppData);
    if (Date.now() < completionWindow.allowedAfter.getTime()) {
      const dateStr = completionWindow.allowedAfter.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = completionWindow.allowedAfter.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      throw new functions.https.HttpsError('failed-precondition', `ยังปิดงานไม่ได้ ต้องรอถึง ${dateStr} ${timeStr} (${completionWindow.reason})`);
    }

    const contactsQuery = db.collection('shift_contacts').where('jobId', '==', jobId);
    const contactsSnap = await transaction.get(contactsQuery);
    const applicantDocs = contactsSnap.docs;

    if (applicantDocs.length === 0) {
      throw new functions.https.HttpsError('failed-precondition', 'No applicants found for this job');
    }

    const selectedApplicantDoc = applicantDocs.find((docSnap) => docSnap.id === selectedApplicationId);
    if (!selectedApplicantDoc) {
      throw new functions.https.HttpsError('not-found', 'Selected application not found in this job');
    }

    transaction.update(jobRef, {
      status: 'closed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedBy: callerUid,
      selectedApplicationId,
      selectedApplicantId: selectedAppData.interestedUserId || null,
    });

    applicantDocs.forEach((docSnap) => {
      const appData = docSnap.data() || {};
      const nextStatus = docSnap.id === selectedApplicationId ? 'confirmed' : 'cancelled';
      transaction.update(docSnap.ref, {
        status: nextStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: callerUid,
        completionOutcome: docSnap.id === selectedApplicationId ? 'hired' : 'auto_rejected',
      });
    });

    transaction.set(completionRef, {
      jobId,
      jobTitle: jobData.title || null,
      posterId: callerUid,
      posterName: jobData.posterName || null,
      posterPhotoURL: jobData.posterPhoto || null,
      hiredUserId: selectedAppData.interestedUserId || null,
      hiredUserName: selectedAppData.interestedUserName || null,
      hiredUserPhotoURL: null,
      selectedApplicationId,
      participantIds: [callerUid, selectedAppData.interestedUserId].filter(Boolean),
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedBy: callerUid,
    });

    return {
      jobId,
      jobTitle: jobData.title || '',
      posterId: callerUid,
      posterName: jobData.posterName || '',
      posterPhotoURL: jobData.posterPhoto || '',
      hiredUserId: selectedAppData.interestedUserId || '',
      hiredUserName: selectedAppData.interestedUserName || '',
      selectedApplicationId,
      rejectedApplicants: applicantDocs
        .filter((docSnap) => docSnap.id !== selectedApplicationId)
        .map((docSnap) => ({ id: docSnap.id, userId: docSnap.data()?.interestedUserId || '' }))
        .filter((item) => item.userId),
    };
  });

  const [posterUser, hiredUser] = await Promise.all([
    getUserSnapshot(result.posterId),
    getUserSnapshot(result.hiredUserId),
  ]);

  await completionRef.set({
    hiredUserPhotoURL: hiredUser?.photoURL || null,
  }, { merge: true });

  await Promise.all([
    createInAppNotification(result.posterId, {
      type: 'job_completed_review',
      title: 'งานจบแล้ว รีวิวได้ทันที',
      body: `รีวิว ${hiredUser?.displayName || result.hiredUserName || 'ผู้ถูกจ้าง'} สำหรับงาน ${result.jobTitle || 'งานนี้'} ได้เลย`,
      data: {
        jobId: result.jobId,
        completionId: result.jobId,
        targetUserId: result.hiredUserId,
        targetName: hiredUser?.displayName || result.hiredUserName || 'ผู้ถูกจ้าง',
        targetUserPhoto: hiredUser?.photoURL || null,
        jobTitle: result.jobTitle || null,
      },
    }),
    createInAppNotification(result.hiredUserId, {
      type: 'job_completed_review',
      title: 'งานเสร็จแล้ว รีวิวผู้ว่าจ้างได้เลย',
      body: `รีวิว ${posterUser?.displayName || result.posterName || 'ผู้ว่าจ้าง'} สำหรับงาน ${result.jobTitle || 'งานนี้'} ได้ทันที`,
      data: {
        jobId: result.jobId,
        completionId: result.jobId,
        targetUserId: result.posterId,
        targetName: posterUser?.displayName || result.posterName || 'ผู้ว่าจ้าง',
        targetUserPhoto: posterUser?.photoURL || result.posterPhotoURL || null,
        jobTitle: result.jobTitle || null,
      },
    }),
    ...result.rejectedApplicants.map((applicant) => createInAppNotification(applicant.userId, {
      type: 'application_rejected',
      title: 'ผลการสมัครงาน',
      body: `ประกาศ ${result.jobTitle || 'งานนี้'} ได้ปิดรับสมัครและเลือกผู้ถูกจ้างเรียบร้อยแล้ว`,
      data: {
        applicationId: applicant.id,
        jobId: result.jobId,
      },
    })),
  ]);

  return {
    completionId: result.jobId,
    jobId: result.jobId,
    jobTitle: result.jobTitle,
    targetUserId: result.hiredUserId,
    targetUserName: hiredUser?.displayName || result.hiredUserName,
    targetUserPhoto: hiredUser?.photoURL || null,
  };
}

exports.completeJobAssignment = functions.https.onCall(async (data, context) => {
  const callerUid = requireCallableAuth(context);
  return await executeCompleteJobAssignment(callerUid, data);
});

exports.completeJobAssignmentHttp = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    const callerUid = await requireHttpBearerAuth(req);
    const result = await executeCompleteJobAssignment(callerUid, req.body?.data || req.body || {});
    res.status(200).json({ result });
  } catch (error) {
    console.error('completeJobAssignmentHttp error:', error);
    const message = error instanceof functions.https.HttpsError
      ? error.message
      : 'ไม่สามารถปิดงานและเลือกผู้ถูกจ้างได้';
    const statusCode = error instanceof functions.https.HttpsError && error.code === 'unauthenticated'
      ? 401
      : error instanceof functions.https.HttpsError && error.code === 'permission-denied'
        ? 403
        : error instanceof functions.https.HttpsError && error.code === 'not-found'
          ? 404
          : 400;
    res.status(statusCode).json({ error: { message } });
  }
});

exports.notifyNewMessage = functions.https.onCall(async (data, context) => {
  const callerUid = requireCallableAuth(context);
  const { conversationId, messagePreview, senderName, userId } = data || {};

  if (!conversationId || typeof conversationId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'conversationId required');
  }

  const convDoc = await db.collection('conversations').doc(conversationId).get();
  if (!convDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Conversation not found');
  }

  const convData = convDoc.data() || {};
  const participants = Array.isArray(convData.participants) ? convData.participants : [];
  if (!participants.includes(callerUid)) {
    throw new functions.https.HttpsError('permission-denied', 'Caller is not a participant');
  }

  const recipientId = participants.find((p) => p !== callerUid);
  if (!recipientId) {
    throw new functions.https.HttpsError('failed-precondition', 'Recipient not found');
  }
  if (userId && userId !== recipientId) {
    throw new functions.https.HttpsError('invalid-argument', 'userId mismatch');
  }

  const safePreview = (messagePreview || '').toString().slice(0, 120) || 'ส่งข้อความถึงคุณ';
  await createInAppNotification(recipientId, {
    type: 'new_message',
    title: `ข้อความจาก ${senderName || 'ผู้ใช้'}`,
    body: safePreview,
    data: { conversationId },
  });

  return { ok: true };
});

// ============================================
// 9. ON USER CREATE - Welcome notification
// ============================================
exports.onUserCreate = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;
    const user = snap.data();
    
    console.log('👋 New user:', user.displayName);
    
    try {
      await emitDomainAnalyticsEvent('user_registered', {
        actorUserId: userId,
        subjectType: 'user',
        subjectId: userId,
        props: {
          role: user.role || null,
          orgType: user.orgType || null,
          isVerified: Boolean(user.isVerified),
          onboardingCompleted: Boolean(user.onboardingCompleted),
        },
      });

      // Create welcome notification
      await createInAppNotification(userId, {
        type: 'welcome',
        title: '🎉 ยินดีต้อนรับสู่ NurseGo!',
        body: 'เริ่มค้นหางานเวรพยาบาลหรือโพสต์หาคนมาเติมเวรได้เลย',
        data: {},
      });
      
      // Create default user plan
      await db.collection('userPlans').add({
        userId,
        planType: 'free',
        isActive: true,
        dailyPostLimit: CONFIG.FREE_DAILY_POST_LIMIT,
        postsToday: 0,
        extraPosts: 0,
        totalSpent: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log('✅ User setup complete');
      return null;
    } catch (error) {
      console.error('❌ Error on user create:', error);
      return null;
    }
  });

// ============================================
// 9.1 ON NEW VERIFICATION REQUEST
// แจ้งเตือน admin เมื่อมีคำขอใหม่เข้ามา
// ============================================
exports.onNewVerificationRequest = functions.firestore
  .document('verifications/{verificationId}')
  .onCreate(async (snap, context) => {
    const verification = snap.data() || {};
    const verificationId = context.params.verificationId;

    try {
      await emitDomainAnalyticsEvent('verification_requested', {
        actorUserId: verification.userId || null,
        subjectType: 'verification',
        subjectId: verificationId,
        props: {
          role: verification.role || null,
          userName: verification.userName || null,
        },
      });

      const title = 'มีคำขอยืนยันตัวตนใหม่';
      const body = `${verification.userName || 'ผู้ใช้'} ส่งคำขอให้ตรวจสอบเอกสารแล้ว`;
      const data = {
        type: 'admin_verification_request',
        verificationId,
        userId: verification.userId || null,
      };

      const adminsSnapshot = await db.collection('users')
        .where('isAdmin', '==', true)
        .get();

      if (adminsSnapshot.empty) {
        console.log('ℹ️ No admins found for verification notification');
        return null;
      }

      for (const adminDoc of adminsSnapshot.docs) {
        const adminData = adminDoc.data() || {};

        await createInAppNotification(adminDoc.id, {
          type: 'admin_verification_request',
          title,
          body,
          data,
        });

        if (adminData.pushToken) {
          await sendExpoPush(adminData.pushToken, title, body, data);
        } else if (adminData.fcmToken) {
          try {
            await admin.messaging().send({
              notification: { title, body },
              data: {
                type: 'admin_verification_request',
                verificationId,
                userId: verification.userId || '',
              },
              token: adminData.fcmToken,
              android: { channelId: 'default', priority: 'high' },
            });
          } catch (fcmErr) {
            console.warn('FCM admin verification notify failed:', fcmErr.message);
          }
        }
      }

      console.log(`✅ Sent verification request notifications to ${adminsSnapshot.size} admins`);
      return null;
    } catch (error) {
      console.error('❌ Error notifying admins about verification request:', error);
      return null;
    }
  });

// ============================================
// 9.2 ON DOCUMENT REVIEW UPDATED
// แจ้งเตือนผู้ใช้เมื่อเอกสารถูกอนุมัติหรือปฏิเสธ
// ============================================
exports.onDocumentReviewUpdated = functions.firestore
  .document('documents/{documentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};
    const documentId = context.params.documentId;

    const beforeStatus = before.status || (before.isVerified ? 'approved' : 'pending');
    const afterStatus = after.status || (after.isVerified ? 'approved' : 'pending');

    if (beforeStatus === afterStatus) {
      return null;
    }

    if (!['approved', 'rejected'].includes(afterStatus)) {
      return null;
    }

    const userId = after.userId;
    if (!userId) {
      return null;
    }

    const documentLabel = after.name || after.fileName || 'เอกสารของคุณ';
    const rejectionReason = String(after.rejectionReason || '').trim();
    const type = afterStatus === 'approved' ? 'license_approved' : 'license_rejected';
    const title = afterStatus === 'approved' ? 'เอกสารผ่านการตรวจสอบแล้ว' : 'เอกสารไม่ผ่านการตรวจสอบ';
    const body = afterStatus === 'approved'
      ? `${documentLabel} ได้รับการอนุมัติแล้ว`
      : `${documentLabel} ไม่ผ่านการตรวจสอบ${rejectionReason ? `: ${rejectionReason}` : ''}`;
    const data = {
      type,
      documentId,
      source: 'document_review',
      status: afterStatus,
    };

    try {
      await createInAppNotification(userId, {
        type,
        title,
        body,
        data,
      });

      const userSnap = await db.collection('users').doc(userId).get();
      if (!userSnap.exists) {
        return null;
      }

      const userData = userSnap.data() || {};

      if (userData.pushToken) {
        await sendExpoPush(userData.pushToken, title, body, data, 'default');
      } else if (userData.fcmToken) {
        try {
          await admin.messaging().send({
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
            token: userData.fcmToken,
            android: { channelId: 'default', priority: 'high' },
          });
        } catch (fcmErr) {
          console.warn('FCM document review notify failed:', fcmErr.message);
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error notifying user about document review:', error);
      return null;
    }
  });

// ============================================
// 10. ON JOB ABOUT TO EXPIRE - 6 hours before
// แจ้งเตือนก่อนงานหมดอายุ
// ============================================
exports.notifyJobExpiringSoon = functions.pubsub
  .schedule('every 3 hours')
  .timeZone('Asia/Bangkok')
  .onRun(async (context) => {
    console.log('⏰ Checking jobs expiring soon...');
    
    const now = new Date();
    const sixHoursFromNow = new Date(now.getTime() + 6 * 60 * 60 * 1000);
    const cutoffDate = new Date(now.getTime() - (CONFIG.POST_EXPIRE_HOURS - 6) * 60 * 60 * 1000);
    
    try {
      // Find shifts that will expire in ~6 hours
      const snapshot = await db.collection('shifts')
        .where('status', '==', 'active')
        .where('createdAt', '<=', cutoffDate)
        .where('expiryNotified', '!=', true)
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No jobs expiring soon');
        return null;
      }
      
      let count = 0;
      
      for (const doc of snapshot.docs) {
        const job = doc.data();
        
        // Check if already extended
        if (job.expiresAt && job.expiresAt.toDate() > sixHoursFromNow) {
          continue;
        }
        
        // Notify poster
        await createInAppNotification(job.posterId, {
          type: 'job_expiring',
          title: '⏰ งานของคุณกำลังจะหมดอายุ',
          body: `"${job.title}" จะหมดอายุใน 6 ชั่วโมง ขยายเวลาหรือปิดรับสมัคร?`,
          data: { jobId: doc.id },
        });

        const posterDoc = await db.collection('users').doc(job.posterId).get();
        if (posterDoc.exists) {
          const poster = posterDoc.data() || {};
          const title = '⏰ งานของคุณกำลังจะหมดอายุ';
          const body = `"${job.title}" จะหมดอายุใน 6 ชั่วโมง ขยายเวลาหรือปิดรับสมัคร?`;
          const pushData = { type: 'job_expiring', jobId: doc.id };

          if (poster.pushToken) {
            await sendExpoPush(poster.pushToken, title, body, pushData);
          } else if (poster.fcmToken) {
            try {
              await admin.messaging().send({
                notification: { title, body },
                data: { type: 'job_expiring', jobId: doc.id },
                token: poster.fcmToken,
                android: { channelId: 'jobs', priority: 'high' },
              });
            } catch (fcmErr) {
              console.warn('FCM job expiry notify failed:', fcmErr.message);
            }
          }
        }
        
        // Mark as notified
        await doc.ref.update({ expiryNotified: true });
        count++;
      }
      
      console.log(`⏰ Notified ${count} job posters about expiry`);
      return null;
    } catch (error) {
      console.error('❌ Error notifying expiry:', error);
      return null;
    }
  });

// ============================================
// EXCHANGE TOKEN — native Firebase auth → JS SDK custom token
// Called after @react-native-firebase/auth phone sign-in succeeds.
// The client sends its Firebase ID token; we verify it and return
// a custom token so the JS SDK auth state can be synced.
// ============================================
exports.exchangeToken = functions.https.onCall(async (data, _context) => {
  const { idToken } = data;
  if (!idToken || typeof idToken !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'idToken required');
  }
  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch {
    throw new functions.https.HttpsError('unauthenticated', 'Invalid or expired token');
  }
  const customToken = await admin.auth().createCustomToken(decoded.uid);
  return { customToken };
});

// ============================================
// CUSTOM OTP AUTH — no reCAPTCHA, no Firebase Phone Auth
// Uses Firebase Admin SDK to create/get phone users and issue custom tokens.
// Client calls signInWithCustomToken() → no ApplicationVerifier required.
// ============================================

/**
 * Step 1: Generate OTP and store it in Firestore.
 * OTP is sent by an external provider only when configured.
 */
exports.sendCustomOTP = functions.https.onCall(async (data, _context) => {
  const { phone } = data;

  if (!phone || typeof phone !== 'string' || !/^\+66[0-9]{9}$/.test(phone)) {
    throw new functions.https.HttpsError('invalid-argument', 'เบอร์โทรศัพท์ไม่ถูกต้อง (+66XXXXXXXXX)');
  }

  // ── Rate limit: max 5 requests per hour per number ──────────────────
  const now = Date.now();
  const rlRef = db.collection('otpRateLimit').doc(phone);
  const rlSnap = await rlRef.get();
  if (rlSnap.exists) {
    const rl = rlSnap.data();
    if (rl.count >= 5 && rl.lastReset > now - 3600000) {
      throw new functions.https.HttpsError('resource-exhausted', 'ส่ง OTP มากเกินไป กรุณารอ 1 ชั่วโมง');
    }
    if (rl.lastReset <= now - 3600000) {
      await rlRef.set({ count: 1, lastReset: now });
    } else {
      await rlRef.update({ count: admin.firestore.FieldValue.increment(1) });
    }
  } else {
    await rlRef.set({ count: 1, lastReset: now });
  }

  // ── Generate & store OTP ─────────────────────────────────────────────
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));
  await db.collection('otpCodes').doc(phone).set({
    code: otpCode,
    expiresAt: now + 5 * 60 * 1000, // 5 minutes
    attempts: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── SMS integration (uncomment ONE provider) ─────────────────────────
  // Option A — Twilio
  // const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  // await twilio.messages.create({
  //   body: `รหัส OTP NurseGo: ${otpCode} (หมดอายุใน 5 นาที)`,
  //   from: process.env.TWILIO_PHONE,
  //   to: phone,
  // });
  //
  // Option B — AWS SNS
  // const SNS = new (require('aws-sdk').SNS)({ region: 'ap-southeast-1' });
  // await SNS.publish({ Message: `รหัส OTP NurseGo: ${otpCode}`, PhoneNumber: phone }).promise();
  // ─────────────────────────────────────────────────────────────────────

  // Production: do not leak OTP in API response.
  throw new functions.https.HttpsError(
    'failed-precondition',
    'OTP provider is not configured for production. Please configure SMS provider first.',
  );
});

/**
 * Step 2: Verify OTP and return a Firebase custom token.
 * Client calls signInWithCustomToken() with the returned token.
 */
exports.verifyCustomOTP = functions.https.onCall(async (data, _context) => {
  const { phone, code } = data;

  if (!phone || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'ข้อมูลไม่ครบ');
  }

  const otpDoc = await db.collection('otpCodes').doc(phone).get();
  if (!otpDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'OTP ไม่พบหรือหมดอายุแล้ว กรุณาขอรหัสใหม่');
  }

  const otpData = otpDoc.data();

  if (Date.now() > otpData.expiresAt) {
    await otpDoc.ref.delete();
    throw new functions.https.HttpsError('deadline-exceeded', 'รหัส OTP หมดอายุแล้ว กรุณาขอรหัสใหม่');
  }

  if (otpData.attempts >= 5) {
    await otpDoc.ref.delete();
    throw new functions.https.HttpsError('resource-exhausted', 'ลองรหัสผิดมากเกินไป กรุณาขอ OTP ใหม่');
  }

  if (otpData.code !== String(code)) {
    await otpDoc.ref.update({ attempts: admin.firestore.FieldValue.increment(1) });
    const remaining = 4 - otpData.attempts;
    throw new functions.https.HttpsError(
      'invalid-argument',
      remaining > 0
        ? `รหัส OTP ไม่ถูกต้อง (เหลือ ${remaining} ครั้ง)`
        : 'รหัส OTP ไม่ถูกต้อง'
    );
  }

  // Correct — delete used OTP
  await otpDoc.ref.delete();

  // Get or create Firebase Auth user for this phone number
  let uid;
  try {
    const existing = await admin.auth().getUserByPhoneNumber(phone);
    uid = existing.uid;
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const created = await admin.auth().createUser({ phoneNumber: phone });
      uid = created.uid;
    } else {
      throw err;
    }
  }

  const customToken = await admin.auth().createCustomToken(uid);
  return { success: true, customToken, uid };
});

// ==========================================
// FIRESTORE TRIGGER: Job completion notifications
// ==========================================
exports.onJobCompletionCreated = functions.firestore
  .document('job_completions/{completionId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    if (!data.needsNotification) return;

    const { posterId, hiredUserId, hiredUserName, posterName, jobTitle, jobId } = data;
    if (!posterId || !hiredUserId) return;

    try {
      const [posterUser, hiredUser] = await Promise.all([
        getUserSnapshot(posterId),
        getUserSnapshot(hiredUserId),
      ]);

      // Update hiredUserPhotoURL and clear the flag
      await snap.ref.update({
        hiredUserPhotoURL: hiredUser?.photoURL || null,
        needsNotification: admin.firestore.FieldValue.delete(),
      });
      // Get all rejected applicants
      const contactsSnap = await db.collection('shift_contacts')
        .where('jobId', '==', jobId)
        .where('completionOutcome', '==', 'auto_rejected')
        .get();

      await Promise.all([
        createInAppNotification(posterId, {
          type: 'job_completed_review',
          title: 'งานจบแล้ว รีวิวได้ทันที',
          body: `รีวิว ${hiredUser?.displayName || hiredUserName || 'ผู้ถูกจ้าง'} สำหรับงาน ${jobTitle || 'งานนี้'} ได้เลย`,
          data: {
            jobId,
            completionId: context.params.completionId,
            targetUserId: hiredUserId,
            targetName: hiredUser?.displayName || hiredUserName || 'ผู้ถูกจ้าง',
            targetUserPhoto: hiredUser?.photoURL || null,
            jobTitle: jobTitle || null,
          },
        }),
        createInAppNotification(hiredUserId, {
          type: 'job_completed_review',
          title: 'งานเสร็จแล้ว รีวิวผู้ว่าจ้างได้เลย',
          body: `รีวิว ${posterUser?.displayName || posterName || 'ผู้ว่าจ้าง'} สำหรับงาน ${jobTitle || 'งานนี้'} ได้ทันที`,
          data: {
            jobId,
            completionId: context.params.completionId,
            targetUserId: posterId,
            targetName: posterUser?.displayName || posterName || 'ผู้ว่าจ้าง',
            targetUserPhoto: posterUser?.photoURL || null,
            jobTitle: jobTitle || null,
          },
        }),
        ...contactsSnap.docs.map((contactDoc) => {
          const contactData = contactDoc.data() || {};
          if (!contactData.interestedUserId) return Promise.resolve();
          return createInAppNotification(contactData.interestedUserId, {
            type: 'application_rejected',
            title: 'ผลการสมัครงาน',
            body: `ประกาศ ${jobTitle || 'งานนี้'} ได้ปิดรับสมัครและเลือกผู้ถูกจ้างเรียบร้อยแล้ว`,
            data: {
              applicationId: contactDoc.id,
              jobId,
            },
          });
        }),
      ]);
    } catch (error) {
      console.error('onJobCompletionCreated notification error:', error);
    }
  });

// ==========================================
// FIRESTORE TRIGGER: New review notifications
// ==========================================
exports.onReviewCreated = functions.firestore
  .document('reviews/{reviewId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const targetType = data.targetType || (data.revieweeId ? 'user' : 'hospital');
    const targetUserId = targetType === 'user' ? data.revieweeId : data.hospitalId;
    const reviewerId = data.reviewerId || data.userId;

    if (!targetUserId || !reviewerId || targetUserId === reviewerId) {
      return null;
    }

    try {
      const [targetUser, reviewerUser] = await Promise.all([
        getUserSnapshot(targetUserId),
        getUserSnapshot(reviewerId),
      ]);

      if (!targetUser) {
        return null;
      }

      const reviewerName = reviewerUser?.displayName || data.userName || 'ผู้ใช้';
      const targetName = targetUser?.displayName || data.targetName || 'โปรไฟล์ของคุณ';
      const title = 'มีคนรีวิวคุณใหม่';
      const body = `${reviewerName} ส่งรีวิวถึง ${targetName}`;
      const notificationData = {
        type: 'new_review',
        reviewId: context.params.reviewId,
        targetType,
        targetUserId: targetType === 'user' ? targetUserId : undefined,
        hospitalId: targetType === 'hospital' ? targetUserId : undefined,
        targetName,
        reviewerId,
        reviewerName,
      };

      await createInAppNotification(targetUserId, {
        type: 'new_review',
        title,
        body,
        data: notificationData,
      });

      if (targetUser.pushToken) {
        await sendExpoPush(targetUser.pushToken, title, body, notificationData, 'default');
      } else if (targetUser.fcmToken) {
        try {
          await admin.messaging().send({
            notification: { title, body },
            data: Object.fromEntries(Object.entries(notificationData).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])),
            token: targetUser.fcmToken,
            android: { channelId: 'default', priority: 'high' },
          });
        } catch (fcmErr) {
          console.warn('FCM review notify failed:', fcmErr.message);
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error notifying user about new review:', error);
      return null;
    }
  });
