// ============================================
// JOB CONSTANTS - ประเภทงาน, สถานที่, ค่าตอบแทน
// ============================================

import { getCurrentResolvedLanguage } from '../i18n';

// ============================================
// ประเภทบุคลากร (Staff Types)
// ============================================

export type StaffType = 'RN' | 'PN' | 'NA' | 'CG' | 'SITTER' | 'ANES' | 'OTHER';

export interface StaffTypeInfo {
  code: StaffType;
  nameTH: string;
  nameEN: string;
  shortName: string;
  shortNameEN?: string;
  description: string;
  descriptionEN?: string;
  requiresLicense: boolean;
}

export const STAFF_TYPES: StaffTypeInfo[] = [
  {
    code: 'RN',
    nameTH: 'พยาบาลวิชาชีพ',
    nameEN: 'Registered Nurse',
    shortName: 'RN',
    shortNameEN: 'RN',
    description: 'จบปริญญาตรี มีใบประกอบวิชาชีพ',
    descriptionEN: 'Bachelor degree and professional license required',
    requiresLicense: true,
  },
  {
    code: 'PN',
    nameTH: 'ผู้ช่วยพยาบาล',
    nameEN: 'Practical Nurse / Nurse Aide',
    shortName: 'PN/NA',
    shortNameEN: 'PN/NA',
    description: 'พยาบาลเทคนิค (PN) / ผู้ช่วยพยาบาล (NA)',
    descriptionEN: 'Practical nurse (PN) / nurse aide (NA)',
    requiresLicense: false,
  },
  {
    code: 'CG',
    nameTH: 'ผู้ดูแลผู้สูงอายุ/ผู้ป่วย',
    nameEN: 'Caregiver',
    shortName: 'CG',
    shortNameEN: 'CG',
    description: 'ผ่านการอบรมหลักสูตร Caregiver',
    descriptionEN: 'Completed caregiver training',
    requiresLicense: false,
  },
  {
    code: 'SITTER',
    nameTH: 'เฝ้าไข้',
    nameEN: 'Patient Sitter',
    shortName: 'เฝ้าไข้',
    shortNameEN: 'Sitter',
    description: 'ดูแลผู้ป่วยในโรงพยาบาลหรือที่บ้าน',
    descriptionEN: 'Provide bedside support in hospitals or at home',
    requiresLicense: false,
  },
  {
    code: 'ANES',
    nameTH: 'ผู้ช่วยวิสัญญี / วิสัญญีพยาบาล',
    nameEN: 'Anesthesia Nurse / CRNA',
    shortName: 'ANES',
    shortNameEN: 'ANES',
    description: 'ผู้ช่วยวิสัญญีแพทย์ / วิสัญญีพยาบาลวิชาชีพ',
    descriptionEN: 'Anesthesia assistant / certified registered nurse anesthetist',
    requiresLicense: true,
  },
  {
    code: 'OTHER',
    nameTH: 'อื่นๆ',
    nameEN: 'Other',
    shortName: 'อื่นๆ',
    shortNameEN: 'Other',
    description: 'ระบุเอง',
    descriptionEN: 'Custom entry',
    requiresLicense: false,
  },
];

// Quick lookup
export const STAFF_TYPE_MAP = STAFF_TYPES.reduce((acc, type) => {
  acc[type.code] = type;
  return acc;
}, {} as Record<StaffType, StaffTypeInfo>);
// NA is an alias for PN/NA display
STAFF_TYPE_MAP['NA'] = STAFF_TYPE_MAP['PN'];

// ============================================
// ประเภทสถานที่ (Location Types)
// ============================================

export type LocationType = 'HOSPITAL' | 'CLINIC' | 'HOME' | 'NURSING_HOME' | 'OTHER';

export interface LocationTypeInfo {
  code: LocationType;
  nameTH: string;
  nameEN: string;
  icon: string;
  description: string;
  descriptionEN?: string;
}

export const LOCATION_TYPES: LocationTypeInfo[] = [
  {
    code: 'HOSPITAL',
    nameTH: 'โรงพยาบาล',
    nameEN: 'Hospital',
    icon: 'business-outline',
    description: 'โรงพยาบาลรัฐหรือเอกชน',
    descriptionEN: 'Public or private hospital',
  },
  {
    code: 'CLINIC',
    nameTH: 'คลินิก',
    nameEN: 'Clinic',
    icon: 'medkit-outline',
    description: 'คลินิกเอกชน, คลินิกความงาม',
    descriptionEN: 'Private clinic or aesthetic clinic',
  },
  {
    code: 'HOME',
    nameTH: 'บ้านผู้ป่วย',
    nameEN: 'Patient home',
    icon: 'home-outline',
    description: 'ดูแลผู้ป่วยที่บ้าน (Home Care)',
    descriptionEN: 'Patient care at home',
  },
  {
    code: 'NURSING_HOME',
    nameTH: 'สถานดูแลผู้สูงอายุ',
    nameEN: 'Nursing home',
    icon: 'bed-outline',
    description: 'Nursing Home, บ้านพักผู้สูงอายุ',
    descriptionEN: 'Nursing home or elderly care residence',
  },
  {
    code: 'OTHER',
    nameTH: 'อื่นๆ',
    nameEN: 'Other',
    icon: 'location-outline',
    description: 'สถานที่อื่น (ระบุเอง)',
    descriptionEN: 'Other location (custom)',
  },
];

