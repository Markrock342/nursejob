// ============================================
// THEME - NurseGo Design System v2
// Modern Healthcare Startup · 2026
// ============================================

export const COLORS = {
  // ------------------------------------------
  // Brand — Sky Blue (trust + medical)
  // ------------------------------------------
  primary: '#0EA5E9',
  primaryDark: '#0284C7',
  primaryLight: '#38BDF8',
  primaryBackground: '#F0F9FF',

  // ------------------------------------------
  // Secondary — Emerald (healthcare + growth)
  // ------------------------------------------
  secondary: '#10B981',
  secondaryDark: '#059669',
  secondaryLight: '#34D399',
  secondaryBackground: '#ECFDF5',

  // ------------------------------------------
  // Accent — Amber (CTAs + important)
  // ------------------------------------------
  accent: '#F59E0B',
  accentDark: '#D97706',
  accentLight: '#FCD34D',
  accentBackground: '#FFFBEB',

  // ------------------------------------------
  // Base
  // ------------------------------------------
  white: '#FFFFFF',
  black: '#000000',

  // ------------------------------------------
  // Backgrounds
  // ------------------------------------------
  background: '#F8FAFC',
  backgroundSecondary: '#F1F5F9',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  // ------------------------------------------
  // Text (Slate scale)
  // ------------------------------------------
  text: '#0F172A',
  textSecondary: '#475569',
  textLight: '#94A3B8',
  textInverse: '#FFFFFF',
  textMuted: '#CBD5E1',

  // ------------------------------------------
  // Borders
  // ------------------------------------------
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#F1F5F9',

  // ------------------------------------------
  // Status
  // ------------------------------------------
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // ------------------------------------------
  // Marketplace — Special states
  // ------------------------------------------
  urgent: '#EF4444',       // งานด่วน
  urgentBg: '#FEF2F2',
  verified: '#10B981',     // ยืนยันตัวตน
  verifiedBg: '#ECFDF5',
  premium: '#F59E0B',      // Premium badge
  premiumBg: '#FFFBEB',
  online: '#22C55E',
  offline: '#94A3B8',

  // ------------------------------------------
  // Social Login
  // ------------------------------------------
  google: '#EA4335',
  facebook: '#1877F2',
  line: '#00B900',

  // ------------------------------------------
  // Overlay
  // ------------------------------------------
  overlay: 'rgba(15, 23, 42, 0.6)',
  overlayLight: 'rgba(15, 23, 42, 0.35)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  xxxl: 24,
  title: 28,
  hero: 32,
} as const;

export const FONT_WEIGHTS = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const BORDER_RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  // Aliases
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// พื้นที่ให้บริการ - กทม.และปริมณฑล
export const PROVINCES = [
  'กรุงเทพมหานคร',
  'นนทบุรี',
  'ปทุมธานี',
  'สมุทรปราการ',
  'สมุทรสาคร',
  'นครปฐม',
] as const;

// เขตในกรุงเทพ
export const BANGKOK_DISTRICTS = [
  'พระนคร', 'ดุสิต', 'หนองจอก', 'บางรัก', 'บางเขน', 'บางกะปิ',
  'ปทุมวัน', 'ป้อมปราบฯ', 'พระโขนง', 'มีนบุรี', 'ลาดกระบัง', 'ยานนาวา',
  'สัมพันธวงศ์', 'พญาไท', 'ธนบุรี', 'บางกอกใหญ่', 'ห้วยขวาง', 'คลองสาน',
  'ตลิ่งชัน', 'บางกอกน้อย', 'บางขุนเทียน', 'ภาษีเจริญ', 'หนองแขม', 'ราษฎร์บูรณะ',
  'บางพลัด', 'ดินแดง', 'บึงกุ่ม', 'สาทร', 'บางซื่อ', 'จตุจักร',
  'บางคอแหลม', 'ประเวศ', 'คลองเตย', 'สวนหลวง', 'จอมทอง', 'ดอนเมือง',
  'ราชเทวี', 'ลาดพร้าว', 'วัฒนา', 'บางแค', 'หลักสี่', 'สายไหม',
  'คันนายาว', 'สะพานสูง', 'วังทองหลาง', 'คลองสามวา', 'บางนา', 'ทวีวัฒนา',
  'ทุ่งครุ', 'บางบอน',
] as const;

// อำเภอในนนทบุรี
export const NONTHABURI_DISTRICTS = [
  'เมืองนนทบุรี', 'บางกรวย', 'บางใหญ่', 'บางบัวทอง', 'ไทรน้อย', 'ปากเกร็ด',
] as const;

// อำเภอในปทุมธานี
export const PATHUMTHANI_DISTRICTS = [
  'เมืองปทุมธานี', 'คลองหลวง', 'ธัญบุรี', 'หนองเสือ', 'ลาดหลุมแก้ว', 'ลำลูกกา', 'สามโคก',
] as const;

// อำเภอในสมุทรปราการ
export const SAMUTPRAKAN_DISTRICTS = [
  'เมืองสมุทรปราการ', 'บางบ่อ', 'บางพลี', 'พระประแดง', 'พระสมุทรเจดีย์', 'บางเสาธง',
] as const;

// อำเภอในสมุทรสาคร
export const SAMUTSAKHON_DISTRICTS = [
  'เมืองสมุทรสาคร', 'กระทุ่มแบน', 'บ้านแพ้ว',
] as const;

