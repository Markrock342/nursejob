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

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

// ============================================
// CONFIG
// ============================================
const CONFIG = {
  POST_EXPIRE_HOURS: 48, // 2 days
  FREE_DAILY_POST_LIMIT: 2,
  CHECK_INTERVAL_HOURS: 6,
};

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
      isValid = true; // ⚠️ เปลี่ยนเมื่อ setup จริง
      
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
      isValid = true; // ⚠️ เปลี่ยนเมื่อ setup จริง
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
      // Query jobs that are active and older than cutoff
      const snapshot = await db.collection('jobs')
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
  .document('applications/{applicationId}')
  .onCreate(async (snap, context) => {
    const application = snap.data();
    console.log('📬 New application:', context.params.applicationId);
    
    try {
      // Get job details
      const jobDoc = await db.collection('jobs').doc(application.jobId).get();
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
          body: `${application.applicantName} สนใจงาน "${job.title}"`,
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
          body: `${application.applicantName} สนใจงาน "${job.title}"`,
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
        body: `${application.applicantName} สนใจงาน "${job.title}"`,
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
      const snapshot = await db.collection('jobs')
        .where('status', '==', 'active')
        .where('acceptedApplicants', '>=', 1)
        .get();
      
      if (snapshot.empty) {
        console.log('✅ No filled jobs to close');
        return null;
      }
      
      const batch = db.batch();
      let count = 0;
      
      snapshot.docs.forEach((doc) => {
        const job = doc.data();
        
        // If accepted applicants >= positions needed, close the job
        if (job.acceptedApplicants >= (job.positions || 1)) {
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
      
      // Count new jobs
      const newJobsSnapshot = await db.collection('jobs')
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
  if (!pushToken || !pushToken.startsWith('ExponentPushToken')) return false;
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

    if (!shiftLat || !shiftLng) {
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
        const userLat = alert.lat;
        const userLng = alert.lng;
        const radiusKm = alert.radiusKm ?? 5;

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
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
}

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
      // Find jobs that will expire in ~6 hours
      const snapshot = await db.collection('jobs')
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