export const LOCATION_TYPE_MAP = LOCATION_TYPES.reduce((acc, type) => {
  acc[type.code] = type;
  return acc;
}, {} as Record<LocationType, LocationTypeInfo>);

// ============================================
// แผนก (Departments)
// ============================================

export const HOSPITAL_DEPARTMENTS = [
  'ICU',
  'CCU',
  'ฉุกเฉิน (ER)',
  'ผู้ป่วยใน (IPD)',
  'ผู้ป่วยนอก (OPD)',
  'ห้องผ่าตัด (OR)',
  'ห้องคลอด (LR)',
  'เด็ก (Pediatric)',
  'ทารกแรกเกิด (NICU)',
  'อายุรกรรม (Med)',
  'ศัลยกรรม (Surg)',
  'กระดูกและข้อ (Ortho)',
  'สูติ-นรีเวช (OB-GYN)',
  'จิตเวช (Psych)',
  'ไตเทียม (Dialysis)',
  'มะเร็ง (Onco)',
  'หัวใจ (Cardio)',
  'ประสาท (Neuro)',
  'ทั่วไป',
] as const;

export const HOME_CARE_TYPES = [
  'ดูแลผู้ป่วยติดเตียง',
  'ดูแลผู้สูงอายุ',
  'ดูแลผู้ป่วยหลังผ่าตัด',
  'ดูแลผู้ป่วยโรคเรื้อรัง',
  'เฝ้าไข้ทั่วไป',
  'ดูแลเด็ก',
  'พาไปพบแพทย์',
  'ทำแผล/ให้ยา',
] as const;

// รวม departments ทั้งหมด
export const ALL_DEPARTMENTS = [
  ...HOSPITAL_DEPARTMENTS,
  ...HOME_CARE_TYPES,
] as const;

// ============================================
// ค่าตอบแทน (Payment Options)
// ============================================

export type PaymentType = 'NET' | 'DEDUCT_PERCENT' | 'NEGOTIABLE';

export interface PaymentOption {
  code: PaymentType;
  nameTH: string;
  nameEN?: string;
  description: string;
  descriptionEN?: string;
}

export const PAYMENT_TYPES: PaymentOption[] = [
  {
    code: 'NET',
    nameTH: 'รับเต็ม (NET)',
    description: 'ได้รับเต็มจำนวนตามที่ระบุ',
    nameEN: 'NET payment',
    descriptionEN: 'The worker receives the full posted amount',
  },
  {
    code: 'DEDUCT_PERCENT',
    nameTH: 'หักเปอร์เซ็นต์',
    description: 'หักค่าบริการจากยอด เช่น หัก 3%',
    nameEN: 'Deduct percentage',
    descriptionEN: 'A service percentage is deducted from the posted amount',
  },
  {
    code: 'NEGOTIABLE',
    nameTH: 'ตามตกลง',
    description: 'ค่าตอบแทนตามตกลง',
    nameEN: 'Negotiable',
    descriptionEN: 'Compensation is negotiable',
  },
];

// ตัวเลือกหัก %
export const DEDUCT_PERCENT_OPTIONS = [
  { value: 0, label: 'ไม่หัก (NET)' },
  { value: 3, label: 'หัก 3%' },
  { value: 5, label: 'หัก 5%' },
  { value: 10, label: 'หัก 10%' },
  { value: -1, label: 'ระบุเอง' },
] as const;

// ประเภทค่าตอบแทน
export const RATE_TYPES = [
  { value: 'shift', label: 'ต่อเวร', labelEN: 'Per shift', shortLabel: '/เวร', shortLabelEN: '/shift' },
  { value: 'day', label: 'ต่อวัน', labelEN: 'Per day', shortLabel: '/วัน', shortLabelEN: '/day' },
  { value: 'hour', label: 'ต่อชั่วโมง', labelEN: 'Per hour', shortLabel: '/ชม.', shortLabelEN: '/hr' },
  { value: 'month', label: 'ต่อเดือน', labelEN: 'Per month', shortLabel: '/เดือน', shortLabelEN: '/month' },
] as const;

// ============================================
// Shift Times
// ============================================

