import { ALL_PROVINCES } from '../constants/locations';
import { DISTRICTS_BY_PROVINCE } from '../constants/districts';
import { JobContactMode, PostShift, StaffType } from '../types';

export interface ExternalContactSignals {
  phones: string[];
  lineIds: string[];
  urls: string[];
  hasExternalContact: boolean;
}

export interface ParsedJobDraft {
  title?: string;
  description?: string;
  staffType?: StaffType;
  department?: string;
  province?: string;
  district?: string;
  hospital?: string;
  address?: string;
  shiftDates?: string[];
  shiftTimeSlots?: Record<string, { start: string; end: string }>;
  shiftRate?: number;
  rateType?: 'shift' | 'day' | 'hour' | 'month';
  slotsNeeded?: number;
  campaignTitle?: string;
  campaignSummary?: string;
  scheduleNote?: string;
  tags?: string[];
  contactPhone?: string;
  contactLine?: string;
  sourceText?: string;
  sourceChannel?: 'paste';
  parseWarnings: string[];
}

const STAFF_TYPE_PATTERNS: Array<{ type: StaffType; patterns: RegExp[] }> = [
  { type: 'RN', patterns: [/\bRN\b/i, /พยาบาลวิชาชีพ/, /registered nurse/i] },
  { type: 'PN', patterns: [/\bPN\b/i, /พยาบาลเทคนิค/, /practical nurse/i] },
  { type: 'NA', patterns: [/\bNA\b/i, /nurse aide/i, /ผู้ช่วยพยาบาล/] },
  { type: 'CG', patterns: [/\bCG\b/i, /care ?giver/i, /ผู้ดูแล/] },
  { type: 'SITTER', patterns: [/sitter/i, /เฝ้าไข้/] },
];

const DEPARTMENT_KEYWORDS = [
  'ICU',
  'ER',
  'OPD',
  'OR',
  'LR',
  'NICU',
  'PICU',
  'Ward',
  'Homecare',
  'ผู้ป่วยนอก',
  'ผู้ป่วยใน',
  'ฉุกเฉิน',
  'ห้องคลอด',
  'ห้องผ่าตัด',
  'ไตเทียม',
  'ICU เด็ก',
  'หอผู้ป่วย',
  'ห้องยา',
  'โฮมแคร์',
  'เฝ้าไข้',
];

const TITLE_PREFIXES = ['รับงาน', 'รับสมัคร', 'หา', 'ด่วน', 'ต้องการ'];

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function padNumber(value: number): string {
  return String(value).padStart(2, '0');
}

function normalizeTimeToken(value: string): string {
  const cleaned = value.replace(/\./g, ':').trim();
  const [hourRaw = '', minuteRaw = '00'] = cleaned.split(':');
  const hour = Math.max(0, Math.min(23, Number(hourRaw) || 0));
  const minute = Math.max(0, Math.min(59, Number(minuteRaw) || 0));
  return `${padNumber(hour)}:${padNumber(minute)}`;
}

function getCurrentBuddhistYear(): number {
  return new Date().getFullYear() + 543;
}

function normalizeYear(yearText?: string): number {
  if (!yearText) return getCurrentBuddhistYear();
  const year = Number(yearText);
  if (!Number.isFinite(year)) return getCurrentBuddhistYear();
  if (year < 100) return 2500 + year;
  if (year < 1000) return year + 2000;
  return year;
}

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = padNumber(date.getMonth() + 1);
  const day = padNumber(date.getDate());
  return `${year}-${month}-${day}`;
}

export function parseStoredDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  const dateKeyMatch = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateKeyMatch) {
    const [, yearText, monthText, dayText] = dateKeyMatch;
    return new Date(Number(yearText), Number(monthText) - 1, Number(dayText), 12, 0, 0, 0);
  }

  return new Date(value);
}

export function toLocalNoonIsoString(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0).toISOString();
}

function buddhistToIso(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const gregorianYear = year > 2400 ? year - 543 : year;
  const date = new Date(gregorianYear, month - 1, day, 12, 0, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
  return date.toISOString();
}

function extractThaiMonth(monthText: string): number | null {
  const normalized = monthText.toLowerCase().replace(/\./g, '');
  const months: Record<string, number> = {
    'มค': 1,
    'มกราคม': 1,
    'กพ': 2,
    'กุมภาพันธ์': 2,
    'มีค': 3,
    'มีนาคม': 3,
    'เมย': 4,
    'เมษายน': 4,
    'พค': 5,
    'พฤษภาคม': 5,
    'มิย': 6,
    'มิถุนายน': 6,
    'กค': 7,
    'กรกฎาคม': 7,
    'สค': 8,
    'สิงหาคม': 8,
    'กย': 9,
    'กันยายน': 9,
    'ตค': 10,
    'ตุลาคม': 10,
    'พย': 11,
    'พฤศจิกายน': 11,
    'ธค': 12,
    'ธันวาคม': 12,
  };
  return months[normalized] || null;
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function maybeExtractTitle(rawText: string): string | undefined {
  const lines = rawText
    .split(/\n+/)
    .map((line) => compactWhitespace(line))
    .filter(Boolean);

  const firstMeaningfulLine = lines.find((line) => TITLE_PREFIXES.some((prefix) => line.includes(prefix))) || lines[0];
  if (!firstMeaningfulLine) return undefined;
  return firstMeaningfulLine.slice(0, 120);
}

function extractStaffType(rawText: string): StaffType | undefined {
  for (const entry of STAFF_TYPE_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(rawText))) {
      return entry.type;
    }
  }
  return undefined;
}

