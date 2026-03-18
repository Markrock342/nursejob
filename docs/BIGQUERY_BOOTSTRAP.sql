CREATE SCHEMA IF NOT EXISTS `nursego_analytics` OPTIONS(location="asia-southeast1");

CREATE TABLE IF NOT EXISTS `nursego_analytics.analytics_events` (
  firestoreDocId STRING,
  eventId STRING,
  eventName STRING,
  eventSource STRING,
  occurredAt STRING,
  eventDate DATE,
  actorUserId STRING,
  actorRole STRING,
  isAuthenticated BOOL,
  screenName STRING,
  subjectType STRING,
  subjectId STRING,
  jobId STRING,
  conversationId STRING,
  province STRING,
  context_json STRING,
  props_json STRING,
  createdAt TIMESTAMP
)
PARTITION BY eventDate
CLUSTER BY eventName, screenName, actorUserId;

CREATE TABLE IF NOT EXISTS `nursego_analytics.analytics_daily_summaries` (
  type STRING,
  eventDate DATE,
  generatedAt STRING,
  source STRING,
  overview STRUCT<
    dau INT64,
    newUsers INT64,
    jobsPosted INT64,
    jobDetailViews INT64,
    applications INT64,
    shares INT64,
    chatStarts INT64,
    messagesSent INT64,
    verificationRequests INT64,
    notificationOpens INT64,
    applyRate FLOAT64,
    chatStartRate FLOAT64
  >,
  countsByEventName JSON,
  context_json STRING,
  props_json STRING
)
PARTITION BY eventDate;