export const SHIFT_TIMES = [
  { value: '08:00-16:00', label: 'เวรเช้า (08:00-16:00)', labelEN: 'Morning shift (08:00-16:00)', shortLabelTH: 'เวรเช้า', shortLabelEN: 'Morning shift' },
  { value: '16:00-00:00', label: 'เวรบ่าย (16:00-00:00)', labelEN: 'Evening shift (16:00-00:00)', shortLabelTH: 'เวรบ่าย', shortLabelEN: 'Evening shift' },
  { value: '00:00-08:00', label: 'เวรดึก (00:00-08:00)', labelEN: 'Night shift (00:00-08:00)', shortLabelTH: 'เวรดึก', shortLabelEN: 'Night shift' },
  { value: '08:00-20:00', label: 'เช้า-บ่าย (08:00-20:00)', labelEN: 'Day double shift (08:00-20:00)', shortLabelTH: 'เช้า-บ่าย', shortLabelEN: 'Day double shift' },
  { value: '20:00-08:00', label: 'บ่าย-ดึก (20:00-08:00)', labelEN: 'Evening-night shift (20:00-08:00)', shortLabelTH: 'บ่าย-ดึก', shortLabelEN: 'Evening-night shift' },
  { value: '07:00-19:00', label: '12 ชม. กลางวัน (07:00-19:00)', labelEN: '12-hour day shift (07:00-19:00)', shortLabelTH: '12 ชม. กลางวัน', shortLabelEN: '12-hour day shift' },
  { value: '19:00-07:00', label: '12 ชม. กลางคืน (19:00-07:00)', labelEN: '12-hour night shift (19:00-07:00)', shortLabelTH: '12 ชม. กลางคืน', shortLabelEN: '12-hour night shift' },
  { value: '00:00-24:00', label: '24 ชม. (ทั้งวัน)', labelEN: '24 hours (full day)', shortLabelTH: 'ทั้งวัน', shortLabelEN: 'Full day' },
  { value: 'custom', label: 'ระบุเวลาเอง', labelEN: 'Custom time', shortLabelTH: 'กำหนดเอง', shortLabelEN: 'Custom' },
] as const;

// ============================================
// Duration Options (สำหรับ Home Care)
// ============================================

export const DURATION_OPTIONS = [
  { value: '1day', label: '1 วัน', labelEN: '1 day' },
  { value: '3days', label: '3 วัน', labelEN: '3 days' },
  { value: '1week', label: '1 สัปดาห์', labelEN: '1 week' },
  { value: '2weeks', label: '2 สัปดาห์', labelEN: '2 weeks' },
  { value: '1month', label: '1 เดือน', labelEN: '1 month' },
  { value: 'long_term', label: 'ระยะยาว', labelEN: 'Long term' },
  { value: 'custom', label: 'ระบุเอง', labelEN: 'Custom' },
] as const;

// ============================================
// Quick Tags (เพิ่มในประกาศ)
// ============================================

export const QUICK_TAGS = [
  'ด่วน',
  'มีที่พัก',
  'มีอาหาร',
  'มีรถรับส่ง',
  'ทำต่อได้',
  'ไม่ต้องมีประสบการณ์',
  'เริ่มงานทันที',
  'นอนเฝ้า',
  'ไม่ต้องนอนเฝ้า',
  'ผู้ป่วยสุภาพ',
  'ผู้ป่วยติดเตียง',
] as const;

// ============================================
// Tags แยกตามหมวดประกาศ
// ============================================

export interface TagGroup {
  title: string;
  icon: string;
  tags: string[];
}

export const SHIFT_TAGS: TagGroup[] = [
  {
    title: 'ความเร่งด่วน',
    icon: 'flash-outline',
    tags: ['ด่วน', 'เริ่มงานทันที', 'หาคนด่วนมาก'],
  },
  {
    title: 'สวัสดิการ',
    icon: 'gift-outline',
    tags: ['มีที่พัก', 'มีอาหาร', 'มีรถรับส่ง', 'มียูนิฟอร์ม'],
  },
  {
    title: 'ลักษณะงาน',
    icon: 'briefcase-outline',
    tags: ['ทำต่อได้', 'ไม่ต้องมีประสบการณ์', 'นอนเฝ้า', 'ไม่ต้องนอนเฝ้า', 'งานเบา', 'มีพี่เลี้ยง'],
  },
];

export const JOB_TAGS: TagGroup[] = [
  {
    title: 'ความเร่งด่วน',
    icon: 'flash-outline',
    tags: ['ด่วน', 'เริ่มงานทันที', 'รับหลายอัตรา'],
  },
  {
    title: 'คุณสมบัติ',
    icon: 'school-outline',
    tags: ['ไม่ต้องมีประสบการณ์', 'ยินดีรับจบใหม่', 'มีใบประกอบวิชาชีพ', 'ประสบการณ์ 1+ ปี', 'ประสบการณ์ 3+ ปี'],
  },
  {
    title: 'สิ่งที่ได้รับ',
    icon: 'gift-outline',
    tags: ['มีที่พัก', 'มีอาหาร', 'มีรถรับส่ง', 'มียูนิฟอร์ม', 'ฝึกอบรมฟรี', 'ทุนการศึกษา'],
  },
  {
    title: 'รูปแบบงาน',
    icon: 'time-outline',
    tags: ['ทำต่อได้', 'Part-time', 'Full-time', 'งานกะ', 'จันทร์-ศุกร์', 'เสาร์-อาทิตย์หยุด'],
  },
];

export const HOMECARE_TAGS: TagGroup[] = [
  {
    title: 'ความเร่งด่วน',
    icon: 'flash-outline',
    tags: ['ด่วน', 'เริ่มงานทันที', 'ต้องการวันนี้'],
  },
  {
    title: 'ลักษณะผู้ป่วย',
    icon: 'heart-outline',
    tags: ['ผู้ป่วยสุภาพ', 'ผู้ป่วยติดเตียง', 'ผู้สูงอายุ', 'เด็กเล็ก', 'ผู้ป่วยหลังผ่าตัด', 'ผู้ป่วยจิตเวช'],
  },
  {
    title: 'สวัสดิการ',
    icon: 'gift-outline',
    tags: ['มีที่พัก', 'มีอาหาร', 'มีรถรับส่ง'],
  },
  {
    title: 'ลักษณะงาน',
    icon: 'briefcase-outline',
    tags: ['นอนเฝ้า', 'ไม่ต้องนอนเฝ้า', 'ทำต่อได้', 'ไม่ต้องมีประสบการณ์', 'มีพี่เลี้ยง'],
  },
];

