import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  increment,
  DocumentSnapshot,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { JobPost, ShiftContact, JobFilters, PostShift } from '../types';
import { getQueryGeohashes, getDistanceKm, encodeGeohash } from '../utils/geohash';
import { assertAuthUser, isAuthUser } from './security/authGuards';

// Re-export types for backward compatibility
export type { JobPost, ShiftContact };

const JOBS_COLLECTION = 'shifts';
const CONTACTS_COLLECTION = 'shift_contacts';
const PAGE_SIZE = 20;

// Production mode: never fall back to mock jobs.
const SHOW_MOCK_DATA = false;

// Sync poster snapshot fields on already-created posts.
export async function syncPosterSnapshotToMyPosts(
  userId: string,
  profile: { displayName?: string; photoURL?: string | null }
): Promise<number> {
  if (!isAuthUser(userId)) return 0;

  const newName = profile.displayName || 'ไม่ระบุชื่อ';
  const newPhoto = profile.photoURL || '';

  const q = query(collection(db, JOBS_COLLECTION), where('posterId', '==', userId));
  const snap = await getDocs(q);
  if (snap.empty) return 0;

  const updates = snap.docs
    .filter((d) => {
      const data = d.data();
      return (data.posterName || 'ไม่ระบุชื่อ') !== newName || (data.posterPhoto || '') !== newPhoto;
    })
    .map((d) =>
      updateDoc(d.ref, {
        posterName: newName,
        posterPhoto: newPhoto,
        updatedAt: serverTimestamp(),
      })
    );

  if (updates.length === 0) return 0;
  await Promise.all(updates);
  return updates.length;
}

// ==========================================
// Helpers
// ==========================================

/** Map Firestore doc → JobPost (normalize Timestamps → Date) */
function mapDocToJob(docSnap: QueryDocumentSnapshot): JobPost {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    title: data.title || 'หาคนแทน',
    posterName: data.posterName || 'ไม่ระบุชื่อ',
    posterId: data.posterId || '',
    posterVerified: data.posterVerified,
    posterRole: data.posterRole,
    posterOrgType: data.posterOrgType,
    posterStaffType: data.posterStaffType,
    posterPlan: data.posterPlan,
    department: data.department || 'ทั่วไป',
    description: data.description || '',
    benefits: Array.isArray(data.benefits) ? data.benefits : [],
    employmentType: data.employmentType || data.salaryType,
    startDateNote: data.startDateNote,
    workHours: data.workHours,
    shiftRate: data.shiftRate || 0,
    salary: data.salary,
    rateType: data.rateType || 'shift',
    salaryType: data.salaryType,
    shiftDate: data.shiftDate?.toDate?.() ?? new Date(),
    shiftTime: data.shiftTime || '',
    location: {
      province: data.location?.province || 'กรุงเทพมหานคร',
      district: data.location?.district || '',
      hospital: data.location?.hospital || '',
      address: data.location?.address || '',
      coordinates: data.location?.coordinates,
      lat: data.location?.lat ?? data.lat,
      lng: data.location?.lng ?? data.lng,
    },
    geohash: data.geohash,
    lat: data.location?.lat ?? data.lat,
    lng: data.location?.lng ?? data.lng,
    shifts: data.shifts || [],
    totalShifts: data.totalShifts || 0,
    filledShifts: data.filledShifts || 0,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    expiresAt: data.expiresAt?.toDate?.() ?? null,
    status: data.status || 'active',
    isUrgent: data.isUrgent || false,
    viewsCount: data.viewsCount || 0,
    applicantsCount: data.applicantsCount || 0,
  } as JobPost;
}

async function enrichJobsWithPosterMetadata(jobs: JobPost[]): Promise<JobPost[]> {
  const posterIds = [...new Set(
    jobs
      .filter((job) => job.posterId && (!job.posterRole || !job.posterStaffType || job.posterVerified === undefined))
      .map((job) => job.posterId)
  )];

  if (posterIds.length === 0) return jobs;

  const posterEntries = await Promise.all(
    posterIds.map(async (posterId) => {
      try {
        const posterDoc = await getDoc(doc(db, 'users', posterId));
        if (!posterDoc.exists()) return [posterId, null] as const;
        const posterData = posterDoc.data();
        return [posterId, {
          role: posterData.role,
          orgType: posterData.orgType,
          staffType: posterData.staffType,
          isVerified: Boolean(posterData.isVerified),
          plan: posterData.subscription?.plan,
        }] as const;
      } catch {
        return [posterId, null] as const;
      }
    })
  );

  const posterMap = new Map(posterEntries);

  return jobs.map((job) => {
    const poster = posterMap.get(job.posterId);
    if (!poster) return job;

    return {
      ...job,
      posterRole: job.posterRole || poster.role,
      posterOrgType: job.posterOrgType || poster.orgType,
      posterStaffType: job.posterStaffType || poster.staffType,
      posterVerified: job.posterVerified ?? poster.isVerified,
      posterPlan: job.posterPlan || poster.plan,
    };
  });
}

