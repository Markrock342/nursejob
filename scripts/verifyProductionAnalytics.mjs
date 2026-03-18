import fs from 'fs';

const PROJECT_ID = 'nurse-go-th';
const REGION = 'us-central1';
const DATASET_ID = 'nursego_analytics';
const EVENTS_TABLE = 'analytics_events';
const SUMMARIES_TABLE = 'analytics_daily_summaries';
const SCHEDULED_TOPIC = `firebase-schedule-generateDailyAnalyticsSummary-${REGION}`;
const FIREBASE_CONFIG_PATH = `${process.env.HOME}/.config/configstore/firebase-tools.json`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readFirebaseCliAuth() {
  if (!fs.existsSync(FIREBASE_CONFIG_PATH)) {
    throw new Error('firebase-tools auth cache not found');
  }

  const data = JSON.parse(fs.readFileSync(FIREBASE_CONFIG_PATH, 'utf8'));
  if (!data.tokens?.refresh_token) {
    throw new Error('firebase-tools refresh token not found');
  }

  return data;
}

async function getAccessToken() {
  const data = readFirebaseCliAuth();
  const expiresAt = Number(data.tokens?.expires_at || 0);
  const now = Date.now();

  if (data.tokens?.access_token && expiresAt > now + 60_000) {
    return data.tokens.access_token;
  }

  throw new Error('firebase-tools cached access token is expired; re-authenticate with Firebase CLI before rerunning verification');
}

