import AsyncStorage from '@react-native-async-storage/async-storage';
import { JobFilters } from '../types';
import { getStaffTypeLabel, StaffType } from '../constants/jobOptions';

export interface SavedJobFilterPreset {
  id: string;
  label: string;
  filters: JobFilters;
  nearbyMode: boolean;
  createdAt: string;
}

const MAX_PRESETS = 6;

function getSavedJobFiltersKey(userId: string) {
  return `saved_job_filters:${userId}`;
}

function buildPresetLabel(filters: JobFilters, nearbyMode: boolean): string {
  const parts: string[] = [];

  if (nearbyMode) parts.push('ใกล้ฉัน');
  if (filters.province) parts.push(filters.province);
  if (filters.staffType) parts.push(getStaffTypeLabel(filters.staffType as StaffType));
  if (filters.postType === 'shift') parts.push('แทนเวร');
  if (filters.postType === 'job') parts.push('รับสมัคร');
  if (filters.postType === 'homecare') parts.push('ดูแลผู้ป่วย');
  if (filters.minRate) parts.push(`฿${filters.minRate.toLocaleString()}+`);
  if (filters.maxRate) parts.push(`ถึง ฿${filters.maxRate.toLocaleString()}`);
  if (filters.urgentOnly) parts.push('ด่วน');

  return parts.slice(0, 3).join(' • ') || 'ตัวกรองโปรด';
}

export async function loadSavedJobFilterPresets(userId: string): Promise<SavedJobFilterPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(getSavedJobFiltersKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveJobFilterPreset(
  userId: string,
  filters: JobFilters,
  nearbyMode: boolean,
): Promise<SavedJobFilterPreset[]> {
  const current = await loadSavedJobFilterPresets(userId);
  const dedupeKey = JSON.stringify({ filters, nearbyMode });
  const filtered = current.filter((item) => JSON.stringify({ filters: item.filters, nearbyMode: item.nearbyMode }) !== dedupeKey);

  const nextPreset: SavedJobFilterPreset = {
    id: `${Date.now()}`,
    label: buildPresetLabel(filters, nearbyMode),
    filters,
    nearbyMode,
    createdAt: new Date().toISOString(),
  };

  const next = [nextPreset, ...filtered].slice(0, MAX_PRESETS);
  await AsyncStorage.setItem(getSavedJobFiltersKey(userId), JSON.stringify(next));
  return next;
}

export async function removeSavedJobFilterPreset(userId: string, presetId: string): Promise<SavedJobFilterPreset[]> {
  const current = await loadSavedJobFilterPresets(userId);
  const next = current.filter((item) => item.id !== presetId);
  await AsyncStorage.setItem(getSavedJobFiltersKey(userId), JSON.stringify(next));
  return next;
}