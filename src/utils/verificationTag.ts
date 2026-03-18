import { StaffType, getStaffTypeLabel } from '../constants/jobOptions';

export interface VerificationTagInput {
  isVerified?: boolean;
  role?: string | null;
  orgType?: string | null;
  staffType?: string | null;
}

export interface IdentityTagInput {
  role?: string | null;
  orgType?: string | null;
  staffType?: string | null;
  staffTypes?: string[] | null;
  adminTags?: string[] | null;
  adminWarningTag?: string | null;
}

export interface RoleTagColors {
  backgroundColor: string;
  textColor: string;
}

export interface AdminDisplayTag {
  label: string;
  tone: 'info' | 'warning';
}

export function getVerificationTagText(input: VerificationTagInput): string | null {
  if (!input.isVerified) return null;

  return 'ยืนยันตัวตนแล้ว';
}

export function hasRoleTag(role?: string | null, orgType?: string | null, staffType?: string | null): boolean {
  if (role === 'admin' || role === 'user') return true;
  if (role === 'hospital') return true;
  if (role === 'nurse') return true;
  return Boolean(orgType || staffType);
}

function getNurseRoleLabel(staffType?: string | null): string {
  switch (staffType) {
    case 'RN':
      return 'Nurse';
    case 'PN':
    case 'NA':
      return 'ผู้ช่วยพยาบาล';
    case 'CG':
      return 'Caregiver';
    case 'SITTER':
      return 'เฝ้าไข้';
    case 'ANES':
      return 'วิสัญญีพยาบาล';
    case 'OTHER':
      return 'บุคลากรทางการแพทย์';
    default:
      return staffType ? getStaffTypeLabel(staffType as StaffType) : 'Nurse';
  }
}

export function getRoleLabel(role?: string | null, orgType?: string | null, staffType?: string | null): string {
  if (role === 'nurse') return getNurseRoleLabel(staffType);

  if (role === 'hospital') {
    switch (orgType) {
      case 'public_hospital':
        return 'HR Hospital';
      case 'private_hospital':
        return 'HR Hospital';
      case 'clinic':
        return 'Clinic';
      case 'agency':
        return 'Agency';
      default:
        return 'HR Hospital';
    }
  }

  if (role === 'admin') return 'ผู้ดูแลระบบ';
  return 'ผู้ใช้ทั่วไป';
}

export function getRoleIconName(role?: string | null): 'shield-checkmark' | 'medical' | 'business' | 'person' {
  if (role === 'admin') return 'shield-checkmark';
  if (role === 'nurse') return 'medical';
  if (role === 'hospital') return 'business';
  return 'person';
}

export function getRoleTagColors(role?: string | null): RoleTagColors {
  if (role === 'admin') {
    return { backgroundColor: '#FEE2E2', textColor: '#B91C1C' };
  }

  if (role === 'nurse') {
    return { backgroundColor: '#DBEAFE', textColor: '#1D4ED8' };
  }

  if (role === 'hospital') {
    return { backgroundColor: '#FEF3C7', textColor: '#B45309' };
  }

  return { backgroundColor: '#DCFCE7', textColor: '#15803D' };
}

export function hasPremiumTag(plan?: string | null): boolean {
  return Boolean(plan && plan !== 'free');
}

export function getPremiumTagText(plan?: string | null): string | null {
  if (!plan || plan === 'free') return null;

  if (plan === 'premium') return 'Premium';
  if (plan === 'nurse_pro') return 'Nurse Pro';
  if (plan === 'hospital_starter') return 'Starter';
  if (plan === 'hospital_pro') return 'Hospital Pro';
  if (plan === 'hospital_enterprise') return 'Enterprise';
  return 'Premium';
}

export function getPremiumTagColors(): RoleTagColors {
  return {
    backgroundColor: '#FEF3C7',
    textColor: '#92400E',
  };
}

export function getAdminDisplayTags(adminTags?: string[] | null, adminWarningTag?: string | null): AdminDisplayTag[] {
  const uniqueLabels = [...new Set((adminTags || []).map((tag) => String(tag || '').trim()).filter(Boolean))];
  const tags: AdminDisplayTag[] = uniqueLabels.map((label) => ({ label, tone: 'info' }));
  const warningLabel = String(adminWarningTag || '').trim();

  if (warningLabel) {
    tags.unshift({ label: warningLabel, tone: 'warning' });
  }

  return tags;
}

function normalizeSurveyTagLabel(tag: string): string {
  switch (tag) {
    case 'SITTER':
      return 'เฝ้าไข้';
    case 'public_hospital':
    case 'private_hospital':
      return 'HR';
    case 'clinic':
      return 'CLINIC';
    case 'agency':
      return 'AGENCY';
    default:
      return tag;
  }
}

export function getSurveySelectionTags(input: Pick<IdentityTagInput, 'role' | 'orgType' | 'staffType' | 'staffTypes'>): string[] {
  if (input.role === 'nurse') {
    const selections = input.staffTypes?.length ? input.staffTypes : input.staffType ? [input.staffType] : [];
    return [...new Set(selections.map((tag) => normalizeSurveyTagLabel(String(tag))))];
  }

  if (input.role === 'hospital') {
    const orgTag = normalizeSurveyTagLabel(String(input.orgType || ''));
    return orgTag ? [orgTag] : ['HR'];
  }

  return [];
}

export function getIdentityDisplayTags(input: IdentityTagInput): AdminDisplayTag[] {
  const surveyTags = getSurveySelectionTags(input).map((label) => ({ label, tone: 'info' as const }));
  const manualTags = getAdminDisplayTags(input.adminTags, input.adminWarningTag);
  const merged: AdminDisplayTag[] = [];
  const seen = new Set<string>();

  for (const tag of [...manualTags, ...surveyTags]) {
    const key = `${tag.tone}:${tag.label}`;
    if (!tag.label || seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
  }

  return merged;
}

export function getAdminDisplayTagColors(tone: 'info' | 'warning'): RoleTagColors {
  if (tone === 'warning') {
    return {
      backgroundColor: '#FEE2E2',
      textColor: '#B91C1C',
    };
  }

  return {
    backgroundColor: '#E0E7FF',
    textColor: '#4338CA',
  };
}
