import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  limit,
  where,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  AppliedCampaignCode,
  CampaignCode,
  CampaignCodeBenefitType,
  CampaignCodePackage,
  CampaignCodeRole,
  PRICING,
  SubscriptionPlan,
  Timestamp,
} from '../types';

const CAMPAIGN_CODES_COL = 'campaign_codes';
const CAMPAIGN_CODE_REDEMPTIONS_COL = 'campaign_code_redemptions';
const USERS_COLLECTION = 'users';
const PURCHASES_COLLECTION = 'purchases';

export const CAMPAIGN_PACKAGE_OPTIONS: Array<{
  key: CampaignCodePackage;
  label: string;
  amount: number;
  plan?: SubscriptionPlan;
  audience: 'user' | 'nurse' | 'hospital' | 'both';
}> = [
  { key: 'premium_monthly', label: 'Premium รายเดือน', amount: PRICING.nursePro, plan: 'premium', audience: 'user' },
  { key: 'premium_annual', label: 'Premium รายปี', amount: PRICING.nurseProAnnual, plan: 'premium', audience: 'user' },
  { key: 'nurse_pro_monthly', label: 'Nurse Pro รายเดือน', amount: PRICING.nursePro, plan: 'nurse_pro', audience: 'nurse' },
  { key: 'nurse_pro_annual', label: 'Nurse Pro รายปี', amount: PRICING.nurseProAnnual, plan: 'nurse_pro', audience: 'nurse' },
  { key: 'hospital_starter_monthly', label: 'Starter รายเดือน', amount: PRICING.hospitalStarter, plan: 'hospital_starter', audience: 'hospital' },
  { key: 'hospital_starter_annual', label: 'Starter รายปี', amount: PRICING.hospitalStarterAnnual, plan: 'hospital_starter', audience: 'hospital' },
  { key: 'hospital_pro_monthly', label: 'Professional รายเดือน', amount: PRICING.hospitalPro, plan: 'hospital_pro', audience: 'hospital' },
  { key: 'hospital_pro_annual', label: 'Professional รายปี', amount: PRICING.hospitalProAnnual, plan: 'hospital_pro', audience: 'hospital' },
  { key: 'hospital_enterprise_monthly', label: 'Enterprise รายเดือน', amount: PRICING.hospitalEnterprise, plan: 'hospital_enterprise', audience: 'hospital' },
  { key: 'hospital_enterprise_annual', label: 'Enterprise รายปี', amount: PRICING.hospitalEnterpriseAnnual, plan: 'hospital_enterprise', audience: 'hospital' },
  { key: 'extra_post', label: 'โพสต์เพิ่ม 1 ครั้ง', amount: PRICING.extraPost, audience: 'both' },
  { key: 'extend_post', label: 'ต่ออายุโพสต์ 1 วัน', amount: PRICING.extendPost, audience: 'both' },
  { key: 'urgent_post', label: 'ป้ายด่วน 1 ครั้ง', amount: PRICING.urgentPost, audience: 'both' },
];

const ALL_CAMPAIGN_PACKAGES = CAMPAIGN_PACKAGE_OPTIONS.map((item) => item.key);

const CAMPAIGN_PACKAGE_EQUIVALENTS: Partial<Record<CampaignCodePackage, CampaignCodePackage[]>> = {
  premium_monthly: ['premium_monthly', 'nurse_pro_monthly'],
  nurse_pro_monthly: ['premium_monthly', 'nurse_pro_monthly'],
  premium_annual: ['premium_annual', 'nurse_pro_annual'],
  nurse_pro_annual: ['premium_annual', 'nurse_pro_annual'],
};

export interface CampaignCodeInput {
  code: string;
  title: string;
  description?: string;
  benefitType: CampaignCodeBenefitType;
  benefitValue: number;
  isActive: boolean;
  allowedRoles: CampaignCodeRole[];
  allowedPackages: CampaignCodePackage[];
  firstPurchaseOnly: boolean;
  minSpend: number;
  maxUses: number | null;
  expiresAt?: Date | null;
  createdBy?: string;
}

