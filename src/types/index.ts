import { Timestamp } from 'firebase/firestore';

// Re-export Timestamp so other files import from one place
export type { Timestamp };

// ============================================
// MULTI-DATE SHIFT TYPE (ใช้กับโพสที่มีหลายเวร)
// ============================================
export interface PostShift {
  id: string;           // uuid หรือ auto-generated key
  date: string;         // ISO date string: "2026-03-05"
  startTime: string;    // "08:00"
  endTime: string;      // "16:00"
  filled: boolean;      // มีคนรับเวรนี้แล้ว
  applicantId?: string; // uid ของคนที่รับ
  applicantName?: string;
}

// ============================================
// TYPE DEFINITIONS - Production Ready
// ============================================

// ============================================
// SUBSCRIPTION TYPES
// ============================================

// B2C = nurse / B2B = hospital roles
export type SubscriptionPlan =
  | 'free'
  | 'nurse_pro'
  | 'hospital_starter'
  | 'hospital_pro'
  | 'hospital_enterprise';

// backward compat alias
export type LegacyPlan = 'premium';

export type BillingCycle = 'monthly' | 'annual';

export interface Subscription {
  plan: SubscriptionPlan;
  billingCycle?: BillingCycle;
  expiresAt?: Date | Timestamp | null;
  startedAt?: Date;
  // Post tracking (free / starter)
  postsToday?: number;
  lastPostDate?: string; // YYYY-MM-DD
  // Urgent bonus — resets monthly for Pro+
  freeUrgentUsed?: boolean;
  freeUrgentMonthReset?: string; // YYYY-MM
}

// ============================================
// PRICING CONSTANTS (THB)
// ============================================
export const PRICING = {
  // ── B2C: พยาบาล ───────────────────────────
  nursePro: 59,
  nurseProAnnual: 590,           // ประหยัด ฿118 (2 เดือนฟรี)

  // ── B2B: โรงพยาบาล / เอเจนซี่ ────────────
  hospitalStarter: 299,
  hospitalStarterAnnual: 2990,   // ประหยัด ฿598
  hospitalPro: 799,
  hospitalProAnnual: 7990,       // ประหยัด ฿1,598
  hospitalEnterprise: 1799,
  hospitalEnterpriseAnnual: 17990, // ประหยัด ฿3,598

  // ── Add-ons (ทุก role) ────────────────────
  urgentPost: 49,
  extendPost: 19,
  extraPost: 29,

  // ── Legacy (backward compat) ──────────────
  subscription: 59,  // was 89 — mapped to nursePro now
} as const;

// ============================================
// PLAN DEFINITIONS
// ============================================
export const SUBSCRIPTION_PLANS = {
  // ─── FREE ────────────────────────────────
  free: {
    name: 'ฟรี',
    audience: 'both' as const,
    price: 0,
    annualPrice: 0,
    postExpiryDays: 3,
    maxPostsPerDay: 2,
    maxApplyPerDay: 3,
    urgentPerMonth: 0,
    features: [
      'สมัครงาน 3 ครั้ง/วัน',
      'โพสต์ได้ 2 ครั้ง/วัน',
      'โพสต์อยู่ 3 วัน',
      'ปุ่มด่วน ฿49/ครั้ง',
    ],
  },

  // ─── B2C: NURSE PRO ───────────────────────
  nurse_pro: {
    name: 'Nurse Pro',
    audience: 'nurse' as const,
    price: 59,
    annualPrice: 590,
    postExpiryDays: 30,
    maxPostsPerDay: null,        // ไม่จำกัด
    maxApplyPerDay: null,
    urgentPerMonth: 1,           // ปุ่มด่วนฟรี 1 ครั้ง/เดือน
    features: [
      'โพสต์ขาย/แลกเวรไม่จำกัด',
      'สมัครงานไม่จำกัด',
      'โพสต์อยู่ 30 วัน',
      '⚡ ปุ่มด่วนฟรี 1 ครั้ง/เดือน',
      '✓ Verified badge บนโปรไฟล์',
      'แจ้งเตือนงานใกล้บ้าน real-time',
    ],
  },

  // ─── B2B: HOSPITAL STARTER ────────────────
  hospital_starter: {
    name: 'Starter',
    audience: 'hospital' as const,
    price: 299,
    annualPrice: 2990,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxPostsPerMonth: 5,
    maxApplyPerDay: null,
    urgentPerMonth: 0,
    features: [
      'ลงประกาศงาน 5 ครั้ง/เดือน',
      'ดูผู้สมัครทั้งหมด',
      'โพสต์อยู่ 30 วัน',
      'โปรไฟล์องค์กร',
      'รับสมัครผ่านแชท',
    ],
  },

  // ─── B2B: HOSPITAL PRO ────────────────────
  hospital_pro: {
    name: 'Professional',
    audience: 'hospital' as const,
    price: 799,
    annualPrice: 7990,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxPostsPerMonth: null,      // ไม่จำกัด
    maxApplyPerDay: null,
    urgentPerMonth: 3,           // ปุ่มด่วนฟรี 3 ครั้ง/เดือน
    features: [
      'ลงประกาศงานไม่จำกัด',
      'ดูผู้สมัครทั้งหมด',
      '⚡ ปุ่มด่วนฟรี 3 ครั้ง/เดือน',
      'Analytics รายงานสถิติ',
      '✓ Verified badge องค์กร',
      'Priority support',
    ],
  },

  // ─── B2B: HOSPITAL ENTERPRISE ─────────────
  hospital_enterprise: {
    name: 'Enterprise',
    audience: 'hospital' as const,
    price: 1799,
    annualPrice: 17990,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxPostsPerMonth: null,
    maxApplyPerDay: null,
    urgentPerMonth: 10,
    features: [
      'ลงประกาศงานไม่จำกัด',
      'หลาย account ในองค์กร',
      '⚡ ปุ่มด่วนฟรี 10 ครั้ง/เดือน',
      'Branded profile & banner',
      'Dedicated account manager',
      'รายงาน analytics แบบ custom',
      'Priority support 24/7',
    ],
  },
} as const;

