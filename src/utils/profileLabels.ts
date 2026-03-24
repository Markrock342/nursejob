import { getCurrentResolvedLanguage } from '../i18n';
import { getStaffTypeDisplayName, STAFF_TYPES } from '../constants/jobOptions';

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

const orgTypeLabelMap: Record<OrgType, { th: string; en: string }> = {
  public_hospital: { th: 'โรงพยาบาลรัฐ', en: 'Public hospital' },
  private_hospital: { th: 'โรงพยาบาลเอกชน', en: 'Private hospital' },
  clinic: { th: 'คลินิก', en: 'Clinic' },
  agency: { th: 'เอเจนซี่จัดหางาน', en: 'Staffing agency' },
};

const workStyleLabelMap: Record<string, { th: string; en: string }> = {
  fulltime: { th: 'งานประจำ / เต็มเวลา', en: 'Full-time / permanent' },
  parttime: { th: 'พาร์ตไทม์ / ชั่วคราว', en: 'Part-time / temporary' },
  weekend: { th: 'เฉพาะวันหยุด / เสาร์อาทิตย์', en: 'Weekends / holidays' },
  flexible: { th: 'ยืดหยุ่น / รับได้หลายแบบ', en: 'Flexible / open to multiple formats' },
};

const careTypeLabelMap: Record<string, { th: string; en: string }> = {
  elderly: { th: 'ดูแลผู้สูงอายุ', en: 'Elderly care' },
  bedridden: { th: 'ดูแลผู้ป่วยติดเตียง', en: 'Bedridden patient care' },
  postsurg: { th: 'ดูแลหลังผ่าตัด / พักฟื้น', en: 'Post-surgery / recovery care' },
  child: { th: 'ดูแลเด็ก', en: 'Child care' },
  terminal: { th: 'ดูแลแบบประคับประคอง', en: 'Palliative care' },
  other: { th: 'อื่นๆ', en: 'Other' },
};

const urgencyLabelMap: Record<string, { th: string; en: string }> = {
  now: { th: 'เร่งด่วนมาก', en: 'Very urgent' },
  week: { th: 'ต้องการภายใน 1 สัปดาห์', en: 'Needed within 1 week' },
  month: { th: 'ต้องการภายใน 1 เดือน', en: 'Needed within 1 month' },
  plan: { th: 'วางแผนล่วงหน้า', en: 'Planning ahead' },
};

function getNotSpecifiedLabel() {
  return getCurrentResolvedLanguage() === 'th' ? 'ยังไม่ระบุ' : 'Not specified';
}

function pickLocalizedLabel(entry?: { th: string; en: string } | null): string | undefined {
  if (!entry) return undefined;
  return getCurrentResolvedLanguage() === 'th' ? entry.th : entry.en;
}

export function getOrgTypeOptions() {
  return ORG_TYPE_OPTIONS.map((option) => ({
    ...option,
    label: pickLocalizedLabel(orgTypeLabelMap[option.code]) || option.label,
  }));
}

export function getNurseWorkStyleOptions() {
  return NURSE_WORK_STYLE_OPTIONS.map((option) => ({
    ...option,
    label: pickLocalizedLabel(workStyleLabelMap[option.key]) || option.label,
  }));
}

export function getUserCareTypeOptions() {
  return USER_CARE_TYPE_OPTIONS.map((option) => ({
    ...option,
    label: pickLocalizedLabel(careTypeLabelMap[option.key]) || option.label,
  }));
}

export function getHospitalUrgencyOptions() {
  return HOSPITAL_URGENCY_OPTIONS.map((option) => ({
    ...option,
    label: pickLocalizedLabel(urgencyLabelMap[option.key]) || option.label,
  }));
}

export function getStaffTypeThaiLabel(value?: string | null): string {
  if (!value) return getNotSpecifiedLabel();
  return getStaffTypeDisplayName(value);
}

export function getOrgTypeThaiLabel(value?: string | null): string {
  if (!value) return getNotSpecifiedLabel();
  return pickLocalizedLabel(orgTypeLabelMap[value as OrgType]) || value;
}

export function getWorkStyleThaiLabel(value?: string | null): string {
  if (!value) return getNotSpecifiedLabel();
  return pickLocalizedLabel(workStyleLabelMap[value]) || value;
}

export function getCareTypeThaiLabel(value?: string | null): string {
  if (!value) return getNotSpecifiedLabel();
  return pickLocalizedLabel(careTypeLabelMap[value]) || value;
}

export function getHiringUrgencyThaiLabel(value?: string | null): string {
  if (!value) return getNotSpecifiedLabel();
  return pickLocalizedLabel(urgencyLabelMap[value]) || value;
}

export function getThaiLabels(values: Array<string | null | undefined>, labeler: (value?: string | null) => string): string[] {
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => labeler(value));
}