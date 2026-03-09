// ============================================
// IAP SERVICE — stub (ระบบชำระเงินเปลี่ยนเป็น Omise แล้ว)
// Payment จัดการใน PaymentScreen + Cloud Function createOmiseCharge / checkOmiseCharge
// ============================================

export const IAP_PRODUCTS = {
  PREMIUM_MONTHLY: 'nurse_pro_monthly',
  EXTRA_POST: 'extra_post',
  EXTEND_POST: 'extend_post',
  URGENT_POST: 'urgent_post',
} as const;

export interface IAPPurchaseResult {
  success: boolean;
  transactionId?: string;
  productId?: string;
  chargeId?: string;
  error?: string;
}

export async function initializeIAP(): Promise<boolean> { return true; }
export function cleanupIAP(): void {}
export async function requestIAPPurchase(_productId: string, _userId: string, _userName: string): Promise<IAPPurchaseResult> {
  return { success: false, error: 'ใช้ PaymentScreen สำหรับการชำระเงิน' };
}
