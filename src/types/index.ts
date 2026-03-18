import { Timestamp } from 'firebase/firestore';

export * from './analytics';

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
  slotsNeeded?: number; // จำนวนคนที่ต้องการใน slot นี้
  filledCount?: number; // จำนวนที่ได้แล้ว
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
  | 'premium'
  | 'nurse_pro'
  | 'hospital_starter'
  | 'hospital_pro'
  | 'hospital_enterprise';

// backward compat alias
export type LegacyPlan = 'premium';

export type BillingCycle = 'monthly' | 'annual';

export type SubscriptionUsageFeature =
  | 'post_create'
  | 'job_application'
  | 'chat_start'
  | 'urgent_post'
  | 'extend_post'
  | 'boost_post';

export interface SubscriptionUsageCounter {
  periodKey: string;
  used: number;
}

export type UserAdminTag = 'RN' | 'PN' | 'NA' | 'ANES' | 'CLINIC' | 'AGENCY';

export type JobContactMode = 'in_app' | 'phone' | 'line' | 'phone_or_line';

export interface Subscription {
  plan: SubscriptionPlan;
  billingCycle?: BillingCycle;
  expiresAt?: Date | Timestamp | null;
  startedAt?: Date;
  isEarlyAccess?: boolean;
  sourcePlan?: SubscriptionPlan;
  // Post tracking (free / starter)
  postsToday?: number;
  lastPostDate?: string; // YYYY-MM-DD
  monthlyUsage?: Partial<Record<SubscriptionUsageFeature, SubscriptionUsageCounter>>;
  // Urgent bonus — resets monthly for Pro+
  freeUrgentUsed?: boolean;
  freeUrgentMonthReset?: string; // YYYY-MM
}

