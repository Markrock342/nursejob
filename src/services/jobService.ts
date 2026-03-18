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
import { JobPost, ShiftContact, JobFilters, PostShift, UserAdminTag } from '../types';
import { getQueryGeohashes, getDistanceKm, encodeGeohash } from '../utils/geohash';
import { detectExternalContactSignals } from '../utils/jobPostIntelligence';
import { assertAuthUser, isAuthUser } from './security/authGuards';
import { beginTrackedSubscription, PerformanceMetricOptions, recordQueryRead } from './performanceMetrics';

// Re-export types for backward compatibility
export type { JobPost, ShiftContact };

const JOBS_COLLECTION = 'shifts';
const CONTACTS_COLLECTION = 'shift_contacts';
const PAGE_SIZE = 20;
const POSTER_METADATA_CACHE_TTL_MS = 5 * 60 * 1000;

type PosterMetadata = {
  role?: string;
  orgType?: string;
  staffType?: string;
  staffTypes?: string[];
  isVerified: boolean;
  plan?: string;
  adminTags?: UserAdminTag[];
  adminWarningTag?: string;
};

const posterMetadataCache = new Map<string, { value: PosterMetadata | null; expiresAt: number }>();

// Sync poster snapshot fields on already-created posts.
export async function syncPosterSnapshotToMyPosts(
  userId: string,
  profile: {
    displayName?: string;
    photoURL?: string | null;
    role?: string;
    orgType?: string;
    staffType?: string;
    staffTypes?: string[];
    isVerified?: boolean;
    posterPlan?: string;
    adminTags?: string[];
    adminWarningTag?: string | null;
  }
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
        ...(profile.role !== undefined ? { posterRole: profile.role } : {}),
        ...(profile.orgType !== undefined ? { posterOrgType: profile.orgType } : {}),
        ...(profile.staffType !== undefined ? { posterStaffType: profile.staffType } : {}),
        ...(profile.staffTypes !== undefined ? { posterStaffTypes: profile.staffTypes } : {}),
        ...(profile.isVerified !== undefined ? { posterVerified: profile.isVerified } : {}),
        ...(profile.posterPlan !== undefined ? { posterPlan: profile.posterPlan } : {}),
        ...(profile.adminTags !== undefined ? { posterAdminTags: profile.adminTags } : {}),
        ...(profile.adminWarningTag !== undefined ? { posterWarningTag: profile.adminWarningTag || null } : {}),
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
    posterStaffTypes: Array.isArray(data.posterStaffTypes) ? data.posterStaffTypes : [],
    posterPlan: data.posterPlan,
    posterAdminTags: Array.isArray(data.posterAdminTags) ? data.posterAdminTags : [],
    posterWarningTag: data.posterWarningTag,
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
    shiftDates: Array.isArray(data.shiftDates) ? data.shiftDates : undefined,
    shiftTimeSlots: data.shiftTimeSlots || undefined,
    scheduleNote: data.scheduleNote,
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
    slotsNeeded: data.slotsNeeded || undefined,
    campaignTitle: data.campaignTitle || undefined,
    campaignSummary: data.campaignSummary || undefined,
    contactMode: data.contactMode || ((data.contactPhone || data.contactLine) ? 'phone_or_line' : 'in_app'),
    sourceText: data.sourceText || undefined,
    sourceChannel: data.sourceChannel || undefined,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    boostedAt: data.boostedAt?.toDate?.() ?? null,
    expiresAt: data.expiresAt?.toDate?.() ?? null,
    status: data.status || 'active',
    isUrgent: data.isUrgent || false,
    viewsCount: data.viewsCount || 0,
    applicantsCount: data.applicantsCount || 0,
  } as JobPost;
}

function getJobSortTime(job: JobPost): number {
  const updatedAt = job.updatedAt instanceof Date ? job.updatedAt : job.updatedAt ? new Date(job.updatedAt as any) : null;
  const createdAt = job.createdAt instanceof Date ? job.createdAt : new Date(job.createdAt as any);
  return (updatedAt?.getTime() || 0) || createdAt.getTime();
}

