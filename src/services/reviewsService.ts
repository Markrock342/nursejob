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
  documentId,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { assertAuthUser } from './security/authGuards';
import { getJobById } from './jobService';

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
  relatedJobId?: string;
  relatedJobTitle?: string;
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
    isVerified?: boolean;
  }
): Promise<string> {
  try {
    assertAuthUser(userId, 'ไม่สามารถรีวิวแทนผู้ใช้อื่นได้');

    const targetType = options?.targetType || 'hospital';
    const targetId = hospitalId;

    // Check if user already reviewed this hospital
    const existing = await getUserReviewForTarget(userId, targetId, targetType);
    if (existing) {
      throw new Error('คุณได้รีวิวโรงพยาบาลนี้แล้ว');
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
      isVerified: options?.isVerified ?? false,
      helpful: 0,
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
  targetType: ReviewTargetType = 'hospital'
): Promise<Review | null> {
  try {
    const reviewerQuery = query(
      collection(db, REVIEWS_COLLECTION),
      where('reviewerId', '==', userId),
      where(targetType === 'hospital' ? 'hospitalId' : 'revieweeId', '==', targetId)
    );
    let snapshot = await getDocs(reviewerQuery);

    // Backward compatibility for old docs that used userId instead of reviewerId
    if (snapshot.empty) {
      const legacyQuery = query(
        collection(db, REVIEWS_COLLECTION),
        where('userId', '==', userId),
        where(targetType === 'hospital' ? 'hospitalId' : 'revieweeId', '==', targetId)
      );
      snapshot = await getDocs(legacyQuery);
    }
    
    if (snapshot.empty) return null;
    
    return toReview(snapshot.docs[0]);
  } catch (error) {
    console.error('Error getting user review:', error);
    return null;
  }
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
): Promise<ReviewEligibility> {
  try {
    assertAuthUser(currentUserId, 'ไม่สามารถตรวจสอบสิทธิ์รีวิวได้');

    const [asWorkerSnap, asPosterSnap] = await Promise.all([
      getDocs(query(
        collection(db, 'shift_contacts'),
        where('interestedUserId', '==', currentUserId),
        where('status', '==', 'confirmed')
      )),
      getDocs(query(
        collection(db, 'shift_contacts'),
        where('posterId', '==', currentUserId),
        where('status', '==', 'confirmed')
      )),
    ]);

    const candidateDocs = [
      ...asWorkerSnap.docs.filter((docSnap) => docSnap.data().posterId === targetUserId),
      ...asPosterSnap.docs.filter((docSnap) => docSnap.data().interestedUserId === targetUserId),
    ];

    for (const docSnap of candidateDocs) {
      const data = docSnap.data();
      const job = data.jobId ? await getJobById(data.jobId) : null;
      const now = new Date();
      const expired = Boolean(job?.expiresAt && new Date(job.expiresAt as any) < now);
      const completed = !job || job.status === 'closed' || job.status === 'expired' || job.status === 'deleted' || expired;
      if (completed) {
        return {
          canReview: true,
          isVerified: true,
          relatedJobId: data.jobId,
          relatedJobTitle: job?.title,
        };
      }
    }

    return { canReview: false, isVerified: false };
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
export async function markReviewHelpful(reviewId: string): Promise<void> {
  try {
    await updateDoc(doc(db, REVIEWS_COLLECTION, reviewId), {
      helpful: increment(1),
    });
  } catch (error) {
    console.error('Error marking review helpful:', error);
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
