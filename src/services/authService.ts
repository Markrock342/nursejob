import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithCredential,
  linkWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  User as FirebaseUser
} from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db, firebaseConfig, canUseNativeFirebaseModules, initializeNativeAppCheck } from '../config/firebase';
import { ADMIN_CONFIG } from '../config/adminConfig';
import { AppliedCampaignCode, LegalConsentRecord, UserAdminTag } from '../types';
import { getGoogleSigninModule } from '../utils/googleSignin';

export interface UserProfile {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  username?: string; // Username สำหรับ login
  photoURL?: string | null;
  phone?: string;
  role: 'user' | 'nurse' | 'hospital' | 'admin'; // user = ผู้ใช้ทั่วไป, nurse = พยาบาล (verified)
  isAdmin: boolean; // Admin flag
  isVerified?: boolean; // สถานะการยืนยันตัวตน (true = พยาบาลที่ผ่านการ verify)
  // Organisation type (hospital/agency only)
  orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency'; // ประเภทองค์กร
  // Care needs (user/family role)
  careNeeds?: string[]; // ดูแลผู้สูงอายุ, เฝ้าไข้, homecare, rehab, child, other
  // Onboarding
  onboardingCompleted?: boolean;
  staffType?: string;   // primary staff type (nurse role)
  staffTypes?: string[]; // all staff types (nurse role)
  interestedStaffTypes?: string[];
  preferredProvince?: string;
  emailVerified?: boolean; // สถานะการยืนยัน email
  licenseNumber?: string; // เลขใบประกอบวิชาชีพ (verified)
  pendingLicenseNumber?: string; // เลขที่รอตรวจสอบ
  licenseVerificationStatus?: 'pending' | 'approved' | 'rejected'; // สถานะการตรวจสอบใบประกอบวิชาชีพ
  experience?: number;
  bio?: string;
  skills?: string[];
  location?: {
    province: string;
    district: string;
  };
  availability?: {
    isAvailable: boolean;
    preferredShifts: string[];
    preferredDays: string[];
  };
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
  workStyle?: string[];      // nurse: fulltime/parttime/weekend/flexible
  careTypes?: string[];      // user: elderly/bedridden/postsurg/child/terminal/other
  hiringUrgency?: string;    // hospital: now/week/month/plan
  createdAt: Date;
  updatedAt?: Date;
  // การแจ้งเตือนงานใกล้ตัว
  nearbyJobAlert?: {
    enabled: boolean;
    radiusKm: number; // 1, 3, 5, 10, 20, 50
    lat: number;
    lng: number;
    geohash4: string; // geohash precision 4 สำหรับ query
    updatedAt?: Date;
  };
  pushToken?: string; // Expo push token
  pendingCampaignCode?: AppliedCampaignCode | null;
  legalConsent?: LegalConsentRecord;
  adminTags?: UserAdminTag[];
  adminWarningTag?: string;
  postingSuspended?: boolean;
  postingSuspendedReason?: string;
  isActive?: boolean;
}

// ==========================================
// Admin Configuration
// ==========================================
// รายชื่อ email ที่เป็น admin (คุณสามารถเพิ่มได้)
const ADMIN_EMAILS = [
  'admin@nursego.app',
  // เพิ่ม email ของคุณที่นี่:
  // 'your-email@gmail.com',
];

function toErrorMessage(error: any): string {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  const projectId = firebaseConfig.projectId || 'Firebase project ปัจจุบัน';

  if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
    return 'ยังไม่ได้เปิด Anonymous sign-in ใน Firebase Authentication';
  }
  if (code === 'auth/network-request-failed') {
    return 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต';
  }
  if (code === 'functions/failed-precondition') {
    return 'ยังไม่ได้ตั้งค่า ADMIN_USERNAME / ADMIN_PASSWORD_HASH บน Cloud Functions';
  }
  if (code === 'functions/unauthenticated') {
    return 'Username หรือ Password ไม่ถูกต้อง';
  }
  if (code === 'functions/resource-exhausted') {
    return message || 'มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่';
  }
  if (code === 'functions/permission-denied' && message.includes('App Check')) {
    return 'Admin login ต้องผ่านการยืนยัน App Check จากแอปที่เชื่อถือได้';
  }
  if (code === 'functions/not-found') {
    return `ไม่พบ Cloud Function verifyAdminLogin ในโปรเจกต์ ${projectId}`;
  }
  if (
    code === 'functions/unavailable' ||
    code === 'functions/internal' ||
    code === 'functions/unknown'
  ) {
    return `เข้าสู่ระบบแอดมินไม่ได้ เพราะ Cloud Functions ของโปรเจกต์ ${projectId} ใช้งานไม่ได้หรือยังไม่ได้ deploy`;
  }
  if (message.includes('CONFIGURATION_NOT_FOUND')) {
    return 'ยังไม่ได้เปิด Anonymous sign-in ใน Firebase Authentication';
  }
  if (message.includes('function') && message.includes('not found')) {
    return `ไม่พบ Cloud Function verifyAdminLogin ในโปรเจกต์ ${projectId}`;
  }

  return message || 'เข้าสู่ระบบแอดมินไม่สำเร็จ กรุณาลองใหม่';
}