// Lookup by postType for convenience
export const TAGS_BY_POST_TYPE: Record<string, TagGroup[]> = {
  shift: SHIFT_TAGS,
  job: JOB_TAGS,
  homecare: HOMECARE_TAGS,
};

// ============================================
// สวัสดิการ (Benefits) - แยกตามหมวด
// ============================================

export interface BenefitGroup {
  title: string;
  icon: string;
  benefits: string[];
}

export const BENEFIT_GROUPS: BenefitGroup[] = [
  {
    title: 'ประกัน & สิทธิ์',
    icon: 'shield-checkmark-outline',
    benefits: ['ประกันสังคม', 'ประกันกลุ่ม', 'ประกันอุบัติเหตุ', 'กองทุนสำรองเลี้ยงชีพ', 'สิทธิลาป่วย'],
  },
  {
    title: 'เงิน & โบนัส',
    icon: 'cash-outline',
    benefits: ['โบนัส', 'OT', 'ค่าเวร', 'ค่าตำแหน่ง', 'ค่าครองชีพ', 'ค่าใบประกอบวิชาชีพ', 'เบี้ยขยัน'],
  },
  {
    title: 'สิ่งอำนวยความสะดวก',
    icon: 'home-outline',
    benefits: ['ที่พัก', 'อาหาร', 'รถรับส่ง', 'ยูนิฟอร์ม', 'ที่จอดรถ'],
  },
  {
    title: 'วันหยุด & สวัสดิการอื่นๆ',
    icon: 'calendar-outline',
    benefits: ['วันหยุดตามปฏิทิน', 'พักร้อน', 'ลากิจ', 'ลาคลอด', 'ทุนการศึกษา', 'ฝึกอบรม', 'ตรวจสุขภาพประจำปี'],
  },
];

// All benefits flattened for quick access
export const ALL_BENEFITS = BENEFIT_GROUPS.flatMap(g => g.benefits);

type LocalizedValueEntry = {
  value: string;
  th: string;
  en: string;
};

type LocalizedGroup = {
  titleTH: string;
  titleEN: string;
  icon: string;
  items: LocalizedValueEntry[];
};

const languageKey = () => (getCurrentResolvedLanguage() === 'th' ? 'th' : 'en');

function localizeText(thText: string, enText: string): string {
  return languageKey() === 'th' ? thText : enText;
}

function buildLookup(entries: LocalizedValueEntry[]) {
  const lookup = new Map<string, LocalizedValueEntry>();
  entries.forEach((entry) => {
    [entry.value, entry.th, entry.en].forEach((candidate) => {
      lookup.set(candidate.trim().toLowerCase(), entry);
    });
  });
  return lookup;
}

function localizeEntryValue(value?: string | null, lookup?: Map<string, LocalizedValueEntry>): string {
  if (!value) {
    return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  }

  const resolved = lookup?.get(value.trim().toLowerCase());
  if (!resolved) return value;
  return languageKey() === 'th' ? resolved.th : resolved.en;
}

const DEPARTMENT_OPTIONS: LocalizedValueEntry[] = [
  { value: 'ICU', th: 'ICU', en: 'ICU' },
  { value: 'CCU', th: 'CCU', en: 'CCU' },
  { value: 'ฉุกเฉิน (ER)', th: 'ฉุกเฉิน (ER)', en: 'Emergency (ER)' },
  { value: 'ผู้ป่วยใน (IPD)', th: 'ผู้ป่วยใน (IPD)', en: 'Inpatient (IPD)' },
  { value: 'ผู้ป่วยนอก (OPD)', th: 'ผู้ป่วยนอก (OPD)', en: 'Outpatient (OPD)' },
  { value: 'ห้องผ่าตัด (OR)', th: 'ห้องผ่าตัด (OR)', en: 'Operating room (OR)' },
  { value: 'ห้องคลอด (LR)', th: 'ห้องคลอด (LR)', en: 'Labor room (LR)' },
  { value: 'เด็ก (Pediatric)', th: 'เด็ก (Pediatric)', en: 'Pediatrics' },
  { value: 'ทารกแรกเกิด (NICU)', th: 'ทารกแรกเกิด (NICU)', en: 'Neonatal ICU (NICU)' },
  { value: 'อายุรกรรม (Med)', th: 'อายุรกรรม (Med)', en: 'Internal medicine' },
  { value: 'ศัลยกรรม (Surg)', th: 'ศัลยกรรม (Surg)', en: 'Surgery' },
  { value: 'กระดูกและข้อ (Ortho)', th: 'กระดูกและข้อ (Ortho)', en: 'Orthopedics' },
  { value: 'สูติ-นรีเวช (OB-GYN)', th: 'สูติ-นรีเวช (OB-GYN)', en: 'OB-GYN' },
  { value: 'จิตเวช (Psych)', th: 'จิตเวช (Psych)', en: 'Psychiatry' },
  { value: 'ไตเทียม (Dialysis)', th: 'ไตเทียม (Dialysis)', en: 'Dialysis' },
  { value: 'มะเร็ง (Onco)', th: 'มะเร็ง (Onco)', en: 'Oncology' },
  { value: 'หัวใจ (Cardio)', th: 'หัวใจ (Cardio)', en: 'Cardiology' },
  { value: 'ประสาท (Neuro)', th: 'ประสาท (Neuro)', en: 'Neurology' },
  { value: 'ทั่วไป', th: 'ทั่วไป', en: 'General' },
];

