// ============================================
// REVIEWS SERVICE - Production Ready
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { assertAuthUser } from './security/authGuards';
import { getJobCompletionById, getUserJobCompletions } from './jobCompletionService';

const REVIEWS_COLLECTION = 'reviews';
const HOSPITALS_COLLECTION = 'hospitals';

export interface Review {
  id: string;
  hospitalId: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  rating: number; // 1-5
  title: string;
  content: string;
  pros?: string; // ข้อดี
  cons?: string; // ข้อเสีย
  wouldRecommend: boolean;
  isVerified: boolean; // เคยทำงานจริงหรือเปล่า
  helpful: number; // จำนวนคนที่กด helpful
  helpfulVoterIds?: string[];
  createdAt: Date;
  updatedAt?: Date;
  response?: {
    content: string;
    respondedAt: Date;
  };
}

export interface HospitalRating {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export type ReviewTargetType = 'hospital' | 'user';

export interface ReviewEligibility {
  canReview: boolean;
  isVerified: boolean;
  completionId?: string;
  relatedJobId?: string;
  relatedJobTitle?: string;
}

interface ReviewLookupOptions {
  relatedJobId?: string;
  completionId?: string;
}

function getEmploymentTargetId(targetId: string, targetType: ReviewTargetType) {
  return targetType === 'hospital' ? { hospitalId: targetId, targetId } : { revieweeId: targetId, targetId };
}

function getTargetNameFromDoc(data: any): string {
  return data.targetName || data.hospitalName || data.revieweeName || '';
}

function toReview(docSnap: any): Review {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    hospitalId: data.hospitalId || data.targetId || data.revieweeId,
    createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate(),
    response: data.response ? {
      ...data.response,
      respondedAt: data.response.respondedAt?.toDate(),
    } : undefined,
  } as Review;
}