async function callAdminLoginEndpoint(username: string, password: string): Promise<any> {
  if (canUseNativeFirebaseModules()) {
    try {
      const appCheckReady = await initializeNativeAppCheck();
      if (!appCheckReady) {
        throw new Error('native-app-check-unavailable');
      }
      const nativeFunctions = require('@react-native-firebase/functions').default;
      const result = await nativeFunctions().httpsCallable('verifyAdminLogin')({ username, password });
      return result.data;
    } catch (error) {
      const code = String((error as any)?.code || '');
      if (code.startsWith('functions/')) {
        throw error;
      }
      console.warn('[admin-login] Native callable failed, falling back to web SDK:', error);
    }
  }

  const fn = httpsCallable(getFunctions(), 'verifyAdminLogin');
  const result = await fn({ username, password });
  return result.data;
}

// ตรวจสอบว่าเป็น admin หรือไม่
export function isAdminEmail(email: string): boolean {
  // Check email list
  if (ADMIN_EMAILS.includes(email.toLowerCase())) {
    return true;
  }
  // Check admin email จาก config
  if (ADMIN_CONFIG.email.toLowerCase() === email.toLowerCase()) {
    return true;
  }
  return false;
}

const USERS_COLLECTION = 'users';

function normalizePhoneForStorage(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  let cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return undefined;
  if (cleaned.startsWith('66')) {
    cleaned = `0${cleaned.substring(2)}`;
  }
  if (!cleaned.startsWith('0') && cleaned.length === 9) {
    cleaned = `0${cleaned}`;
  }
  return cleaned;
}

function mapUserProfile(docId: string, data: any): UserProfile {
  return {
    id: docId,
    uid: docId,
    ...data,
    phone: normalizePhoneForStorage(data.phone),
    isAdmin: data.isAdmin === true || data.role === 'admin',
    isActive: data.isActive !== false,
    createdAt: data.createdAt?.toDate?.() || data.createdAt || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
  } as UserProfile;
}

function buildProfileSeed(
  user: FirebaseUser,
  seed: Partial<Omit<UserProfile, 'id' | 'uid' | 'createdAt'>> = {}
): Omit<UserProfile, 'id'> {
  return {
    uid: user.uid,
    email: seed.email || user.email || '',
    displayName: seed.displayName || user.displayName || user.email?.split('@')[0] || 'ผู้ใช้',
    username: seed.username,
    photoURL: seed.photoURL ?? user.photoURL,
    phone: normalizePhoneForStorage(seed.phone || user.phoneNumber),
    role: seed.role || 'user',
    isAdmin: seed.isAdmin === true,
    isActive: seed.isActive !== false,
    isVerified: seed.isVerified ?? false,
    onboardingCompleted: seed.onboardingCompleted,
    staffType: seed.staffType,
    orgType: seed.orgType,
    emailVerified: seed.emailVerified ?? user.emailVerified,
    createdAt: new Date(),
  };
}

