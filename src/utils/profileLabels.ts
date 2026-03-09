import { STAFF_TYPES } from '../constants/jobOptions';

export type OrgType = 'public_hospital' | 'private_hospital' | 'clinic' | 'agency';

export const ORG_TYPE_OPTIONS: Array<{ code: OrgType; label: string }> = [
  { code: 'public_hospital', label: 'โรงพยาบาลรัฐ' },
  { code: 'private_hospital', label: 'โรงพยาบาลเอกชน' },
  { code: 'clinic', label: 'คลินิก' },
  { code: 'agency', label: 'เอเจนซี่จัดหางาน' },
];

export const NURSE_WORK_STYLE_OPTIONS = [
  { key: 'fulltime', label: 'งานประจำ / เต็มเวลา' },
  { key: 'parttime', label: 'พาร์ตไทม์ / ชั่วคราว' },
  { key: 'weekend', label: 'เฉพาะวันหยุด / เสาร์อาทิตย์' },
  { key: 'flexible', label: 'ยืดหยุ่น / รับได้หลายแบบ' },
] as const;

export const USER_CARE_TYPE_OPTIONS = [
  { key: 'elderly', label: 'ดูแลผู้สูงอายุ' },
  { key: 'bedridden', label: 'ดูแลผู้ป่วยติดเตียง' },
  { key: 'postsurg', label: 'ดูแลหลังผ่าตัด / พักฟื้น' },
  { key: 'child', label: 'ดูแลเด็ก' },
  { key: 'terminal', label: 'ดูแลแบบประคับประคอง' },
  { key: 'other', label: 'อื่นๆ' },
] as const;

export const HOSPITAL_URGENCY_OPTIONS = [
  { key: 'now', label: 'เร่งด่วนมาก' },
  { key: 'week', label: 'ต้องการภายใน 1 สัปดาห์' },
  { key: 'month', label: 'ต้องการภายใน 1 เดือน' },
  { key: 'plan', label: 'วางแผนล่วงหน้า' },
] as const;

const staffTypeLabelMap = STAFF_TYPES.reduce<Record<string, string>>((acc, staff) => {
  acc[staff.code] = staff.nameTH;
  return acc;
}, {});

export function getStaffTypeThaiLabel(value?: string | null): string {
  if (!value) return 'ยังไม่ระบุ';
  return staffTypeLabelMap[value] || value;
}

export function getOrgTypeThaiLabel(value?: string | null): string {
  if (!value) return 'ยังไม่ระบุ';
  return ORG_TYPE_OPTIONS.find((option) => option.code === value)?.label || value;
}

export function getWorkStyleThaiLabel(value?: string | null): string {
  if (!value) return 'ยังไม่ระบุ';
  return NURSE_WORK_STYLE_OPTIONS.find((option) => option.key === value)?.label || value;
}

export function getCareTypeThaiLabel(value?: string | null): string {
  if (!value) return 'ยังไม่ระบุ';
  return USER_CARE_TYPE_OPTIONS.find((option) => option.key === value)?.label || value;
}

export function getHiringUrgencyThaiLabel(value?: string | null): string {
  if (!value) return 'ยังไม่ระบุ';
  return HOSPITAL_URGENCY_OPTIONS.find((option) => option.key === value)?.label || value;
}

export function getThaiLabels(values: Array<string | null | undefined>, labeler: (value?: string | null) => string): string[] {
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => labeler(value));
}