async function googleApi(method, url, body, allow404 = false) {
  const accessToken = await getAccessToken();
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (allow404 && response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${method} ${url} failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return {};
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function ensureBigQueryApiEnabled() {
  const serviceName = 'bigquery.googleapis.com';
  const service = await googleApi(
    'GET',
    `https://serviceusage.googleapis.com/v1/projects/${PROJECT_ID}/services/${serviceName}`,
  );

  if (service.state === 'ENABLED') {
    console.log('[ok] BigQuery API already enabled');
    return;
  }

  const operation = await googleApi(
    'POST',
    `https://serviceusage.googleapis.com/v1/projects/${PROJECT_ID}/services/${serviceName}:enable`,
    {},
  );

  const operationName = operation.name;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await googleApi('GET', `https://serviceusage.googleapis.com/v1/${operationName}`);
    if (result.done) {
      console.log('[ok] BigQuery API enabled');
      return;
    }
    await sleep(2000);
  }

  throw new Error('Timed out enabling BigQuery API');
}

async function ensureDataset() {
  const dataset = await googleApi(
    'GET',
    `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets/${DATASET_ID}`,
    undefined,
    true,
  );

  if (dataset) {
    console.log(`[ok] Dataset ${DATASET_ID} exists`);
    return;
  }

  await googleApi(
    'POST',
    `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets`,
    {
      datasetReference: {
        projectId: PROJECT_ID,
        datasetId: DATASET_ID,
      },
      location: 'asia-southeast1',
    },
  );

  console.log(`[ok] Dataset ${DATASET_ID} created`);
}

function analyticsEventsTableBody() {
  return {
    tableReference: {
      projectId: PROJECT_ID,
      datasetId: DATASET_ID,
      tableId: EVENTS_TABLE,
    },
    schema: {
      fields: [
        { name: 'firestoreDocId', type: 'STRING' },
        { name: 'eventId', type: 'STRING' },
        { name: 'eventName', type: 'STRING' },
        { name: 'eventSource', type: 'STRING' },
        { name: 'occurredAt', type: 'STRING' },
        { name: 'eventDate', type: 'DATE' },
        { name: 'actorUserId', type: 'STRING' },
        { name: 'actorRole', type: 'STRING' },
        { name: 'isAuthenticated', type: 'BOOLEAN' },
        { name: 'screenName', type: 'STRING' },
        { name: 'subjectType', type: 'STRING' },
        { name: 'subjectId', type: 'STRING' },
        { name: 'jobId', type: 'STRING' },
        { name: 'conversationId', type: 'STRING' },
        { name: 'province', type: 'STRING' },
        { name: 'context_json', type: 'STRING' },
        { name: 'props_json', type: 'STRING' },
        { name: 'createdAt', type: 'TIMESTAMP' },
      ],
    },
    timePartitioning: {
      type: 'DAY',
      field: 'eventDate',
    },
    clustering: {
      fields: ['eventName', 'screenName', 'actorUserId'],
    },
  };
}

function analyticsSummariesTableBody() {
  return {
    tableReference: {
      projectId: PROJECT_ID,
      datasetId: DATASET_ID,
      tableId: SUMMARIES_TABLE,
    },
    schema: {
      fields: [
        { name: 'type', type: 'STRING' },
        { name: 'eventDate', type: 'DATE' },
        { name: 'generatedAt', type: 'STRING' },
        { name: 'source', type: 'STRING' },
        {
          name: 'overview',
          type: 'RECORD',
          fields: [
            { name: 'dau', type: 'INTEGER' },
            { name: 'newUsers', type: 'INTEGER' },
            { name: 'jobsPosted', type: 'INTEGER' },
            { name: 'jobDetailViews', type: 'INTEGER' },
            { name: 'applications', type: 'INTEGER' },
            { name: 'shares', type: 'INTEGER' },
            { name: 'chatStarts', type: 'INTEGER' },
            { name: 'messagesSent', type: 'INTEGER' },
            { name: 'verificationRequests', type: 'INTEGER' },
            { name: 'notificationOpens', type: 'INTEGER' },
            { name: 'applyRate', type: 'FLOAT' },
            { name: 'chatStartRate', type: 'FLOAT' },
          ],
        },
        { name: 'countsByEventName', type: 'JSON' },
        { name: 'context_json', type: 'STRING' },
        { name: 'props_json', type: 'STRING' },
      ],
    },
    timePartitioning: {
      type: 'DAY',
      field: 'eventDate',
    },
  };
}

async function ensureTable(tableId, bodyFactory) {
  const table = await googleApi(
    'GET',
    `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets/${DATASET_ID}/tables/${tableId}`,
    undefined,
    true,
  );

  if (table) {
    console.log(`[ok] Table ${DATASET_ID}.${tableId} exists`);
    return;
  }

  await googleApi(
    'POST',
    `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/datasets/${DATASET_ID}/tables`,
    bodyFactory(),
  );

  console.log(`[ok] Table ${DATASET_ID}.${tableId} created`);
}

async function sendCallable(functionName, data) {
  const response = await fetch(`https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(`Callable ${functionName} failed: ${JSON.stringify(payload)}`);
  }

  return payload.result;
}

async function sendVerificationEvents() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const base = yesterday.getTime();
  const eventTimes = Array.from({ length: 14 }, (_, index) => new Date(base + (index * 60_000)).toISOString());
  const verificationTag = `prod_verify_${Date.now()}`;

  const events = [
    { eventName: 'app_open', screenName: 'App', props: { verificationTag }, occurredAt: eventTimes[0] },
    { eventName: 'screen_view', screenName: 'Register', props: { verificationTag }, occurredAt: eventTimes[1] },
    { eventName: 'onboarding_started', screenName: 'Register', props: { verificationTag, entryPoint: 'production_verification' }, occurredAt: eventTimes[2] },
    { eventName: 'otp_requested', screenName: 'Register', subjectType: 'phone_registration', subjectId: verificationTag, props: { verificationTag, flow: 'verification' }, occurredAt: eventTimes[3] },
    { eventName: 'otp_verified', screenName: 'OTPVerification', subjectType: 'phone_registration', subjectId: verificationTag, props: { verificationTag, flow: 'verification' }, occurredAt: eventTimes[4] },
    { eventName: 'role_selected', screenName: 'ChooseRole', props: { verificationTag, role: 'nurse' }, occurredAt: eventTimes[5] },
    { eventName: 'onboarding_completed', screenName: 'OnboardingSurvey', props: { verificationTag, role: 'nurse' }, occurredAt: eventTimes[6] },
    { eventName: 'chat_list_view', screenName: 'ChatList', subjectType: 'conversation_list', subjectId: verificationTag, props: { verificationTag }, occurredAt: eventTimes[7] },
    { eventName: 'chat_room_view', screenName: 'ChatRoom', subjectType: 'conversation', subjectId: verificationTag, conversationId: verificationTag, props: { verificationTag }, occurredAt: eventTimes[8] },
    { eventName: 'message_sent', screenName: 'ChatRoom', subjectType: 'message', subjectId: verificationTag, conversationId: verificationTag, props: { verificationTag, messageType: 'text', source: 'verification' }, occurredAt: eventTimes[9] },
    { eventName: 'post_job_started', screenName: 'PostJob', subjectType: 'job_draft', subjectId: verificationTag, props: { verificationTag, mode: 'create' }, occurredAt: eventTimes[10] },
    { eventName: 'post_job_submitted', screenName: 'PostJob', subjectType: 'shift', subjectId: verificationTag, jobId: verificationTag, props: { verificationTag, step: 'created', postType: 'shift' }, occurredAt: eventTimes[11] },
    { eventName: 'profile_viewed', screenName: 'Profile', subjectType: 'user_profile', subjectId: verificationTag, props: { verificationTag }, occurredAt: eventTimes[12] },
    { eventName: 'profile_updated', screenName: 'Profile', subjectType: 'user_profile', subjectId: verificationTag, props: { verificationTag, hasBio: true }, occurredAt: eventTimes[13] },
  ];

  for (const event of events) {
    await sendCallable('trackAnalyticsEvent', event);
    console.log(`[ok] Event sent: ${event.eventName}`);
  }

  return {
    verificationTag,
    eventDate: eventTimes[0].slice(0, 10),
    eventNames: events.map((event) => event.eventName),
  };
}

function unwrapFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return Number(value.integerValue);
  if (value.doubleValue !== undefined) return Number(value.doubleValue);
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.timestampValue !== undefined) return value.timestampValue;
  if (value.mapValue !== undefined) {
    const result = {};
    for (const [key, entry] of Object.entries(value.mapValue.fields || {})) {
      result[key] = unwrapFirestoreValue(entry);
    }
    return result;
  }
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(unwrapFirestoreValue);
  }
  if (value.nullValue !== undefined) return null;
  return value;
}

function unwrapFirestoreDocument(doc) {
  const fields = doc.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, unwrapFirestoreValue(value)]));
}

async function listFirestoreDocuments(collectionId, pageSize = 20) {
  const result = await googleApi(
    'POST',
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`,
    {
      structuredQuery: {
        from: [{ collectionId }],
        orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
        limit: pageSize,
      },
    },
  );
  return result
    .filter((entry) => entry.document)
    .map((entry) => unwrapFirestoreDocument(entry.document));
}

async function queryBigQuery(sql) {
  const result = await googleApi(
    'POST',
    `https://bigquery.googleapis.com/bigquery/v2/projects/${PROJECT_ID}/queries`,
    {
      query: sql,
      useLegacySql: false,
      location: 'asia-southeast1',
    },
  );
  return result.rows || [];
}

async function publishScheduledTopic() {
  await googleApi(
    'POST',
    `https://pubsub.googleapis.com/v1/projects/${PROJECT_ID}/topics/${SCHEDULED_TOPIC}:publish`,
    {
      messages: [
        {
          data: Buffer.from(JSON.stringify({ triggeredBy: 'verifyProductionAnalytics' })).toString('base64'),
        },
      ],
    },
  );
  console.log('[ok] Published message to scheduled summary topic');
}

async function waitForSummary(eventDate, verificationTag) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const reports = await listFirestoreDocuments('analytics_reports', 10);
    const match = reports.find((report) => report.type === 'daily_executive_summary' && report.eventDate === eventDate);
    if (match) {
      console.log('[ok] Found daily summary in analytics_reports');
      return match;
    }
    await sleep(5000);
    if (attempt === 5) {
      console.log(`[wait] Still waiting for analytics_reports daily summary for ${eventDate} (${verificationTag})`);
    }
  }
  throw new Error('Timed out waiting for daily summary report in Firestore');
}

