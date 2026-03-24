import {
  addDoc,
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { assertAuthUser, isAuthUser } from './security/authGuards';
import { getJobs } from './jobService';
import { JobPost, NurseScheduleEntry, NurseScheduleEntryDraft, PostShift, ShiftContact } from '../types';

const NURSE_SCHEDULE_COLLECTION = 'nurse_schedule_entries';
const SHIFT_CONTACTS_COLLECTION = 'shift_contacts';
const SHIFTS_COLLECTION = 'shifts';

type ScheduleSubscriber = (entries: NurseScheduleEntry[]) => void;
type ErrorSubscriber = (error: unknown) => void;

function toDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function buildMonthRange(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function hasTimeOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function combineDateAndTime(dateKey: string, timeText: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = timeText.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function parseShiftTimeRange(shiftTime?: string): { startTime: string; endTime: string } | null {
  if (!shiftTime || !shiftTime.includes('-')) return null;
  const [startTime, endTime] = shiftTime.split('-').map((item) => item.trim());
  if (!startTime || !endTime) return null;
  return { startTime, endTime };
}

function formatTimeText(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function getMonthDatesMatchingWeekday(sourceDate: Date): Date[] {
  const dates: Date[] = [];
  const month = sourceDate.getMonth();
  const cursor = new Date(sourceDate);
  cursor.setDate(cursor.getDate() + 7);
  while (cursor.getMonth() === month) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function mapManualEntry(docId: string, data: any): NurseScheduleEntry {
  return {
    id: docId,
    userId: data.userId,
    title: data.title,
    kind: data.kind,
    source: 'manual',
    startAt: toDate(data.startAt),
    endAt: toDate(data.endAt),
    note: data.note,
    tagColor: data.tagColor,
    reminderEnabled: !!data.reminderEnabled,
    reminderTime: typeof data.reminderTime === 'string' ? data.reminderTime : null,
    reminderOffsetMinutes: typeof data.reminderOffsetMinutes === 'number' ? data.reminderOffsetMinutes : null,
    locationName: data.locationName,
    status: data.status || 'planned',
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,
    isEditable: true,
  };
}

function sortEntries(entries: NurseScheduleEntry[]): NurseScheduleEntry[] {
  return [...entries].sort((left, right) => {
    const leftStart = toDate(left.startAt).getTime();
    const rightStart = toDate(right.startAt).getTime();
    if (leftStart !== rightStart) return leftStart - rightStart;
    return left.title.localeCompare(right.title);
  });
}

function scoreJobMatch(job: JobPost, userProfile: any, dateKey: string, availabilityEntries: NurseScheduleEntry[]): number {
  const staffTypes = [userProfile.staffType, ...(userProfile.staffTypes || [])].filter(Boolean) as string[];
  const province = userProfile.preferredProvince || userProfile.location?.province;
  let score = 0;

  if (!job.staffType || staffTypes.length === 0) {
    score += 1;
  } else if (staffTypes.includes(job.staffType)) {
    score += 5;
  }

  if (province && (job.location?.province === province || job.province === province)) {
    score += 3;
  }

  if (job.status === 'urgent' || job.isUrgent) {
    score += 2;
  }

  const occurrences = getJobOccurrencesForDate(job, dateKey);
  if (occurrences.length === 0) return -1;

  const overlapsAvailability = occurrences.some((occurrence) =>
    availabilityEntries.some((entry) =>
      hasTimeOverlap(occurrence.startAt, occurrence.endAt, toDate(entry.startAt), toDate(entry.endAt)),
    ),
  );
  if (!overlapsAvailability) return -1;

  score += Math.min(Math.round((job.shiftRate || 0) / 500), 3);
  return score;
}

function getJobOccurrencesForDate(job: JobPost, dateKey: string): Array<{ startAt: Date; endAt: Date }> {
  if (Array.isArray(job.shifts) && job.shifts.length > 0) {
    return job.shifts
      .filter((shift) => shift.date === dateKey && shift.startTime && shift.endTime)
      .map((shift) => ({
        startAt: combineDateAndTime(shift.date, shift.startTime),
        endAt: combineDateAndTime(shift.date, shift.endTime),
      }));
  }

  if (Array.isArray(job.shiftDates) && job.shiftDates.includes(dateKey)) {
    const slot = job.shiftTimeSlots?.[dateKey];
    const fallbackRange = parseShiftTimeRange(job.shiftTime);
    const startTime = slot?.start || job.startTime || fallbackRange?.startTime;
    const endTime = slot?.end || job.endTime || fallbackRange?.endTime;
    if (!startTime || !endTime) return [];
    return [{
      startAt: combineDateAndTime(dateKey, startTime),
      endAt: combineDateAndTime(dateKey, endTime),
    }];
  }

  const singleDate = job.shiftDate ? toDate(job.shiftDate) : null;
  if (!singleDate || toDateKey(singleDate) !== dateKey) return [];
  const fallbackRange = parseShiftTimeRange(job.shiftTime);
  const startTime = job.startTime || fallbackRange?.startTime;
  const endTime = job.endTime || fallbackRange?.endTime;
  if (!startTime || !endTime) return [];
  return [{
    startAt: combineDateAndTime(dateKey, startTime),
    endAt: combineDateAndTime(dateKey, endTime),
  }];
}

function isWithinMonth(entry: NurseScheduleEntry, month: Date): boolean {
  const { start, end } = buildMonthRange(month);
  const entryStart = toDate(entry.startAt).getTime();
  return entryStart >= start.getTime() && entryStart <= end.getTime();
}

function materializeConfirmedJobEntries(contact: ShiftContact, job?: JobPost): NurseScheduleEntry[] {
  if (!job || contact.status !== 'confirmed') return [];

  const baseTitle = job.title || 'งานที่ยืนยันแล้ว';
  const baseNote = contact.message || job.scheduleNote || undefined;
  const locationName = job.hospital || job.location?.hospital || job.location?.province || job.province;
  const createdAt = contact.contactedAt || new Date();

  if (Array.isArray(job.shifts) && job.shifts.length > 0) {
    return job.shifts
      .map((shift, index) => buildEntryFromPostShift(contact, job, shift, index, baseTitle, baseNote, locationName, createdAt))
      .filter(Boolean) as NurseScheduleEntry[];
  }

  if (Array.isArray(job.shiftDates) && job.shiftDates.length > 0) {
    return job.shiftDates
      .map((dateKey, index) => {
        const slot = job.shiftTimeSlots?.[dateKey];
        const fallbackRange = parseShiftTimeRange(job.shiftTime);
        const startTime = slot?.start || job.startTime || fallbackRange?.startTime || '08:00';
        const endTime = slot?.end || job.endTime || fallbackRange?.endTime || '16:00';
        return buildDerivedEntry({
          id: `job-${contact.id}-${dateKey}-${index}`,
          userId: contact.interestedUserId,
          title: baseTitle,
          note: baseNote,
          locationName,
          linkedJobId: job.id,
          linkedContactId: contact.id,
          startAt: combineDateAndTime(dateKey, startTime),
          endAt: combineDateAndTime(dateKey, endTime),
          createdAt,
        });
      })
      .filter(Boolean);
  }

  const singleDate = job.shiftDate ? toDate(job.shiftDate) : new Date();
  const dateKey = toDateKey(singleDate);
  const fallbackRange = parseShiftTimeRange(job.shiftTime);
  const startTime = job.startTime || fallbackRange?.startTime || '08:00';
  const endTime = job.endTime || fallbackRange?.endTime || '16:00';

  return [
    buildDerivedEntry({
      id: `job-${contact.id}-${dateKey}`,
      userId: contact.interestedUserId,
      title: baseTitle,
      note: baseNote,
      locationName,
      linkedJobId: job.id,
      linkedContactId: contact.id,
      startAt: combineDateAndTime(dateKey, startTime),
      endAt: combineDateAndTime(dateKey, endTime),
      createdAt,
    }),
  ];
}

function buildEntryFromPostShift(
  contact: ShiftContact,
  job: JobPost,
  shift: PostShift,
  index: number,
  title: string,
  note: string | undefined,
  locationName: string | undefined,
  createdAt: Date,
): NurseScheduleEntry | null {
  if (!shift.date || !shift.startTime || !shift.endTime) return null;
  return buildDerivedEntry({
    id: `job-${contact.id}-${shift.date}-${index}`,
    userId: contact.interestedUserId,
    title,
    note,
    locationName,
    linkedJobId: job.id,
    linkedContactId: contact.id,
    startAt: combineDateAndTime(shift.date, shift.startTime),
    endAt: combineDateAndTime(shift.date, shift.endTime),
    createdAt,
  });
}

function buildDerivedEntry(input: {
  id: string;
  userId: string;
  title: string;
  note?: string;
  locationName?: string;
  linkedJobId: string;
  linkedContactId: string;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
}): NurseScheduleEntry {
  return {
    id: input.id,
    userId: input.userId,
    title: input.title,
    kind: 'nursego_job',
    source: 'job_confirmed',
    startAt: input.startAt,
    endAt: input.endAt,
    note: input.note,
    locationName: input.locationName,
    status: 'confirmed',
    linkedJobId: input.linkedJobId,
    linkedContactId: input.linkedContactId,
    createdAt: input.createdAt,
    isEditable: false,
  };
}

async function getJobForContact(contact: ShiftContact): Promise<JobPost | undefined> {
  if (!contact.jobId) return contact.job;
  if (contact.job) return contact.job;
  const snapshot = await getDoc(doc(db, SHIFTS_COLLECTION, contact.jobId));
  if (!snapshot.exists()) return undefined;
  return { id: snapshot.id, ...snapshot.data() } as JobPost;
}

export async function createManualNurseScheduleEntry(userId: string, draft: NurseScheduleEntryDraft): Promise<string> {
  assertAuthUser(userId, 'ไม่สามารถบันทึกตารางงานแทนผู้ใช้อื่นได้');

  const startAt = combineDateAndTime(draft.dateKey, draft.startTime);
  const endAt = combineDateAndTime(draft.dateKey, draft.endTime);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || startAt >= endAt) {
    throw new Error('กรุณาตรวจสอบวันและเวลาเริ่ม/สิ้นสุด');
  }

  try {
    const docRef = await addDoc(collection(db, NURSE_SCHEDULE_COLLECTION), {
      userId,
      title: draft.title.trim(),
      kind: draft.kind,
      source: 'manual',
      startAt,
      endAt,
      note: draft.note?.trim() || '',
      tagColor: draft.tagColor || null,
      reminderEnabled: !!draft.reminderEnabled,
      reminderTime: draft.reminderEnabled ? (draft.reminderTime || null) : null,
      reminderOffsetMinutes: draft.reminderOffsetMinutes ?? 30,
      status: 'planned',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return docRef.id;
  } catch (error: any) {
    throw new Error(error?.code === 'permission-denied'
      ? 'ไม่มีสิทธิ์บันทึกตารางงาน กรุณาลองใหม่'
      : 'บันทึกตารางงานไม่สำเร็จ กรุณาลองใหม่');
  }
}

export async function updateManualNurseScheduleEntry(
  entryId: string,
  userId: string,
  patch: Partial<NurseScheduleEntryDraft>,
): Promise<void> {
  assertAuthUser(userId, 'ไม่สามารถแก้ไขตารางงานแทนผู้ใช้อื่นได้');

  const docRef = doc(db, NURSE_SCHEDULE_COLLECTION, entryId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error('ไม่พบรายการตารางงาน');
  const data = snapshot.data();
  if (data.userId !== userId || data.source !== 'manual') {
    throw new Error('รายการนี้ไม่สามารถแก้ไขได้');
  }

  const nextDateKey = patch.dateKey || toDateKey(toDate(data.startAt));
  const nextStartTime = patch.startTime || `${pad2(toDate(data.startAt).getHours())}:${pad2(toDate(data.startAt).getMinutes())}`;
  const nextEndTime = patch.endTime || `${pad2(toDate(data.endAt).getHours())}:${pad2(toDate(data.endAt).getMinutes())}`;
  const nextStartAt = combineDateAndTime(nextDateKey, nextStartTime);
  const nextEndAt = combineDateAndTime(nextDateKey, nextEndTime);

  await updateDoc(docRef, {
    title: patch.title?.trim() || data.title,
    kind: patch.kind || data.kind,
    note: patch.note?.trim() ?? data.note ?? '',
    tagColor: patch.tagColor !== undefined ? patch.tagColor || null : data.tagColor || null,
    reminderEnabled: patch.reminderEnabled !== undefined ? !!patch.reminderEnabled : !!data.reminderEnabled,
    reminderTime:
      patch.reminderEnabled === false
        ? null
        : (patch.reminderTime !== undefined
            ? patch.reminderTime || null
            : (typeof data.reminderTime === 'string' ? data.reminderTime : null)),
    reminderOffsetMinutes:
      patch.reminderOffsetMinutes !== undefined
        ? patch.reminderOffsetMinutes
        : (typeof data.reminderOffsetMinutes === 'number' ? data.reminderOffsetMinutes : 30),
    startAt: nextStartAt,
    endAt: nextEndAt,
    updatedAt: serverTimestamp(),
  });
}

export async function duplicateManualEntryToMonth(entryId: string, userId: string): Promise<number> {
  assertAuthUser(userId, 'ไม่สามารถคัดลอกตารางงานแทนผู้ใช้อื่นได้');

  const docRef = doc(db, NURSE_SCHEDULE_COLLECTION, entryId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) throw new Error('ไม่พบรายการตารางงาน');

  const data = snapshot.data();
  if (data.userId !== userId || data.source !== 'manual') {
    throw new Error('รายการนี้ไม่สามารถคัดลอกได้');
  }

  const sourceStart = toDate(data.startAt);
  const sourceEnd = toDate(data.endAt);
  const matchingDates = getMonthDatesMatchingWeekday(sourceStart);
  if (matchingDates.length === 0) return 0;

  const existingSnapshot = await getDocs(query(collection(db, NURSE_SCHEDULE_COLLECTION), where('userId', '==', userId)));
  const existingEntries = existingSnapshot.docs.map((item) => item.data());

  const startTime = formatTimeText(sourceStart);
  const endTime = formatTimeText(sourceEnd);
  const creates = matchingDates
    .filter((date) => {
      const dateKey = toDateKey(date);
      return !existingEntries.some((entry) => (
        entry.source === 'manual'
        && entry.title === data.title
        && entry.kind === data.kind
        && toDateKey(toDate(entry.startAt)) === dateKey
        && formatTimeText(toDate(entry.startAt)) === startTime
        && formatTimeText(toDate(entry.endAt)) === endTime
      ));
    })
    .map((date) => addDoc(collection(db, NURSE_SCHEDULE_COLLECTION), {
      userId,
      title: data.title,
      kind: data.kind,
      source: 'manual',
      startAt: combineDateAndTime(toDateKey(date), startTime),
      endAt: combineDateAndTime(toDateKey(date), endTime),
      note: data.note || '',
      tagColor: data.tagColor || null,
      reminderEnabled: !!data.reminderEnabled,
      reminderTime: typeof data.reminderTime === 'string' ? data.reminderTime : null,
      reminderOffsetMinutes: typeof data.reminderOffsetMinutes === 'number' ? data.reminderOffsetMinutes : 30,
      status: data.status || 'planned',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

  await Promise.all(creates);
  return creates.length;
}

export async function deleteManualNurseScheduleEntry(entryId: string, userId: string): Promise<void> {
  assertAuthUser(userId, 'ไม่สามารถลบตารางงานแทนผู้ใช้อื่นได้');

  const docRef = doc(db, NURSE_SCHEDULE_COLLECTION, entryId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return;
  const data = snapshot.data();
  if (data.userId !== userId || data.source !== 'manual') {
    throw new Error('รายการนี้ไม่สามารถลบได้');
  }

  await deleteDoc(docRef);
}

export function subscribeToNurseScheduleEntries(
  userId: string,
  month: Date,
  onChange: ScheduleSubscriber,
  onError?: ErrorSubscriber,
): () => void {
  if (!isAuthUser(userId)) {
    onChange([]);
    return () => {};
  }

  let manualEntries: NurseScheduleEntry[] = [];
  let confirmedJobEntries: NurseScheduleEntry[] = [];
  let disposed = false;

  const emit = () => {
    if (disposed) return;
    const merged = sortEntries([...manualEntries, ...confirmedJobEntries].filter((entry) => isWithinMonth(entry, month)));
    onChange(merged);
  };

  const manualQuery = query(
    collection(db, NURSE_SCHEDULE_COLLECTION),
    where('userId', '==', userId),
  );

  const contactsQuery = query(
    collection(db, SHIFT_CONTACTS_COLLECTION),
    where('interestedUserId', '==', userId),
  );

  const unsubscribeManual = onSnapshot(
    manualQuery,
    (snapshot) => {
      manualEntries = snapshot.docs.map((docSnap) => mapManualEntry(docSnap.id, docSnap.data()));
      emit();
    },
    () => {
      manualEntries = [];
      emit();
    },
  );

  const unsubscribeContacts = onSnapshot(
    contactsQuery,
    async (snapshot) => {
      try {
        const contacts = snapshot.docs
          .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as ShiftContact))
          .filter((contact) => contact.status === 'confirmed');

        const jobEntries = await Promise.all(
          contacts.map(async (contact) => {
            try {
              const job = await getJobForContact(contact);
              return materializeConfirmedJobEntries(contact, job);
            } catch {
              return [] as NurseScheduleEntry[];
            }
          }),
        );

        confirmedJobEntries = jobEntries.flat();
        emit();
      } catch {
        confirmedJobEntries = [];
        emit();
      }
    },
    () => {
      confirmedJobEntries = [];
      emit();
    },
  );

  return () => {
    disposed = true;
    unsubscribeManual();
    unsubscribeContacts();
  };
}

export async function getSuggestedJobsForAvailability(
  userProfile: any,
  entries: NurseScheduleEntry[],
  dateKey: string,
  limitCount = 6,
): Promise<JobPost[]> {
  const availabilityEntries = entries.filter((entry) => entry.kind === 'availability' && toDateKey(toDate(entry.startAt)) === dateKey);
  if (availabilityEntries.length === 0) return [];

  const staffType = userProfile.staffType || userProfile.staffTypes?.[0];
  const province = userProfile.preferredProvince || userProfile.location?.province;
  const { jobs } = await getJobs({
    ...(staffType ? { staffType } : {}),
    ...(province ? { province } : {}),
    sortBy: 'highestPay',
  }, undefined, 60);

  return jobs
    .map((job) => ({ job, score: scoreJobMatch(job, userProfile, dateKey, availabilityEntries) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limitCount)
    .map((item) => item.job);
}