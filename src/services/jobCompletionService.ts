import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db, firebaseConfig } from '../config/firebase';
import { JobCompletion } from '../types';
import { assertAuthUser, isAuthUser, waitForAuthUser } from './security/authGuards';

const COMPLETIONS_COLLECTION = 'job_completions';

/**
 * Get the last (latest) work date from a job document.
 * Returns null for job-type posts that only have startDateNote.
 */
function getLastShiftDate(jobData: any): Date | null {
  // Multi-date: shiftDates array of ISO strings
  if (Array.isArray(jobData.shiftDates) && jobData.shiftDates.length > 0) {
    const dates = jobData.shiftDates
      .map((d: string) => new Date(d))
      .filter((d: Date) => !isNaN(d.getTime()));
    if (dates.length > 0) {
      return dates.reduce((latest: Date, d: Date) => d > latest ? d : latest);
    }
  }

  if (jobData.shiftTimeSlots && typeof jobData.shiftTimeSlots === 'object') {
    const dates = Object.keys(jobData.shiftTimeSlots)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));
    if (dates.length > 0) {
      return dates.reduce((latest: Date, d: Date) => d > latest ? d : latest);
    }
  }

  // End date for homecare
  if (jobData.shiftDateEnd) {
    const end = jobData.shiftDateEnd instanceof Date
      ? jobData.shiftDateEnd
      : jobData.shiftDateEnd?.toDate?.() || new Date(jobData.shiftDateEnd);
    if (!isNaN(end.getTime())) return end;
  }

  // Single shiftDate
  if (jobData.shiftDate) {
    const d = jobData.shiftDate instanceof Date
      ? jobData.shiftDate
      : jobData.shiftDate?.toDate?.() || new Date(jobData.shiftDate);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export interface CompleteJobAssignmentResult {
  completionId: string;
  jobId: string;
  jobTitle?: string;
  targetUserId: string;
  targetUserName?: string;
  targetUserPhoto?: string;
}

function mapCompletionDoc(docSnap: any): JobCompletion {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    ...data,
    completedAt: (data.completedAt as Timestamp)?.toDate?.() || new Date(),
  } as JobCompletion;
}

export async function completeJobAssignment(
  jobId: string,
  selectedApplicationId: string,
): Promise<CompleteJobAssignmentResult> {
  assertAuthUser();
  const authUser = await waitForAuthUser();
  const projectId = firebaseConfig.projectId;

  if (!projectId) {
    throw new Error('Firebase project ยังไม่ถูกตั้งค่า');
  }

  const idToken = await authUser.getIdToken();
  const response = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/completeJobAssignmentHttp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      data: {
        jobId,
        selectedApplicationId,
      },
    }),
  });

  const responseText = await response.text();
  const payload = responseText ? JSON.parse(responseText) : null;

  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.message || `ไม่สามารถปิดงานและเลือกผู้ถูกจ้างได้ (${response.status})`);
  }

  return (payload?.result || payload?.data) as CompleteJobAssignmentResult;
}

export async function getJobCompletionById(completionId: string): Promise<JobCompletion | null> {
  try {
    const docSnap = await getDoc(doc(db, COMPLETIONS_COLLECTION, completionId));
    if (!docSnap.exists()) return null;
    return mapCompletionDoc(docSnap);
  } catch (error) {
    console.error('Error getting job completion:', error);
    return null;
  }
}

export async function getUserJobCompletions(userId: string): Promise<JobCompletion[]> {
  try {
    if (!isAuthUser(userId)) return [];
    const q = query(collection(db, COMPLETIONS_COLLECTION), where('participantIds', 'array-contains', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map(mapCompletionDoc)
      .sort((a, b) => {
        const aTime = a.completedAt instanceof Date ? a.completedAt.getTime() : 0;
        const bTime = b.completedAt instanceof Date ? b.completedAt.getTime() : 0;
        return bTime - aTime;
      });
  } catch (error) {
    console.error('Error getting user completions:', error);
    return [];
  }
}