// ============================================
// PRICING CONSTANTS (THB)
// ============================================
export const PRICING = {
  // ── B2C: พยาบาล ───────────────────────────
  nursePro: 79,
  nurseProAnnual: 790,

  // ── B2B: โรงพยาบาล / เอเจนซี่ ────────────
  hospitalStarter: 390,
  hospitalStarterAnnual: 3900,
  hospitalPro: 990,
  hospitalProAnnual: 9900,
  hospitalEnterprise: 2900,
  hospitalEnterpriseAnnual: 29000,

  // ── Add-ons (ทุก role) ────────────────────
  urgentPost: 39,
  extendPost: 19,
  extraPost: 29,

  // ── Legacy (backward compat) ──────────────
  subscription: 79,
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
      'โพสต์ได้ 2 ครั้ง/วัน',
      'โพสต์อยู่ 3 วัน',
      'ซื้อโพสต์เพิ่ม ต่ออายุ และป้ายด่วนได้แยกเป็นครั้ง',
      'เหมาะกับการเริ่มใช้งานและทดลองลงประกาศ',
    ],
  },

  // ─── B2C: PREMIUM ─────────────────────────
  premium: {
    name: 'Premium',
    audience: 'both' as const,
    price: 79,
    annualPrice: 790,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxApplyPerDay: null,
    urgentPerMonth: 1,
    features: [
      'โพสต์ได้ไม่จำกัด',
      'โพสต์อยู่ 30 วัน',
      'ใช้ป้ายด่วนฟรี 1 ครั้ง/เดือน',
      'เหมาะกับผู้ใช้ที่ต้องการสิทธิ์ใช้งานมากขึ้นโดยไม่ผูกกับสายงานพยาบาล',
    ],
  },

  // ─── B2C: NURSE PRO ───────────────────────
  nurse_pro: {
    name: 'Nurse Pro',
    audience: 'nurse' as const,
    price: 79,
    annualPrice: 790,
    postExpiryDays: 30,
    maxPostsPerDay: null,        // ไม่จำกัด
    maxApplyPerDay: null,
    urgentPerMonth: 1,           // ปุ่มด่วนฟรี 1 ครั้ง/เดือน
    features: [
      'โพสต์ได้ไม่จำกัด',
      'โพสต์อยู่ 30 วัน',
      'ใช้ป้ายด่วนฟรี 1 ครั้ง/เดือน',
      'เหมาะกับพยาบาลที่ลงเวรหรือหางานต่อเนื่อง',
    ],
  },

  // ─── B2B: HOSPITAL STARTER ────────────────
  hospital_starter: {
    name: 'Starter',
    audience: 'hospital' as const,
    price: 390,
    annualPrice: 3900,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxPostsPerMonth: 5,
    maxApplyPerDay: null,
    urgentPerMonth: 0,
    features: [
      'ลงประกาศงาน 5 ครั้ง/เดือน',
      'โพสต์อยู่ 30 วัน',
      'เหมาะกับองค์กรที่ลงงานเป็นรอบ ไม่ได้ลงทุกวัน',
    ],
  },

  // ─── B2B: HOSPITAL PRO ────────────────────
  hospital_pro: {
    name: 'Professional',
    audience: 'hospital' as const,
    price: 990,
    annualPrice: 9900,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxPostsPerMonth: null,      // ไม่จำกัด
    maxApplyPerDay: null,
    urgentPerMonth: 3,           // ปุ่มด่วนฟรี 3 ครั้ง/เดือน
    features: [
      'ลงประกาศงานไม่จำกัด',
      'โพสต์อยู่ 30 วัน',
      'ใช้ป้ายด่วนฟรี 3 ครั้ง/เดือน',
      'เหมาะกับองค์กรที่เปิดรับหลายตำแหน่งต่อเนื่อง',
    ],
  },

  // ─── B2B: HOSPITAL ENTERPRISE ─────────────
  hospital_enterprise: {
    name: 'Enterprise',
    audience: 'hospital' as const,
    price: 2900,
    annualPrice: 29000,
    postExpiryDays: 30,
    maxPostsPerDay: null,
    maxPostsPerMonth: null,
    maxApplyPerDay: null,
    urgentPerMonth: 10,
    features: [
      'ลงประกาศงานไม่จำกัด',
      'โพสต์อยู่ 30 วัน',
      'ใช้ป้ายด่วนฟรี 10 ครั้ง/เดือน',
      'เหมาะกับองค์กรที่ต้องดันประกาศหลายชิ้นพร้อมกัน',
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

// ============================================
// CAMPAIGN / PROMO CODE TYPES
// ============================================
export type CampaignCodeBenefitType =
  | 'percent_discount'
  | 'fixed_discount'
  | 'free_urgent'
  | 'free_post'
  | 'bonus_days';

export type CampaignCodeRole = 'user' | 'nurse' | 'hospital' | 'admin';

export type CampaignCodePackage =
  | 'premium_monthly'
  | 'premium_annual'
  | 'nurse_pro_monthly'
  | 'nurse_pro_annual'
  | 'hospital_starter_monthly'
  | 'hospital_starter_annual'
  | 'hospital_pro_monthly'
  | 'hospital_pro_annual'
  | 'hospital_enterprise_monthly'
  | 'hospital_enterprise_annual'
  | 'extra_post'
  | 'extend_post'
  | 'urgent_post';

export interface CampaignCodeRule {
  allowedRoles: CampaignCodeRole[];
  allowedPackages: CampaignCodePackage[];
  firstPurchaseOnly: boolean;
  minSpend: number;
  maxUses: number | null;
  expiresAt?: Date | Timestamp | null;
}

export interface AppliedCampaignCode {
  code: string;
  title: string;
  description?: string;
  benefitType: CampaignCodeBenefitType;
  benefitValue: number;
  packageKey: CampaignCodePackage;
  packageLabel: string;
  originalAmount: number;
  finalAmount: number;
  discountAmount: number;
  appliedAt?: Date | Timestamp | null;
}

export interface CampaignCode {
  id: string;
  code: string;
  title: string;
  description?: string;
  benefitType: CampaignCodeBenefitType;
  benefitValue: number;
  usedCount: number;
  isActive: boolean;
  rule: CampaignCodeRule;
  createdBy?: string;
  createdAt?: Date | Timestamp | null;
  updatedAt?: Date | Timestamp | null;
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
  privacy?: {
    profileVisible?: boolean;
    showOnlineStatus?: boolean;
  };
  notificationPreferences?: {
    pushEnabled?: boolean;
    newJobs?: boolean;
    messages?: boolean;
    applications?: boolean;
    marketing?: boolean;
  };
  settings?: {
    notifications: boolean;
    emailNotifications: boolean;
    jobAlerts: boolean;
  };
  pendingCampaignCode?: AppliedCampaignCode | null;
  legalConsent?: LegalConsentRecord;
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
    province?: string;
    staffTypes?: string[];
    minRate?: number;
    maxRate?: number;
    updatedAt?: Date;
  };
}

export interface LegalConsentAcceptance {
  version: string;
  acceptedAt: Date | Timestamp;
}

export interface LegalConsentRecord {
  terms: LegalConsentAcceptance;
  privacy: LegalConsentAcceptance;
  acceptedFrom?: string;
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
  posterStaffTypes?: string[];
  posterPlan?: string;
  posterAdminTags?: UserAdminTag[];
  posterWarningTag?: string;
  
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
  slotsNeeded?: number;
  campaignTitle?: string;
  campaignSummary?: string;
  scheduleNote?: string;
  contactMode?: JobContactMode;
  sourceText?: string;
  sourceChannel?: 'manual' | 'paste';

  // Geolocation (ใหม่: สำหรับ proximity search)
  geohash?: string;       // geohash precision 5 (~5km) for indexing
  lat?: number;
  lng?: number;

  // Metadata
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  boostedAt?: Date | Timestamp | null;
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

export interface JobCompletion {
  id: string;
  jobId: string;
  jobTitle?: string;
  posterId: string;
  posterName?: string;
  posterPhotoURL?: string;
  hiredUserId: string;
  hiredUserName?: string;
  hiredUserPhotoURL?: string;
  selectedApplicationId: string;
  participantIds: string[];
  status: 'completed';
  completedAt: Date | Timestamp;
  completedBy: string;
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
  JobDetail: { job?: JobPost; jobId?: string; source?: string };
  ChatRoom: { 
    conversationId: string; 
    recipientId?: string;
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
  Shop: undefined; // สิทธิ์และแพ็กเกจ
  ThemeSelection: undefined; // เลือกโทนสี
  Documents: undefined;
  Applicants: { jobId?: string } | undefined;
  Reviews: {
    hospitalId?: string;
    hospitalName?: string;
    targetUserId?: string;
    targetName?: string;
    targetRole?: string;
    completionId?: string;
    relatedJobId?: string;
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
    packageKey?: CampaignCodePackage;
    plan?: SubscriptionPlan;
    billingCycle?: BillingCycle;
    formData?: any;
    jobId?: string;
    returnTo?: string;
    submissionToken?: string;
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
      legalConsent?: LegalConsentRecord;
    };
  };
  ChooseRole: { phone?: string; phoneVerified?: boolean; fromGoogle?: boolean; registrationData?: any };
  CompleteRegistration: { 
    phone: string; 
    phoneVerified: boolean;
    role?: 'user' | 'nurse' | 'hospital';
    staffType?: string;   // nurse: ประเภทบุคลากรที่เลือก
    orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency'; // hospital/agency
    registrationData?: {
      legalConsent?: LegalConsentRecord;
    };
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
  type?: 'text' | 'image' | 'file' | 'document' | 'saved_document' | 'location' | 'system';
  department: string;
  description: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  documentType?: string;
  location?: {
    lat: number;
    lng: number;
    address: string;
    province?: string;
    district?: string;
  };
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