async function resolveUserProfileFromAuth(
  user: FirebaseUser,
  options: {
    createIfMissing?: boolean;
    fallbackPhone?: string;
    seed?: Partial<Omit<UserProfile, 'id' | 'uid' | 'createdAt'>>;
  } = {}
): Promise<UserProfile | null> {
  const directProfile = await getUserProfile(user.uid);
  if (directProfile) {
    return directProfile;
  }

  const fallbackPhone = normalizePhoneForStorage(options.fallbackPhone || user.phoneNumber);
  if (fallbackPhone) {
    const phoneProfile = await findUserByPhone(fallbackPhone);
    if (phoneProfile) {
      if (phoneProfile.uid !== user.uid) {
        const migratedProfile = {
          ...phoneProfile,
          uid: user.uid,
          email: user.email || phoneProfile.email || '',
          displayName: user.displayName || phoneProfile.displayName || 'ผู้ใช้',
          photoURL: user.photoURL || phoneProfile.photoURL || null,
          phone: fallbackPhone,
          updatedAt: new Date(),
        };
        await setDoc(doc(db, USERS_COLLECTION, user.uid), {
          ...migratedProfile,
          createdAt: phoneProfile.createdAt,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        return { ...migratedProfile, id: user.uid } as UserProfile;
      }
      return phoneProfile;
    }
  }

  if (!options.createIfMissing) {
    return null;
  }

  const seededProfile = buildProfileSeed(user, options.seed);
  await setDoc(doc(db, USERS_COLLECTION, user.uid), {
    ...seededProfile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  return { id: user.uid, ...seededProfile };
}

export async function resolveAuthenticatedUserProfile(
  user: FirebaseUser,
  options: {
    createIfMissing?: boolean;
    fallbackPhone?: string;
    seed?: Partial<Omit<UserProfile, 'id' | 'uid' | 'createdAt'>>;
  } = {}
): Promise<UserProfile | null> {
  const profile = await resolveUserProfileFromAuth(user, options);
  if (profile && profile.isActive === false) {
    await signOut(auth).catch(() => {});
    throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
  }
  return profile;
}

// ==========================================
// Authentication Functions
// ==========================================

// Register new user
// ถ้า auth.currentUser มีอยู่แล้ว (phone-auth session จาก OTP) → link email/password
// ถ้ายังไม่มี → createUserWithEmailAndPassword ตามปกติ
export async function registerUser(
  email: string, 
  password: string, 
  displayName: string,
  role: 'user' | 'nurse' | 'hospital' = 'user',
  username?: string,
  phone?: string,
  staffType?: string,
  orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency',
  legalConsent?: LegalConsentRecord,
): Promise<UserProfile> {
  try {
    // Check if username already exists (if provided)
    if (username) {
      const usernameQuery = query(
        collection(db, USERS_COLLECTION),
        where('username', '==', username.toLowerCase())
      );
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        throw new Error('Username นี้ถูกใช้งานแล้ว');
      }
    }

    const isAdmin = false;
    const finalRole = role;
    let user: FirebaseUser;
    const currentUser = auth.currentUser;
    const hasEmailProvider = currentUser?.providerData.some(
      (provider) => provider.providerId === EmailAuthProvider.PROVIDER_ID
    ) || false;
    const normalizedPhone = normalizePhoneForStorage(phone);
    const currentUserPhone = normalizePhoneForStorage(currentUser?.phoneNumber);
    const shouldLinkCurrentSession = Boolean(
      currentUser &&
      !hasEmailProvider &&
      (!normalizedPhone || !currentUserPhone || normalizedPhone === currentUserPhone)
    );

    if (shouldLinkCurrentSession && currentUser) {
      // ===== PHONE-FIRST FLOW =====
      // User signed in via Phone OTP → link email+password credential
      const emailCredential = EmailAuthProvider.credential(email, password);
      const linked = await linkWithCredential(currentUser, emailCredential);
      user = linked.user;
    } else {
      // ===== STANDARD FLOW =====
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      user = userCredential.user;
    }

    // Update display name
    await updateProfile(user, { displayName });

    // Send email verification
    await sendEmailVerification(user);

    // Create / overwrite user profile in Firestore
    const userProfile: Omit<UserProfile, 'id'> = {
      uid: user.uid,
      email,
      displayName,
      username: username || undefined,
      phone: normalizePhoneForStorage(phone || user.phoneNumber),
      role: finalRole,
      isAdmin,
      isActive: true,
      isVerified: false,
      onboardingCompleted: true,
      emailVerified: user.emailVerified,
      createdAt: new Date(),
      ...(legalConsent ? { legalConsent } : {}),
      ...(staffType ? { staffType } : {}),
      ...(orgType ? { orgType } : {}),
    };

    await setDoc(doc(db, USERS_COLLECTION, user.uid), {
      ...userProfile,
      createdAt: serverTimestamp(),
    }, { merge: true });

    return { id: user.uid, ...userProfile };
  } catch (error: any) {
    console.error('Error registering user:', error);
    
    if (error.code === 'auth/email-already-in-use') throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
    if (error.code === 'auth/weak-password') throw new Error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
    if (error.code === 'auth/invalid-email') throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    if (error.code === 'auth/provider-already-linked') throw new Error('อีเมลนี้ถูกเชื่อมโยงกับบัญชีอื่นแล้ว');
    if (error.code === 'auth/credential-already-in-use') throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
    throw error;
  }
}

// Login user
export async function loginUser(email: string, password: string): Promise<UserProfile> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userProfile = await resolveUserProfileFromAuth(user, {
      createIfMissing: true,
      seed: {
        email: user.email || email,
        displayName: user.displayName || email.split('@')[0],
        role: 'user',
        isAdmin: false,
        isVerified: false,
        onboardingCompleted: true,
        emailVerified: user.emailVerified,
      },
    });

    if (!userProfile) {
      throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
    }

    if (userProfile.isActive === false) {
      await signOut(auth).catch(() => {});
      throw new Error('บัญชีนี้ถูกระงับการใช้งาน');
    }

    return userProfile;
  } catch (error: any) {
    // Translate Firebase errors to Thai
    const code = error.code || '';
    
    // Also try to extract from message if no code
    let extractedCode = code;
    if (!extractedCode) {
      const match = error.message?.match(/\(([^)]+)\)/);
      if (match) extractedCode = match[1];
    }
    
    if (extractedCode === 'auth/user-not-found' || extractedCode === 'auth/wrong-password' || extractedCode === 'auth/invalid-credential') {
      throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    } else if (extractedCode === 'auth/invalid-email') {
      throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    } else if (extractedCode === 'auth/too-many-requests') {
      throw new Error('มีการพยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่');
    }
    
    throw error;
  }
}

