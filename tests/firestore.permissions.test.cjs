const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
} = require('firebase/firestore');

const PROJECT_ID = 'nursejob-rules-test';
let testEnv;

async function seed(writeFn) {
  await testEnv.withSecurityRulesDisabledContext(async (context) => {
    await writeFn(context.firestore());
  });
}

test.before(async () => {
  const rules = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

test.afterEach(async () => {
  await testEnv.clearFirestore();
});

test('owner can create shift with own posterId', async () => {
  const db = testEnv.authenticatedContext('owner_1').firestore();
  const shiftRef = doc(db, 'shifts', 'shift_1');

  await assertSucceeds(setDoc(shiftRef, {
    posterId: 'owner_1',
    title: 'Night Shift ICU',
    status: 'active',
    shiftRate: 1200,
    createdAt: new Date(),
  }));
});

test('non-owner cannot update other user shift', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'shifts', 'shift_2'), {
      posterId: 'owner_2',
      title: 'ER Shift',
      status: 'active',
      shiftRate: 1000,
    });
  });

  const db = testEnv.authenticatedContext('intruder_1').firestore();
  await assertFails(updateDoc(doc(db, 'shifts', 'shift_2'), { title: 'Hacked title' }));
});

test('favorites enforce owner-only writes', async () => {
  const ownerDb = testEnv.authenticatedContext('user_1').firestore();
  await assertSucceeds(addDoc(collection(ownerDb, 'favorites'), {
    userId: 'user_1',
    jobId: 'job_1',
    createdAt: new Date(),
  }));

  const intruderDb = testEnv.authenticatedContext('user_2').firestore();
  await assertFails(addDoc(collection(intruderDb, 'favorites'), {
    userId: 'user_1',
    jobId: 'job_2',
    createdAt: new Date(),
  }));
});

test('admin can read conversation even if not a participant', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'users', 'admin_1'), {
      uid: 'admin_1',
      role: 'admin',
      email: 'admin@nursego.app',
    });
    await setDoc(doc(db, 'conversations', 'conv_1'), {
      participants: ['user_a', 'user_b'],
      lastMessageAt: new Date(),
      createdAt: new Date(),
    });
  });

  const adminDb = testEnv.authenticatedContext('admin_1').firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'conversations', 'conv_1')));
});

test('unauthenticated user cannot read favorites', async () => {
  await seed(async (db) => {
    await setDoc(doc(db, 'favorites', 'fav_1'), {
      userId: 'user_1',
      jobId: 'job_1',
      createdAt: new Date(),
    });
  });

  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthDb, 'favorites', 'fav_1')));
});