// Create review
export async function createReview(
  hospitalId: string,
  userId: string,
  userName: string,
  rating: number,
  title: string,
  content: string,
  options?: {
    pros?: string;
    cons?: string;
    wouldRecommend?: boolean;
    userPhotoURL?: string;
    targetType?: ReviewTargetType;
    targetName?: string;
    relatedJobId?: string;
    completionId?: string;
    isVerified?: boolean;
  }
): Promise<string> {
  try {
    assertAuthUser(userId, 'ไม่สามารถรีวิวแทนผู้ใช้อื่นได้');

    const targetType = options?.targetType || 'hospital';
    const targetId = hospitalId;

    if (targetId === userId) {
      throw new Error('ไม่สามารถรีวิวตัวเองได้');
    }

    const eligibility = await canUserReviewTarget(userId, targetId, options?.completionId);
    if (!eligibility.canReview) {
      throw new Error('ยังไม่มีสิทธิ์รีวิวนี้ ต้องมีงานที่ยืนยันและจบงานจริงก่อน');
    }

    // Check if user already reviewed this hospital
    const existing = await getUserReviewForTarget(userId, targetId, targetType, {
      relatedJobId: options?.relatedJobId,
      completionId: options?.completionId,
    });
    if (existing) {
      throw new Error(targetType === 'user' ? 'คุณได้รีวิวงานนี้ไปแล้ว' : 'คุณได้รีวิวสถานที่นี้แล้ว');
    }

    const docRef = await addDoc(collection(db, REVIEWS_COLLECTION), {
      ...getEmploymentTargetId(targetId, targetType),
      targetType,
      targetName: options?.targetName || null,
      hospitalId: targetType === 'hospital' ? targetId : null,
      reviewerId: userId,
      userId,
      userName,
      userPhotoURL: options?.userPhotoURL || null,
      revieweeId: targetType === 'user' ? targetId : null,
      rating,
      title,
      content,
      pros: options?.pros || null,
      cons: options?.cons || null,
      wouldRecommend: options?.wouldRecommend ?? true,
      relatedJobId: options?.relatedJobId || null,
      completionId: options?.completionId || null,
      isVerified: options?.isVerified ?? false,
      helpful: 0,
      helpfulVoterIds: [],
      createdAt: serverTimestamp(),
    });

    // Update hospital rating
    if (targetType === 'hospital') {
      await updateHospitalRating(targetId);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating review:', error);
    throw error;
  }
}

// Get reviews for hospital
export async function getHospitalReviews(hospitalId: string): Promise<Review[]> {
  try {
    return getReviewsForTarget(hospitalId, 'hospital');
  } catch (error) {
    console.error('Error getting reviews:', error);
    return [];
  }
}

// Get user's review for a hospital
export async function getUserReviewForHospital(
  userId: string,
  hospitalId: string
): Promise<Review | null> {
  return getUserReviewForTarget(userId, hospitalId, 'hospital');
}

export async function getUserReviewForTarget(
  userId: string,
  targetId: string,
  targetType: ReviewTargetType = 'hospital',
  options?: ReviewLookupOptions,
): Promise<Review | null> {
  try {
    const fieldName = targetType === 'hospital' ? 'hospitalId' : 'revieweeId';
    const reviewerQuery = query(
      collection(db, REVIEWS_COLLECTION),
      where('reviewerId', '==', userId),
      where(fieldName, '==', targetId)
    );
    let docs = (await getDocs(reviewerQuery)).docs;

    if (docs.length === 0) {
      const legacyQuery = query(
        collection(db, REVIEWS_COLLECTION),
        where('userId', '==', userId),
        where(fieldName, '==', targetId)
      );
      docs = (await getDocs(legacyQuery)).docs;
    }

    if (options?.completionId) {
      docs = docs.filter((docSnap) => docSnap.data()?.completionId === options.completionId);
    }
    if (options?.relatedJobId) {
      docs = docs.filter((docSnap) => docSnap.data()?.relatedJobId === options.relatedJobId);
    }

    if (docs.length === 0) return null;

    docs.sort((a, b) => {
      const aTime = (a.data().createdAt as Timestamp)?.toDate?.()?.getTime?.() || 0;
      const bTime = (b.data().createdAt as Timestamp)?.toDate?.()?.getTime?.() || 0;
      return bTime - aTime;
    });

    return toReview(docs[0]);
  } catch (error) {
    console.error('Error getting user review:', error);
    return null;
  }
}

async function findEligibleCompletionReview(
  currentUserId: string,
  targetUserId: string,
  completionId?: string,
): Promise<ReviewEligibility> {
  const targetCompletion = completionId
    ? await getJobCompletionById(completionId)
    : null;

  const completions = targetCompletion
    ? [targetCompletion]
    : await getUserJobCompletions(currentUserId);

  for (const completion of completions) {
    if (!completion || completion.status !== 'completed') continue;
    if (!completion.participantIds?.includes(currentUserId) || !completion.participantIds?.includes(targetUserId)) continue;

    const existingReview = await getUserReviewForTarget(currentUserId, targetUserId, 'user', {
      completionId: completion.id,
      relatedJobId: completion.jobId,
    });

    if (existingReview) continue;

    return {
      canReview: true,
      isVerified: true,
      completionId: completion.id,
      relatedJobId: completion.jobId,
      relatedJobTitle: completion.jobTitle,
    };
  }

  return { canReview: false, isVerified: false };
}

export async function getReviewsForTarget(
  targetId: string,
  targetType: ReviewTargetType = 'hospital'
): Promise<Review[]> {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where(targetType === 'hospital' ? 'hospitalId' : 'revieweeId', '==', targetId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(toReview);
  } catch (error) {
    console.error('Error getting reviews for target:', error);
    return [];
  }
}

export async function getTargetRating(
  targetId: string,
  targetType: ReviewTargetType = 'hospital'
): Promise<HospitalRating> {
  try {
    const reviews = await getReviewsForTarget(targetId, targetType);
    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    reviews.forEach(review => {
      sum += review.rating;
      breakdown[review.rating as 1 | 2 | 3 | 4 | 5]++;
    });

    return {
      averageRating: reviews.length > 0 ? Math.round((sum / reviews.length) * 10) / 10 : 0,
      totalReviews: reviews.length,
      ratingBreakdown: breakdown,
    };
  } catch (error) {
    console.error('Error getting target rating:', error);
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }
}

export async function canUserReviewTarget(
  currentUserId: string,
  targetUserId: string,
  completionId?: string,
): Promise<ReviewEligibility> {
  try {
    assertAuthUser(currentUserId, 'ไม่สามารถตรวจสอบสิทธิ์รีวิวได้');
    return await findEligibleCompletionReview(currentUserId, targetUserId, completionId);
  } catch (error) {
    console.error('Error checking review eligibility:', error);
    return { canReview: false, isVerified: false };
  }
}

// Get all reviews by user
export async function getUserReviews(userId: string): Promise<Review[]> {
  try {
    const q = query(
      collection(db, REVIEWS_COLLECTION),
      where('reviewerId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Review[];
  } catch (error) {
    console.error('Error getting user reviews:', error);
    return [];
  }
}

// Update review
export async function updateReview(
  reviewId: string,
  updates: Partial<Pick<Review, 'rating' | 'title' | 'content' | 'pros' | 'cons' | 'wouldRecommend'>>
): Promise<void> {
  try {
    const reviewDoc = await getDoc(doc(db, REVIEWS_COLLECTION, reviewId));
    if (!reviewDoc.exists()) throw new Error('Review not found');
    
    await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // Update hospital rating if rating changed
    if (updates.rating) {
      await updateHospitalRating(reviewDoc.data().hospitalId);
    }
  } catch (error) {
    console.error('Error updating review:', error);
    throw error;
  }
}

// Delete review
export async function deleteReview(reviewId: string): Promise<void> {
  try {
    const reviewDoc = await getDoc(doc(db, REVIEWS_COLLECTION, reviewId));
    if (!reviewDoc.exists()) throw new Error('Review not found');
    
    const hospitalId = reviewDoc.data().hospitalId;
    
    await deleteDoc(doc(db, REVIEWS_COLLECTION, reviewId));
    
    // Update hospital rating
    await updateHospitalRating(hospitalId);
  } catch (error) {
    console.error('Error deleting review:', error);
    throw error;
  }
}

// Mark review as helpful
export async function markReviewHelpful(reviewId: string, userId: string): Promise<boolean> {
  try {
    assertAuthUser(userId, 'ไม่สามารถกดรีวิวนี้ว่ามีประโยชน์แทนผู้ใช้อื่นได้');

    return await runTransaction(db, async (transaction) => {
      const reviewRef = doc(db, REVIEWS_COLLECTION, reviewId);
      const reviewSnap = await transaction.get(reviewRef);

      if (!reviewSnap.exists()) {
        throw new Error('ไม่พบรีวิวนี้');
      }

      const reviewData = reviewSnap.data() || {};
      const helpfulVoterIds = Array.isArray(reviewData.helpfulVoterIds) ? reviewData.helpfulVoterIds : [];

      if (reviewData.reviewerId === userId) {
        throw new Error('ไม่สามารถกดมีประโยชน์ให้รีวิวของตัวเองได้');
      }

      if (helpfulVoterIds.includes(userId)) {
        return false;
      }

      transaction.update(reviewRef, {
        helpful: Number(reviewData.helpful || 0) + 1,
        helpfulVoterIds: [...helpfulVoterIds, userId],
      });

      return true;
    });
  } catch (error) {
    console.error('Error marking review helpful:', error);
    throw error;
  }
}

// Hospital responds to review
export async function respondToReview(
  reviewId: string,
  responseContent: string
): Promise<void> {
  try {
    await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), {
      response: {
        content: responseContent,
        respondedAt: serverTimestamp(),
      },
    });
  } catch (error) {
    console.error('Error responding to review:', error);
    throw error;
  }
}

// Calculate and update hospital rating
async function updateHospitalRating(hospitalId: string): Promise<void> {
  try {
    const reviews = await getHospitalReviews(hospitalId);
    
    if (reviews.length === 0) {
      await updateDoc(doc(db, HOSPITALS_COLLECTION, hospitalId), {
        rating: {
          average: 0,
          count: 0,
        },
      });
      return;
    }

    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / reviews.length;

    await updateDoc(doc(db, HOSPITALS_COLLECTION, hospitalId), {
      rating: {
        average: Math.round(average * 10) / 10,
        count: reviews.length,
      },
    });
  } catch (error) {
    console.error('Error updating hospital rating:', error);
  }
}

// Get hospital rating summary
export async function getHospitalRating(hospitalId: string): Promise<HospitalRating> {
  return getTargetRating(hospitalId, 'hospital');
}