const HOME_CARE_TYPE_OPTIONS: LocalizedValueEntry[] = [
  { value: 'ดูแลผู้ป่วยติดเตียง', th: 'ดูแลผู้ป่วยติดเตียง', en: 'Bedridden patient care' },
  { value: 'ดูแลผู้สูงอายุ', th: 'ดูแลผู้สูงอายุ', en: 'Elderly care' },
  { value: 'ดูแลผู้ป่วยหลังผ่าตัด', th: 'ดูแลผู้ป่วยหลังผ่าตัด', en: 'Post-surgery patient care' },
  { value: 'ดูแลผู้ป่วยโรคเรื้อรัง', th: 'ดูแลผู้ป่วยโรคเรื้อรัง', en: 'Chronic illness care' },
  { value: 'เฝ้าไข้ทั่วไป', th: 'เฝ้าไข้ทั่วไป', en: 'General bedside care' },
  { value: 'ดูแลเด็ก', th: 'ดูแลเด็ก', en: 'Child care' },
  { value: 'พาไปพบแพทย์', th: 'พาไปพบแพทย์', en: 'Escort to appointments' },
  { value: 'ทำแผล/ให้ยา', th: 'ทำแผล/ให้ยา', en: 'Wound care / medication support' },
];

const BENEFIT_GROUP_ENTRIES: LocalizedGroup[] = [
  {
    titleTH: 'ประกัน & สิทธิ์',
    titleEN: 'Insurance & rights',
    icon: 'shield-checkmark-outline',
    items: [
      { value: 'ประกันสังคม', th: 'ประกันสังคม', en: 'Social security' },
      { value: 'ประกันกลุ่ม', th: 'ประกันกลุ่ม', en: 'Group insurance' },
      { value: 'ประกันอุบัติเหตุ', th: 'ประกันอุบัติเหตุ', en: 'Accident insurance' },
      { value: 'กองทุนสำรองเลี้ยงชีพ', th: 'กองทุนสำรองเลี้ยงชีพ', en: 'Provident fund' },
      { value: 'สิทธิลาป่วย', th: 'สิทธิลาป่วย', en: 'Sick leave' },
    ],
  },
  {
    titleTH: 'เงิน & โบนัส',
    titleEN: 'Pay & bonuses',
    icon: 'cash-outline',
    items: [
      { value: 'โบนัส', th: 'โบนัส', en: 'Bonus' },
      { value: 'OT', th: 'OT', en: 'OT' },
      { value: 'ค่าเวร', th: 'ค่าเวร', en: 'Shift allowance' },
      { value: 'ค่าตำแหน่ง', th: 'ค่าตำแหน่ง', en: 'Position allowance' },
      { value: 'ค่าครองชีพ', th: 'ค่าครองชีพ', en: 'Cost-of-living allowance' },
      { value: 'ค่าใบประกอบวิชาชีพ', th: 'ค่าใบประกอบวิชาชีพ', en: 'License allowance' },
      { value: 'เบี้ยขยัน', th: 'เบี้ยขยัน', en: 'Attendance bonus' },
    ],
  },
  {
    titleTH: 'สิ่งอำนวยความสะดวก',
    titleEN: 'Facilities',
    icon: 'home-outline',
    items: [
      { value: 'ที่พัก', th: 'ที่พัก', en: 'Accommodation' },
      { value: 'อาหาร', th: 'อาหาร', en: 'Meals' },
      { value: 'รถรับส่ง', th: 'รถรับส่ง', en: 'Shuttle' },
      { value: 'ยูนิฟอร์ม', th: 'ยูนิฟอร์ม', en: 'Uniform' },
      { value: 'ที่จอดรถ', th: 'ที่จอดรถ', en: 'Parking' },
    ],
  },
  {
    titleTH: 'วันหยุด & สวัสดิการอื่นๆ',
    titleEN: 'Leave & other benefits',
    icon: 'calendar-outline',
    items: [
      { value: 'วันหยุดตามปฏิทิน', th: 'วันหยุดตามปฏิทิน', en: 'Public holidays' },
      { value: 'พักร้อน', th: 'พักร้อน', en: 'Annual leave' },
      { value: 'ลากิจ', th: 'ลากิจ', en: 'Personal leave' },
      { value: 'ลาคลอด', th: 'ลาคลอด', en: 'Maternity leave' },
      { value: 'ทุนการศึกษา', th: 'ทุนการศึกษา', en: 'Scholarship' },
      { value: 'ฝึกอบรม', th: 'ฝึกอบรม', en: 'Training' },
      { value: 'ตรวจสุขภาพประจำปี', th: 'ตรวจสุขภาพประจำปี', en: 'Annual health check' },
    ],
  },
];