function extractDepartment(rawText: string): string | undefined {
  const found = DEPARTMENT_KEYWORDS.find((keyword) => rawText.toLowerCase().includes(keyword.toLowerCase()));
  return found || undefined;
}

function extractProvince(rawText: string): string | undefined {
  return ALL_PROVINCES.find((province) => rawText.includes(province));
}

function extractDistrict(rawText: string, province?: string): string | undefined {
  if (!province) return undefined;
  const districts = DISTRICTS_BY_PROVINCE[province] || [];
  return districts.find((district) => rawText.includes(district));
}

function extractHospital(rawText: string): string | undefined {
  const patterns = [
    /(รพ\.?[^\n,]+)/i,
    /(โรงพยาบาล[^\n,]+)/i,
    /(คลินิก[^\n,]+)/i,
    /(ศูนย์[^\n,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match?.[1]) return compactWhitespace(match[1]);
  }
  return undefined;
}

function extractSlotsNeeded(rawText: string): number | undefined {
  const patterns = [
    /(\d+)\s*(?:คน|ตำแหน่ง|อัตรา)/i,
    /(?:ต้องการ|รับ)\s*(\d+)\s*คน/i,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    const value = Number(match?.[1] || 0);
    if (value > 0) return value;
  }

  return undefined;
}

function extractRate(rawText: string): { rate?: number; rateType?: 'shift' | 'day' | 'hour' | 'month' } {
  const normalized = rawText.replace(/,/g, '');
  const patterns: Array<{ pattern: RegExp; rateType: 'shift' | 'day' | 'hour' | 'month' }> = [
    { pattern: /(\d{3,6})\s*(?:บาท|บ\.)\s*\/?\s*(?:เดือน|month)/i, rateType: 'month' },
    { pattern: /(\d{3,6})\s*(?:บาท|บ\.)\s*\/?\s*(?:วัน|day)/i, rateType: 'day' },
    { pattern: /(\d{3,6})\s*(?:บาท|บ\.)\s*\/?\s*(?:ชม\.|ชั่วโมง|hour)/i, rateType: 'hour' },
    { pattern: /(\d{3,6})\s*(?:บาท|บ\.)\s*\/?\s*(?:เวร|shift)?/i, rateType: 'shift' },
  ];

  for (const { pattern, rateType } of patterns) {
    const match = normalized.match(pattern);
    const rate = Number(match?.[1] || 0);
    if (rate > 0) return { rate, rateType };
  }

  return {};
}

function extractDates(rawText: string): string[] {
  const results: string[] = [];
  const slashPattern = /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g;
  for (const match of rawText.matchAll(slashPattern)) {
    const iso = buddhistToIso(Number(match[1]), Number(match[2]), normalizeYear(match[3]));
    if (iso) results.push(iso);
  }

  const thaiMonthPattern = /(\d{1,2})(?:\s*[\-–]\s*(\d{1,2}))?\s*(มค\.?|มกราคม|กพ\.?|กุมภาพันธ์|มีค\.?|มีนาคม|เมย\.?|เมษายน|พค\.?|พฤษภาคม|มิย\.?|มิถุนายน|กค\.?|กรกฎาคม|สค\.?|สิงหาคม|กย\.?|กันยายน|ตค\.?|ตุลาคม|พย\.?|พฤศจิกายน|ธค\.?|ธันวาคม)(?:\s*(\d{2,4}))?/gi;
  for (const match of rawText.matchAll(thaiMonthPattern)) {
    const month = extractThaiMonth(match[3]);
    if (!month) continue;
    const year = normalizeYear(match[4]);
    const startDay = Number(match[1]);
    const endDay = Number(match[2] || match[1]);
    for (let day = startDay; day <= endDay; day += 1) {
      const iso = buddhistToIso(day, month, year);
      if (iso) results.push(iso);
    }
  }

  return uniqueStrings(results).sort();
}

function extractTimeSlots(rawText: string, shiftDates: string[]): Record<string, { start: string; end: string }> {
  const timePattern = /(\d{1,2}[:.]\d{2})\s*[-–ถึง]+\s*(\d{1,2}[:.]\d{2})/g;
  const timeMatches = [...rawText.matchAll(timePattern)].map((match) => ({
    start: normalizeTimeToken(match[1]),
    end: normalizeTimeToken(match[2]),
  }));

  if (timeMatches.length === 0 || shiftDates.length === 0) return {};

  const fallback = timeMatches[0];
  return Object.fromEntries(
    shiftDates.map((isoDate, index) => [
      isoDate.slice(0, 10),
      timeMatches[index] || fallback,
    ])
  );
}

export function buildPostShifts(
  shiftDates: string[] = [],
  shiftTimeSlots: Record<string, { start: string; end: string }> = {},
  slotsNeeded = 1
): PostShift[] {
  return shiftDates.map((isoDate, index) => {
    const key = isoDate.slice(0, 10);
    const slot = shiftTimeSlots[key] || { start: '', end: '' };
    return {
      id: `${key}_${index + 1}`,
      date: isoDate,
      startTime: slot.start,
      endTime: slot.end,
      filled: false,
      slotsNeeded,
      filledCount: 0,
    };
  });
}

export function detectExternalContactSignals(text: string): ExternalContactSignals {
  const phones = uniqueStrings(
    [...text.matchAll(/(?:\+66|0)\d(?:[\s-]?\d){7,9}/g)].map((match) => match[0].replace(/\s+/g, ''))
  );
  const lineIds = uniqueStrings(
    [
      ...text.matchAll(/(?:line\s*id|ไลน์|line)\s*[:：]?\s*(@?[a-z0-9._-]{3,})/gi),
      ...text.matchAll(/@[a-z0-9._-]{3,}/gi),
    ].map((match) => match[1] || match[0])
  );
  const urls = uniqueStrings(
    [...text.matchAll(/(?:https?:\/\/|www\.)[^\s]+/gi)].map((match) => match[0])
  );

  return {
    phones,
    lineIds,
    urls,
    hasExternalContact: phones.length > 0 || lineIds.length > 0 || urls.length > 0,
  };
}

export function getSafeContactMode(mode?: JobContactMode, hasPhone?: boolean, hasLine?: boolean): JobContactMode {
  if (mode) return mode;
  if (hasPhone && hasLine) return 'phone_or_line';
  if (hasPhone) return 'phone';
  if (hasLine) return 'line';
  return 'in_app';
}

export function parseJobPostText(rawText: string): ParsedJobDraft {
  const normalized = compactWhitespace(rawText);
  const parseWarnings: string[] = [];
  const shiftDates = extractDates(rawText);
  const shiftTimeSlots = extractTimeSlots(rawText, shiftDates);
  const { rate, rateType } = extractRate(rawText);
  const province = extractProvince(rawText);
  const district = extractDistrict(rawText, province);
  const staffType = extractStaffType(rawText);
  const slotsNeeded = extractSlotsNeeded(rawText) || 1;
  const externalSignals = detectExternalContactSignals(rawText);
  const title = maybeExtractTitle(rawText);

  if (!staffType) parseWarnings.push('ยังจับประเภทบุคลากรไม่ได้ กรุณาเลือกเองอีกครั้ง');
  if (!province) parseWarnings.push('ยังจับจังหวัดไม่ได้ กรุณาเลือกเองอีกครั้ง');
  if (shiftDates.length === 0) parseWarnings.push('ยังจับวันทำงานไม่ได้ กรุณาเลือกวันในปฏิทิน');
  if (Object.keys(shiftTimeSlots).length === 0) parseWarnings.push('ยังจับเวลาไม่ครบ กรุณาตรวจสอบเวลาแต่ละวัน');
  if (!rate) parseWarnings.push('ยังจับค่าตอบแทนไม่ได้ กรุณากรอกเพิ่ม');

  return {
    title,
    description: normalized,
    staffType,
    department: extractDepartment(rawText),
    province,
    district,
    hospital: extractHospital(rawText),
    shiftDates,
    shiftTimeSlots,
    shiftRate: rate,
    rateType,
    slotsNeeded,
    campaignTitle: title,
    campaignSummary: shiftDates.length > 1
      ? `ประกาศนี้มี ${shiftDates.length} วัน ต้องการ ${slotsNeeded} คนต่อรอบ`
      : slotsNeeded > 1
        ? `ประกาศนี้ต้องการ ${slotsNeeded} คนในรอบเดียว`
        : undefined,
    scheduleNote: shiftDates.length > 1 ? 'ระบบสร้างตาราง slot จากข้อความที่วางให้แล้ว' : undefined,
    tags: uniqueStrings([
      shiftDates.length > 1 ? 'หลายวัน' : undefined,
      slotsNeeded > 1 ? `${slotsNeeded} คน` : undefined,
      province,
      extractDepartment(rawText),
    ]),
    contactPhone: externalSignals.phones[0],
    contactLine: externalSignals.lineIds[0],
    sourceText: rawText.trim(),
    sourceChannel: 'paste',
    parseWarnings,
  };
}