// ============================================
// REFERRAL TYPES
// ============================================
export interface ReferralInfo {
  referralCode: string;       // เช่น "NURSE-A1B2C3"
  referredCount: number;      // จำนวนคนที่ใช้ code นี้
  rewardMonthsEarned: number; // เดือนฟรีที่ได้รับ
  rewardMonthsUsed: number;
}

export interface ReferralRecord {
  id: string;
  referrerUid: string;
  refereeUid: string;
  refereeEmail: string;
  referralCode: string;
  createdAt: Date | Timestamp;
  rewardGranted: boolean;     // true เมื่อ referee upgrade แล้ว
  rewardGrantedAt?: Date | Timestamp;
}

// User Types
export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string | null;
  phone?: string;
  role: 'user' | 'nurse' | 'hospital' | 'admin';
  // Onboarding
  onboardingCompleted?: boolean;
  staffType?: string; // primary staff type (for nurse)
  staffTypes?: string[]; // multiple staff types (for nurse)
  interestedStaffTypes?: string[]; // for hospital/user — what they're looking for
  preferredProvince?: string;
  licenseNumber?: string;
  licenseVerified?: boolean;
  experience?: number;
  skills?: string[];
  education?: string[];
  certifications?: string[];
  bio?: string;
  location?: {
    province: string;
    district: string;
  };
  availability?: {
    isAvailable: boolean;
    preferredShifts: ('morning' | 'afternoon' | 'night')[];
    preferredDays: string[];
  };
  ratings?: {
    average: number;
    count: number;
  };
  completedJobs?: number;
  isVerified?: boolean;
  isActive?: boolean;
  settings?: {
    notifications: boolean;
    emailNotifications: boolean;
    jobAlerts: boolean;
  };
  // Subscription
  subscription?: Subscription;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  lastActiveAt?: Date;
  fcmToken?: string; // For push notifications
  nearbyJobAlert?: {
    enabled: boolean;
    radiusKm: number;
    lat: number;
    lng: number;
    geohash4: string;
    updatedAt?: Date;
  };
}

// Job Types - บอร์ดหาคนแทน
export interface JobPost {
  id: string;
  
  // Post type (Supabase)
  postType?: 'shift' | 'job' | 'homecare';
  
  title: string;
  posterName: string;
  posterId: string;
  posterPhoto?: string;
  posterRole?: 'user' | 'nurse' | 'hospital' | 'admin' | string;
  posterOrgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency' | string;
  posterStaffType?: string;
  posterPlan?: string;
  
  // ประเภทบุคลากรที่ต้องการ
  staffType?: 'RN' | 'PN' | 'NA' | 'CG' | 'SITTER' | 'OTHER' | string;
  staffTypeOther?: string; // ถ้าเลือก OTHER
  