const TAG_GROUP_ENTRIES: Record<string, LocalizedGroup[]> = {
  shift: [
    {
      titleTH: 'ความเร่งด่วน',
      titleEN: 'Urgency',
      icon: 'flash-outline',
      items: [
        { value: 'ด่วน', th: 'ด่วน', en: 'Urgent' },
        { value: 'เริ่มงานทันที', th: 'เริ่มงานทันที', en: 'Start immediately' },
        { value: 'หาคนด่วนมาก', th: 'หาคนด่วนมาก', en: 'Need someone urgently' },
      ],
    },
    {
      titleTH: 'สวัสดิการ',
      titleEN: 'Benefits',
      icon: 'gift-outline',
      items: [
        { value: 'มีที่พัก', th: 'มีที่พัก', en: 'Accommodation provided' },
        { value: 'มีอาหาร', th: 'มีอาหาร', en: 'Meals provided' },
        { value: 'มีรถรับส่ง', th: 'มีรถรับส่ง', en: 'Shuttle provided' },
        { value: 'มียูนิฟอร์ม', th: 'มียูนิฟอร์ม', en: 'Uniform provided' },
      ],
    },
    {
      titleTH: 'ลักษณะงาน',
      titleEN: 'Work style',
      icon: 'briefcase-outline',
      items: [
        { value: 'ทำต่อได้', th: 'ทำต่อได้', en: 'Can continue' },
        { value: 'ไม่ต้องมีประสบการณ์', th: 'ไม่ต้องมีประสบการณ์', en: 'No experience required' },
        { value: 'นอนเฝ้า', th: 'นอนเฝ้า', en: 'Stay overnight' },
        { value: 'ไม่ต้องนอนเฝ้า', th: 'ไม่ต้องนอนเฝ้า', en: 'No overnight stay' },
        { value: 'งานเบา', th: 'งานเบา', en: 'Light workload' },
        { value: 'มีพี่เลี้ยง', th: 'มีพี่เลี้ยง', en: 'Mentor available' },
      ],
    },
  ],
  job: [
    {
      titleTH: 'ความเร่งด่วน',
      titleEN: 'Urgency',
      icon: 'flash-outline',
      items: [
        { value: 'ด่วน', th: 'ด่วน', en: 'Urgent' },
        { value: 'เริ่มงานทันที', th: 'เริ่มงานทันที', en: 'Start immediately' },
        { value: 'รับหลายอัตรา', th: 'รับหลายอัตรา', en: 'Multiple openings' },
      ],
    },
    {
      titleTH: 'คุณสมบัติ',
      titleEN: 'Requirements',
      icon: 'school-outline',
      items: [
        { value: 'ไม่ต้องมีประสบการณ์', th: 'ไม่ต้องมีประสบการณ์', en: 'No experience required' },
        { value: 'ยินดีรับจบใหม่', th: 'ยินดีรับจบใหม่', en: 'New graduates welcome' },
        { value: 'มีใบประกอบวิชาชีพ', th: 'มีใบประกอบวิชาชีพ', en: 'Professional license required' },
        { value: 'ประสบการณ์ 1+ ปี', th: 'ประสบการณ์ 1+ ปี', en: '1+ years experience' },
        { value: 'ประสบการณ์ 3+ ปี', th: 'ประสบการณ์ 3+ ปี', en: '3+ years experience' },
      ],
    },
    {
      titleTH: 'สิ่งที่ได้รับ',
      titleEN: 'What you get',
      icon: 'gift-outline',
      items: [
        { value: 'มีที่พัก', th: 'มีที่พัก', en: 'Accommodation provided' },
        { value: 'มีอาหาร', th: 'มีอาหาร', en: 'Meals provided' },
        { value: 'มีรถรับส่ง', th: 'มีรถรับส่ง', en: 'Shuttle provided' },
        { value: 'มียูนิฟอร์ม', th: 'มียูนิฟอร์ม', en: 'Uniform provided' },
        { value: 'ฝึกอบรมฟรี', th: 'ฝึกอบรมฟรี', en: 'Free training' },
        { value: 'ทุนการศึกษา', th: 'ทุนการศึกษา', en: 'Scholarship' },
      ],
    },
    {
      titleTH: 'รูปแบบงาน',
      titleEN: 'Work format',
      icon: 'time-outline',
      items: [
        { value: 'ทำต่อได้', th: 'ทำต่อได้', en: 'Can continue' },
        { value: 'Part-time', th: 'Part-time', en: 'Part-time' },
        { value: 'Full-time', th: 'Full-time', en: 'Full-time' },
        { value: 'งานกะ', th: 'งานกะ', en: 'Shift work' },
        { value: 'จันทร์-ศุกร์', th: 'จันทร์-ศุกร์', en: 'Mon-Fri' },
        { value: 'เสาร์-อาทิตย์หยุด', th: 'เสาร์-อาทิตย์หยุด', en: 'Weekends off' },
      ],
    },
  ],
  homecare: [
    {
      titleTH: 'ความเร่งด่วน',
      titleEN: 'Urgency',
      icon: 'flash-outline',
      items: [
        { value: 'ด่วน', th: 'ด่วน', en: 'Urgent' },
        { value: 'เริ่มงานทันที', th: 'เริ่มงานทันที', en: 'Start immediately' },
        { value: 'ต้องการวันนี้', th: 'ต้องการวันนี้', en: 'Needed today' },
      ],
    },
    {
      titleTH: 'ลักษณะผู้ป่วย',
      titleEN: 'Patient profile',
      icon: 'heart-outline',
      items: [
        { value: 'ผู้ป่วยสุภาพ', th: 'ผู้ป่วยสุภาพ', en: 'Cooperative patient' },
        { value: 'ผู้ป่วยติดเตียง', th: 'ผู้ป่วยติดเตียง', en: 'Bedridden patient' },
        { value: 'ผู้สูงอายุ', th: 'ผู้สูงอายุ', en: 'Elderly patient' },
        { value: 'เด็กเล็ก', th: 'เด็กเล็ก', en: 'Young child' },
        { value: 'ผู้ป่วยหลังผ่าตัด', th: 'ผู้ป่วยหลังผ่าตัด', en: 'Post-surgery patient' },
        { value: 'ผู้ป่วยจิตเวช', th: 'ผู้ป่วยจิตเวช', en: 'Psychiatric patient' },
      ],
    },
    {
      titleTH: 'สวัสดิการ',
      titleEN: 'Benefits',
      icon: 'gift-outline',
      items: [
        { value: 'มีที่พัก', th: 'มีที่พัก', en: 'Accommodation provided' },
        { value: 'มีอาหาร', th: 'มีอาหาร', en: 'Meals provided' },
        { value: 'มีรถรับส่ง', th: 'มีรถรับส่ง', en: 'Shuttle provided' },
      ],
    },
    {
      titleTH: 'ลักษณะงาน',
      titleEN: 'Work style',
      icon: 'briefcase-outline',
      items: [
        { value: 'นอนเฝ้า', th: 'นอนเฝ้า', en: 'Stay overnight' },
        { value: 'ไม่ต้องนอนเฝ้า', th: 'ไม่ต้องนอนเฝ้า', en: 'No overnight stay' },
        { value: 'ทำต่อได้', th: 'ทำต่อได้', en: 'Can continue' },
        { value: 'ไม่ต้องมีประสบการณ์', th: 'ไม่ต้องมีประสบการณ์', en: 'No experience required' },
        { value: 'มีพี่เลี้ยง', th: 'มีพี่เลี้ยง', en: 'Mentor available' },
      ],
    },
  ],
};