async function main() {
  console.log('[step] Ensuring BigQuery API and tables');
  await ensureBigQueryApiEnabled();
  await ensureDataset();
  await ensureTable(EVENTS_TABLE, analyticsEventsTableBody);
  await ensureTable(SUMMARIES_TABLE, analyticsSummariesTableBody);

  console.log('[step] Sending production verification events');
  const verification = await sendVerificationEvents();

  await sleep(8000);

  console.log('[step] Checking analytics_events in Firestore');
  const firestoreEvents = await listFirestoreDocuments('analytics_events', 30);
  const recentVerificationEvents = firestoreEvents.filter((doc) => doc.props?.verificationTag === verification.verificationTag);
  if (recentVerificationEvents.length < verification.eventNames.length - 1) {
    throw new Error(`Expected verification events in Firestore, found ${recentVerificationEvents.length}`);
  }
  console.log(`[ok] Found ${recentVerificationEvents.length} verification events in Firestore`);

  console.log('[step] Checking analytics_events in BigQuery');
  const namesList = verification.eventNames.map((name) => `'${name}'`).join(', ');
  const bqRows = await queryBigQuery(`
    SELECT eventName, COUNT(*) AS total
    FROM \`${PROJECT_ID}.${DATASET_ID}.${EVENTS_TABLE}\`
    WHERE eventDate = DATE('${verification.eventDate}')
      AND JSON_VALUE(props_json, '$.verificationTag') = '${verification.verificationTag}'
      AND eventName IN (${namesList})
    GROUP BY eventName
    ORDER BY eventName
  `);
  console.log(`[ok] BigQuery has ${bqRows.length} grouped event rows for verification tag ${verification.verificationTag}`);

  console.log('[step] Triggering scheduled daily summary now');
  await publishScheduledTopic();
  const summary = await waitForSummary(verification.eventDate, verification.verificationTag);

  console.log('[step] Checking analytics_daily_summaries in BigQuery');
  const summaryRows = await queryBigQuery(`
    SELECT eventDate, source, overview.messagesSent AS messagesSent, overview.newUsers AS newUsers
    FROM \`${PROJECT_ID}.${DATASET_ID}.${SUMMARIES_TABLE}\`
    WHERE eventDate = DATE('${verification.eventDate}')
    ORDER BY generatedAt DESC
    LIMIT 3
  `);

  console.log(JSON.stringify({
    verificationTag: verification.verificationTag,
    eventDate: verification.eventDate,
    firestoreEventsFound: recentVerificationEvents.length,
    bigQueryEventGroups: bqRows.length,
    firestoreSummary: summary,
    bigQuerySummaryRows: summaryRows,
  }, null, 2));
}

main().catch((error) => {
  console.error('[fatal]', error);
  process.exit(1);
});