/** ตรวจว่าโพสต์ active และยังไม่หมดอายุ */
function isActivePost(job: JobPost): boolean {
  if (job.status !== 'active' && job.status !== 'urgent') return false;
  if (job.expiresAt) {
    const expiry = job.expiresAt instanceof Date ? job.expiresAt : new Date(job.expiresAt as any);
    if (expiry < new Date()) return false;
  }
  return true;
}

// ==========================================
// Shifts Service - บอร์ดหาคนแทน
// ==========================================

// Subscribe to real-time jobs updates
export function subscribeToJobs(callback: (jobs: JobPost[]) => void): () => void {
  const jobsQuery = query(
    collection(db, JOBS_COLLECTION),
    where('status', 'in', ['active', 'urgent']),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE)
  );

  return onSnapshot(jobsQuery, (snapshot) => {
    const now = new Date();
    const jobs = snapshot.docs
      .map(mapDocToJob)
      .filter(isActivePost);

    console.log(`[subscribeToJobs] ${jobs.length} active jobs from Firestore`);

    // แสดง mock เฉพาะใน dev mode และเมื่อ feature flag เปิดอยู่เท่านั้น
    if (SHOW_MOCK_DATA && jobs.length === 0) {
      callback(getMockJobs());
      return;
    }

    enrichJobsWithPosterMetadata(jobs)
      .then(callback)
      .catch(() => callback(jobs));
  }, (error) => {
    // ถ้า permission-denied → ไม่ต้อง callback และไม่ต้อง log error spam
    if ((error as any)?.code === 'permission-denied') {
      console.warn('[subscribeToJobs] Not signed in — skipping job subscription');
      return;
    }
    console.error('[subscribeToJobs] Firestore error:', error);
    callback([]);
  });
}

// Get active jobs with optional filters + pagination cursor
export async function getJobs(
  filters?: JobFilters,
  cursor?: DocumentSnapshot,
  pageSize = PAGE_SIZE,
): Promise<{ jobs: JobPost[]; lastDoc: DocumentSnapshot | null }> {
  try {
    let jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('status', 'in', ['active', 'urgent']),
      orderBy('createdAt', 'desc'),
      limit(pageSize),
    );

    if (cursor) {
      jobsQuery = query(jobsQuery, startAfter(cursor));
    }

    const snapshot = await getDocs(jobsQuery);
    let jobs = snapshot.docs.map(mapDocToJob).filter(isActivePost);
    jobs = await enrichJobsWithPosterMetadata(jobs);

    // Client-side filters
    if (filters) {
      if (filters.province)     jobs = jobs.filter(j => j.location?.province === filters.province);
      if (filters.district)     jobs = jobs.filter(j => j.location?.district === filters.district);
      if (filters.department)   jobs = jobs.filter(j => j.department === filters.department);
      if (filters.staffType)    jobs = jobs.filter(j => j.staffType === filters.staffType);
      if (filters.locationType) jobs = jobs.filter(j => j.locationType === filters.locationType);
      if (filters.urgentOnly)   jobs = jobs.filter(j => j.status === 'urgent' || j.isUrgent);
      if (filters.verifiedOnly) jobs = jobs.filter(j => j.posterVerified);
      if (filters.minRate)      jobs = jobs.filter(j => (j.shiftRate || 0) >= filters.minRate!);
      if (filters.maxRate)      jobs = jobs.filter(j => (j.shiftRate || 0) <= filters.maxRate!);
      if (filters.sortBy === 'highestPay') {
        jobs.sort((a, b) => (b.shiftRate || 0) - (a.shiftRate || 0));
      }
    }

    const lastDoc = snapshot.docs.length === pageSize
      ? snapshot.docs[snapshot.docs.length - 1] as DocumentSnapshot
      : null;

    return { jobs, lastDoc };
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      console.warn('[getJobs] Not signed in — returning empty list');
      return { jobs: [], lastDoc: null };
    }
    console.error('[getJobs] Firestore error:', error);
    throw error;
  }
}

