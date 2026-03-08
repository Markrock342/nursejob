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

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  POST_EXPIRE_HOURS: 48, // 2 days
  FREE_DAILY_POST_LIMIT: 2,
  CHECK_INTERVAL_HOURS: 6,
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
  const runtimeAdmin = (typeof functions.config === 'function' ? functions.config().admin : null) || {};
  return {
    username: runtimeAdmin.username || process.env.ADMIN_USERNAME || '',
    passwordHash: (runtimeAdmin.password_hash || process.env.ADMIN_PASSWORD_HASH || '').toLowerCase(),
    email: runtimeAdmin.email || process.env.ADMIN_EMAIL || 'admin@nursego.admin',
    displayName: runtimeAdmin.display_name || process.env.ADMIN_DISPLAY_NAME || 'Administrator',
  };
}

// ============================================
// IAP RECEIPT VERIFICATION - ตรวจสอบการซื้อจาก App Store / Google Play
// ============================================
// เมื่อผู้ใช้ซื้อผ่าน IAP แอปจะส่ง receipt มาให้ Cloud Function ตรวจสอบ
// ถ้า receipt ถูกต้อง → activate สินค้าให้ผู้ใช้อัตโนมัติ
// ============================================
exports.verifyIAPReceipt = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const { receipt, productId, platform, userId } = req.body;

  if (!receipt || !productId || !platform) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  try {
    let isValid = false;

    if (platform === 'ios') {
      // ============================================
      // Apple Receipt Verification
      // ============================================
      // TODO: เมื่อมี Apple Developer Account แล้ว
      // ส่ง receipt ไป Apple verifyReceipt endpoint:
      //   Production: https://buy.itunes.apple.com/verifyReceipt
      //   Sandbox:    https://sandbox.itunes.apple.com/verifyReceipt
      //
      // const appleResponse = await fetch('https://buy.itunes.apple.com/verifyReceipt', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     'receipt-data': receipt,
      //     'password': process.env.APPLE_SHARED_SECRET, // จาก App Store Connect
      //     'exclude-old-transactions': true,
      //   }),
      // });
      // const appleResult = await appleResponse.json();
      // isValid = appleResult.status === 0;
      
      console.log('📱 iOS receipt received (verification pending Apple setup)');
      isValid = false;
      
    } else if (platform === 'android') {
      // ============================================
      // Google Play Receipt Verification
      // ============================================
      // TODO: เมื่อมี Google Play Developer Account แล้ว
      // ใช้ Google Play Developer API:
      //
      // const { google } = require('googleapis');
      // const androidPublisher = google.androidpublisher('v3');
      // 
      // Consumable:
      //   androidPublisher.purchases.products.get({ ... })
      //
      // Subscription:
      //   androidPublisher.purchases.subscriptions.get({ ... })
      
      console.log('🤖 Android receipt received (verification pending Google setup)');
      isValid = false;

    }

    if (isValid) {
      // บันทึก verified purchase ลง Firestore
      await db.collection('iap_receipts').add({
        userId: userId || 'unknown',
        productId,
        platform,
        receipt: receipt.substring(0, 100) + '...', // เก็บแค่ส่วนต้น (receipt ยาวมาก)
        verified: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Activate product
      if (userId) {
        await activateIAPProduct(userId, productId);
      }

      console.log(`✅ IAP verified: ${productId} for user ${userId}`);
      res.json({ success: true, productId });
    } else {
      console.log(`❌ IAP verification failed: ${productId}`);
      res.status(400).json({ success: false, error: 'Invalid receipt' });
    }
  } catch (error) {
    console.error('❌ IAP verification error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
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

  const cfg = getAdminEnvConfig();
  if (!cfg.username || !cfg.passwordHash) {
    throw new functions.https.HttpsError('failed-precondition', 'Admin env is not configured');
  }

  const validUser = String(username).trim().toLowerCase() === cfg.username.toLowerCase();
  const inputHash = sha256(password);
  const validPass = safeEqualHex(inputHash, cfg.passwordHash);

  if (!validUser || !validPass) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    throw new functions.https.HttpsError('unauthenticated', 'Invalid admin credentials');
  }

  const adminUid = `admin_${sha256(cfg.username).slice(0, 20)}`;

  await db.collection('users').doc(adminUid).set({
    uid: adminUid,
    email: cfg.email,
    displayName: cfg.displayName,
    role: 'admin',
    isAdmin: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  const customToken = await admin.auth().createCustomToken(adminUid);

  return {
    customToken,
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

// Helper: Activate IAP product for user
async function activateIAPProduct(userId, productId) {
  const userRef = db.collection('users').doc(userId);
  
  switch (productId) {
    case 'com.nursego.app.premium.monthly': {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      
      await userRef.update({
        subscription: {
          plan: 'premium',
          startedAt: new Date(),
          expiresAt,
          postsToday: 0,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Also update userPlans collection
      const planSnapshot = await db.collection('userPlans')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!planSnapshot.empty) {
        await planSnapshot.docs[0].ref.update({
          planType: 'premium',
          subscriptionStart: admin.firestore.FieldValue.serverTimestamp(),
          subscriptionEnd: expiresAt,
          dailyPostLimit: 999,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log(`👑 Premium activated for ${userId}`);
      break;
    }

    case 'com.nursego.app.extra.post': {
      const planSnapshot = await db.collection('userPlans')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (!planSnapshot.empty) {
        await planSnapshot.docs[0].ref.update({
          extraPosts: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log(`📝 Extra post added for ${userId}`);
      break;
    }

    case 'com.nursego.app.urgent.post':
    case 'com.nursego.app.extend.post':
      // TODO: Implement urgent/extend activation
      console.log(`🛍️ ${productId} activated for ${userId}`);
      break;

    default:
      console.warn(`Unknown product: ${productId}`);
  }
}

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
// ส่ง notification เมื่อมีคนสนใจงาน
// ============================================
exports.onNewApplication = functions.firestore
  .document('shift_contacts/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data();
    console.log('📬 New application:', context.params.applicationId);
    
    try {
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
      
      if (!fcmToken) {
        console.log('⚠️ No FCM token for poster');
        // Create in-app notification instead
        await createInAppNotification(job.posterId, {
          type: 'new_application',
          title: '📩 มีคนสนใจงานของคุณ!',
          body: `${application.interestedUserName || 'ผู้สมัคร'} สนใจงาน "${job.title}"`,
          data: {
            jobId: application.jobId,
            applicationId: context.params.applicationId,
          },
        });
        return null;
      }
      
      // Send FCM push notification
      const message = {
        notification: {
          title: '📩 มีคนสนใจงานของคุณ!',
          body: `${application.interestedUserName || 'ผู้สมัคร'} สนใจงาน "${job.title}"`,
        },
        data: {
          type: 'new_application',
          jobId: application.jobId,
          applicationId: context.params.applicationId,
        },
        token: fcmToken,
      };
      
      await admin.messaging().send(message);
      console.log('✅ Push notification sent');
      
      // Also create in-app notification
      await createInAppNotification(job.posterId, {
        type: 'new_application',
        title: '📩 มีคนสนใจงานของคุณ!',
        body: `${application.interestedUserName || 'ผู้สมัคร'} สนใจงาน "${job.title}"`,
        data: {
          jobId: application.jobId,
          applicationId: context.params.applicationId,
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
      // Get conversation
      const convDoc = await db.collection('conversations').doc(conversationId).get();
      if (!convDoc.exists) return null;
      
      const conversation = convDoc.data();
      
      // Find recipient (the other participant)
      const recipientId = conversation.participants.find(
        (p) => p !== message.senderId
      );
      
      if (!recipientId) return null;
      
      // Get recipient's FCM token
      const recipientDoc = await db.collection('users').doc(recipientId).get();
      if (!recipientDoc.exists) return null;
      
      const recipient = recipientDoc.data();
      
      // Create in-app notification
      await createInAppNotification(recipientId, {
        type: 'new_message',
        title: `💬 ${message.senderName}`,
        body: message.text?.substring(0, 100) || 'ส่งข้อความถึงคุณ',
        data: {
          conversationId,
        },
      });
      
      // Send FCM if available
      if (recipient.fcmToken) {
        const fcmMessage = {
          notification: {
            title: `💬 ${message.senderName}`,
            body: message.text?.substring(0, 100) || 'ส่งข้อความถึงคุณ',
          },
          data: {
            type: 'new_message',
            conversationId,
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
      
      // Save weekly report
      await db.collection('reports').add({
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
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    try {
      const snapshot = await db.collection('notifications')
        .where('createdAt', '<', thirtyDaysAgo)
        .limit(500)
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No old notifications to cleanup');
        return null;
      }
      
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`🧹 Deleted ${snapshot.size} old notifications`);
      
      return null;
    } catch (error) {
      console.error('❌ Error cleaning up:', error);
      return null;
    }
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

// ============================================
// HELPER: Send Expo Push Notification
// Uses Expo Push API (works with Expo push tokens)
// ============================================
async function sendExpoPush(pushToken, title, body, data = {}) {
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
        channelId: 'jobs',
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

      let notifiedCount = 0;

      for (const userDoc of usersSnap.docs) {
        // อย่าแจ้งเตือน poster ตัวเอง
        if (userDoc.id === shift.posterId) continue;

        const userData = userDoc.data();
        const alert = userData.nearbyJobAlert;
        const userLat = alert?.lat;
        const userLng = alert?.lng;
        const radiusKm = alert.radiusKm ?? 5;

        if (userLat == null || userLng == null) {
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
        const pushToken = userData.pushToken;
        if (pushToken) {
          await sendExpoPush(pushToken, notifTitle, notifBody, notifData);
        }

        // ── FCM fallback (ถ้ามี fcmToken) ──
        const fcmToken = userData.fcmToken;
        if (fcmToken && !pushToken) {
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
    });
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

function requireCallableAuth(context) {
  const uid = context?.auth?.uid;
  if (!uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  return uid;
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

  return { ok: true };
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
 * devCode is returned only in emulator/dev mode (never in production).
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

  // Only allow returning devCode in emulator.
  if (isEmulator) {
    functions.logger.log(`[OTP DEV] ${phone} → ${otpCode}`);
    return { success: true, devCode: otpCode };
  }

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
