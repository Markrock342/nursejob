import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { JobPost, NurseScheduleEntry, NurseScheduleEntryDraft } from '../../types';
import {
  createManualNurseScheduleEntry,
  deleteManualNurseScheduleEntry,
  duplicateManualEntryToMonth,
  getSuggestedJobsForAvailability,
  subscribeToNurseScheduleEntries,
  updateManualNurseScheduleEntry,
} from '../../services/nurseScheduleService';
import { syncScheduleReminderNotifications } from '../../services/notificationService';
import { getHolidaysForDate, isPublicHoliday, getHolidayEmoji } from '../../constants/holidays';

const DAY_HEADERS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

type DraftState = NurseScheduleEntryDraft;

/* ─── Vibrant solid palette per kind (like reference planner app) ─── */

type KindPalette = { bg: string; text: string };

const KIND_PALETTES: Record<NurseScheduleEntry['kind'], KindPalette> = {
  personal_shift: { bg: '#F5C76E', text: '#8B6914' },
  availability:   { bg: '#7DD4B8', text: '#1B6B4F' },
  time_off:       { bg: '#F4A6B8', text: '#9E3050' },
  nursego_job:    { bg: '#85C8F2', text: '#1A5A8A' },
};

const SHIFT_PERIOD_PALETTES: Record<'morning' | 'afternoon' | 'night', KindPalette> = {
  morning: { bg: '#25C8D9', text: '#FFFFFF' },
  afternoon: { bg: '#D8B36A', text: '#FFFDF8' },
  night: { bg: '#435777', text: '#FFFFFF' },
};

const TAG_COLOR_OPTIONS: Array<{ value: string; bg: string; text: string }> = [
  { value: '#25C8D9', bg: '#25C8D9', text: '#FFFFFF' },
  { value: '#D8B36A', bg: '#D8B36A', text: '#FFFDF8' },
  { value: '#435777', bg: '#435777', text: '#FFFFFF' },
  { value: '#F4A6B8', bg: '#F4A6B8', text: '#7E2842' },
  { value: '#7DD4B8', bg: '#7DD4B8', text: '#185A45' },
  { value: '#B49CFF', bg: '#B49CFF', text: '#FFFFFF' },
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toDate(value: any): Date {
  if (value instanceof Date) return value;
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

function formatDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function formatTimeRange(entry: NurseScheduleEntry): string {
  const startAt = toDate(entry.startAt);
  const endAt = toDate(entry.endAt);
  return `${pad2(startAt.getHours())}:${pad2(startAt.getMinutes())} - ${pad2(endAt.getHours())}:${pad2(endAt.getMinutes())}`;
}

function getSuggestedJobTimeText(job: JobPost, selectedDateKey: string): string {
  if (Array.isArray(job.shifts) && job.shifts.length > 0) {
    const match = job.shifts.find((shift) => shift.date === selectedDateKey && shift.startTime && shift.endTime);
    if (match) return `${match.startTime} - ${match.endTime}`;
  }

  if (Array.isArray(job.shiftDates) && job.shiftDates.includes(selectedDateKey)) {
    const slot = job.shiftTimeSlots?.[selectedDateKey];
    if (slot?.start && slot?.end) return `${slot.start} - ${slot.end}`;
    if (job.startTime && job.endTime) return `${job.startTime} - ${job.endTime}`;
    if (job.shiftTime) return job.shiftTime;
  }

  if (job.shiftDate && toDateKey(toDate(job.shiftDate)) === selectedDateKey) {
    if (job.startTime && job.endTime) return `${job.startTime} - ${job.endTime}`;
    if (job.shiftTime) return job.shiftTime;
  }

  return 'ดูรายละเอียดเวลาในประกาศ';
}

function hasTimeOverlap(leftStart: Date, leftEnd: Date, rightStart: Date, rightEnd: Date): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function getEntryDateKey(entry: NurseScheduleEntry): string {
  return toDateKey(toDate(entry.startAt));
}

function getKindPalette(kind: NurseScheduleEntry['kind']): KindPalette {
  return KIND_PALETTES[kind] || KIND_PALETTES.personal_shift;
}

function getShiftPeriod(hour: number): 'morning' | 'afternoon' | 'night' {
  if (hour >= 17 || hour < 5) return 'night';
  if (hour < 12) return 'morning';
  return 'afternoon';
}

function getShiftTimeLabel(entry: NurseScheduleEntry): string {
  const hour = toDate(entry.startAt).getHours();
  switch (getShiftPeriod(hour)) {
    case 'night': return 'ดึก';
    case 'morning': return 'เช้า';
    default: return 'บ่าย';
  }
}

function getShiftTimeEmoji(entry: NurseScheduleEntry): string {
  const hour = toDate(entry.startAt).getHours();
  switch (getShiftPeriod(hour)) {
    case 'night': return '🌙';
    case 'morning': return '☀️';
    default: return '🌤️';
  }
}

function getEntryPalette(entry: NurseScheduleEntry): KindPalette {
  const customPalette = TAG_COLOR_OPTIONS.find((option) => option.value === entry.tagColor);
  if (customPalette) return { bg: customPalette.bg, text: customPalette.text };
  if (entry.kind === 'personal_shift') {
    return SHIFT_PERIOD_PALETTES[getShiftPeriod(toDate(entry.startAt).getHours())];
  }
  return getKindPalette(entry.kind);
}

function getCellLabel(entry: NurseScheduleEntry): string {
  switch (entry.kind) {
    case 'availability': return 'ว่าง';
    case 'time_off': return 'หยุด';
    case 'nursego_job': return 'แอพ';
    default: return getShiftTimeLabel(entry);
  }
}

function getCellEmoji(entry: NurseScheduleEntry): string {
  switch (entry.kind) {
    case 'availability': return '✨';
    case 'time_off': return '🎉';
    case 'nursego_job': return '⭐';
    default: return getShiftTimeEmoji(entry);
  }
}

function getKindShortLabel(kind: NurseScheduleEntry['kind']): string {
  switch (kind) {
    case 'availability': return 'ว่าง';
    case 'time_off': return 'หยุด';
    case 'nursego_job': return 'แอพ';
    default: return 'เวร';
  }
}

function getKindEmoji(kind: NurseScheduleEntry['kind']): string {
  switch (kind) {
    case 'availability': return '✨';
    case 'time_off': return '🎉';
    case 'nursego_job': return '⭐';
    default: return '☀️';
  }
}

function getSummaryEmoji(key: 'morning' | 'afternoon' | 'night' | 'time_off' | 'nursego_job'): string {
  switch (key) {
    case 'morning': return '☀️';
    case 'afternoon': return '🌤️';
    case 'night': return '🌙';
    case 'time_off': return '🎉';
    default: return '⭐';
  }
}

function getKindLabel(kind: NurseScheduleEntry['kind']): string {
  switch (kind) {
    case 'availability': return 'วันว่างรับเวร';
    case 'time_off': return 'วันหยุด';
    case 'nursego_job': return 'งานจาก NurseGo';
    default: return 'เวรส่วนตัว';
  }
}

function getKindIcon(kind: NurseScheduleEntry['kind']): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'availability': return 'sparkles-outline';
    case 'time_off': return 'cafe-outline';
    case 'nursego_job': return 'briefcase-outline';
    default: return 'calendar-outline';
  }
}

function buildCalendarCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const leading = firstDay.getDay();
  const trailing = 6 - lastDay.getDay();
  const total = leading + lastDay.getDate() + trailing;
  const rows: Array<Array<Date | null>> = [];
  const cells: Array<Date | null> = [];

  for (let index = 0; index < total; index += 1) {
    const dayNumber = index - leading + 1;
    if (dayNumber < 1 || dayNumber > lastDay.getDate()) {
      cells.push(null);
    } else {
      cells.push(new Date(month.getFullYear(), month.getMonth(), dayNumber));
    }
  }

  for (let index = 0; index < cells.length; index += 7) {
    rows.push(cells.slice(index, index + 7));
  }
  return rows;
}

const INITIAL_DRAFT = (dateKey: string): DraftState => ({
  title: '',
  kind: 'personal_shift',
  dateKey,
  startTime: '08:00',
  endTime: '16:00',
  note: '',
  tagColor: '',
  reminderEnabled: false,
  reminderTime: '16:30',
  reminderOffsetMinutes: null,
});

/* ─── Time slots every 30 min ─── */
const TIME_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  TIME_SLOTS.push(`${pad2(h)}:00`);
  TIME_SLOTS.push(`${pad2(h)}:30`);
}

/* ─── Quick shift presets ─── */
const QUICK_SHIFTS = [
  { key: 'morning', label: 'เช้า', emoji: '☀️', start: '08:00', end: '16:00', palette: SHIFT_PERIOD_PALETTES.morning },
  { key: 'afternoon', label: 'บ่าย', emoji: '🌤️', start: '16:00', end: '00:00', palette: SHIFT_PERIOD_PALETTES.afternoon },
  { key: 'night', label: 'ดึก', emoji: '🌙', start: '00:00', end: '08:00', palette: SHIFT_PERIOD_PALETTES.night },
  { key: 'time_off', label: 'หยุด', emoji: '🎉', start: '00:00', end: '23:59', palette: KIND_PALETTES.time_off },
] as const;

