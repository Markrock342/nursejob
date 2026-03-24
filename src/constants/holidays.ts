/**
 * Thai public holidays and important dates
 * ข้อมูลวันหยุดราชการ และวันสำคัญของไทย ปี 2568-2570
 */

export type HolidayType = 'public' | 'important';

export interface ThaiHoliday {
  date: string;       // YYYY-MM-DD
  name: string;       // Thai name
  type: HolidayType;  // 'public' = วันหยุดราชการ, 'important' = วันสำคัญ
}

// ── 2568 (2025) ──
const HOLIDAYS_2568: ThaiHoliday[] = [
  { date: '2025-01-01', name: 'วันขึ้นปีใหม่', type: 'public' },
  { date: '2025-02-12', name: 'วันมาฆบูชา', type: 'public' },
  { date: '2025-02-14', name: 'วันวาเลนไทน์', type: 'important' },
  { date: '2025-04-06', name: 'วันจักรี', type: 'public' },
  { date: '2025-04-13', name: 'วันสงกรานต์', type: 'public' },
  { date: '2025-04-14', name: 'วันสงกรานต์', type: 'public' },
  { date: '2025-04-15', name: 'วันสงกรานต์', type: 'public' },
  { date: '2025-05-01', name: 'วันแรงงานแห่งชาติ', type: 'public' },
  { date: '2025-05-04', name: 'วันฉัตรมงคล', type: 'public' },
  { date: '2025-05-11', name: 'วันวิสาขบูชา', type: 'public' },
  { date: '2025-05-12', name: 'วันพืชมงคล', type: 'public' },
  { date: '2025-06-03', name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ', type: 'public' },
  { date: '2025-07-09', name: 'วันอาสาฬหบูชา', type: 'public' },
  { date: '2025-07-10', name: 'วันเข้าพรรษา', type: 'public' },
  { date: '2025-07-28', name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', type: 'public' },
  { date: '2025-08-12', name: 'วันแม่แห่งชาติ', type: 'public' },
  { date: '2025-10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'public' },
  { date: '2025-10-23', name: 'วันปิยมหาราช', type: 'public' },
  { date: '2025-12-05', name: 'วันพ่อแห่งชาติ', type: 'public' },
  { date: '2025-12-10', name: 'วันรัฐธรรมนูญ', type: 'public' },
  { date: '2025-12-31', name: 'วันสิ้นปี', type: 'public' },
];

// ── 2569 (2026) ──
const HOLIDAYS_2569: ThaiHoliday[] = [
  { date: '2026-01-01', name: 'วันขึ้นปีใหม่', type: 'public' },
  { date: '2026-01-02', name: 'ชดเชยวันขึ้นปีใหม่', type: 'public' },
  { date: '2026-02-17', name: 'วันตรุษจีน', type: 'important' },
  { date: '2026-03-03', name: 'วันมาฆบูชา', type: 'public' },
  { date: '2026-04-05', name: 'วันเช็งเม้ง', type: 'important' },
  { date: '2026-04-06', name: 'วันจักรี - วันพระบาทสมเด็จพระพุทธยอดฟ้าจุฬาโลกมหาราช', type: 'public' },
  { date: '2026-04-13', name: 'วันสงกรานต์', type: 'public' },
  { date: '2026-04-14', name: 'วันสงกรานต์', type: 'public' },
  { date: '2026-04-15', name: 'วันสงกรานต์', type: 'public' },
  { date: '2026-05-01', name: 'วันแรงงานแห่งชาติ', type: 'public' },
  { date: '2026-05-04', name: 'วันฉัตรมงคล', type: 'public' },
  { date: '2026-05-31', name: 'วันวิสาขบูชา', type: 'public' },
  { date: '2026-06-01', name: 'ชดเชยวันวิสาขบูชา', type: 'public' },
  { date: '2026-06-03', name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ', type: 'public' },
  { date: '2026-07-28', name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', type: 'public' },
  { date: '2026-07-29', name: 'วันอาสาฬหบูชา', type: 'public' },
  { date: '2026-07-30', name: 'วันเข้าพรรษา', type: 'public' },
  { date: '2026-08-12', name: 'วันแม่แห่งชาติ', type: 'public' },
  { date: '2026-10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'public' },
  { date: '2026-10-23', name: 'วันปิยมหาราช', type: 'public' },
  { date: '2026-12-05', name: 'วันพ่อแห่งชาติ', type: 'public' },
  { date: '2026-12-07', name: 'ชดเชยวันพ่อแห่งชาติ', type: 'public' },
  { date: '2026-12-10', name: 'วันรัฐธรรมนูญ', type: 'public' },
  { date: '2026-12-31', name: 'วันสิ้นปี', type: 'public' },
];

// ── 2570 (2027) ──
const HOLIDAYS_2570: ThaiHoliday[] = [
  { date: '2027-01-01', name: 'วันขึ้นปีใหม่', type: 'public' },
  { date: '2027-02-05', name: 'วันตรุษจีน', type: 'important' },
  { date: '2027-02-19', name: 'วันมาฆบูชา', type: 'public' },
  { date: '2027-04-06', name: 'วันจักรี', type: 'public' },
  { date: '2027-04-13', name: 'วันสงกรานต์', type: 'public' },
  { date: '2027-04-14', name: 'วันสงกรานต์', type: 'public' },
  { date: '2027-04-15', name: 'วันสงกรานต์', type: 'public' },
  { date: '2027-05-01', name: 'วันแรงงานแห่งชาติ', type: 'public' },
  { date: '2027-05-04', name: 'วันฉัตรมงคล', type: 'public' },
  { date: '2027-05-20', name: 'วันวิสาขบูชา', type: 'public' },
  { date: '2027-06-03', name: 'วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าสุทิดาฯ', type: 'public' },
  { date: '2027-07-18', name: 'วันอาสาฬหบูชา', type: 'public' },
  { date: '2027-07-19', name: 'วันเข้าพรรษา', type: 'public' },
  { date: '2027-07-28', name: 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว', type: 'public' },
  { date: '2027-08-12', name: 'วันแม่แห่งชาติ', type: 'public' },
  { date: '2027-10-13', name: 'วันคล้ายวันสวรรคต ร.9', type: 'public' },
  { date: '2027-10-23', name: 'วันปิยมหาราช', type: 'public' },
  { date: '2027-12-05', name: 'วันพ่อแห่งชาติ', type: 'public' },
  { date: '2027-12-06', name: 'ชดเชยวันพ่อแห่งชาติ', type: 'public' },
  { date: '2027-12-10', name: 'วันรัฐธรรมนูญ', type: 'public' },
  { date: '2027-12-31', name: 'วันสิ้นปี', type: 'public' },
];

export const ALL_HOLIDAYS: ThaiHoliday[] = [
  ...HOLIDAYS_2568,
  ...HOLIDAYS_2569,
  ...HOLIDAYS_2570,
];

/** Lookup holiday by date key (YYYY-MM-DD) */
const holidayMap = new Map<string, ThaiHoliday[]>();
for (const h of ALL_HOLIDAYS) {
  const existing = holidayMap.get(h.date) || [];
  existing.push(h);
  holidayMap.set(h.date, existing);
}

export function getHolidaysForDate(dateKey: string): ThaiHoliday[] {
  return holidayMap.get(dateKey) || [];
}

export function isPublicHoliday(dateKey: string): boolean {
  return (holidayMap.get(dateKey) || []).some((h) => h.type === 'public');
}

/** Get holidays for a specific year (Buddhist Era year) */
export function getHolidaysByBEYear(beYear: number): ThaiHoliday[] {
  const ceYear = beYear - 543;
  return ALL_HOLIDAYS.filter((h) => h.date.startsWith(`${ceYear}-`));
}

/** Get upcoming holidays from today */
export function getUpcomingHolidays(fromDate?: Date): ThaiHoliday[] {
  const today = fromDate || new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return ALL_HOLIDAYS.filter((h) => h.date >= todayStr);
}

/** Get holiday emoji by type */
export function getHolidayEmoji(holiday: ThaiHoliday): string {
  const name = holiday.name;
  if (name.includes('ปีใหม่') || name.includes('สิ้นปี')) return '🎆';
  if (name.includes('สงกรานต์')) return '💦';
  if (name.includes('ตรุษจีน')) return '🧧';
  if (name.includes('วาเลนไทน์')) return '💕';
  if (name.includes('เช็งเม้ง')) return '🪦';
  if (name.includes('แม่')) return '👩‍👦';
  if (name.includes('พ่อ')) return '👨‍👧';
  if (name.includes('มาฆบูชา') || name.includes('วิสาขบูชา') || name.includes('อาสาฬหบูชา') || name.includes('เข้าพรรษา')) return '🙏';
  if (name.includes('จักรี') || name.includes('ฉัตรมงคล') || name.includes('พระชนมพรรษา')) return '👑';
  if (name.includes('สวรรคต') || name.includes('ปิยมหาราช')) return '🖤';
  if (name.includes('รัฐธรรมนูญ')) return '📜';
  if (name.includes('แรงงาน')) return '⚒️';
  if (name.includes('พืชมงคล')) return '🌾';
  if (holiday.type === 'public') return '⭐';
  return '📌';
}