// Get single job by ID
export async function getJobById(jobId: string): Promise<JobPost | null> {
  try {
    const docSnap = await getDoc(doc(db, JOBS_COLLECTION, jobId));
    if (!docSnap.exists()) return null;
    const job = mapDocToJob(docSnap as QueryDocumentSnapshot);
    const [enrichedJob] = await enrichJobsWithPosterMetadata([job]);
    return enrichedJob;
  } catch (error) {
    console.error('[getJobById] error:', error);
    throw error;
  }
}

// Search shifts (client-side fulltext — อนาคตเปลี่ยนเป็น Algolia/Typesense)
export async function searchJobs(searchText: string): Promise<JobPost[]> {
  try {
    const { jobs } = await getJobs();
    const q = searchText.toLowerCase();
    return jobs.filter(job =>
      job.posterName?.toLowerCase().includes(q) ||
      job.title?.toLowerCase().includes(q) ||
      job.department?.toLowerCase().includes(q) ||
      job.location?.district?.toLowerCase().includes(q) ||
      job.location?.province?.toLowerCase().includes(q) ||
      job.location?.hospital?.toLowerCase().includes(q)
    );
  } catch (error) {
    console.error('[searchJobs] error:', error);
    throw error;
  }
}

/**
 * หางานใกล้ตัวด้วย Geohash
 * @param lat  ละติจูดของผู้ใช้
 * @param lng  ลองจิจูด
 * @param radiusKm  รัศมีที่ต้องการ (กิโลเมตร)
 */
export async function getJobsNearby(
  lat: number,
  lng: number,
  radiusKm = 10,
): Promise<JobPost[]> {
  try {
    const geohashes = getQueryGeohashes(lat, lng, radiusKm);
    const jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('status', 'in', ['active', 'urgent']),
      where('geohash', 'in', geohashes),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE),
    );
    const snapshot = await getDocs(jobsQuery);
    let jobs = snapshot.docs.map(mapDocToJob).filter(isActivePost);
    jobs = jobs.filter((job) => {
      if (job.lat == null || job.lng == null) return false;
      return getDistanceKm(lat, lng, job.lat, job.lng) <= radiusKm;
    });
    jobs = await enrichJobsWithPosterMetadata(jobs);

    // เรียงตามระยะทางจริงโดยใช้ Haversine
    jobs.sort((a, b) => {
      const da = a.lat && a.lng ? getDistanceKm(lat, lng, a.lat, a.lng) : 9999;
      const db2 = b.lat && b.lng ? getDistanceKm(lat, lng, b.lat, b.lng) : 9999;
      return da - db2;
    });

    return jobs;
  } catch (error) {
    console.error('[getJobsNearby] error:', error);
    throw error;
  }
}

// ==========================================
// Anti-scam & Rate limit helpers
// ==========================================

const MIN_RATE_BAHT = 300;   // ค่าเวรต่ำสุดที่สมเหตุสมผล (บาท/เวร)
const MAX_POSTS_PER_HOUR = 5; // โพสต์ได้ไม่เกิน 5 ครั้ง/ชม. ต่อ user
const SUSPICIOUS_KEYWORDS = ['โอนเงิน', 'ค่ามัดจำ', 'line@', 'สมัครฟรี', 'รายได้เสริม', 'mlm'];

export interface PostValidationResult {
  valid: boolean;
  warnings: string[];
  blocked: boolean;
  reason?: string;
}

/** ตรวจ rate limit: ดึงจำนวนโพสต์ของ user ใน 1 ชม. ล่าสุด */
async function checkRateLimit(posterId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const q = query(
    collection(db, JOBS_COLLECTION),
    where('posterId', '==', posterId),
    where('createdAt', '>=', Timestamp.fromDate(oneHourAgo))
  );
  const snap = await getDocs(q);
  return snap.size < MAX_POSTS_PER_HOUR;
}