  department: string;
  description?: string;
  requirements?: string[];
  benefits?: string[];
  employmentType?: string;
  startDateNote?: string;
  workHours?: string;
  
  // ค่าตอบแทน
  shiftRate: number;
  salary?: number;
  rateType: 'hour' | 'day' | 'shift' | 'month' | 'per_shift' | 'per_day' | 'per_month' | 'negotiable';
  salaryType?: string;
  paymentType?: 'NET' | 'DEDUCT_PERCENT' | 'NEGOTIABLE' | 'CASH' | 'TRANSFER' | 'DEDUCT';
  deductPercent?: number; // เช่น 3, 5, 10
  
  // วันเวลาที่ต้องการ
  shiftDate: Date;
  shiftDates?: string[]; // ISO strings สำหรับโพสต์หลายเวร
  shiftDateEnd?: Date; // สำหรับงานหลายวัน
  shiftTime: string; // เช่น "08:00-16:00", "16:00-00:00"
  shiftTimeSlots?: Record<string, { start: string; end: string }>; // per-date time: key = "YYYY-MM-DD"
  startTime?: string;
  endTime?: string;
  duration?: string; // ระยะเวลา เช่น "1week", "1month"
  
  // สถานที่
  locationType?: 'HOSPITAL' | 'CLINIC' | 'HOME' | 'NURSING_HOME' | 'OTHER';
  province?: string;
  district?: string;
  hospital?: string;
  address?: string;
  location?: {
    province: string;
    district?: string;
    hospital?: string;
    address?: string;
    landmark?: string;
    lat?: number;
    lng?: number;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // ข้อมูลติดต่อ
  contactName?: string;
  contactPhone?: string;
  contactLine?: string;
  
  // Multi-date shifts (ใหม่: รองรับโพสที่มีหลายเวร)
  shifts?: PostShift[];
  totalShifts?: number;
  filledShifts?: number;

  // Geolocation (ใหม่: สำหรับ proximity search)
  geohash?: string;       // geohash precision 5 (~5km) for indexing
  lat?: number;
  lng?: number;

  // Metadata
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  expiresAt?: Date | Timestamp | null;
  status: 'active' | 'closed' | 'urgent' | 'expired' | 'deleted';
  isUrgent?: boolean;
  viewsCount?: number;
  applicationCount?: number;
  applicantsCount?: number;
  tags?: string[];
  posterVerified?: boolean; // ผู้โพสต์ได้รับการยืนยันตัวตนแล้ว
}

// การติดต่อแสดงความสนใจ
export interface ShiftContact {
  id: string;
  jobId: string;
  job?: JobPost;
  interestedUserId: string;
  interestedUserName?: string;
  interestedUserPhone?: string;
  message?: string;
  status: 'interested' | 'confirmed' | 'cancelled' | 'expired';
  contactedAt: Date;
  notes?: string;
  jobDeleted?: boolean; // true when job post was deleted
}

// Chat Types
export interface Conversation {
  id: string;
  participants: string[];
  participantDetails?: {
    id: string;
    name?: string;
    displayName?: string;
    photoURL?: string;
  }[];
  jobId?: string;
  jobTitle?: string;
  hospitalName?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  lastMessageSenderId?: string;
  createdAt: Date;
  unreadCount?: number;
  unreadBy?: { [userId: string]: number }; // Track unread per user
  isArchived?: boolean;
  isPinned?: boolean;
  hiddenBy?: string[]; // รายการ userId ที่ซ่อนแชทนี้
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  senderPhoto?: string;
  text: string;
  type?: 'text' | 'image' | 'file' | 'location' | 'system';
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: Date;
  isRead?: boolean;
  readBy?: string[];
  deliveredTo?: string[];
  isDeleted?: boolean;
  replyTo?: {
    messageId: string;
    text: string;
    senderName: string;
  };
}

// Notification Types
export interface AppNotification {
  id: string;
  userId: string;
  type: 'job_match' | 'application_update' | 'new_message' | 'job_reminder' | 'system' | 'promotion';
  title: string;
  body: string;
  data?: {
    jobId?: string;
    applicationId?: string;
    conversationId?: string;
    url?: string;
  };
  read: boolean;
  createdAt: Date;
}

// Review Types
export interface Review {
  id: string;
  reviewerId: string;
  reviewerName: string;
  reviewerPhoto?: string;
  revieweeId: string;
  jobId: string;
  rating: number;
  comment?: string;
  tags?: string[];
  createdAt: Date;
  response?: {
    text: string;
    createdAt: Date;
  };
}

// Filter Types
// Filter Types - สำหรับบอร์ดหาคนแทน
export interface JobFilters {
  query?: string;
  province?: string;
  region?: string; // ภาค
  district?: string;
  department?: string;
  staffType?: 'RN' | 'PN' | 'NA' | 'CG' | 'SITTER' | 'OTHER' | string; // ประเภทบุคลากร
  locationType?: 'HOSPITAL' | 'CLINIC' | 'HOME' | 'NURSING_HOME' | 'OTHER'; // ประเภทสถานที่
  postType?: 'shift' | 'job' | 'homecare'; // ประเภทโพสต์
  urgentOnly?: boolean;
  verifiedOnly?: boolean; // กรองเฉพาะงานจากพยาบาลยืนยันแล้ว
  homeCareOnly?: boolean; // งาน Home Care เท่านั้น
  sortBy?: 'latest' | 'night' | 'morning' | 'nearest' | 'highestPay';
  minRate?: number;
  maxRate?: number;
  paymentType?: 'NET' | 'DEDUCT_PERCENT' | 'NEGOTIABLE';
}

// Navigation Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  JobDetail: { job?: JobPost; jobId?: string };
  ChatRoom: { 
    conversationId: string; 
    recipientName?: string;
    recipientPhoto?: string;
    jobTitle?: string;
  };
  EditProfile: undefined;
  Applications: undefined;
  Settings: undefined;
  Notifications: undefined;
  Favorites: undefined;
  MyPosts: undefined;
  Shop: undefined; // ร้านค้า / ซื้อบริการ
  ThemeSelection: undefined; // เลือกโทนสี
  Documents: undefined;
  Applicants: undefined;
  Reviews: {
    hospitalId?: string;
    hospitalName?: string;
    targetUserId?: string;
    targetName?: string;
    targetRole?: string;
  };
  Help: undefined;
  Terms: undefined;
  Privacy: undefined;
  Verification: undefined; // ยืนยันตัวตนพยาบาล
  UserProfile: { userId: string; userName?: string; userPhoto?: string }; // ดูโปรไฟล์คนอื่น
  AdminDashboard: undefined; // Admin Dashboard Screen
  AdminVerification: undefined; // Admin Verification Screen - ตรวจใบอนุญาต
  AdminReports: undefined; // Admin Reports Screen - ดูรายงาน
  AdminFeedback: undefined; // Admin Feedback Screen - ดู feedback
  Feedback: undefined; // User Feedback Screen
  Payment: {
    type?: string;
    amount?: number;
    title?: string;
    description?: string;
    formData?: any;
    returnTo?: string;
  };
  MapJobs: undefined; // แผนที่งานใกล้ตัว
  NearbyJobAlert: undefined; // ตั้งค่าแจ้งเตือนงานใกล้ตัว
  OnboardingSurvey: undefined; // แบบสำรวจเริ่มต้น
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  PhoneLogin: undefined;
  EmailVerification: { email: string };
  OTPVerification: { 
    phone: string;
    verificationId: string;
    registrationData?: {
      email?: string;
      password?: string;
      displayName?: string;
    };
  };
  ChooseRole: { phone?: string; phoneVerified?: boolean; fromGoogle?: boolean; registrationData?: any };
  CompleteRegistration: { 
    phone: string; 
    phoneVerified: boolean;
    role?: 'user' | 'nurse' | 'hospital';
    staffType?: string;   // nurse: ประเภทบุคลากรที่เลือก
    orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency'; // hospital/agency
    registrationData?: any;
  };
  Terms: undefined;
  Privacy: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Search?: undefined;
  PostJob: undefined;
  Chat: undefined;
  Profile: undefined;
};

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  phone?: string;
  role: 'nurse' | 'hospital';
  acceptTerms: boolean;
}

export interface PostJobForm {
  title: string;
  department: string;
  description: string;
  requirements: string[];
  benefits: string[];
  salaryMin: string;
  salaryMax: string;
  employmentType: string;
  province: string;
  district: string;
  address: string;
  contactPhone: string;
  contactLine: string;
  contactEmail: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Export StaffType for external usage
export type StaffType = 'RN' | 'PN' | 'NA' | 'CG' | 'SITTER' | 'OTHER';
