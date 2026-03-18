// ============================================
// VALIDATION UTILITIES - ตรวจสอบข้อมูลที่กรอก
// ============================================

// ============================================
// Regular Expressions
// ============================================
const REGEX = {
  // Thai phone: 08X-XXX-XXXX or 09X-XXX-XXXX
  thaiPhone: /^0[689]\d{8}$/,
  
  // Email
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  // Thai national ID (13 digits)
  thaiNationalId: /^\d{13}$/,
  
  // Only letters (Thai + English)
  onlyLetters: /^[a-zA-Zก-๙\s]+$/,
  
  // Only numbers
  onlyNumbers: /^\d+$/,
  
  // Username: alphanumeric + underscore, 3-20 chars
  username: /^[a-zA-Z0-9_]{3,20}$/,
  
  // License number (Thai nursing license)
  nursingLicense: /^\d{5,10}$/,
  
  // URL
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  
  // LINE ID
  lineId: /^[a-zA-Z0-9_.]{4,20}$/,
};

// ============================================
// Validation Functions
// ============================================

/**
 * ตรวจสอบ ว่าไม่ว่าง
 */
export function isRequired(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

/**
 * ตรวจสอบเบอร์โทรไทย
 */
export function isValidThaiPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return REGEX.thaiPhone.test(cleaned);
}

/**
 * ตรวจสอบ email
 */
export function isValidEmail(email: string): boolean {
  return REGEX.email.test(email.trim().toLowerCase());
}

/**
 * ตรวจสอบเลขบัตรประชาชนไทย (13 หลัก + checksum)
 */
export function isValidThaiNationalId(id: string): boolean {
  const cleaned = id.replace(/\D/g, '');
  if (!REGEX.thaiNationalId.test(cleaned)) return false;
  
  // Checksum validation
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(cleaned[12]);
}

/**
 * ตรวจสอบ username
 */
export function isValidUsername(username: string): boolean {
  return REGEX.username.test(username);
}

/**
 * ตรวจสอบความยาวขั้นต่ำ
 */
export function hasMinLength(value: string, minLength: number): boolean {
  return value.trim().length >= minLength;
}

/**
 * ตรวจสอบความยาวสูงสุด
 */
export function hasMaxLength(value: string, maxLength: number): boolean {
  return value.trim().length <= maxLength;
}

/**
 * ตรวจสอบรหัสผ่าน (อย่างน้อย 8 ตัว)
 */
export function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' };
  }
  // Optional: เพิ่มข้อกำหนดอื่นๆ
  // if (!/[A-Z]/.test(password)) {
  //   return { valid: false, error: 'รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว' };
  // }
  return { valid: true };
}

/**
 * ตรวจสอบค่าตอบแทน (ตัวเลขบวก)
 */
export function isValidSalary(value: string): boolean {
  const num = parseFloat(value.replace(/,/g, ''));
  return !isNaN(num) && num > 0;
}

/**
 * ตรวจสอบ LINE ID
 */
export function isValidLineId(lineId: string): boolean {
  return REGEX.lineId.test(lineId);
}

/**
 * ตรวจสอบเลขใบประกอบวิชาชีพ
 */
export function isValidNursingLicense(license: string): boolean {
  const cleaned = license.replace(/\D/g, '');
  return REGEX.nursingLicense.test(cleaned);
}

// ============================================
// Sanitization Functions (ป้องกัน XSS/Injection)
// ============================================

/**
 * ลบ HTML tags ออกจาก string
 */
export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Escape special characters
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * ทำความสะอาด input (ลบ whitespace เกิน + HTML)
 */
export function sanitizeInput(str: string): string {
  return stripHtml(str)
    .trim()
    .replace(/\s+/g, ' '); // ลด whitespace หลายตัวเหลือ 1
}

/**
 * ทำความสะอาดเบอร์โทร (เหลือแค่ตัวเลข)
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * ทำความสะอาด email (lowercase + trim)
 */
export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================
// Form Validation Helper
// ============================================

interface ValidationRule {
  validator: (value: any) => boolean;
  message: string;
}

interface FieldRules {
  [fieldName: string]: ValidationRule[];
}

/**
 * ตรวจสอบฟอร์มทั้งหมดในครั้งเดียว
 * @returns Record<string, string> - errors หรือ {} ถ้าผ่านทั้งหมด
 */
export function validateForm(
  values: Record<string, any>,
  rules: FieldRules
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const fieldName of Object.keys(rules)) {
    const fieldRules = rules[fieldName];
    const value = values[fieldName];

    for (const rule of fieldRules) {
      if (!rule.validator(value)) {
        errors[fieldName] = rule.message;
        break; // เอาแค่ error แรกของแต่ละ field
      }
    }
  }

  return errors;
}

// ============================================
// Common Validation Rules (ใช้ซ้ำได้)
// ============================================

export const RULES = {
  required: (message = 'กรุณากรอกข้อมูล'): ValidationRule => ({
    validator: isRequired,
    message,
  }),
  
  email: (message = 'รูปแบบอีเมลไม่ถูกต้อง'): ValidationRule => ({
    validator: isValidEmail,
    message,
  }),
  
  thaiPhone: (message = 'รูปแบบเบอร์โทรไม่ถูกต้อง (เช่น 08X-XXX-XXXX)'): ValidationRule => ({
    validator: isValidThaiPhone,
    message,
  }),
  
  minLength: (min: number, message?: string): ValidationRule => ({
    validator: (v) => hasMinLength(v || '', min),
    message: message || `ต้องมีอย่างน้อย ${min} ตัวอักษร`,
  }),
  
  maxLength: (max: number, message?: string): ValidationRule => ({
    validator: (v) => hasMaxLength(v || '', max),
    message: message || `ต้องไม่เกิน ${max} ตัวอักษร`,
  }),
  
  username: (message = 'Username ต้องเป็นตัวอักษร/ตัวเลข 3-20 ตัว'): ValidationRule => ({
    validator: isValidUsername,
    message,
  }),
  
  salary: (message = 'กรุณากรอกจำนวนเงินที่ถูกต้อง'): ValidationRule => ({
    validator: isValidSalary,
    message,
  }),
  
  thaiNationalId: (message = 'เลขบัตรประชาชนไม่ถูกต้อง'): ValidationRule => ({
    validator: isValidThaiNationalId,
    message,
  }),
};

// ============================================
// Export All
// ============================================
export default {
  isRequired,
  isValidThaiPhone,
  isValidEmail,
  isValidThaiNationalId,
  isValidUsername,
  isValidPassword,
  isValidSalary,
  isValidLineId,
  isValidNursingLicense,
  hasMinLength,
  hasMaxLength,
  stripHtml,
  escapeHtml,
  sanitizeInput,
  sanitizePhone,
  sanitizeEmail,
  validateForm,
  RULES,
};