// อำเภอในนครปฐม
export const NAKHONPATHOM_DISTRICTS = [
  'เมืองนครปฐม', 'กำแพงแสน', 'นครชัยศรี', 'ดอนตูม', 'บางเลน', 'สามพราน', 'พุทธมณฑล',
] as const;

// รวมอำเภอทุกจังหวัด
export const DISTRICTS_BY_PROVINCE: Record<string, readonly string[]> = {
  'กรุงเทพมหานคร': BANGKOK_DISTRICTS,
  'นนทบุรี': NONTHABURI_DISTRICTS,
  'ปทุมธานี': PATHUMTHANI_DISTRICTS,
  'สมุทรปราการ': SAMUTPRAKAN_DISTRICTS,
  'สมุทรสาคร': SAMUTSAKHON_DISTRICTS,
  'นครปฐม': NAKHONPATHOM_DISTRICTS,
} as const;

// Position Options
export const POSITIONS = [
  'พยาบาลวิชาชีพ',
  'พยาบาลทั่วไป',
  'พยาบาล ICU',
  'พยาบาลห้องผ่าตัด',
  'พยาบาลห้องคลอด',
  'พยาบาลเด็ก',
  'พยาบาลผู้สูงอายุ',
  'พยาบาลฉุกเฉิน',
  'พยาบาลอายุรกรรม',
  'พยาบาลศัลยกรรม',
  'พยาบาลประจำคลินิก',
  'ผู้ช่วยพยาบาล',
  'พนักงานผู้ช่วยเหลือคนไข้',
] as const;

// Department Options
export const DEPARTMENTS = [
  'แผนก ICU',
  'แผนก CCU',
  'แผนกฉุกเฉิน',
  'แผนกผู้ป่วยใน',
  'แผนกผู้ป่วยนอก',
  'ห้องผ่าตัด',
  'ห้องคลอด',
  'แผนกเด็ก',
  'แผนกทารกแรกเกิด',
  'แผนกอายุรกรรม',
  'แผนกศัลยกรรม',
  'แผนกกระดูกและข้อ',
  'แผนกจักษุ',
  'แผนก ENT',
  'แผนกจิตเวช',
  'แผนกไตเทียม',
  'แผนกมะเร็ง',
  'แผนกกายภาพบำบัด',
  'คลินิกทั่วไป',
] as const;

// Common Benefits
export const BENEFITS = [
  'ค่าเดินทาง',
  'อาหาร',
  'ที่พัก',
  'ประกันสังคม',
  'ประกันสุขภาพ',
  'โบนัส',
  'ค่าเสี่ยงภัย',
  'ค่าล่วงเวลา',
  'วันหยุดตามกฎหมาย',
  'ค่าครองชีพ',
  'เบี้ยขยัน',
  'สวัสดิการครอบครัว',
] as const;

// Quick Filters
export const QUICK_FILTERS = [
  { key: 'all', label: 'ทั้งหมด', icon: 'grid-outline' },
  { key: 'urgent', label: 'ด่วน', icon: 'flash-outline' },
  { key: 'nearby', label: 'ใกล้ฉัน', icon: 'location-outline' },
  { key: 'icu', label: 'ICU', icon: 'pulse-outline' },
  { key: 'surgery', label: 'ผ่าตัด', icon: 'medical-outline' },
  { key: 'ward', label: 'ผู้ป่วยใน', icon: 'bed-outline' },
  { key: 'clinic', label: 'คลินิก', icon: 'business-outline' },
] as const;

// Application Status
export const APPLICATION_STATUS = {
  pending: { label: 'รอพิจารณา', color: COLORS.warning },
  viewed: { label: 'เปิดดูแล้ว', color: COLORS.info },
  shortlisted: { label: 'ผ่านคัดกรอง', color: COLORS.secondary },
  accepted: { label: 'ผ่านการคัดเลือก', color: COLORS.success },
  rejected: { label: 'ไม่ผ่าน', color: COLORS.error },
  withdrawn: { label: 'ถอนใบสมัคร', color: COLORS.textLight },
} as const;

// Error Messages (Thai)
export const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'อีเมลนี้ถูกใช้งานแล้ว',
  'auth/invalid-email': 'รูปแบบอีเมลไม่ถูกต้อง',
  'auth/weak-password': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  'auth/user-not-found': 'ไม่พบบัญชีผู้ใช้นี้',
  'auth/wrong-password': 'รหัสผ่านไม่ถูกต้อง',
  'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'auth/user-disabled': 'บัญชีนี้ถูกระงับการใช้งาน',
  'auth/too-many-requests': 'ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่',
  'auth/network-request-failed': 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต',
  'permission-denied': 'ไม่มีสิทธิ์เข้าถึง',
  'not-found': 'ไม่พบข้อมูล',
  'already-applied': 'คุณได้สมัครงานนี้แล้ว',
  'default': 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
} as const;

// Success Messages (Thai)
export const SUCCESS_MESSAGES = {
  login: 'เข้าสู่ระบบสำเร็จ',
  register: 'สร้างบัญชีสำเร็จ',
  logout: 'ออกจากระบบสำเร็จ',
  profileUpdate: 'บันทึกข้อมูลเรียบร้อยแล้ว',
  jobApply: 'สมัครงานสำเร็จ',
  jobPost: 'โพสต์งานเรียบร้อยแล้ว',
  messageSent: 'ส่งข้อความสำเร็จ',
  passwordReset: 'ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว',
} as const;