function sortJobsByVisibility(jobs: JobPost[]): JobPost[] {
  return [...jobs].sort((a, b) => {
    const aTime = getJobSortTime(a);
    const bTime = getJobSortTime(b);
    if (bTime !== aTime) return bTime - aTime;
    const aUrgent = a.status === 'urgent' || a.isUrgent ? 1 : 0;
    const bUrgent = b.status === 'urgent' || b.isUrgent ? 1 : 0;
    return bUrgent - aUrgent;
  });
}

async function enrichJobsWithPosterMetadata(jobs: JobPost[]): Promise<JobPost[]> {
  const posterIds = [...new Set(jobs.filter((job) => job.posterId).map((job) => job.posterId))];

  if (posterIds.length === 0) return jobs;

  const posterEntries = await Promise.all(
    posterIds.map(async (posterId) => {
      const cached = posterMetadataCache.get(posterId);
      if (cached && cached.expiresAt > Date.now()) {
        return [posterId, cached.value] as const;
      }

      try {
        const posterDoc = await getDoc(doc(db, 'users', posterId));
        if (!posterDoc.exists()) {
          posterMetadataCache.set(posterId, {
            value: null,
            expiresAt: Date.now() + POSTER_METADATA_CACHE_TTL_MS,
          });
          return [posterId, null] as const;
        }
        const posterData = posterDoc.data();
        const metadata: PosterMetadata = {
          role: posterData.role,
          orgType: posterData.orgType,
          staffType: posterData.staffType,
          staffTypes: Array.isArray(posterData.staffTypes) ? posterData.staffTypes : [],
          isVerified: Boolean(posterData.isVerified),
          plan: posterData.subscription?.plan,
          adminTags: Array.isArray(posterData.adminTags) ? posterData.adminTags : [],
          adminWarningTag: typeof posterData.adminWarningTag === 'string' ? posterData.adminWarningTag : undefined,
        };
        posterMetadataCache.set(posterId, {
          value: metadata,
          expiresAt: Date.now() + POSTER_METADATA_CACHE_TTL_MS,
        });
        return [posterId, metadata] as const;
      } catch {
        posterMetadataCache.set(posterId, {
          value: null,
          expiresAt: Date.now() + 30_000,
        });
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
      posterStaffTypes: job.posterStaffTypes?.length ? job.posterStaffTypes : poster.staffTypes,
      posterVerified: job.posterVerified ?? poster.isVerified,
      posterPlan: job.posterPlan || poster.plan,
      posterAdminTags: poster.adminTags,
      posterWarningTag: poster.adminWarningTag,
    };
  });
}

async function getPosterPostingState(posterId: string): Promise<{ canPost: boolean; reason?: string }> {
  try {
    const posterDoc = await getDoc(doc(db, 'users', posterId));
    if (!posterDoc.exists()) {
      return { canPost: false, reason: 'ไม่พบบัญชีผู้โพสต์' };
    }

    const posterData = posterDoc.data();
    if (posterData.isActive === false) {
      return { canPost: false, reason: 'บัญชีนี้ถูกระงับการใช้งานโดยผู้ดูแลระบบ' };
    }

    if (posterData.postingSuspended === true) {
      return {
        canPost: false,
        reason: posterData.postingSuspendedReason || 'บัญชีนี้ถูกระงับการโพสต์โดยผู้ดูแลระบบ',
      };
    }

    return { canPost: true };
  } catch {
    return { canPost: false, reason: 'ไม่สามารถตรวจสอบสิทธิ์การโพสต์ได้ กรุณาลองใหม่' };
  }
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
export function subscribeToJobs(
  callback: (jobs: JobPost[]) => void,
  metrics?: PerformanceMetricOptions,
): () => void {
  const jobsQuery = query(
    collection(db, JOBS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(PAGE_SIZE * 3)
  );

  const endMetric = beginTrackedSubscription({
    screenName: metrics?.screenName,
    source: metrics?.source || 'jobs:feed',
  });

  const unsubscribe = onSnapshot(jobsQuery, (snapshot) => {
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: `${metrics?.source || 'jobs:feed'}:snapshot`,
    });

    const jobs = snapshot.docs
      .map(mapDocToJob)
      .filter(isActivePost);

    console.log(`[subscribeToJobs] ${jobs.length} active jobs from Firestore`);

    enrichJobsWithPosterMetadata(jobs)
      .then((enrichedJobs) => callback(sortJobsByVisibility(enrichedJobs)))
      .catch(() => callback(sortJobsByVisibility(jobs)));
  }, (error) => {
    // ถ้า permission-denied → ไม่ต้อง callback และไม่ต้อง log error spam
    if ((error as any)?.code === 'permission-denied') {
      console.warn('[subscribeToJobs] Not signed in — skipping job subscription');
      return;
    }
    console.error('[subscribeToJobs] Firestore error:', error);
    callback([]);
  });

  return () => {
    endMetric();
    unsubscribe();
  };
}

// Get active jobs with optional filters + pagination cursor
export async function getJobs(
  filters?: JobFilters,
  cursor?: DocumentSnapshot,
  pageSize = PAGE_SIZE,
  metrics?: PerformanceMetricOptions,
): Promise<{ jobs: JobPost[]; lastDoc: DocumentSnapshot | null }> {
  try {
    let jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(pageSize * 3),
    );

    if (cursor) {
      jobsQuery = query(jobsQuery, startAfter(cursor));
    }

    const snapshot = await getDocs(jobsQuery);
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: metrics?.source || 'jobs:get',
    });
    let jobs = snapshot.docs.map(mapDocToJob).filter(isActivePost);
    jobs = sortJobsByVisibility(await enrichJobsWithPosterMetadata(jobs));

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

    jobs = jobs.slice(0, pageSize);

    const lastDoc = snapshot.docs.length > 0
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
  metrics?: PerformanceMetricOptions,
): Promise<JobPost[]> {
  try {
    const geohashes = getQueryGeohashes(lat, lng, radiusKm);
    const jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('geohash', 'in', geohashes),
      limit(PAGE_SIZE * 4),
    );
    const snapshot = await getDocs(jobsQuery);
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: metrics?.source || 'jobs:nearby',
    });
    let jobs = snapshot.docs.map(mapDocToJob).filter(isActivePost);
    jobs = jobs.filter((job) => {
      if (job.lat == null || job.lng == null) return false;
      return getDistanceKm(lat, lng, job.lat, job.lng) <= radiusKm;
    });
    jobs = await enrichJobsWithPosterMetadata(jobs);

    // เรียงตามระยะทางจริงโดยใช้ Haversine
    jobs.sort((a, b) => {
      const boostedDiff = getJobSortTime(b) - getJobSortTime(a);
      if (boostedDiff !== 0) return boostedDiff;
      const da = a.lat && a.lng ? getDistanceKm(lat, lng, a.lat, a.lng) : 9999;
      const db2 = b.lat && b.lng ? getDistanceKm(lat, lng, b.lat, b.lng) : 9999;
      return da - db2;
    });

    return jobs.slice(0, PAGE_SIZE);
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

  const externalSignals = detectExternalContactSignals(`${jobData.title || ''}\n${jobData.description || ''}\n${jobData.sourceText || ''}`);
  if (externalSignals.hasExternalContact) {
    warnings.push('พบเบอร์โทร, LINE หรือ link ในเนื้อหาโพสต์ แนะนำย้ายไปไว้ในช่องติดต่อเพื่อให้ประกาศอ่านง่ายขึ้น');
  }

  if (jobData.contactMode === 'in_app' && externalSignals.hasExternalContact) {
    blocked = true;
    reason = 'โพสต์นี้เลือกเริ่มคุยผ่านแอปก่อน กรุณาย้ายเบอร์หรือ LINE ไปไว้ในช่องติดต่อ แล้วลองโพสต์อีกครั้ง';
  }

  return { valid: !blocked, warnings, blocked, reason };
}

