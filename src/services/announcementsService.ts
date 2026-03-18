import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const STICKY_ANNOUNCEMENTS_DOC = doc(db, 'app_config', 'sticky_announcements');

export type AnnouncementSeverity = 'info' | 'warning' | 'critical' | 'success';
export type AnnouncementTargetScreen = 'home' | 'notifications' | 'chat' | 'all';

export interface StickyAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  isPinned: boolean;
  targetScreens: AnnouncementTargetScreen[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  createdBy?: string;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeAnnouncement(raw: any): StickyAnnouncement | null {
  if (!raw || typeof raw !== 'object' || !raw.id || !raw.title || !raw.body) return null;
  return {
    id: String(raw.id),
    title: String(raw.title),
    body: String(raw.body),
    severity: ['info', 'warning', 'critical', 'success'].includes(raw.severity) ? raw.severity : 'info',
    isActive: raw.isActive !== false,
    isPinned: raw.isPinned === true,
    targetScreens: Array.isArray(raw.targetScreens) && raw.targetScreens.length > 0
      ? raw.targetScreens.filter((item: unknown): item is AnnouncementTargetScreen => item === 'home' || item === 'notifications' || item === 'chat' || item === 'all')
      : ['all'],
    startsAt: parseDate(raw.startsAt),
    endsAt: parseDate(raw.endsAt),
    createdAt: parseDate(raw.createdAt),
    updatedAt: parseDate(raw.updatedAt),
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
  };
}

function parseAnnouncementList(data: any): StickyAnnouncement[] {
  const items: unknown[] = Array.isArray(data?.items) ? data.items : [];
  return items
    .map(normalizeAnnouncement)
    .filter((item: StickyAnnouncement | null): item is StickyAnnouncement => Boolean(item))
    .sort((a: StickyAnnouncement, b: StickyAnnouncement) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0);
    });
}

function matchesScreen(targetScreens: AnnouncementTargetScreen[], screen: AnnouncementTargetScreen): boolean {
  return targetScreens.includes('all') || targetScreens.includes(screen);
}

function isCurrentlyActive(item: StickyAnnouncement): boolean {
  const now = Date.now();
  if (!item.isActive) return false;
  if (item.startsAt && item.startsAt.getTime() > now) return false;
  if (item.endsAt && item.endsAt.getTime() < now) return false;
  return true;
}

function filterActiveForScreen(items: StickyAnnouncement[], screen: AnnouncementTargetScreen): StickyAnnouncement[] {
  return items.filter((item) => isCurrentlyActive(item) && matchesScreen(item.targetScreens, screen));
}

export async function getStickyAnnouncementsAdmin(): Promise<StickyAnnouncement[]> {
  const snapshot = await getDoc(STICKY_ANNOUNCEMENTS_DOC);
  return parseAnnouncementList(snapshot.data());
}

export function subscribeStickyAnnouncements(
  screen: AnnouncementTargetScreen,
  callback: (items: StickyAnnouncement[]) => void
): () => void {
  return onSnapshot(STICKY_ANNOUNCEMENTS_DOC, (snapshot) => {
    callback(filterActiveForScreen(parseAnnouncementList(snapshot.data()), screen));
  }, () => callback([]));
}

export function subscribeStickyAnnouncementsAdmin(
  callback: (items: StickyAnnouncement[]) => void
): () => void {
  return onSnapshot(STICKY_ANNOUNCEMENTS_DOC, (snapshot) => {
    callback(parseAnnouncementList(snapshot.data()));
  }, () => callback([]));
}

async function writeAnnouncements(items: StickyAnnouncement[]): Promise<void> {
  await setDoc(STICKY_ANNOUNCEMENTS_DOC, {
    items: items.map((item) => ({
      ...item,
      startsAt: item.startsAt || null,
      endsAt: item.endsAt || null,
      createdAt: item.createdAt || new Date(),
      updatedAt: item.updatedAt || new Date(),
    })),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function upsertStickyAnnouncement(input: StickyAnnouncement): Promise<void> {
  const current = await getStickyAnnouncementsAdmin();
  const nextItem: StickyAnnouncement = {
    ...input,
    updatedAt: new Date(),
    createdAt: input.createdAt || new Date(),
  };
  const existingIndex = current.findIndex((item) => item.id === input.id);
  if (existingIndex >= 0) {
    current[existingIndex] = nextItem;
  } else {
    current.unshift(nextItem);
  }
  await writeAnnouncements(current);
}

export async function removeStickyAnnouncement(id: string): Promise<void> {
  const current = await getStickyAnnouncementsAdmin();
  await writeAnnouncements(current.filter((item) => item.id !== id));
}

export async function toggleStickyAnnouncementActive(id: string, isActive: boolean): Promise<void> {
  const current = await getStickyAnnouncementsAdmin();
  await writeAnnouncements(current.map((item) => (
    item.id === id ? { ...item, isActive, updatedAt: new Date() } : item
  )));
}