/** ตรวจเนื้อหา + ค่าตอบแทน */
export function validateJobPost(jobData: Partial<JobPost>): PostValidationResult {
  const warnings: string[] = [];
  let blocked = false;
  let reason: string | undefined;

  // 1. ค่าตอบแทนต่ำผิดปกติ
  if (jobData.shiftRate && jobData.shiftRate > 0 && jobData.shiftRate < MIN_RATE_BAHT) {
    warnings.push(`ค่าตอบแทน ${jobData.shiftRate} บาท ต่ำกว่าปกติ (ขั้นต่ำแนะนำ ${MIN_RATE_BAHT} บาท)`);
  }

  // 2. Keyword scam
  const fullText = `${jobData.title || ''} ${jobData.description || ''}`.toLowerCase();
  const foundKeywords = SUSPICIOUS_KEYWORDS.filter(kw => fullText.includes(kw));
  if (foundKeywords.length > 0) {
    warnings.push(`พบคำที่อาจเป็นการหลอกลวง: ${foundKeywords.join(', ')}`);
    if (foundKeywords.length >= 2) {
      blocked = true;
      reason = 'เนื้อหาโพสต์มีลักษณะหลอกลวง กรุณาแก้ไขแล้วลองใหม่';
    }
  }

  // 3. Title / description too short
  if ((jobData.title || '').trim().length < 5) {
    warnings.push('หัวข้อสั้นเกินไป กรุณาระบุรายละเอียดเพิ่มเติม');
  }

  return { valid: !blocked, warnings, blocked, reason };
}

// Create new job post
export async function createJob(jobData: Partial<JobPost>): Promise<string> {
  try {
    const currentUser = assertAuthUser(jobData.posterId, 'ไม่สามารถยืนยันตัวตนผู้โพสต์ได้ กรุณาเข้าสู่ระบบใหม่');

    // Rate limit check
    if (jobData.posterId) {
      const allowed = await checkRateLimit(jobData.posterId);
      if (!allowed) {
        throw new Error('คุณโพสต์บ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่');
      }
    }

    // Anti-scam validation
    const validation = validateJobPost(jobData);
    if (validation.blocked) {
      throw new Error(validation.reason || 'ไม่สามารถโพสต์ได้');
    }

    // Clean undefined values — Firestore rejects undefined fields
    const cleanData: Record<string, any> = {};
    for (const [key, value] of Object.entries(jobData)) {
      if (value !== undefined) cleanData[key] = value;
    }

    // Auto-generate geohash — support both location.coordinates (Google Places) and location.lat/lng (map picker)
    const coords = cleanData.location?.coordinates;
    const locLat = coords?.lat || cleanData.location?.lat;
    const locLng = coords?.lng || cleanData.location?.lng;
    if (locLat && locLng) {
      cleanData.geohash = encodeGeohash(locLat, locLng);
      cleanData.lat = locLat;
      cleanData.lng = locLng;
    }

    const docRef = await addDoc(collection(db, JOBS_COLLECTION), {
      ...cleanData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      applicantsCount: 0,
      viewsCount: 0,
      status: cleanData.status || 'active',
    });
    return docRef.id;
  } catch (error: any) {
    if (error?.code === 'permission-denied') {
      throw new Error('สิทธิ์ไม่เพียงพอหรือเซสชันยังไม่พร้อม กรุณาออกแล้วเข้าใหม่');
    }
    const msg = String(error?.message || '');
    if (msg.includes('เซสชันหมดอายุ') || msg.includes('ยืนยันตัวตนผู้โพสต์')) {
      // Auth cache/token race is handled by UI prompt; avoid noisy red overlay.
      throw error;
    }
    console.error('[createJob] error:', error);
    throw error;
  }
}

// Update job
export async function updateJob(jobId: string, updates: Partial<JobPost>): Promise<void> {
  try {
    const currentUser = assertAuthUser();

    const docRef = doc(db, JOBS_COLLECTION, jobId);
    const currentDoc = await getDoc(docRef);
    if (!currentDoc.exists()) throw new Error('ไม่พบประกาศนี้');
    const data = currentDoc.data();
    if (data.posterId !== currentUser.uid) {
      throw new Error('ไม่มีสิทธิ์แก้ไขประกาศนี้');
    }
    await updateDoc(docRef, updates);
  } catch (error) {
    console.error('Error updating job:', error);
    throw error;
  }
}

// Increment view count — ใช้ atomic increment ไม่ต้อง read ก่อน
export async function incrementViewCount(jobId: string): Promise<void> {
  try {
    await updateDoc(doc(db, JOBS_COLLECTION, jobId), {
      viewsCount: increment(1),
    });
  } catch (error) {
    // ไม่ throw — view count ไม่ใช่ critical operation
    console.warn('[incrementViewCount] non-critical error:', error);
  }
}