// Create new job post
export async function createJob(jobData: Partial<JobPost>): Promise<string> {
  try {
    const currentUser = assertAuthUser(jobData.posterId, 'ไม่สามารถยืนยันตัวตนผู้โพสต์ได้ กรุณาเข้าสู่ระบบใหม่');
    const postingState = await getPosterPostingState(jobData.posterId || currentUser.uid);
    if (!postingState.canPost) {
      throw new Error(postingState.reason || 'บัญชีนี้ถูกระงับการโพสต์');
    }

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

    const targetStatus = updates.status || data.status;
    if (targetStatus === 'active' || targetStatus === 'urgent') {
      const postingState = await getPosterPostingState(currentUser.uid);
      if (!postingState.canPost) {
        throw new Error(postingState.reason || 'บัญชีนี้ถูกระงับการโพสต์');
      }
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
export async function getUserPosts(userId: string, metrics?: PerformanceMetricOptions): Promise<JobPost[]> {
  try {
    const jobsQuery = query(
      collection(db, JOBS_COLLECTION),
      where('posterId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(jobsQuery);
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: metrics?.source || 'jobs:user_posts',
    });
    const jobs = snapshot.docs.map(mapDocToJob);
    return sortJobsByVisibility(await enrichJobsWithPosterMetadata(jobs));
  } catch (error) {
    console.error('[getUserPosts] error:', error);
    return [];
  }
}

// Subscribe to user's posts in real-time
export function subscribeToUserPosts(
  userId: string,
  callback: (posts: JobPost[]) => void,
  metrics?: PerformanceMetricOptions,
): () => void {
  const postsQuery = query(
    collection(db, JOBS_COLLECTION),
    where('posterId', '==', userId),
    orderBy('createdAt', 'desc'),
  );

  const endMetric = beginTrackedSubscription({
    screenName: metrics?.screenName,
    source: metrics?.source || 'jobs:user_posts_subscription',
  });

  const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: `${metrics?.source || 'jobs:user_posts_subscription'}:snapshot`,
    });
    const jobs = snapshot.docs.map(mapDocToJob);
    enrichJobsWithPosterMetadata(jobs)
      .then((enrichedJobs) => callback(sortJobsByVisibility(enrichedJobs)))
      .catch(() => callback(sortJobsByVisibility(jobs)));
  }, (error) => {
    console.error('[subscribeToUserPosts] error:', error);
    callback([]);
  });

  return () => {
    endMetric();
    unsubscribe();
  };
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
    if (status === 'active' || status === 'urgent') {
      const postingState = await getPosterPostingState(currentUser.uid);
      if (!postingState.canPost) {
        throw new Error(postingState.reason || 'บัญชีนี้ถูกระงับการโพสต์');
      }
    }
    await updateDoc(docRef, {
      status,
      isUrgent: status === 'urgent',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating job status:', error);
    throw error;
  }
}

export async function boostJobPost(jobId: string): Promise<Date> {
  try {
    const currentUser = assertAuthUser();
    const docRef = doc(db, JOBS_COLLECTION, jobId);
    const currentDoc = await getDoc(docRef);
    if (!currentDoc.exists()) throw new Error('ไม่พบประกาศนี้');

    const data = currentDoc.data();
    if (data.posterId !== currentUser.uid) {
      throw new Error('ไม่มีสิทธิ์ดันประกาศนี้');
    }

    const boostedAt = new Date();
    await updateDoc(docRef, {
      boostedAt,
      updatedAt: boostedAt,
    });
    return boostedAt;
  } catch (error) {
    console.error('Error boosting job:', error);
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

