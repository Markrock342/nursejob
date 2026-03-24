import React, { useMemo, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';
import { ALL_HOLIDAYS, getHolidayEmoji, ThaiHoliday } from '../../constants/holidays';

function pad2(n: number) { return String(n).padStart(2, '0'); }

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function formatThaiDate(dateStr: string): { day: number; weekday: string; monthYear: string } {
  const d = new Date(`${dateStr}T00:00:00`);
  const weekdays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  return {
    day: d.getDate(),
    weekday: weekdays[d.getDay()],
    monthYear: d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
  };
}

type FilterMode = 'all' | 'public_only';

export default function HolidayListScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [filter, setFilter] = useState<FilterMode>('all');

  const filteredHolidays = useMemo(() => {
    const base = filter === 'public_only'
      ? ALL_HOLIDAYS.filter((h) => h.type === 'public')
      : ALL_HOLIDAYS;
    return base.filter((h) => h.date >= todayKey);
  }, [filter, todayKey]);

  // Group by month
  const grouped = useMemo(() => {
    const map: Record<string, ThaiHoliday[]> = {};
    for (const h of filteredHolidays) {
      const d = new Date(`${h.date}T00:00:00`);
      const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
      if (!map[key]) map[key] = [];
      map[key].push(h);
    }
    return Object.entries(map).map(([key, items]) => {
      const d = new Date(`${key}-01T00:00:00`);
      const label = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
      return { key, label, items };
    });
  }, [filteredHolidays]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>วันหยุดวันสำคัญ</Text>
        <TouchableOpacity
          style={styles.todayBadge}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.todayBadgeText}>
            {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} →
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            วันหยุด/วันสำคัญ
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'public_only' && styles.filterChipActive]}
          onPress={() => setFilter('public_only')}
        >
          <Text style={[styles.filterChipText, filter === 'public_only' && styles.filterChipTextActive]}>
            เฉพาะวันหยุด
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {grouped.map((group) => (
          <View key={group.key}>
            <Text style={styles.monthLabel}>{group.label}</Text>
            {group.items.map((h, idx) => {
              const info = formatThaiDate(h.date);
              const isToday = h.date === todayKey;
              const isPublic = h.type === 'public';
              return (
                <View key={`${h.date}-${idx}`} style={styles.holidayRow}>
                  <View style={styles.dateSide}>
                    <Text style={styles.dateWeekday}>{info.weekday}</Text>
                    <Text style={[styles.dateDay, isToday && styles.dateDayToday]}>{info.day}</Text>
                  </View>
                  <View style={[styles.holidayCard, isPublic ? styles.holidayCardPublic : styles.holidayCardImportant]}>
                    <Text style={styles.holidayEmoji}>{getHolidayEmoji(h)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.holidayName, isPublic ? styles.holidayNamePublic : styles.holidayNameImportant]} numberOfLines={2}>
                        {h.name}
                      </Text>
                      <Text style={styles.holidayType}>
                        {isPublic ? 'วันหยุดราชการและธนาคาร' : 'วันสำคัญ'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {grouped.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>ไม่มีวันหยุดที่จะแสดง</Text>
          </View>
        )}

        {/* Today indicator */}
        {filteredHolidays.some((h) => h.date === todayKey) && (
          <View style={styles.todayLine}>
            <View style={styles.todayDot} />
            <Text style={styles.todayLineText}>
              วันนี้ - {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric' })}
            </Text>
            <View style={styles.todayLineBar} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? colors.background : '#FDF6EF' },
    header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    },
    backBtn: { padding: 4, marginRight: 8 },
    headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: colors.text },
    todayBadge: {
      backgroundColor: isDark ? colors.surface : '#FFF',
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      borderWidth: 1, borderColor: isDark ? colors.border : '#F0E4D6',
    },
    todayBadgeText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    filterRow: {
      flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8,
    },
    filterChip: {
      paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
      backgroundColor: isDark ? colors.surface : '#FFF',
      borderWidth: 1, borderColor: isDark ? colors.border : '#E8DDD3',
    },
    filterChipActive: {
      backgroundColor: isDark ? colors.primary : '#C78E9D',
      borderColor: 'transparent',
    },
    filterChipText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    filterChipTextActive: { color: '#FFF' },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    monthLabel: {
      fontSize: 16, fontWeight: '700', color: colors.text,
      marginTop: 20, marginBottom: 10,
    },
    holidayRow: {
      flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12,
    },
    dateSide: { width: 48, alignItems: 'center' },
    dateWeekday: { fontSize: 11, color: colors.textSecondary, fontWeight: '500' },
    dateDay: { fontSize: 22, fontWeight: '800', color: colors.text },
    dateDayToday: { color: colors.primary },
    holidayCard: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16,
    },
    holidayCardPublic: { backgroundColor: isDark ? '#2A4030' : '#D4F5E4' },
    holidayCardImportant: { backgroundColor: isDark ? '#3A2A2A' : '#FCDEDE' },
    holidayEmoji: { fontSize: 28 },
    holidayName: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
    holidayNamePublic: { color: isDark ? '#A4E8C4' : '#1B6B4F' },
    holidayNameImportant: { color: isDark ? '#F4A6B8' : '#9E3050' },
    holidayType: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    todayLine: {
      flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 14,
    },
    todayDot: {
      width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF9800',
    },
    todayLineText: { fontSize: 12, fontWeight: '700', color: '#FF9800' },
    todayLineBar: { flex: 1, height: 2, backgroundColor: '#FF9800', borderRadius: 1 },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: 14, color: colors.textMuted },
  });
}
