// ============================================
// FAVORITES SERVICE - Production Ready
// ============================================

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  documentId,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { JobPost } from '../types';
import { assertAuthUser, isAuthUser } from './security/authGuards';
import { beginTrackedSubscription, PerformanceMetricOptions, recordQueryRead } from './performanceMetrics';

const FAVORITES_COLLECTION = 'favorites';
const FAVORITES_JOB_BATCH_SIZE = 10;

export interface Favorite {
  id: string;
  userId: string;
  jobId: string;
  createdAt: Date;
  job?: JobPost;
}

async function getJobsByIds(jobIds: string[], metrics?: PerformanceMetricOptions): Promise<Map<string, JobPost>> {
  const jobMap = new Map<string, JobPost>();
  const uniqueJobIds = [...new Set(jobIds.filter(Boolean))];

  for (let index = 0; index < uniqueJobIds.length; index += FAVORITES_JOB_BATCH_SIZE) {
    const batchIds = uniqueJobIds.slice(index, index + FAVORITES_JOB_BATCH_SIZE);
    if (batchIds.length === 0) continue;

    const snapshot = await getDocs(
      query(collection(db, 'shifts'), where(documentId(), 'in', batchIds))
    );
    recordQueryRead(snapshot.size, {
      screenName: metrics?.screenName,
      source: `${metrics?.source || 'favorites'}:jobs_batch`,
    });

    snapshot.docs.forEach((jobDoc) => {
      const data = jobDoc.data();
      jobMap.set(jobDoc.id, {
        id: jobDoc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.(),
        shiftDate: data.shiftDate?.toDate?.() || data.shiftDate,
        expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
      } as JobPost);
    });
  }

  return jobMap;
}

async function buildFavorites(snapshot: any, metrics?: PerformanceMetricOptions): Promise<Favorite[]> {
  recordQueryRead(snapshot.size, {
    screenName: metrics?.screenName,
    source: `${metrics?.source || 'favorites'}:favorites_docs`,
  });

  const docs = snapshot.docs;
  const jobMap = await getJobsByIds(
    docs.map((docSnap: any) => docSnap.data().jobId),
    metrics,
  );

  return docs
    .map((docSnap: any) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userId: data.userId,
        jobId: data.jobId,
        createdAt: data.createdAt?.toDate() || new Date(),
        job: jobMap.get(data.jobId),
      } as Favorite;
    })
    .sort((a: Favorite, b: Favorite) => b.createdAt.getTime() - a.createdAt.getTime());
}

// Add job to favorites
export async function addToFavorites(userId: string, jobId: string): Promise<string> {
  try {
    assertAuthUser(userId, 'ไม่สามารถบันทึกรายการโปรดแทนผู้ใช้อื่นได้');

    // Check if already favorited
    const existing = await getFavoriteByJobId(userId, jobId);
    if (existing) {
      return existing.id;
    }

    const docRef = await addDoc(collection(db, FAVORITES_COLLECTION), {
      userId,
      jobId,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

// Remove from favorites
export async function removeFromFavorites(userId: string, jobId: string): Promise<void> {
  try {
    assertAuthUser(userId, 'ไม่สามารถลบรายการโปรดแทนผู้ใช้อื่นได้');

    const favorite = await getFavoriteByJobId(userId, jobId);
    if (favorite) {
      await deleteDoc(doc(db, FAVORITES_COLLECTION, favorite.id));
    }
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

// Get favorite by job ID
export async function getFavoriteByJobId(userId: string, jobId: string): Promise<Favorite | null> {
  try {
    if (!isAuthUser(userId)) return null;

    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId),
      where('jobId', '==', jobId)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return null;
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    } as Favorite;
  } catch (error) {
    console.error('Error getting favorite:', error);
    return null;
  }
}

// Check if job is favorited
export async function isFavorited(userId: string, jobId: string): Promise<boolean> {
  const favorite = await getFavoriteByJobId(userId, jobId);
  return favorite !== null;
}

// Toggle favorite (add or remove)
export async function toggleFavorite(userId: string, jobId: string): Promise<boolean> {
  try {
    const isFav = await isFavorited(userId, jobId);
    if (isFav) {
      await removeFromFavorites(userId, jobId);
      return false;
    } else {
      await addToFavorites(userId, jobId);
      return true;
    }
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
}

// Get all user favorites with job details
export async function getUserFavorites(userId: string, metrics?: PerformanceMetricOptions): Promise<Favorite[]> {
  if (!isAuthUser(userId)) return [];
  try {
    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);

    return buildFavorites(snapshot, metrics);
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
}

// Subscribe to favorites changes
export function subscribeToFavorites(
  userId: string,
  callback: (favorites: Favorite[]) => void,
  metrics?: PerformanceMetricOptions
): () => void {
  if (!isAuthUser(userId)) {
    callback([]);
    return () => {};
  }
  const q = query(
    collection(db, FAVORITES_COLLECTION),
    where('userId', '==', userId)
  );
  
  const endMetric = beginTrackedSubscription({
    screenName: metrics?.screenName,
    source: metrics?.source || 'favorites:subscription',
  });

  const unsubscribe = onSnapshot(q, async (snapshot) => {
    callback(await buildFavorites(snapshot, metrics));
  }, (error) => {
    console.warn('Favorites listener error (auth not ready?):', error.code);
  });

  return () => {
    endMetric();
    unsubscribe();
  };
}

// Get favorites count
export async function getFavoritesCount(userId: string): Promise<number> {
  if (!isAuthUser(userId)) return 0;
  try {
    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch {
    // Permission error during auth state transition — harmless
    return 0;
  }
}