// Login with Google ID Token
// Returns { profile, isNewUser } — isNewUser = true when onboarding not yet done
export async function loginWithGoogle(idToken: string): Promise<{ profile: UserProfile; isNewUser: boolean }> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    const userProfile = await resolveUserProfileFromAuth(user, {
      createIfMissing: true,
      seed: {
        email: user.email || '',
        displayName: user.displayName || 'ผู้ใช้',
        photoURL: user.photoURL,
        role: 'user',
        isAdmin: false,
        onboardingCompleted: false,
        emailVerified: user.emailVerified,
      },
    });

    if (!userProfile) {
      throw new Error('ไม่สามารถโหลดข้อมูลผู้ใช้จาก Google ได้');
    }

    const isNewUser = !userProfile.onboardingCompleted;
    if (user.photoURL && user.photoURL !== userProfile.photoURL) {
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      });
      userProfile.photoURL = user.photoURL;
    }

    return { profile: userProfile, isNewUser };
  } catch (error: any) {
    console.error('Error logging in with Google:', error);
    if (error.code === 'auth/account-exists-with-different-credential') {
      throw new Error('อีเมลนี้ลงทะเบียนด้วย Email/Password ไว้แล้ว\nกรุณาเข้าสู่ระบบด้วย Email และรหัสผ่านแทน');
    }
    throw new Error('เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
  }
}

// Find user email by username
export async function findEmailByUsername(username: string): Promise<string | null> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      return userData.email;
    }
    return null;
  } catch (error) {
    console.error('Error finding email by username:', error);
    return null;
  }
}

// Login as Admin with username/password
export async function loginAsAdmin(username: string, password: string): Promise<UserProfile> {
  try {
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }

    const data = await callAdminLoginEndpoint(username, password);
    const profile = data.profile || {};
    const email = data?.email || profile.email || ADMIN_CONFIG.email;

    await signInWithEmailAndPassword(auth, email, password);

    const currentUid = auth.currentUser?.uid;
    return {
      id: profile.id || currentUid,
      uid: profile.uid || currentUid,
      email: profile.email || email,
      displayName: profile.displayName || ADMIN_CONFIG.displayName,
      role: 'admin',
      isAdmin: true,
      createdAt: new Date(),
    };
  } catch (e: any) {
    throw new Error(toErrorMessage(e));
  }
}

// Logout user
export async function logoutUser(): Promise<void> {
  try {
    const googleSigninModule = getGoogleSigninModule();
    if (googleSigninModule?.GoogleSignin) {
      await googleSigninModule.GoogleSignin.signOut().catch(() => null);
    }
    await signOut(auth);
  } catch (error) {
    console.error('Error logging out:', error);
    throw error;
  }
}

// Get user profile from Firestore
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return mapUserProfile(docSnap.id, data);
    }
    return null;
  } catch (error: any) {
    const code = error?.code;
    const message = String(error?.message || '');
    if (code === 'permission-denied' || message.includes('Missing or insufficient permissions')) {
      return null;
    }
    console.error('Error fetching user profile:', error);
    throw error;
  }
}