export interface CampaignCodeUpdateInput {
  title?: string;
  description?: string;
  benefitType?: CampaignCodeBenefitType;
  benefitValue?: number;
  isActive?: boolean;
  allowedRoles?: CampaignCodeRole[];
  allowedPackages?: CampaignCodePackage[];
  firstPurchaseOnly?: boolean;
  minSpend?: number;
  maxUses?: number | null;
  expiresAt?: Date | null;
}

export interface CampaignCodeValidationInput {
  code: string;
  userId: string;
  userRole: string;
  packageKey: CampaignCodePackage;
  amount: number;
}

export interface CampaignCodeValidationResult {
  valid: boolean;
  message: string;
  code?: CampaignCode;
  pendingCode?: AppliedCampaignCode;
}

export interface CampaignCodeConsumptionResult {
  applied: boolean;
  message?: string;
  pendingCode?: AppliedCampaignCode;
}

function toDate(value: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function normalizeCampaignCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

export function generateCampaignCode(prefix = 'NG'): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${random}`;
}

export function getCampaignPackageOption(packageKey: CampaignCodePackage) {
  return CAMPAIGN_PACKAGE_OPTIONS.find((item) => item.key === packageKey);
}

export function getEquivalentCampaignPackageKeys(packageKey: CampaignCodePackage): CampaignCodePackage[] {
  return CAMPAIGN_PACKAGE_EQUIVALENTS[packageKey] || [packageKey];
}

export function getCampaignPackageDisplayKey(packageKey: CampaignCodePackage, role?: string | null): CampaignCodePackage {
  const isNurse = role === 'nurse';

  switch (packageKey) {
    case 'premium_monthly':
    case 'nurse_pro_monthly':
      return isNurse ? 'nurse_pro_monthly' : 'premium_monthly';
    case 'premium_annual':
    case 'nurse_pro_annual':
      return isNurse ? 'nurse_pro_annual' : 'premium_annual';
    default:
      return packageKey;
  }
}

export function getCampaignPackageLabel(packageKey: CampaignCodePackage): string {
  return getCampaignPackageOption(packageKey)?.label || packageKey;
}

export function getCampaignPackageDisplayLabel(packageKey: CampaignCodePackage, role?: string | null): string {
  return getCampaignPackageLabel(getCampaignPackageDisplayKey(packageKey, role));
}

export function getCampaignPackageAmount(packageKey: CampaignCodePackage): number {
  return getCampaignPackageOption(packageKey)?.amount || 0;
}

export function getCampaignBenefitSummary(benefitType: CampaignCodeBenefitType, benefitValue: number): string {
  switch (benefitType) {
    case 'percent_discount':
      return `ลด ${benefitValue}%`;
    case 'fixed_discount':
      return `ลด ฿${benefitValue.toLocaleString()}`;
    case 'free_urgent':
      return `ฟรีป้ายด่วน ${benefitValue} ครั้ง`;
    case 'free_post':
      return `ฟรีโพสต์ ${benefitValue} ครั้ง`;
    case 'bonus_days':
      return `เพิ่มวันประกาศ ${benefitValue} วัน`;
    default:
      return 'ไม่ระบุ';
  }
}

function normalizeUserRole(role: string): CampaignCodeRole {
  if (role === 'nurse' || role === 'hospital' || role === 'admin') return role;
  return 'user';
}

function calculateCampaignPrice(
  benefitType: CampaignCodeBenefitType,
  benefitValue: number,
  amount: number,
): { finalAmount: number; discountAmount: number } {
  if (amount <= 0) {
    return { finalAmount: 0, discountAmount: 0 };
  }

  switch (benefitType) {
    case 'percent_discount': {
      const discountAmount = Math.min(amount, Math.round((amount * benefitValue) / 100));
      return { finalAmount: Math.max(0, amount - discountAmount), discountAmount };
    }
    case 'fixed_discount': {
      const discountAmount = Math.min(amount, benefitValue);
      return { finalAmount: Math.max(0, amount - discountAmount), discountAmount };
    }
    case 'free_urgent':
    case 'free_post':
      return { finalAmount: 0, discountAmount: amount };
    case 'bonus_days':
    default:
      return { finalAmount: amount, discountAmount: 0 };
  }
}

async function hasCompletedPaidPurchase(userId: string): Promise<boolean> {
  const purchasesRef = collection(db, PURCHASES_COLLECTION);
  const purchaseQuery = query(
    purchasesRef,
    where('userId', '==', userId),
    where('status', '==', 'completed'),
    limit(1),
  );
  const purchaseSnap = await getDocs(purchaseQuery);
  if (!purchaseSnap.empty) return true;

  const userSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
  if (!userSnap.exists()) return false;
  const subscriptionPlan = userSnap.data()?.subscription?.plan;
  return subscriptionPlan != null && subscriptionPlan !== 'free';
}

function buildPendingCampaignCode(
  campaignCode: CampaignCode,
  packageKey: CampaignCodePackage,
  amount: number,
): AppliedCampaignCode {
  const pricing = calculateCampaignPrice(campaignCode.benefitType, campaignCode.benefitValue, amount);
  return {
    code: campaignCode.code,
    title: campaignCode.title,
    description: campaignCode.description,
    benefitType: campaignCode.benefitType,
    benefitValue: campaignCode.benefitValue,
    packageKey,
    packageLabel: getCampaignPackageLabel(packageKey),
    originalAmount: amount,
    finalAmount: pricing.finalAmount,
    discountAmount: pricing.discountAmount,
    appliedAt: new Date(),
  };
}

function mapCampaignCode(docSnap: any): CampaignCode {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    code: data.code || docSnap.id,
    title: data.title || 'ไม่มีชื่อ',
    description: data.description || '',
    benefitType: data.benefitType || 'percent_discount',
    benefitValue: Number(data.benefitValue || 0),
    usedCount: Number(data.usedCount || 0),
    isActive: data.isActive !== false,
    rule: {
      allowedRoles: Array.isArray(data.rule?.allowedRoles) ? data.rule.allowedRoles : ['user', 'nurse', 'hospital'],
      allowedPackages: Array.isArray(data.rule?.allowedPackages) && data.rule.allowedPackages.length > 0
        ? data.rule.allowedPackages
        : ALL_CAMPAIGN_PACKAGES,
      firstPurchaseOnly: Boolean(data.rule?.firstPurchaseOnly),
      minSpend: Number(data.rule?.minSpend || 0),
      maxUses: data.rule?.maxUses == null ? null : Number(data.rule.maxUses),
      expiresAt: toDate(data.rule?.expiresAt),
    },
    createdBy: data.createdBy,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getAllCampaignCodes(limitCount: number = 100): Promise<CampaignCode[]> {
  try {
    const codesRef = collection(db, CAMPAIGN_CODES_COL);
    const q = query(codesRef, orderBy('createdAt', 'desc'), limit(limitCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapCampaignCode);
  } catch (error) {
    console.error('[campaignCodeService] getAllCampaignCodes error:', error);
    return [];
  }
}

export async function createCampaignCode(input: CampaignCodeInput): Promise<CampaignCode> {
  const normalizedCode = normalizeCampaignCode(input.code);
  if (!normalizedCode) {
    throw new Error('กรุณากำหนดรหัสโค้ด');
  }

  const codeRef = doc(db, CAMPAIGN_CODES_COL, normalizedCode);
  const existing = await getDoc(codeRef);
  if (existing.exists()) {
    throw new Error('โค้ดนี้ถูกใช้งานแล้ว');
  }

  await setDoc(codeRef, {
    code: normalizedCode,
    title: input.title.trim(),
    description: input.description?.trim() || '',
    benefitType: input.benefitType,
    benefitValue: input.benefitValue,
    usedCount: 0,
    isActive: input.isActive,
    rule: {
      allowedRoles: input.allowedRoles,
      allowedPackages: input.allowedPackages,
      firstPurchaseOnly: input.firstPurchaseOnly,
      minSpend: input.minSpend,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt || null,
    },
    createdBy: input.createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await getDoc(codeRef);
  return mapCampaignCode(created);
}

export async function updateCampaignCode(code: string, input: CampaignCodeUpdateInput): Promise<void> {
  const normalizedCode = normalizeCampaignCode(code);
  const codeRef = doc(db, CAMPAIGN_CODES_COL, normalizedCode);

  await updateDoc(codeRef, {
    ...(input.title !== undefined ? { title: input.title.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(input.benefitType !== undefined ? { benefitType: input.benefitType } : {}),
    ...(input.benefitValue !== undefined ? { benefitValue: input.benefitValue } : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.allowedRoles !== undefined || input.allowedPackages !== undefined || input.firstPurchaseOnly !== undefined || input.minSpend !== undefined || input.maxUses !== undefined || input.expiresAt !== undefined
      ? {
          rule: {
            ...(input.allowedRoles !== undefined ? { allowedRoles: input.allowedRoles } : {}),
            ...(input.allowedPackages !== undefined ? { allowedPackages: input.allowedPackages } : {}),
            ...(input.firstPurchaseOnly !== undefined ? { firstPurchaseOnly: input.firstPurchaseOnly } : {}),
            ...(input.minSpend !== undefined ? { minSpend: input.minSpend } : {}),
            ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
            ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt || null } : {}),
          },
        }
      : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function setCampaignCodeActive(code: string, isActive: boolean): Promise<void> {
  const normalizedCode = normalizeCampaignCode(code);
  await updateDoc(doc(db, CAMPAIGN_CODES_COL, normalizedCode), {
    isActive,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCampaignCode(code: string): Promise<void> {
  const normalizedCode = normalizeCampaignCode(code);
  await deleteDoc(doc(db, CAMPAIGN_CODES_COL, normalizedCode));
}

export async function validateCampaignCode(input: CampaignCodeValidationInput): Promise<CampaignCodeValidationResult> {
  const normalizedCode = normalizeCampaignCode(input.code);
  if (!normalizedCode) {
    return { valid: false, message: 'กรุณากรอกรหัสโค้ด' };
  }

  const packageOption = getCampaignPackageOption(input.packageKey);
  if (!packageOption) {
    return { valid: false, message: 'ไม่พบแพ็กเกจที่เลือก' };
  }

  const codeSnap = await getDoc(doc(db, CAMPAIGN_CODES_COL, normalizedCode));
  if (!codeSnap.exists()) {
    return { valid: false, message: 'ไม่พบโค้ดนี้ในระบบ' };
  }

  const campaignCode = mapCampaignCode(codeSnap);
  const userRole = normalizeUserRole(input.userRole);
  const now = new Date();

  if (!campaignCode.isActive) {
    return { valid: false, message: 'โค้ดนี้ยังไม่เปิดใช้งาน' };
  }
  if (!campaignCode.rule.allowedRoles.includes(userRole)) {
    return { valid: false, message: 'โค้ดนี้ยังไม่รองรับ role ของคุณ' };
  }
  const equivalentPackageKeys = getEquivalentCampaignPackageKeys(input.packageKey);

  if (!campaignCode.rule.allowedPackages.some((packageKey) => equivalentPackageKeys.includes(packageKey))) {
    return {
      valid: false,
      message: `โค้ดนี้ใช้กับ ${getCampaignPackageDisplayLabel(input.packageKey, input.userRole)} ไม่ได้`,
    };
  }
  if (campaignCode.rule.expiresAt && campaignCode.rule.expiresAt < now) {
    return { valid: false, message: 'โค้ดนี้หมดอายุแล้ว' };
  }
  if (campaignCode.rule.maxUses != null && campaignCode.usedCount >= campaignCode.rule.maxUses) {
    return { valid: false, message: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' };
  }
  if (input.amount < campaignCode.rule.minSpend) {
    return {
      valid: false,
      message: `ยอดซื้อขั้นต่ำสำหรับโค้ดนี้คือ ฿${campaignCode.rule.minSpend.toLocaleString()}`,
    };
  }
  if (campaignCode.rule.firstPurchaseOnly) {
    const alreadyPurchased = await hasCompletedPaidPurchase(input.userId);
    if (alreadyPurchased) {
      return { valid: false, message: 'โค้ดนี้ใช้ได้เฉพาะการซื้อครั้งแรก' };
    }
  }

  return {
    valid: true,
    message: `ใช้โค้ดได้: ${getCampaignBenefitSummary(campaignCode.benefitType, campaignCode.benefitValue)}`,
    code: campaignCode,
    pendingCode: buildPendingCampaignCode(campaignCode, input.packageKey, input.amount),
  };
}

export async function savePendingCampaignCodeForUser(input: CampaignCodeValidationInput): Promise<CampaignCodeValidationResult> {
  const validation = await validateCampaignCode(input);
  if (!validation.valid || !validation.pendingCode) {
    return validation;
  }

  await updateDoc(doc(db, USERS_COLLECTION, input.userId), {
    pendingCampaignCode: validation.pendingCode,
    updatedAt: serverTimestamp(),
  });

  return validation;
}

export async function clearPendingCampaignCodeForUser(userId: string): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, userId), {
    pendingCampaignCode: null,
    updatedAt: serverTimestamp(),
  });
}

export async function consumePendingCampaignCodeForPurchase(input: {
  userId: string;
  packageKey: CampaignCodePackage;
  amount: number;
  purchaseId?: string;
  transactionId?: string;
}): Promise<CampaignCodeConsumptionResult> {
  const userRef = doc(db, USERS_COLLECTION, input.userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    return { applied: false, message: 'ไม่พบข้อมูลผู้ใช้' };
  }

  const userData = userSnap.data();
  const pendingCode = userData.pendingCampaignCode as AppliedCampaignCode | undefined;
  if (!pendingCode) {
    return { applied: false, message: 'ไม่มีโค้ดที่รอใช้งาน' };
  }
  if (!getEquivalentCampaignPackageKeys(pendingCode.packageKey).includes(input.packageKey)) {
    return { applied: false, message: 'โค้ดที่บันทึกไว้เป็นคนละแพ็กเกจ' };
  }

  const codeRef = doc(db, CAMPAIGN_CODES_COL, normalizeCampaignCode(pendingCode.code));
  await runTransaction(db, async (transaction) => {
    const codeSnap = await transaction.get(codeRef);
    if (!codeSnap.exists()) {
      throw new Error('ไม่พบโค้ดนี้ในระบบ');
    }

    const campaignCode = mapCampaignCode(codeSnap);
    const userRole = normalizeUserRole(userData.role);

    if (!campaignCode.isActive) {
      throw new Error('โค้ดนี้ถูกปิดใช้งานแล้ว');
    }
    if (!campaignCode.rule.allowedRoles.includes(userRole)) {
      throw new Error('โค้ดนี้ยังไม่รองรับประเภทบัญชีของคุณ');
    }
    if (!campaignCode.rule.allowedPackages.some((packageKey) => getEquivalentCampaignPackageKeys(input.packageKey).includes(packageKey))) {
      throw new Error('โค้ดนี้ไม่รองรับแพ็กเกจที่กำลังซื้อ');
    }
    if (campaignCode.rule.expiresAt && campaignCode.rule.expiresAt < new Date()) {
      throw new Error('โค้ดนี้หมดอายุแล้ว');
    }
    if (campaignCode.rule.maxUses != null && campaignCode.usedCount >= campaignCode.rule.maxUses) {
      throw new Error('โค้ดนี้ถูกใช้ครบจำนวนแล้ว');
    }
    if (input.amount < campaignCode.rule.minSpend) {
      throw new Error(`ยอดซื้อขั้นต่ำสำหรับโค้ดนี้คือ ฿${campaignCode.rule.minSpend.toLocaleString()}`);
    }

    transaction.update(codeRef, {
      usedCount: campaignCode.usedCount + 1,
      updatedAt: serverTimestamp(),
    });
    transaction.update(userRef, {
      pendingCampaignCode: null,
      updatedAt: serverTimestamp(),
    });
  });

  if (pendingCode) {
    const pricing = calculateCampaignPrice(pendingCode.benefitType, pendingCode.benefitValue, input.amount);
    const redemptionRef = doc(collection(db, CAMPAIGN_CODE_REDEMPTIONS_COL));
    await setDoc(redemptionRef, {
      code: pendingCode.code,
      userId: input.userId,
      packageKey: input.packageKey,
      originalAmount: input.amount,
      finalAmount: pricing.finalAmount,
      discountAmount: pricing.discountAmount,
      purchaseId: input.purchaseId || null,
      transactionId: input.transactionId || null,
      createdAt: serverTimestamp(),
    });

    return {
      applied: true,
      message: `ใช้โค้ดสำเร็จ: ${getCampaignBenefitSummary(pendingCode.benefitType, pendingCode.benefitValue)}`,
      pendingCode,
    };
  }

  return { applied: false, message: 'ไม่สามารถสรุปผลการใช้โค้ดได้' };
}