const departmentLookup = buildLookup([...DEPARTMENT_OPTIONS, ...HOME_CARE_TYPE_OPTIONS]);
const benefitLookup = buildLookup(BENEFIT_GROUP_ENTRIES.flatMap((group) => group.items));
const tagLookup = buildLookup(Object.values(TAG_GROUP_ENTRIES).flatMap((groups) => groups.flatMap((group) => group.items)));

function localizeGroup(group: LocalizedGroup) {
  return {
    title: localizeText(group.titleTH, group.titleEN),
    icon: group.icon,
    items: group.items.map((item) => ({
      value: item.value,
      label: localizeText(item.th, item.en),
    })),
  };
}

export function getStaffTypeShortLabel(code?: StaffType | string | null): string {
  if (!code) return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  const item = STAFF_TYPE_MAP[code as StaffType];
  if (!item) return code;
  return getCurrentResolvedLanguage() === 'th' ? item.shortName : (item.shortNameEN || item.shortName);
}

export function getStaffTypeOptions() {
  return STAFF_TYPES.map((item) => ({
    ...item,
    displayName: getCurrentResolvedLanguage() === 'th' ? item.nameTH : item.nameEN,
    shortDisplayName: getCurrentResolvedLanguage() === 'th' ? item.shortName : (item.shortNameEN || item.shortName),
    displayDescription: getCurrentResolvedLanguage() === 'th' ? item.description : (item.descriptionEN || item.description),
  }));
}

export function getLocationTypeOptions() {
  return LOCATION_TYPES.map((item) => ({
    ...item,
    displayName: getCurrentResolvedLanguage() === 'th' ? item.nameTH : item.nameEN,
    displayDescription: getCurrentResolvedLanguage() === 'th' ? item.description : (item.descriptionEN || item.description),
  }));
}

export function getDepartmentOptions(postType?: string, locationType?: LocationType) {
  const source = postType === 'homecare' || locationType === 'HOME' ? HOME_CARE_TYPE_OPTIONS : DEPARTMENT_OPTIONS;
  return source.map((item) => ({
    value: item.value,
    label: localizeText(item.th, item.en),
  }));
}

export function getDepartmentDisplayName(value?: string | null): string {
  return localizeEntryValue(value, departmentLookup);
}

export function getPaymentTypeOptions() {
  return PAYMENT_TYPES.map((item) => ({
    ...item,
    label: getCurrentResolvedLanguage() === 'th' ? item.nameTH : (item.nameEN || item.nameTH),
    displayDescription: getCurrentResolvedLanguage() === 'th' ? item.description : (item.descriptionEN || item.description),
  }));
}

export function getPaymentTypeDisplayName(code?: PaymentType | string | null): string {
  if (!code) return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  const item = PAYMENT_TYPES.find((option) => option.code === code);
  if (!item) return code;
  return getCurrentResolvedLanguage() === 'th' ? item.nameTH : (item.nameEN || item.nameTH);
}