// Delete job
export async function deleteJob(jobId: string): Promise<void> {
  try {
    const currentUser = assertAuthUser();

    const docRef = doc(db, JOBS_COLLECTION, jobId);
    const currentDoc = await getDoc(docRef);
    if (!currentDoc.exists()) throw new Error('ไม่พบประกาศนี้');
    const data = currentDoc.data();
    if (data.posterId !== currentUser.uid) {
      throw new Error('ไม่มีสิทธิ์ลบประกาศนี้');
    }
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting job:', error);
    throw error;
  }
}

// Get jobs by user ID (ประกาศของฉัน)
export async function getUserPosts(userId: string): Promise<JobPost[]> {
  try {
    const jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('posterId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(jobsQuery);
    const jobs = snapshot.docs.map(mapDocToJob);
    return enrichJobsWithPosterMetadata(jobs);
  } catch (error) {
    console.error('[getUserPosts] error:', error);
    return [];
  }
}

// Subscribe to user's posts in real-time
export function subscribeToUserPosts(
  userId: string,
  callback: (posts: JobPost[]) => void,
): () => void {
  const postsQuery = query(
    collection(db, JOBS_COLLECTION),
    where('posterId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(postsQuery, (snapshot) => {
    const jobs = snapshot.docs.map(mapDocToJob);
    enrichJobsWithPosterMetadata(jobs)
      .then(callback)
      .catch(() => callback(jobs));
  }, (error) => {
    console.error('[subscribeToUserPosts] error:', error);
    callback([]);
  });
}

// Update job status
export async function updateJobStatus(jobId: string, status: 'active' | 'urgent' | 'closed'): Promise<void> {
  try {
    const currentUser = assertAuthUser();

    const docRef = doc(db, JOBS_COLLECTION, jobId);
    const currentDoc = await getDoc(docRef);
    if (!currentDoc.exists()) throw new Error('ไม่พบประกาศนี้');
    const data = currentDoc.data();
    if (data.posterId !== currentUser.uid) {
      throw new Error('ไม่มีสิทธิ์แก้ไขสถานะประกาศนี้');
    }
    await updateDoc(docRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

// ==========================================
// Shift Contact Service - การแสดงความสนใจ
// ==========================================

// แสดงความสนใจ
export async function contactForShift(
  jobId: string, 
  userId: string, 
  userName: string,
  userPhone: string,
  message?: string
): Promise<string> {
  try {
    const currentUser = assertAuthUser(userId, 'ไม่สามารถแสดงความสนใจแทนผู้ใช้อื่นได้');

    const jobRef = doc(db, JOBS_COLLECTION, jobId);
    const jobDoc = await getDoc(jobRef);
    if (!jobDoc.exists()) throw new Error('ไม่พบประกาศนี้');
    const jobData = jobDoc.data();
    const posterId = jobData.posterId;
    if (!posterId) throw new Error('ประกาศนี้ไม่มีข้อมูลผู้โพสต์');

    // Check if already contacted
    const existingQuery = query(
      collection(db, CONTACTS_COLLECTION),
      where('jobId', '==', jobId),
      where('interestedUserId', '==', userId)
    );
    const existing = await getDocs(existingQuery);
    
    if (!existing.empty) {
      throw new Error('คุณได้ติดต่อเรื่องงานนี้แล้ว');
    }

    // Create contact record
    const docRef = await addDoc(collection(db, CONTACTS_COLLECTION), {
      jobId,
      posterId,
      interestedUserId: userId,
      interestedUserName: userName,
      interestedUserPhone: userPhone,
      message: message || '',
      status: 'interested',
      contactedAt: serverTimestamp(),
    });

    // Update views count
    if (jobDoc.exists()) {
      const currentCount = jobData.viewsCount || 0;
      await updateDoc(jobRef, {
        viewsCount: currentCount + 1
      });
    }

    return docRef.id;
  } catch (error) {
    console.error('Error contacting for shift:', error);
    throw error;
  }
}

// Get user's interested shifts
export async function getUserShiftContacts(userId: string): Promise<ShiftContact[]> {
  if (!isAuthUser(userId)) return [];
  try {
    // Use simpler query without orderBy to avoid index requirement
    const contactsQuery = query(
      collection(db, CONTACTS_COLLECTION),
      where('interestedUserId', '==', userId)
    );
    
    const snapshot = await getDocs(contactsQuery);
    const contacts = await Promise.all(
      snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        
        // Fetch job details
        let jobData: JobPost | undefined;
        let jobDeleted = false;
        try {
          const jobDoc = await getDoc(doc(db, JOBS_COLLECTION, data.jobId));
          if (jobDoc.exists()) {
            const job = jobDoc.data();
            jobData = {
              id: jobDoc.id,
              title: job.title || 'เวร',
              posterName: job.posterName || 'ไม่ระบุ',
              ...job,
            } as JobPost;
          } else {
            // Job was deleted
            jobDeleted = true;
          }
        } catch (e) {
          console.error('Error fetching job:', e);
        }

        return {
          id: docSnap.id,
          ...data,
          contactedAt: data.contactedAt?.toDate() || new Date(),
          job: jobData,
          jobDeleted,
          status: jobDeleted ? 'expired' : (data.status || 'interested'),
        } as ShiftContact;
      })
    );

    // Sort client-side
    contacts.sort((a, b) => {
      const dateA = a.contactedAt instanceof Date ? a.contactedAt.getTime() : 0;
      const dateB = b.contactedAt instanceof Date ? b.contactedAt.getTime() : 0;
      return dateB - dateA;
    });

    return contacts;
  } catch (error: any) {
    if (error?.code === 'permission-denied') return []; // auth not ready yet
    console.warn('[getUserShiftContacts] non-critical error:', error?.code || error?.message || error);
    return [];
  }
}

// Delete a contact entry from user's history
export async function deleteShiftContact(contactId: string): Promise<void> {
  await deleteDoc(doc(db, CONTACTS_COLLECTION, contactId));
}

// Get contacts for a shift (for poster)
export async function getShiftContacts(jobId: string): Promise<ShiftContact[]> {
  try {
    // Use simpler query without orderBy to avoid index requirement
    const contactsQuery = query(
      collection(db, CONTACTS_COLLECTION),
      where('jobId', '==', jobId)
    );
    
    const snapshot = await getDocs(contactsQuery);
    const contacts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      contactedAt: doc.data().contactedAt?.toDate() || new Date(),
    } as ShiftContact));
    
    // Sort client-side
    contacts.sort((a, b) => {
      const dateA = a.contactedAt instanceof Date ? a.contactedAt.getTime() : 0;
      const dateB = b.contactedAt instanceof Date ? b.contactedAt.getTime() : 0;
      return dateB - dateA;
    });
    
    return contacts;
  } catch (error: any) {
    if (error?.code === 'permission-denied') return [];
    console.warn('[getShiftContacts] non-critical error:', error?.code || error?.message || error);
    return []; // Return empty instead of throwing
  }
}

