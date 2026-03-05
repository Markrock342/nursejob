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
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { JobPost } from '../types';
import { getJobById } from './jobService';

const FAVORITES_COLLECTION = 'favorites';

export interface Favorite {
  id: string;
  userId: string;
  jobId: string;
  createdAt: Date;
  job?: JobPost;
}

// Add job to favorites
export async function addToFavorites(userId: string, jobId: string): Promise<string> {
  try {
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
export async function getUserFavorites(userId: string): Promise<Favorite[]> {
  if (!getAuth().currentUser) return [];
  try {
    const q = query(
      collection(db, FAVORITES_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    const favorites: Favorite[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const job = await getJobById(data.jobId);
      
      favorites.push({
        id: docSnap.id,
        userId: data.userId,
        jobId: data.jobId,
        createdAt: data.createdAt?.toDate() || new Date(),
        job: job || undefined,
      });
    }
    
    return favorites.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
}

// Subscribe to favorites changes
export function subscribeToFavorites(
  userId: string,
  callback: (favorites: Favorite[]) => void
): () => void {
  const q = query(
    collection(db, FAVORITES_COLLECTION),
    where('userId', '==', userId)
  );
  
  return onSnapshot(q, async (snapshot) => {
    const favorites: Favorite[] = [];
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const job = await getJobById(data.jobId);
      
      favorites.push({
        id: docSnap.id,
        userId: data.userId,
        jobId: data.jobId,
        createdAt: data.createdAt?.toDate() || new Date(),
        job: job || undefined,
      });
    }
    
    callback(favorites.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
  }, (error) => {
    console.warn('Favorites listener error (auth not ready?):', error.code);
  });
}

// Get favorites count
export async function getFavoritesCount(userId: string): Promise<number> {
  if (!getAuth().currentUser) return 0;
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