export function getDeductPercentOptions() {
  return DEDUCT_PERCENT_OPTIONS.map((item) => ({
    ...item,
    label: item.value === 0
      ? localizeText('ไม่หัก (NET)', 'No deduction (NET)')
      : item.value === -1
        ? localizeText('ระบุเอง', 'Custom')
        : localizeText(`หัก ${item.value}%`, `Deduct ${item.value}%`),
  }));
}

export function getRateTypeOptions() {
  return RATE_TYPES.map((item) => ({
    ...item,
    label: getCurrentResolvedLanguage() === 'th' ? item.label : item.labelEN,
    shortLabel: getCurrentResolvedLanguage() === 'th' ? item.shortLabel : item.shortLabelEN,
  }));
}

export function getRateTypeDisplayName(value?: string | null): string {
  if (!value) return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  const item = RATE_TYPES.find((rate) => rate.value === value);
  if (!item) return value;
  return getCurrentResolvedLanguage() === 'th' ? item.label : item.labelEN;
}

export function getRateTypeShortLabel(value?: string | null): string {
  if (!value) return '';
  const item = RATE_TYPES.find((rate) => rate.value === value);
  if (!item) return '';
  return getCurrentResolvedLanguage() === 'th' ? item.shortLabel : item.shortLabelEN;
}

export function getShiftTimeOptions() {
  return SHIFT_TIMES.map((item) => ({
    ...item,
    label: getCurrentResolvedLanguage() === 'th' ? item.label : item.labelEN,
    shortLabel: getCurrentResolvedLanguage() === 'th' ? item.shortLabelTH : item.shortLabelEN,
  }));
}

export function getShiftTimeDisplayName(value?: string | null, short: boolean = false): string {
  if (!value) return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  const item = SHIFT_TIMES.find((shift) => shift.value === value);
  if (!item) return value;
  if (short) {
    return getCurrentResolvedLanguage() === 'th' ? item.shortLabelTH : item.shortLabelEN;
  }
  return getCurrentResolvedLanguage() === 'th' ? item.label : item.labelEN;
}

export function getDurationOptions() {
  return DURATION_OPTIONS.map((item) => ({
    ...item,
    label: getCurrentResolvedLanguage() === 'th' ? item.label : item.labelEN,
  }));
}

export function getDurationDisplayName(value?: string | null): string {
  if (!value) return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  const item = DURATION_OPTIONS.find((duration) => duration.value === value);
  if (!item) return value;
  return getCurrentResolvedLanguage() === 'th' ? item.label : item.labelEN;
}

export function getEmploymentTypeLabel(value?: string | null): string {
  switch (value) {
    case 'full_time':
      return localizeText('งานประจำ', 'Full-time');
    case 'part_time':
      return localizeText('พาร์ตไทม์', 'Part-time');
    case 'contract':
      return localizeText('สัญญาจ้าง', 'Contract');
    case 'temporary':
      return localizeText('ชั่วคราว', 'Temporary');
    default:
      return value || (getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified');
  }
}

export function getTagGroups(postType: string) {
  return (TAG_GROUP_ENTRIES[postType] || []).map(localizeGroup);
}

export function getTagDisplayName(value?: string | null): string {
  return localizeEntryValue(value, tagLookup);
}

export function getBenefitGroups() {
  return BENEFIT_GROUP_ENTRIES.map(localizeGroup);
}

export function getBenefitDisplayName(value?: string | null): string {
  return localizeEntryValue(value, benefitLookup);
}

export function getLocalizedBenefits(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).map((value) => getBenefitDisplayName(value));
}

export function getLocalizedTags(values: Array<string | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).map((value) => getTagDisplayName(value));
}

// ============================================
// Helper Functions
// ============================================

export function getStaffTypeLabel(code: StaffType): string {
  const item = STAFF_TYPE_MAP[code];
  if (!item) return code;

  return getStaffTypeShortLabel(code) || code;
}

export function getStaffTypeDisplayName(code?: StaffType | string | null): string {
  if (!code) return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
  const item = STAFF_TYPE_MAP[code as StaffType];
  if (!item) return code;
  return getCurrentResolvedLanguage() === 'th' ? item.nameTH : item.nameEN;
}

export function getLocationTypeLabel(code: LocationType): string {
  const item = LOCATION_TYPE_MAP[code];
  if (!item) return code;
  return getCurrentResolvedLanguage() === 'th' ? item.nameTH : item.nameEN;
}

export function formatPayment(amount: number, rateType: string, paymentType: PaymentType, deductPercent?: number): string {
  const formattedAmount = amount.toLocaleString('th-TH');
  const unit = getRateTypeShortLabel(rateType);
  
  let suffix = '';
  if (paymentType === 'DEDUCT_PERCENT' && deductPercent) {
    suffix = getCurrentResolvedLanguage() === 'th'
      ? ` (หัก ${deductPercent}%)`
      : ` (deduct ${deductPercent}%)`;
  } else if (paymentType === 'NET') {
    suffix = ' NET';
  }
  
  return `฿${formattedAmount}${unit}${suffix}`;
}

export function calculateNetAmount(amount: number, paymentType: PaymentType, deductPercent?: number): number {
  if (paymentType === 'DEDUCT_PERCENT' && deductPercent) {
    return amount * (1 - deductPercent / 100);
  }
  return amount;
}
