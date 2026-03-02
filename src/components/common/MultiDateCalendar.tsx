// ============================================
// MULTI-DATE CALENDAR — NurseGo v2
// Tap to select / deselect multiple dates
// Used in PostJobScreen step 2
// ============================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

const { width: W } = Dimensions.get('window');
const CELL_SIZE = Math.floor((W - 48 - 12) / 7); // 7 columns, 24px side padding, 6px gap

const THAI_DAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  d.setDate(1);
  return d;
}

interface MultiDateCalendarProps {
  selectedDates: Date[];
  onChange: (dates: Date[]) => void;
  minDate?: Date;
  maxDate?: Date;
  maxSelections?: number;
}

export function MultiDateCalendar({
  selectedDates,
  onChange,
  minDate,
  maxDate,
  maxSelections = 31,
}: MultiDateCalendarProps) {
  const { colors } = useTheme();
  const today = useMemo(() => new Date(), []);
  const effectiveMin = minDate ?? today;

  const [viewDate, setViewDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const selectedSet = useMemo(() => {
    const s = new Set<string>();
    selectedDates.forEach(d => s.add(dateKey(d)));
    return s;
  }, [selectedDates]);

  // Build calendar grid
  const cells = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid: Array<Date | null> = [];

    for (let i = 0; i < firstDay; i++) grid.push(null);
    for (let d = 1; d <= daysInMonth; d++) grid.push(new Date(year, month, d));
    // Pad to full rows
    while (grid.length % 7 !== 0) grid.push(null);
    return grid;
  }, [viewDate]);

  const toggle = (date: Date) => {
    const key = dateKey(date);
    const isSelected = selectedSet.has(key);

    if (isSelected) {
      onChange(selectedDates.filter(d => dateKey(d) !== key));
    } else {
      if (selectedDates.length >= maxSelections) return;
      onChange([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const isDisabled = (date: Date) => {
    if (effectiveMin && date < effectiveMin && !isSameDate(date, effectiveMin)) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isToday = (date: Date) => isSameDate(date, today);

  const clearAll = () => onChange([]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.background }]}
          onPress={() => setViewDate(v => addMonths(v, -1))}
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {THAI_MONTHS[viewDate.getMonth()]} {viewDate.getFullYear() + 543}
        </Text>

        <TouchableOpacity
          style={[styles.navBtn, { backgroundColor: colors.background }]}
          onPress={() => setViewDate(v => addMonths(v, 1))}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day names */}
      <View style={styles.dayRow}>
        {THAI_DAYS.map((d, i) => (
          <Text
            key={d}
            style={[
              styles.dayName,
              { color: i === 0 ? '#EF4444' : i === 6 ? '#0EA5E9' : colors.textSecondary },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {cells.map((date, idx) => {
          if (!date) return <View key={`empty-${idx}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;
          const key = dateKey(date);
          const selected = selectedSet.has(key);
          const disabled = isDisabled(date);
          const todayCell = isToday(date);
          const isSun = date.getDay() === 0;
          const isSat = date.getDay() === 6;

          return (
            <TouchableOpacity
              key={key}
              onPress={() => !disabled && toggle(date)}
              disabled={disabled}
              style={[
                styles.cell,
                { width: CELL_SIZE, height: CELL_SIZE },
                selected && { backgroundColor: colors.primary },
                !selected && todayCell && { borderWidth: 2, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.cellText,
                  selected
                    ? { color: '#FFF', fontWeight: '700' }
                    : disabled
                    ? { color: colors.border }
                    : isSun
                    ? { color: '#EF4444' }
                    : isSat
                    ? { color: '#0EA5E9' }
                    : { color: colors.text },
                  todayCell && !selected && { fontWeight: '700' },
                ]}
              >
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Footer summary */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <View style={[styles.countBadge, { backgroundColor: colors.primaryBackground }]}>
          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          <Text style={[styles.countText, { color: colors.primary }]}>
            {selectedDates.length > 0
              ? `เลือก ${selectedDates.length} วัน`
              : 'ยังไม่ได้เลือกวัน'}
          </Text>
        </View>

        {selectedDates.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearBtn}>
            <Text style={[styles.clearBtnText, { color: '#EF4444' }]}>ล้างทั้งหมด</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Selected dates preview chips */}
      {selectedDates.length > 0 && (
        <View style={styles.chips}>
          {selectedDates.slice(0, 6).map(d => (
            <TouchableOpacity
              key={dateKey(d)}
              style={[styles.chip, { backgroundColor: colors.primaryBackground, borderColor: colors.primary }]}
              onPress={() => toggle(d)}
            >
              <Text style={[styles.chipText, { color: colors.primary }]}>
                {d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
              </Text>
              <Ionicons name="close" size={12} color={colors.primary} />
            </TouchableOpacity>
          ))}
          {selectedDates.length > 6 && (
            <View style={[styles.chip, { backgroundColor: colors.primaryBackground, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.textSecondary }]}>
                +{selectedDates.length - 6} วัน
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },

  header: {
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
  },
  monthLabel: { fontSize: 16, fontWeight: '700' },

  dayRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayName: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    paddingVertical: 4,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CELL_SIZE / 2,
    marginVertical: 2,
  },
  cellText: { fontSize: 14 },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 8,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
  },
  countText: { fontSize: 13, fontWeight: '600' },
  clearBtn: { padding: 4 },
  clearBtnText: { fontSize: 13, fontWeight: '500' },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    gap: 4,
  },
  chipText: { fontSize: 12, fontWeight: '500' },
});
