const admin = require('firebase-admin');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'nurse-go-th';
const DEFAULT_LIMIT = Number(process.env.VERIFICATIONS_LIMIT || 10);

function parseArgs(argv) {
  const args = {
    uid: '',
    email: '',
    status: '',
    limit: DEFAULT_LIMIT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === '--uid' && next) {
      args.uid = next;
      index += 1;
    } else if (token === '--email' && next) {
      args.email = next;
      index += 1;
    } else if (token === '--status' && next) {
      args.status = next;
      index += 1;
    } else if (token === '--limit' && next) {
      const parsed = Number(next);
      if (!Number.isNaN(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      index += 1;
    }
  }

  return args;
}

function initAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  return admin.initializeApp({ projectId: PROJECT_ID });
}

function toDateString(value) {
  if (!value) return '-';
  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

async function findUserDoc(db, verification) {
  if (!verification.userId) {
    return { exists: false, reason: 'missing-userId' };
  }

  const userDoc = await db.collection('users').doc(String(verification.userId)).get();
  if (!userDoc.exists) {
    return { exists: false, reason: 'user-doc-missing' };
  }

  const userData = userDoc.data() || {};
  return {
    exists: true,
    emailMatches: !verification.userEmail || !userData.email || verification.userEmail === userData.email,
    role: userData.role || '-',
    email: userData.email || '-',
  };
}

async function buildQuery(db, filters) {
  let query = db.collection('verifications');

  if (filters.uid) {
    query = query.where('userId', '==', filters.uid);
  }
  if (filters.email) {
    query = query.where('userEmail', '==', filters.email);
  }
  if (filters.status) {
    query = query.where('status', '==', filters.status);
  }

  return query.limit(filters.limit).get();
}

async function main() {
  const filters = parseArgs(process.argv.slice(2));

  try {
    initAdmin();
    const db = admin.firestore();
    const snapshot = await buildQuery(db, filters);

    if (snapshot.empty) {
      console.log(JSON.stringify({ ok: true, projectId: PROJECT_ID, count: 0, rows: [] }, null, 2));
      return;
    }

    const rows = [];
    for (const verificationDoc of snapshot.docs) {
      const data = verificationDoc.data() || {};
      const userCheck = await findUserDoc(db, data);
      rows.push({
        verificationId: verificationDoc.id,
        userId: data.userId || '-',
        userEmail: data.userEmail || '-',
        status: data.status || '-',
        verificationType: data.verificationType || '-',
        submittedAt: toDateString(data.submittedAt),
        userDocExists: userCheck.exists,
        userDocReason: userCheck.reason || '-',
        userDocEmail: userCheck.email || '-',
        emailMatches: userCheck.emailMatches ?? null,
        userRole: userCheck.role || '-',
      });
    }

    const mismatches = rows.filter((row) => !row.userDocExists || row.emailMatches === false);

    console.log(JSON.stringify({
      ok: true,
      projectId: PROJECT_ID,
      count: rows.length,
      mismatchCount: mismatches.length,
      rows,
    }, null, 2));
  } catch (error) {
    const message = error && (error.stack || error.message || String(error));
    console.error('Failed to inspect verifications.');
    console.error(message);
    console.error('Hint: set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON with Firestore access, or run gcloud auth application-default login first.');
    process.exit(1);
  }
}

void main();