// Update user profile
export async function updateUserProfile(
  userId: string, 
  updates: Partial<Omit<UserProfile, 'id' | 'email' | 'createdAt'>>
): Promise<void> {
  try {
    const sanitizedUpdates = { ...(updates as Record<string, any>) };
    delete sanitizedUpdates.role;
    delete sanitizedUpdates.isAdmin;
    delete sanitizedUpdates.uid;
    delete sanitizedUpdates.id;
    delete sanitizedUpdates.email;

    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // If user doc does not exist, create with minimal/default fields
      await setDoc(docRef, {
        uid: userId,
        createdAt: serverTimestamp(),
        ...sanitizedUpdates,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await updateDoc(docRef, {
        ...sanitizedUpdates,
        updatedAt: serverTimestamp(),
      });
    }

    // Update Firebase Auth profile if displayName or photoURL changed
    const currentUser = auth.currentUser;
    if (currentUser && (sanitizedUpdates.displayName || sanitizedUpdates.photoURL)) {
      await updateProfile(currentUser, {
        displayName: sanitizedUpdates.displayName,
        photoURL: sanitizedUpdates.photoURL,
      });
    }

    // Keep poster snapshot fields on old posts in sync with latest profile.
    if (sanitizedUpdates.displayName !== undefined || sanitizedUpdates.photoURL !== undefined) {
      const shiftsQuery = query(collection(db, 'shifts'), where('posterId', '==', userId));
      const shiftsSnap = await getDocs(shiftsQuery);

      if (!shiftsSnap.empty) {
        const posterSnapshotUpdates: Record<string, any> = {
          updatedAt: serverTimestamp(),
        };

        if (sanitizedUpdates.displayName !== undefined) {
          posterSnapshotUpdates.posterName = sanitizedUpdates.displayName || 'ไม่ระบุชื่อ';
        }
        if (sanitizedUpdates.photoURL !== undefined) {
          posterSnapshotUpdates.posterPhoto = sanitizedUpdates.photoURL || '';
        }

        await Promise.all(
          shiftsSnap.docs.map((shiftDoc) => updateDoc(shiftDoc.ref, posterSnapshotUpdates))
        );
      }
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

export async function completeUserOnboarding(
  userId: string,
  updates: {
    role: 'user' | 'nurse' | 'hospital';
    staffType?: string;
    orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency';
    phone?: string;
  }
): Promise<UserProfile> {
  const payload: Record<string, any> = {
    uid: userId,
    role: updates.role,
    isAdmin: false,
    onboardingCompleted: true,
    updatedAt: serverTimestamp(),
  };

  if (updates.role === 'nurse') {
    payload.staffType = updates.staffType || null;
    payload.orgType = null;
  } else if (updates.role === 'hospital') {
    payload.orgType = updates.orgType || null;
    payload.staffType = null;
  } else {
    payload.staffType = null;
    payload.orgType = null;
  }

  const normalizedPhone = normalizePhoneForStorage(updates.phone);
  if (normalizedPhone) {
    payload.phone = normalizedPhone;
    payload.phoneVerified = true;
  }

  await setDoc(doc(db, USERS_COLLECTION, userId), {
    ...payload,
    createdAt: serverTimestamp(),
  }, { merge: true });

  const profile = await getUserProfile(userId);
  if (!profile) {
    throw new Error('ไม่สามารถบันทึกข้อมูล onboarding ได้');
  }
  return profile;
}

// Subscribe to auth state changes
export function subscribeToAuthChanges(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

// Get current user
export function getCurrentUser(): FirebaseUser | null {
  return auth.currentUser;
}

// Reset password
export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    console.error('Error resetting password:', error);
    if (error.code === 'auth/user-not-found') {
      throw new Error('ไม่พบบัญชีที่ใช้อีเมลนี้');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
    }
    throw error;
  }
}

// Delete user account
export async function deleteUserAccount(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('ไม่พบผู้ใช้ที่เข้าสู่ระบบ');
    }

    await user.getIdToken(true);

    const fn = httpsCallable(getFunctions(), 'deleteCurrentUserAccount');
    await fn({});
  } catch (error: any) {
    console.error('Error deleting account:', error);
    if (error.code === 'auth/requires-recent-login' || error.code === 'functions/unauthenticated') {
      throw new Error('กรุณาเข้าสู่ระบบใหม่ก่อนลบบัญชี');
    }
    throw new Error(error?.message || 'ไม่สามารถลบบัญชีได้ กรุณาลองใหม่');
  }
}

// ==========================================
// Email Verification Functions
// ==========================================

// Send verification email
export async function sendVerificationEmail(): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('ไม่พบผู้ใช้ที่เข้าสู่ระบบ');
    }
    await sendEmailVerification(user);
  } catch (error: any) {
    console.error('Error sending verification email:', error);
    if (error.code === 'auth/too-many-requests') {
      throw new Error('ส่ง email มากเกินไป กรุณารอสักครู่แล้วลองใหม่');
    }
    throw new Error('ไม่สามารถส่ง email ยืนยันได้');
  }
}