// Update contact status
export async function updateShiftContactStatus(
  contactId: string, 
  status: 'interested' | 'confirmed' | 'cancelled'
): Promise<void> {
  try {
    const docRef = doc(db, CONTACTS_COLLECTION, contactId);
    await updateDoc(docRef, { status });
  } catch (error) {
    console.error('Error updating contact:', error);
    throw error;
  }
}

// ==========================================
// Mock Data (Fallback when Firebase unavailable)
// ==========================================
function getMockJobs(): JobPost[] {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const nextWeek = new Date(today.getTime() + 604800000);
  
  return [
    {
      id: '1',
      title: '🔥 หาคนแทนเวรดึก ICU ด่วนมาก!',
      posterName: 'พี่หมิว RN',
      posterId: 'u1',
      posterPhoto: 'https://randomuser.me/api/portraits/women/44.jpg',
      department: 'ICU',
      description: 'ติดธุระกะทันหัน หาคนแทนด่วนค่ะ ผู้ป่วย 6 เตียง มี NA ช่วย',
      shiftRate: 2000,
      rateType: 'shift',
      shiftDate: tomorrow,
      shiftTime: '00:00-08:00',
      location: {
        province: 'กรุงเทพมหานคร',
        district: 'วัฒนา',
        hospital: 'รพ.บำรุงราษฎร์',
      },
      contactPhone: '089-123-4567',
      contactLine: '@mew_nurse',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'urgent',
      viewsCount: 45,
      tags: ['ด่วน', 'ICU', 'เวรดึก'],
    },
    {
      id: '2',
      title: 'รับสมัครงาน OR หัวหิน',
      posterName: 'นุ่น พยาบาล',
      posterId: 'u2',
      posterPhoto: 'https://randomuser.me/api/portraits/women/68.jpg',
      department: 'OR',
      description: 'ไปทำ Part time ที่หัวหิน ค่าตอบแทนดี รับหลายวันได้',
      shiftRate: 350,
      rateType: 'hour',
      shiftDate: nextWeek,
      shiftTime: '08:00-20:00',
      location: {
        province: 'ประจวบคีรีขันธ์',
        district: 'หัวหิน',
        hospital: 'รพ.หัวหิน',
      },
      contactPhone: '081-234-5678',
      createdAt: new Date(Date.now() - 3600000),
      updatedAt: new Date(),
      status: 'active',
      viewsCount: 28,
    },
    {
      id: '3',
      title: 'หาคนแทนเวรเช้า ER',
      posterName: 'อาร์ม RN',
      posterId: 'u3',
      posterPhoto: 'https://randomuser.me/api/portraits/men/32.jpg',
      department: 'ER',
      description: 'ติดสอบ หาคนแทนเวรเช้าครับ ER busy มาก',
      shiftRate: 1800,
      rateType: 'shift',
      shiftDate: tomorrow,
      shiftTime: '08:00-16:00',
      location: {
        province: 'กรุงเทพมหานคร',
        district: 'ห้วยขวาง',
        hospital: 'รพ.กรุงเทพ',
      },
      contactPhone: '082-345-6789',
      contactLine: 'arm_nurse',
      createdAt: new Date(Date.now() - 7200000),
      updatedAt: new Date(),
      status: 'active',
      viewsCount: 15,
    },
    {
      id: '4',
      title: 'รับงาน Part time วอร์ด Med',
      posterName: 'เจน พยาบาล',
      posterId: 'u4',
      posterPhoto: 'https://randomuser.me/api/portraits/women/22.jpg',
      department: 'Med',
      description: 'วอร์ดอายุรกรรม ผู้ป่วยไม่หนัก รับได้หลายวัน',
      shiftRate: 1500,
      rateType: 'shift',
      shiftDate: nextWeek,
      shiftTime: '16:00-00:00',
      location: {
        province: 'นนทบุรี',
        district: 'เมืองนนทบุรี',
        hospital: 'รพ.นนทเวช',
      },
      contactPhone: '083-456-7890',
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(),
      status: 'active',
      viewsCount: 32,
    },
    {
      id: '5',
      title: '🔥 ด่วน! หาคนแทนเวรบ่าย Pedia',
      posterName: 'มิ้นท์ RN',
      posterId: 'u5',
      posterPhoto: 'https://randomuser.me/api/portraits/women/55.jpg',
      department: 'Pediatric',
      description: 'วอร์ดเด็ก ผู้ป่วย 10 เตียง มี NA 2 คน ช่วยงาน',
      shiftRate: 1700,
      rateType: 'shift',
      shiftDate: today,
      shiftTime: '16:00-00:00',
      location: {
        province: 'กรุงเทพมหานคร',
        district: 'บางกะปิ',
        hospital: 'รพ.เปาโล เมโมเรียล',
      },
      contactPhone: '084-567-8901',
      contactLine: '@mint_pedia',
      createdAt: new Date(Date.now() - 1800000),
      updatedAt: new Date(),
      status: 'urgent',
      viewsCount: 67,
      tags: ['ด่วน', 'เด็ก', 'เวรบ่าย'],
    },
    {
      id: '6',
      title: 'รับสมัครเวรดึก OPD คลินิก',
      posterName: 'ก้อย พยาบาล',
      posterId: 'u6',
      posterPhoto: 'https://randomuser.me/api/portraits/women/33.jpg',
      department: 'OPD',
      description: 'คลินิกเปิด 24 ชม. งานไม่หนัก มีหมอ 1 คน',
      shiftRate: 250,
      rateType: 'hour',
      shiftDate: tomorrow,
      shiftTime: '00:00-08:00',
      location: {
        province: 'สมุทรปราการ',
        district: 'บางพลี',
        hospital: 'คลินิกสุขภาพ 24 ชม.',
      },
      contactPhone: '085-678-9012',
      createdAt: new Date(Date.now() - 172800000),
      updatedAt: new Date(),
      status: 'active',
      viewsCount: 18,
    },
  ];
}