export default function NurseScheduleScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [entries, setEntries] = useState<NurseScheduleEntry[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [suggestedJobs, setSuggestedJobs] = useState<JobPost[]>([]);
  const [draft, setDraft] = useState<DraftState>(() => INITIAL_DRAFT(toDateKey(new Date())));
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | 'reminder' | null>(null);
  const timeListRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!user?.uid) return undefined;

    return subscribeToNurseScheduleEntries(
      user.uid,
      monthCursor,
      setEntries,
      () => Alert.alert('โหลดตารางงานไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง'),
    );
  }, [monthCursor, user?.uid]);

  useEffect(() => {
    setDraft((prev) => ({ ...prev, dateKey: selectedDateKey }));
  }, [selectedDateKey]);

  useEffect(() => {
    if (!user?.uid || entries.length === 0) return;
    void syncScheduleReminderNotifications(user.uid, entries);
  }, [entries, user?.uid]);

  const entriesByDate = useMemo(() => {
    return entries.reduce<Record<string, NurseScheduleEntry[]>>((accumulator, entry) => {
      const dateKey = getEntryDateKey(entry);
      if (!accumulator[dateKey]) accumulator[dateKey] = [];
      accumulator[dateKey].push(entry);
      return accumulator;
    }, {});
  }, [entries]);

  const selectedEntries = useMemo(() => {
    return [...(entriesByDate[selectedDateKey] || [])].sort(
      (left, right) => toDate(left.startAt).getTime() - toDate(right.startAt).getTime(),
    );
  }, [entriesByDate, selectedDateKey]);

  const selectedAvailabilityEntries = useMemo(
    () => selectedEntries.filter((entry) => entry.kind === 'availability'),
    [selectedEntries],
  );

  const calendarRows = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);

  const summaryCounts = useMemo(() => {
    const counts: Record<string, number> = { morning: 0, afternoon: 0, night: 0, time_off: 0, nursego_job: 0 };
    for (const entry of entries) {
      if (entry.kind === 'personal_shift') {
        counts[getShiftPeriod(toDate(entry.startAt).getHours())] += 1;
      } else if (entry.kind === 'time_off') {
        counts.time_off += 1;
      } else if (entry.kind === 'nursego_job') {
        counts.nursego_job += 1;
      }
    }
    return counts;
  }, [entries]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  const resetDraft = () => {
    setEditingEntryId(null);
    setDraft(INITIAL_DRAFT(selectedDateKey));
    setActiveTimePicker(null);
  };

  useEffect(() => {
    let active = true;

    if (!user || selectedAvailabilityEntries.length === 0) {
      setSuggestedJobs([]);
      return () => {
        active = false;
      };
    }

    setIsLoadingSuggestions(true);
    void getSuggestedJobsForAvailability(user, entries, selectedDateKey)
      .then((jobs) => {
        if (!active) return;
        setSuggestedJobs(jobs);
      })
      .catch(() => {
        if (!active) return;
        setSuggestedJobs([]);
      })
      .finally(() => {
        if (!active) return;
        setIsLoadingSuggestions(false);
      });

    return () => {
      active = false;
    };
  }, [entries, selectedAvailabilityEntries.length, selectedDateKey, user]);

  const openCreateModal = () => {
    resetDraft();
    setShowCreateModal(true);
  };

  const handleQuickShift = async (shiftKey: string) => {
    if (!user?.uid) return;
    const preset = QUICK_SHIFTS.find((s) => s.key === shiftKey);
    if (!preset) return;

    const isTimeOff = shiftKey === 'time_off';
    const quickDraft: NurseScheduleEntryDraft = {
      title: isTimeOff ? 'วันหยุด' : `เวร${preset.label}`,
      kind: isTimeOff ? 'time_off' : 'personal_shift',
      dateKey: selectedDateKey,
      startTime: preset.start,
      endTime: preset.end,
      note: '',
      tagColor: '',
      reminderEnabled: false,
      reminderTime: null,
      reminderOffsetMinutes: null,
    };

    try {
      setIsSaving(true);
      await createManualNurseScheduleEntry(user.uid, quickDraft);
      setShowQuickSheet(false);
    } catch (error: any) {
      Alert.alert('บันทึกไม่สำเร็จ', error?.message || 'กรุณาลองใหม่');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateTap = (dateKey: string) => {
    if (selectedDateKey === dateKey) {
      // Tap again on selected date → open quick sheet
      setShowQuickSheet(true);
    } else {
      setSelectedDateKey(dateKey);
    }
  };

  const openEditModal = (entry: NurseScheduleEntry) => {
    const startAt = toDate(entry.startAt);
    const endAt = toDate(entry.endAt);
    setEditingEntryId(entry.id);
    setDraft({
      title: entry.title,
      kind: entry.kind === 'nursego_job' ? 'personal_shift' : entry.kind,
      dateKey: toDateKey(startAt),
      startTime: `${pad2(startAt.getHours())}:${pad2(startAt.getMinutes())}`,
      endTime: `${pad2(endAt.getHours())}:${pad2(endAt.getMinutes())}`,
      note: entry.note || '',
      tagColor: entry.tagColor || '',
      reminderEnabled: !!entry.reminderEnabled,
      reminderTime: entry.reminderTime || '16:30',
      reminderOffsetMinutes: entry.reminderOffsetMinutes ?? null,
    });
    setShowCreateModal(true);
  };

  const handlePrevMonth = () => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCreateEntry = async () => {
    if (!user?.uid) return;
    if (!draft.title.trim()) {
      Alert.alert('กรอกชื่อรายการก่อน', 'เช่น เวร OR เช้า หรือ วันว่างรับเวร');
      return;
    }

    const draftStart = new Date(`${draft.dateKey}T${draft.startTime}:00`);
    const draftEnd = new Date(`${draft.dateKey}T${draft.endTime}:00`);
    const overlappingEntries = (entriesByDate[draft.dateKey] || []).filter((entry) =>
      entry.id !== editingEntryId &&
      hasTimeOverlap(draftStart, draftEnd, toDate(entry.startAt), toDate(entry.endAt)),
    );

    const saveEntry = async () => {
      try {
        setIsSaving(true);
        if (editingEntryId) {
          await updateManualNurseScheduleEntry(editingEntryId, user.uid, draft);
        } else {
          await createManualNurseScheduleEntry(user.uid, draft);
        }
        setShowCreateModal(false);
        resetDraft();
      } catch (error: any) {
        Alert.alert('บันทึกตารางงานไม่สำเร็จ', error?.message || 'กรุณาลองใหม่');
      } finally {
        setIsSaving(false);
      }
    };

    if (overlappingEntries.length > 0) {
      Alert.alert(
        'ช่วงเวลาชนกับรายการเดิม',
        `เวลานี้ชนกับ ${overlappingEntries[0].title} ต้องการบันทึกต่อหรือไม่?`,
        [
          { text: 'ยกเลิก', style: 'cancel' },
          { text: 'บันทึกต่อ', onPress: () => { void saveEntry(); } },
        ],
      );
      return;
    }

    await saveEntry();
  };

  const handleDuplicateEntry = (entry: NurseScheduleEntry) => {
    if (!user?.uid || !entry.isEditable) return;

    Alert.alert(
      'คัดลอกทั้งเดือน',
      'จะคัดลอกรายการนี้ไปทุกสัปดาห์ที่เหลือของเดือนเดียวกัน',
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: 'คัดลอก',
          onPress: async () => {
            try {
              const created = await duplicateManualEntryToMonth(entry.id, user.uid);
              Alert.alert('คัดลอกสำเร็จ', created > 0 ? `เพิ่ม ${created} รายการในเดือนนี้แล้ว` : 'เดือนนี้มีรายการรูปแบบนี้ครบแล้ว');
            } catch (error: any) {
              Alert.alert('คัดลอกไม่สำเร็จ', error?.message || 'กรุณาลองใหม่');
            }
          },
        },
      ],
    );
  };

  const handleDeleteEntry = (entry: NurseScheduleEntry) => {
    if (!user?.uid || !entry.isEditable) return;

    Alert.alert('ลบรายการนี้?', entry.title, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteManualNurseScheduleEntry(entry.id, user.uid);
          } catch (error: any) {
            Alert.alert('ลบไม่สำเร็จ', error?.message || 'กรุณาลองใหม่');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={isDark ? colors.background : '#FDF6EF'} />
      <View style={styles.heroCard}>
        <View style={styles.heroDotLarge} />
        <View style={styles.heroDotSmall} />
        <Text style={styles.heroTitle}>ตารางงาน</Text>
      </View>

      <View style={styles.header}>
        <View>
          <Text style={styles.monthTitle}>{formatMonthLabel(monthCursor)}</Text>
          <Text style={styles.monthSubtitle}>ภาพรวมงานและวันหยุด</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>เพิ่ม</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.calendarCard}>
          <View style={styles.calendarBlobMint} />
          <View style={styles.calendarBlobPeach} />
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{formatMonthLabel(monthCursor)}</Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekHeaderRow}>
            {DAY_HEADERS.map((h) => (
              <View key={h} style={styles.weekCell}>
                <Text style={styles.weekText}>{h}</Text>
              </View>
            ))}
          </View>

          {calendarRows.map((row, ri) => (
            <View key={`r${ri}`} style={styles.dayRow}>
              {row.map((cell, ci) => {
                if (!cell) return <View key={`e${ri}${ci}`} style={styles.dayCell} />;

                const dateKey = toDateKey(cell);
                const dayEntries = entriesByDate[dateKey] || [];
                const visibleDayEntries = dayEntries.filter((entry) => entry.kind !== 'availability');
                const isSelected = selectedDateKey === dateKey;
                const isToday = dateKey === todayKey;
                const dateHolidays = getHolidaysForDate(dateKey);
                const hasHoliday = dateHolidays.length > 0;

                return (
                  <TouchableOpacity
                    key={dateKey}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => handleDateTap(dateKey)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.dayNumRow}>
                      <View style={[styles.dayNumWrap, isSelected && styles.dayNumSelectedWrap, isToday && styles.dayNumToday]}>
                        <Text style={[styles.dayNum, isSelected && styles.dayNumSelectedText, isToday && styles.dayNumTodayText, isSelected && isToday && styles.dayNumSelectedTodayText]}>
                          {cell.getDate()}
                        </Text>
                      </View>
                      {hasHoliday && <Text style={styles.holidayDot}>⭐</Text>}
                    </View>
                    {hasHoliday && visibleDayEntries.length === 0 && (
                      <Text style={styles.holidayCellLabel} numberOfLines={1}>{dateHolidays[0].name.slice(0, 6)}</Text>
                    )}

                    {visibleDayEntries.slice(0, 2).map((entry) => {
                      const palette = getEntryPalette(entry);
                      return (
                        <View key={entry.id} style={[styles.cellTag, { backgroundColor: palette.bg }]}>
                          <Text style={styles.cellTagText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                            {getCellLabel(entry)} {getCellEmoji(entry)}
                          </Text>
                        </View>
                      );
                    })}
                    {visibleDayEntries.length > 2 && (
                      <Text style={styles.cellMore}>+{visibleDayEntries.length - 2}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={styles.summaryRow}>
            {([
              { key: 'morning', label: 'เช้า', palette: SHIFT_PERIOD_PALETTES.morning },
              { key: 'afternoon', label: 'บ่าย', palette: SHIFT_PERIOD_PALETTES.afternoon },
              { key: 'night', label: 'ดึก', palette: SHIFT_PERIOD_PALETTES.night },
              { key: 'time_off', label: 'หยุด', palette: getKindPalette('time_off') },
              { key: 'nursego_job', label: 'แอพ', palette: getKindPalette('nursego_job') },
            ] as Array<{ key: 'morning' | 'afternoon' | 'night' | 'time_off' | 'nursego_job'; label: string; palette: KindPalette }>).map((item) => {
              const count = summaryCounts[item.key] || 0;
              return (
                <View key={item.key} style={[styles.summaryPill, { backgroundColor: item.palette.bg }]}> 
                  <Text style={styles.summaryPillText}>
                    {getSummaryEmoji(item.key)} {item.label} ({count})
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Holiday info for selected date */}
          {(() => {
            const holidays = getHolidaysForDate(selectedDateKey);
            return holidays.length > 0 ? (
              <View style={styles.holidayBanner}>
                <Text style={styles.holidayBannerEmoji}>{getHolidayEmoji(holidays[0])}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.holidayBannerText}>{holidays.map((h) => h.name).join(', ')}</Text>
                  <Text style={styles.holidayBannerSub}>{holidays[0].type === 'public' ? 'วันหยุดราชการ' : 'วันสำคัญ'}</Text>
                </View>
              </View>
            ) : null;
          })()}

          {/* Holiday link */}
          <TouchableOpacity style={styles.holidayLink} onPress={() => navigation.navigate('HolidayList')}>
            <Text style={styles.holidayLinkIcon}>📅</Text>
            <Text style={styles.holidayLinkText}>เช็ควันหยุด/วันสำคัญปีนี้</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Selected day detail ── */}
        <View style={styles.detailCard}>
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{formatDayLabel(selectedDateKey)}</Text>
              <Text style={styles.detailSub}>
                {selectedEntries.length === 0 ? 'ไม่มีรายการ' : `${selectedEntries.length} รายการ`}
              </Text>
            </View>
            <TouchableOpacity style={styles.addDayBtn} onPress={() => setShowQuickSheet(true)}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addDayBtnText}>เพิ่ม</Text>
            </TouchableOpacity>
          </View>

          {selectedEntries.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-clear-outline" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>ยังไม่มีรายการในวันนี้</Text>
            </View>
          ) : (
            selectedEntries.map((entry) => {
              const palette = getEntryPalette(entry);
              return (
                <View key={entry.id} style={[styles.entryRow, { borderLeftColor: palette.bg }]}>
                  <View style={[styles.entryIcon, { backgroundColor: palette.bg }]}>
                    <Text style={styles.entryIconEmoji}>{getCellEmoji(entry)}</Text>
                  </View>
                  <View style={styles.entryBody}>
                    <View style={styles.entryTopRow}>
                      <Text style={styles.entryTitle} numberOfLines={1}>{entry.title}</Text>
                      {entry.isEditable ? (
                        <View style={styles.entryActions}>
                          <TouchableOpacity onPress={() => openEditModal(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="create-outline" size={16} color={colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDuplicateEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteEntry(entry)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="trash-outline" size={16} color={colors.error} />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={[styles.syncBadge, { backgroundColor: palette.bg }]}>
                          <Text style={styles.syncBadgeText}>Sync</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.entryMeta}>
                      {getKindLabel(entry.kind)} • {formatTimeRange(entry)}
                    </Text>
                    {entry.locationName ? <Text style={styles.entrySub}>{entry.locationName}</Text> : null}
                    {entry.note ? <Text style={styles.entryNote}>{entry.note}</Text> : null}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Suggested jobs ── */}
        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>งานแนะนำจากวันว่าง</Text>
          <Text style={styles.detailSub}>
            {selectedAvailabilityEntries.length === 0
              ? 'เพิ่มวันว่างเพื่อดูงานที่ตรงเวลา'
              : 'งานที่ตรงกับช่วงเวลาว่าง'}
          </Text>

          {selectedAvailabilityEntries.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="sparkles-outline" size={24} color={colors.textMuted} />
              <Text style={styles.emptyText}>เมื่อเพิ่มวันว่าง ระบบจะแสดงงานที่ตรงเวลา</Text>
            </View>
          ) : isLoadingSuggestions ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>กำลังค้นหางาน...</Text>
            </View>
          ) : suggestedJobs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>ยังไม่พบงานในช่วงเวลานี้</Text>
            </View>
          ) : (
            suggestedJobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.suggItem}
                onPress={() => navigation.navigate('JobDetail', { job, jobId: job.id, source: 'schedule_match' })}
              >
                <View style={styles.suggTopRow}>
                  <Text style={styles.suggTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.suggRate}>฿{(job.shiftRate || 0).toLocaleString()}</Text>
                </View>
                <Text style={styles.suggMeta}>
                  {job.location?.province || job.province || '-'} • {job.staffType || '-'} • {getSuggestedJobTimeText(job, selectedDateKey)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showCreateModal} animationType="fade" transparent onRequestClose={() => setShowCreateModal(false)}>
        <SafeAreaView style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => { setShowCreateModal(false); resetDraft(); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="arrow-back" size={24} color={colors.primary} />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>EVENT</Text>
                <TouchableOpacity onPress={handleCreateEntry} disabled={isSaving} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={isSaving ? 'hourglass-outline' : 'checkmark'} size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.evtTitleArea}>
                  <View style={styles.evtTitleBadgeRow}>
                    <View style={styles.evtTitleBadge}>
                      <Text style={styles.evtTitleBadgeText}>{editingEntryId ? 'แก้ไข' : 'รายการใหม่'}</Text>
                    </View>
                  </View>
                  <TextInput
                    style={styles.evtTitleInput}
                    value={draft.title}
                    onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))}
                    placeholder="ชื่องาน"
                    placeholderTextColor={colors.textMuted}
                    autoFocus={!editingEntryId}
                  />
                  <TextInput
                    style={styles.evtNoteInput}
                    value={draft.note}
                    onChangeText={(note) => setDraft((prev) => ({ ...prev, note }))}
                    placeholder="หมายเหตุ"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                </View>

                <View style={styles.compactSection}>
                  <View style={styles.blockHeader}>
                    <View style={[styles.blockIconWrap, { backgroundColor: '#EAF8F4' }]}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.sectionTitle}>เวลาเวร</Text>
                  </View>
                  <View style={styles.evtRowCompact}>
                    <Text style={styles.evtRowText}>{formatDayLabel(draft.dateKey)}</Text>
                  </View>

                  <View style={styles.evtRowCompact}>
                    <View style={styles.evtTimeInputs}>
                      <TouchableOpacity
                        style={[styles.evtTimeBtn, activeTimePicker === 'start' && styles.evtTimeBtnActive]}
                        onPress={() => {
                          const next = activeTimePicker === 'start' ? null : 'start';
                          setActiveTimePicker(next);
                          if (next) {
                            const idx = TIME_SLOTS.indexOf(draft.startTime);
                            setTimeout(() => timeListRef.current?.scrollTo({ y: Math.max(idx, 0) * 44, animated: false }), 50);
                          }
                        }}
                      >
                        <Text style={[styles.evtTimeBtnText, activeTimePicker === 'start' && { color: colors.primary }]}>{draft.startTime}</Text>
                      </TouchableOpacity>
                      <Text style={styles.evtTimeSep}>→</Text>
                      <TouchableOpacity
                        style={[styles.evtTimeBtn, activeTimePicker === 'end' && styles.evtTimeBtnActive]}
                        onPress={() => {
                          const next = activeTimePicker === 'end' ? null : 'end';
                          setActiveTimePicker(next);
                          if (next) {
                            const idx = TIME_SLOTS.indexOf(draft.endTime);
                            setTimeout(() => timeListRef.current?.scrollTo({ y: Math.max(idx, 0) * 44, animated: false }), 50);
                          }
                        }}
                      >
                        <Text style={[styles.evtTimeBtnText, activeTimePicker === 'end' && { color: colors.primary }]}>{draft.endTime}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {activeTimePicker && (
                    <View style={styles.timePickerContainer}>
                      <ScrollView ref={timeListRef} style={styles.timePickerList} nestedScrollEnabled>
                        {TIME_SLOTS.map((slot) => {
                          const isSelected =
                            (activeTimePicker === 'start' && slot === draft.startTime) ||
                            (activeTimePicker === 'end' && slot === draft.endTime);
                          return (
                            <TouchableOpacity
                              key={slot}
                              style={[styles.timePickerItem, isSelected && styles.timePickerItemActive]}
                              onPress={() => {
                                if (activeTimePicker === 'start') {
                                  setDraft((prev) => ({ ...prev, startTime: slot }));
                                } else {
                                  setDraft((prev) => ({ ...prev, endTime: slot }));
                                }
                                setActiveTimePicker(null);
                              }}
                            >
                              <Text style={[styles.timePickerItemText, isSelected && styles.timePickerItemTextActive]}>{slot}</Text>
                              {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.compactSection}>
                  <View style={styles.blockHeader}>
                    <View style={[styles.blockIconWrap, { backgroundColor: '#FFF0E0' }]}>
                      <Ionicons name="alarm-outline" size={16} color="#D9901A" />
                    </View>
                    <Text style={styles.sectionTitle}>เตือน</Text>
                    <TouchableOpacity
                      style={[styles.toggleTrack, draft.reminderEnabled && styles.toggleTrackActive]}
                      onPress={() => setDraft((prev) => ({ ...prev, reminderEnabled: !prev.reminderEnabled }))}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.toggleThumb, draft.reminderEnabled && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.alarmRow}>
                    <TouchableOpacity
                      style={[
                        styles.alarmTimeButton,
                        !draft.reminderEnabled && styles.alarmTimeButtonDisabled,
                        activeTimePicker === 'reminder' && styles.evtTimeBtnActive,
                      ]}
                      onPress={() => {
                        if (!draft.reminderEnabled) return;
                        const next = activeTimePicker === 'reminder' ? null : 'reminder';
                        setActiveTimePicker(next);
                        if (next) {
                          const idx = TIME_SLOTS.indexOf(draft.reminderTime || '16:30');
                          setTimeout(() => timeListRef.current?.scrollTo({ y: Math.max(idx, 0) * 44, animated: false }), 50);
                        }
                      }}
                    >
                      <Ionicons name="notifications-outline" size={16} color={draft.reminderEnabled ? colors.primary : colors.textMuted} />
                      <Text style={[styles.alarmTimeText, !draft.reminderEnabled && styles.alarmTimeTextDisabled]}>
                        {draft.reminderEnabled ? (draft.reminderTime || '16:30') : 'ปิดการเตือน'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {activeTimePicker === 'reminder' && draft.reminderEnabled && (
                    <View style={styles.timePickerContainer}>
                      <ScrollView ref={timeListRef} style={styles.timePickerList} nestedScrollEnabled>
                        {TIME_SLOTS.map((slot) => {
                          const isSelected = slot === (draft.reminderTime || '16:30');
                          return (
                            <TouchableOpacity
                              key={slot}
                              style={[styles.timePickerItem, isSelected && styles.timePickerItemActive]}
                              onPress={() => {
                                setDraft((prev) => ({ ...prev, reminderTime: slot }));
                                setActiveTimePicker(null);
                              }}
                            >
                              <Text style={[styles.timePickerItemText, isSelected && styles.timePickerItemTextActive]}>{slot}</Text>
                              {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.compactSection}>
                  <View style={styles.blockHeader}>
                    <View style={[styles.blockIconWrap, { backgroundColor: '#EEF6FF' }]}>
                      <Ionicons name="apps-outline" size={16} color="#5A7BD8" />
                    </View>
                    <Text style={styles.sectionTitle}>ประเภท</Text>
                  </View>
                  <View style={styles.evtColorRowCompact}>
                    {([
                      { key: 'personal_shift', label: '☀️ เวร' },
                      { key: 'availability', label: '✨ ว่าง' },
                      { key: 'time_off', label: '🎉 หยุด' },
                    ] as Array<{ key: DraftState['kind']; label: string }>).map((opt) => {
                      const isActive = draft.kind === opt.key;
                      const palette = getKindPalette(opt.key);
                      return (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.evtColorChip, { backgroundColor: palette.bg, borderColor: isActive ? palette.text : 'transparent' }]}
                          onPress={() => setDraft((prev) => ({ ...prev, kind: opt.key }))}
                        >
                          <Text style={[styles.evtColorChipText, { color: palette.text }]}>{opt.label}</Text>
                          {isActive && <Ionicons name="checkmark-circle" size={16} color={palette.text} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.compactSection}>
                  <View style={styles.blockHeader}>
                    <View style={[styles.blockIconWrap, { backgroundColor: '#FBEFFF' }]}>
                      <Ionicons name="color-palette-outline" size={16} color="#A35ED8" />
                    </View>
                    <Text style={styles.sectionTitle}>สีแท็ก</Text>
                  </View>
                  <View style={styles.tagColorRow}>
                    <TouchableOpacity
                      style={[styles.autoColorChip, !draft.tagColor && styles.autoColorChipActive]}
                      onPress={() => setDraft((prev) => ({ ...prev, tagColor: '' }))}
                    >
                      <Text style={[styles.autoColorChipText, !draft.tagColor && styles.autoColorChipTextActive]}>อัตโนมัติ</Text>
                    </TouchableOpacity>
                    {TAG_COLOR_OPTIONS.map((option) => {
                      const isActive = draft.tagColor === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.tagColorChip, { backgroundColor: option.bg }, isActive && styles.tagColorChipActive]}
                          onPress={() => setDraft((prev) => ({ ...prev, tagColor: option.value }))}
                        >
                          {isActive && <Ionicons name="checkmark" size={16} color={option.text} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ── Quick Shift Bottom Sheet ── */}
      <Modal visible={showQuickSheet} animationType="slide" transparent onRequestClose={() => setShowQuickSheet(false)}>
        <TouchableOpacity style={styles.quickBackdrop} activeOpacity={1} onPress={() => setShowQuickSheet(false)}>
          <View style={styles.quickSheet}>
            <View style={styles.quickHandle} />
            <Text style={styles.quickTitle}>
              ระบุเวร - วันที่ {new Date(`${selectedDateKey}T00:00:00`).getDate()} ({new Date(`${selectedDateKey}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'long' })})
            </Text>
            <TouchableOpacity style={styles.quickClose} onPress={() => setShowQuickSheet(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.quickBtnRow}>
              {QUICK_SHIFTS.map((shift) => (
                <TouchableOpacity
                  key={shift.key}
                  style={[styles.quickBtn, { backgroundColor: shift.palette.bg }]}
                  onPress={() => handleQuickShift(shift.key)}
                  disabled={isSaving}
                >
                  <Text style={styles.quickBtnEmoji}>{shift.emoji}</Text>
                  <Text style={[styles.quickBtnLabel, { color: shift.palette.text }]}>{shift.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.quickAddMore}
              onPress={() => {
                setShowQuickSheet(false);
                openCreateModal();
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.quickAddMoreText}>เพิ่มเวรควบ หรือเวรอื่นๆ เช่น เช้าต่อบ่าย</Text>
            </TouchableOpacity>

            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickDeleteBtn} onPress={() => setShowQuickSheet(false)}>
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={[styles.quickActionText, { color: colors.error }]}>ลบ</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickConfirmBtn} onPress={() => setShowQuickSheet(false)}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.quickActionText, { color: colors.primary }]}>ตกลง</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  const cardBg = isDark ? colors.surface : '#FFFAF5';
  const cardBorder = isDark ? colors.border : '#F0E4D6';

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? colors.background : '#F7E8EA',
    },
    heroCard: {
      marginHorizontal: 16,
      marginTop: 6,
      paddingHorizontal: 22,
      paddingVertical: 20,
      borderRadius: 28,
      backgroundColor: isDark ? colors.surface : '#C78E9D',
      overflow: 'hidden',
    },
    heroDotLarge: {
      position: 'absolute',
      right: 24,
      top: 20,
      width: 74,
      height: 74,
      borderRadius: 37,
      backgroundColor: 'rgba(255, 228, 171, 0.42)',
    },
    heroDotSmall: {
      position: 'absolute',
      right: 86,
      bottom: 16,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(206, 242, 228, 0.36)',
    },
    heroEyebrow: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 12,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    heroTitle: {
      color: '#FFFDF8',
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      maxWidth: 240,
    },
    heroSubtitle: {
      color: 'rgba(255,255,255,0.86)',
      fontSize: 14,
      lineHeight: 20,
      marginTop: 10,
      maxWidth: 250,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
    },
    monthTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '800',
    },
    monthSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 3,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? colors.primary : '#1CD6B4',
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 22,
      shadowColor: '#1CD6B4',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    addBtnText: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '700',
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      paddingTop: 6,
      gap: 16,
    },
    calendarCard: {
      backgroundColor: cardBg,
      borderRadius: 30,
      padding: 14,
      borderWidth: 1,
      borderColor: cardBorder,
      overflow: 'hidden',
      shadowColor: 'rgba(118, 90, 92, 0.28)',
      shadowOpacity: isDark ? 0 : 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
    },
    calendarBlobMint: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      left: -26,
      bottom: -20,
      backgroundColor: 'rgba(162, 234, 220, 0.32)',
    },
    calendarBlobPeach: {
      position: 'absolute',
      width: 96,
      height: 96,
      borderRadius: 48,
      right: -20,
      top: 18,
      backgroundColor: 'rgba(255, 225, 172, 0.28)',
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? colors.backgroundSecondary : '#F6EFE7',
    },
    monthLabel: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    weekHeaderRow: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    weekCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 4,
    },
    weekText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    dayRow: {
      flexDirection: 'row',
      marginBottom: 3,
    },
    dayCell: {
      flex: 1,
      minHeight: 68,
      borderRadius: 14,
      padding: 4,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'transparent' : '#EFE7DA',
      backgroundColor: 'rgba(255,255,255,0.46)',
    },
    dayCellSelected: {
      backgroundColor: isDark ? colors.primaryBackground : '#E8F7F3',
      borderColor: isDark ? colors.primary : '#9DDFC9',
    },
    dayNumRow: {
      alignItems: 'center',
      marginBottom: 4,
    },
    dayNumWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumToday: {
      backgroundColor: isDark ? colors.primary : '#2BD4B6',
    },
    dayNumSelectedWrap: {
      backgroundColor: 'rgba(255,255,255,0.82)',
    },
    dayNum: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    dayNumTodayText: {
      color: '#FFF',
    },
    dayNumSelectedTodayText: {
      color: '#FFF',
    },
    dayNumSelectedText: {
      fontWeight: '900',
    },
    cellTag: {
      width: '96%',
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 6,
      marginBottom: 2,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    cellTagText: {
      color: '#FFF',
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.2,
      lineHeight: 11,
      includeFontPadding: false,
    },
    cellMore: {
      color: colors.textMuted,
      fontSize: 9,
      fontWeight: '700',
    },
    summaryRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 8,
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: cardBorder,
    },
    summaryPill: {
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 9,
      minWidth: 88,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 3 },
    },
    summaryPillText: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '800',
    },
    detailCard: {
      backgroundColor: cardBg,
      borderRadius: 26,
      padding: 18,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: 'rgba(118, 90, 92, 0.22)',
      shadowOpacity: isDark ? 0 : 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    detailHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    detailTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    detailSub: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    addDayBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: isDark ? colors.backgroundSecondary : '#EBF5FF',
    },
    addDayBtnText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 13,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 6,
    },
    emptyText: {
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      maxWidth: 260,
      fontSize: 13,
    },
    entryRow: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
      borderLeftWidth: 5,
      borderLeftColor: '#CCC',
      paddingLeft: 12,
      marginTop: 8,
      borderRadius: 14,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFFF0',
    },
    entryIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    entryIconEmoji: {
      fontSize: 16,
    },
    entryBody: {
      flex: 1,
      gap: 2,
    },
    entryTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    entryTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    entryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    entryMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    entrySub: {
      color: colors.textMuted,
      fontSize: 12,
    },
    entryNote: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },
    syncBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    syncBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '800',
    },
    suggItem: {
      marginTop: 8,
      padding: 14,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: cardBorder,
      backgroundColor: isDark ? colors.background : '#FFFFFF',
      gap: 4,
    },
    suggTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    suggTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    suggRate: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: 14,
    },
    suggMeta: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(86, 63, 69, 0.28)',
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    modalSheet: {
      flex: 1,
      maxHeight: '92%',
      backgroundColor: isDark ? colors.background : '#FFFDF9',
      borderRadius: 28,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
    modalHandle: {
      alignSelf: 'center',
      width: 54,
      height: 5,
      borderRadius: 999,
      backgroundColor: isDark ? colors.border : '#E5DDD3',
      marginTop: 10,
    },
    modalHeader: {
      paddingHorizontal: 20,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? colors.border : '#F0E9DE',
    },
    modalTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '800',
      letterSpacing: 1,
    },
    modalSave: {
      color: colors.primary,
      fontWeight: '800',
    },
    modalBody: {
      padding: 20,
      gap: 12,
      paddingBottom: 28,
    },
    evtTitleArea: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 20,
      padding: 18,
      gap: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#F1EAE0',
      shadowColor: '#000',
      shadowOpacity: isDark ? 0 : 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    evtMetaCard: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#F1EAE0',
      gap: 12,
    },
    evtTitleBadgeRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
    },
    evtTitleBadge: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F6EEE5',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    evtTitleBadgeText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '700',
    },
    evtTitleInput: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
    },
    evtNoteInput: {
      color: colors.textSecondary,
      fontSize: 16,
      lineHeight: 20,
      minHeight: 32,
    },
    evtRowCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    evtDivider: {
      height: 1,
      backgroundColor: isDark ? colors.border : '#EFE7DD',
      marginVertical: 10,
    },
    evtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    evtRowText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    evtRowLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    evtTimeInputs: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    evtTimeBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E8E1D6',
      backgroundColor: isDark ? colors.surface : '#FFF8F0',
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    evtTimeBtnActive: {
      borderColor: isDark ? colors.primary : '#2BD4B6',
      backgroundColor: isDark ? colors.primaryBackground : '#E8FAF5',
    },
    evtTimeBtnText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    evtTimeSep: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
    timePickerContainer: {
      marginLeft: 30,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E8E1D6',
      borderRadius: 16,
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      maxHeight: 220,
      overflow: 'hidden',
    },
    timePickerList: {
      maxHeight: 220,
    },
    timePickerItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 11,
      height: 44,
    },
    timePickerItemActive: {
      backgroundColor: isDark ? colors.primaryBackground : '#E8FAF5',
    },
    timePickerItemText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '500',
    },
    timePickerItemTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    compactSection: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#F1EAE0',
      gap: 12,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    blockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    blockIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionSection: {
      gap: 10,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionChip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 18,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F7F1E9',
    },
    optionChipActive: {
      backgroundColor: isDark ? colors.primaryBackground : '#E8FAF5',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    optionChipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    optionChipTextActive: {
      color: colors.primary,
    },
    evtColorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingLeft: 32,
      marginBottom: 8,
    },
    evtColorRowCompact: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    evtColorChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 15,
      paddingVertical: 11,
      borderRadius: 22,
      borderWidth: 2,
    },
    evtColorChipText: {
      fontSize: 13,
      fontWeight: '700',
    },
    tagColorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
    },
    autoColorChip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 18,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F7F1E9',
    },
    autoColorChipActive: {
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: isDark ? colors.primaryBackground : '#E8FAF5',
    },
    autoColorChipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    autoColorChipTextActive: {
      color: colors.primary,
    },
    toggleTrack: {
      marginLeft: 'auto',
      width: 48,
      height: 28,
      borderRadius: 999,
      backgroundColor: '#E6E3DE',
      paddingHorizontal: 3,
      justifyContent: 'center',
    },
    toggleTrackActive: {
      backgroundColor: '#22D3B6',
    },
    toggleThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: '#FFFFFF',
    },
    toggleThumbActive: {
      alignSelf: 'flex-end',
    },
    alarmRow: {
      paddingLeft: 42,
    },
    alarmTimeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#E8E1D6',
      backgroundColor: isDark ? colors.surface : '#FFF8F0',
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    alarmTimeButtonDisabled: {
      backgroundColor: isDark ? colors.backgroundSecondary : '#F4F0EA',
    },
    alarmTimeText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
    alarmTimeTextDisabled: {
      color: colors.textMuted,
    },
    tagColorChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    tagColorChipActive: {
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },

    /* ── Holiday styles ── */
    holidayDot: {
      fontSize: 7,
      position: 'absolute',
      right: -2,
      top: -2,
    },
    holidayCellLabel: {
      fontSize: 7,
      color: '#D4A017',
      fontWeight: '700',
      textAlign: 'center',
      lineHeight: 9,
    },
    holidayBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: isDark ? '#2A3A20' : '#FFF9E6',
      borderRadius: 14,
      padding: 12,
      marginTop: 10,
      borderWidth: 1,
      borderColor: isDark ? '#4A5A30' : '#F5E6B8',
    },
    holidayBannerEmoji: { fontSize: 24 },
    holidayBannerText: { fontSize: 13, fontWeight: '700', color: colors.text },
    holidayBannerSub: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
    holidayLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: isDark ? colors.backgroundSecondary : '#FFF5F0',
      borderWidth: 1,
      borderColor: isDark ? colors.border : '#F5E0D5',
    },
    holidayLinkIcon: { fontSize: 16 },
    holidayLinkText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textSecondary },

    /* ── Quick shift sheet ── */
    quickBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    quickSheet: {
      backgroundColor: cardBg,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 20,
      paddingBottom: 34,
      paddingTop: 12,
    },
    quickHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: isDark ? colors.border : '#DDD',
      alignSelf: 'center',
      marginBottom: 16,
    },
    quickTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 18,
    },
    quickClose: {
      position: 'absolute',
      right: 20,
      top: 14,
      padding: 4,
    },
    quickBtnRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 16,
    },
    quickBtn: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    quickBtnEmoji: { fontSize: 24 },
    quickBtnLabel: { fontSize: 14, fontWeight: '800', marginTop: 2 },
    quickAddMore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: isDark ? colors.backgroundSecondary : '#F0F8FF',
      marginBottom: 16,
    },
    quickAddMoreText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
    quickActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: cardBorder,
      paddingTop: 12,
    },
    quickDeleteBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    quickConfirmBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
    },
    quickActionText: { fontSize: 15, fontWeight: '700' },
  });
}