// Check if email is verified
export function isEmailVerified(): boolean {
  const user = auth.currentUser;
  return user?.emailVerified || false;
}

// Refresh user to get latest email verification status
export async function refreshEmailVerificationStatus(): Promise<boolean> {
  try {
    const user = auth.currentUser;
    if (!user) {
      return false;
    }
    
    // Reload user to get latest status from Firebase
    await user.reload();
    
    // If verified, update Firestore
    if (user.emailVerified) {
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        emailVerified: true,
        updatedAt: serverTimestamp(),
      });
    }
    
    return user.emailVerified;
  } catch (error) {
    console.error('Error refreshing verification status:', error);
    return false;
  }
}

// ==========================================
// Phone Login Functions (OTP-based)
// ==========================================

// Find user profile by phone number
export async function findUserByPhone(phone: string): Promise<UserProfile | null> {
  try {
    const cleanPhone = normalizePhoneForStorage(phone);
    if (!cleanPhone) {
      return null;
    }
    
    const usersRef = collection(db, USERS_COLLECTION);
    
    // Try to find with cleaned phone
    const q = query(usersRef, where('phone', '==', cleanPhone));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0];
      return mapUserProfile(docData.id, docData.data());
    }
    
    // Also try with leading zero variations
    const phoneVariations = [
      cleanPhone,
      cleanPhone.startsWith('0') ? cleanPhone.substring(1) : '0' + cleanPhone,
    ];
    
    for (const phoneVar of phoneVariations) {
      const qVar = query(usersRef, where('phone', '==', phoneVar));
      const snapVar = await getDocs(qVar);
      if (!snapVar.empty) {
        const docData = snapVar.docs[0];
        return mapUserProfile(docData.id, docData.data());
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error finding user by phone:', error);
    return null;
  }
}

// Login with phone (after OTP verification) - returns user profile without Firebase Auth
export async function loginWithPhoneOTP(phone: string): Promise<UserProfile> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('เซสชัน OTP ไม่สมบูรณ์ กรุณาขอรหัสใหม่');
    }

    const userProfile = await resolveUserProfileFromAuth(currentUser, {
      fallbackPhone: phone,
    });
    
    if (!userProfile) {
      throw new Error('ไม่พบบัญชีที่ลงทะเบียนด้วยเบอร์นี้\nกรุณาสมัครสมาชิกก่อน');
    }
    
    // Update last login
    await updateDoc(doc(db, USERS_COLLECTION, currentUser.uid), {
      lastLoginAt: serverTimestamp(),
      phoneVerified: true,
      phone: normalizePhoneForStorage(phone),
      updatedAt: serverTimestamp(),
    });
    
    const refreshedProfile = await getUserProfile(currentUser.uid);
    return refreshedProfile || {
      ...userProfile,
      id: currentUser.uid,
      uid: currentUser.uid,
      phone: normalizePhoneForStorage(phone),
    };
  } catch (error: any) {
    console.error('Error logging in with phone:', error);
    throw error;
  }
}

// ==========================================
// Update User Privacy Settings (ไปยัง Firestore)
// ==========================================
export async function updateUserPrivacy(
  uid: string, 
  privacySettings: { 
    profileVisible?: boolean; 
    showOnlineStatus?: boolean;
  }
): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      'privacy.profileVisible': privacySettings.profileVisible,
      'privacy.showOnlineStatus': privacySettings.showOnlineStatus,
      updatedAt: serverTimestamp(),
    });
    console.log('Privacy settings updated in Firestore');
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    throw error;
  }
}

// ==========================================
// Update Online Status (สำหรับแสดงสถานะออนไลน์)
// ==========================================
export async function updateOnlineStatus(uid: string, isOnline: boolean): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, uid);
    await updateDoc(userRef, {
      isOnline: isOnline,
      lastActiveAt: serverTimestamp(),
    });
  } catch (error: any) {
    if (error?.code === 'permission-denied') return; // auth not ready yet — silent
    console.error('Error updating online status:', error);
  }
}

