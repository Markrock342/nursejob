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
  deleteUser,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { ADMIN_CONFIG, validateAdminConfig } from '../config/adminConfig';
import * as ExpoCrypto from 'expo-crypto';

export interface UserProfile {
  id: string;
  uid: string; // Firebase Auth UID
  email: string;
  displayName: string;
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

// ✅ Admin credentials อ่านจาก environment variables แทนที่จะ hardcode
// ⚠️ validating config ก่อนใช้
const adminConfigValidation = validateAdminConfig();
if (!adminConfigValidation.valid) {
  console.warn(adminConfigValidation.error);
}

// SHA-256 via expo-crypto — works on iOS, Android (Hermes), and Web
async function sha256(message: string): Promise<string> {
  return ExpoCrypto.digestStringAsync(
    ExpoCrypto.CryptoDigestAlgorithm.SHA256,
    message,
  );
}

// ตรวจสอบ admin credentials (async เพื่อใช้ hashing)
export async function validateAdminCredentials(username: string, password: string): Promise<boolean> {
  // Check username
  if (username.toLowerCase() !== ADMIN_CONFIG.username.toLowerCase()) {
    return false;
  }

  // Hash input password และเทียบกับ stored hash
  const inputHash = await sha256(password);
  return inputHash === ADMIN_CONFIG.passwordHash;
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
  orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency'
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

    const isAdmin = isAdminEmail(email);
    const finalRole = isAdmin ? 'admin' : role;
    let user: FirebaseUser;

    if (auth.currentUser && auth.currentUser.providerData.some(p => p.providerId === 'phone')) {
      // ===== PHONE-FIRST FLOW =====
      // User signed in via Phone OTP → link email+password credential
      const emailCredential = EmailAuthProvider.credential(email, password);
      const linked = await linkWithCredential(auth.currentUser, emailCredential);
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
      phone: phone || user.phoneNumber || undefined,
      role: finalRole,
      isAdmin,
      isVerified: false,
      emailVerified: false,
      createdAt: new Date(),
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
    if (error.code === 'auth/weak-password') throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
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

    // Get user profile from Firestore
    let userProfile = await getUserProfile(user.uid);
    
    // If profile doesn't exist, create one (for existing Firebase Auth users)
    if (!userProfile) {
      const isAdmin = isAdminEmail(email);
      userProfile = {
        id: user.uid,
        uid: user.uid,
        email: user.email || email,
        displayName: user.displayName || email.split('@')[0],
        role: isAdmin ? 'admin' : 'user', // Default เป็น user
        isAdmin,
        isVerified: false,
        createdAt: new Date(),
      };
      
      await setDoc(doc(db, USERS_COLLECTION, user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
      });
    }

    // Update isAdmin flag if needed
    if (isAdminEmail(email) && !userProfile.isAdmin) {
      await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
        isAdmin: true,
        role: 'admin',
      });
      userProfile.isAdmin = true;
      userProfile.role = 'admin';
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
export async function loginWithGoogle(idToken: string): Promise<UserProfile> {
  try {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // Get or create user profile
    let userProfile = await getUserProfile(user.uid);
    
    if (!userProfile) {
      const isAdmin = isAdminEmail(user.email || '');
      userProfile = {
        id: user.uid,
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'ผู้ใช้',
        photoURL: user.photoURL,
        role: isAdmin ? 'admin' : 'nurse',
        isAdmin,
        createdAt: new Date(),
      };
      
      await setDoc(doc(db, USERS_COLLECTION, user.uid), {
        ...userProfile,
        createdAt: serverTimestamp(),
      });
    } else {
      // Update photo URL from Google if changed
      if (user.photoURL && user.photoURL !== userProfile.photoURL) {
        await updateDoc(doc(db, USERS_COLLECTION, user.uid), {
          photoURL: user.photoURL,
        });
        userProfile.photoURL = user.photoURL;
      }
    }

    return userProfile;
  } catch (error: any) {
    console.error('Error logging in with Google:', error);
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

// Login as Admin with username/password (ไม่ต้องผ่าน Firebase Auth)
export async function loginAsAdmin(username: string, password: string): Promise<UserProfile> {
  // Validate admin credentials (from environment variables)
  const isValid = await validateAdminCredentials(username, password);
  
  if (!isValid) {
    // Delay เพื่อป้องกัน brute force
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    throw new Error('Username หรือ Password ไม่ถูกต้อง');
  }

  // สร้าง admin profile (ไม่บันทึกใน Firestore เพื่อความปลอดภัย)
  const adminProfile: UserProfile = {
    id: `admin_${ADMIN_CONFIG.username}`,
    uid: `admin_${ADMIN_CONFIG.username}`,
    email: ADMIN_CONFIG.email,
    displayName: ADMIN_CONFIG.displayName,
    role: 'admin',
    isAdmin: true,
    createdAt: new Date(),
  };

  return adminProfile;
}

// Logout user
export async function logoutUser(): Promise<void> {
  try {
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
      return {
        id: docSnap.id,
        uid: docSnap.id,
        ...data,
        isAdmin: data.isAdmin || isAdminEmail(data.email || ''),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
      } as UserProfile;
    }
    return null;
  } catch (error) {
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
    const docRef = doc(db, USERS_COLLECTION, userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      // If user doc does not exist, create with minimal/default fields
      await setDoc(docRef, {
        uid: userId,
        createdAt: serverTimestamp(),
        ...updates,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } else {
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    }

    // Update Firebase Auth profile if displayName or photoURL changed
    const currentUser = auth.currentUser;
    if (currentUser && (updates.displayName || updates.photoURL)) {
      await updateProfile(currentUser, {
        displayName: updates.displayName,
        photoURL: updates.photoURL,
      });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
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

    // Delete user document from Firestore
    await deleteDoc(doc(db, USERS_COLLECTION, user.uid));

    // Delete Firebase Auth user
    await deleteUser(user);
  } catch (error: any) {
    console.error('Error deleting account:', error);
    if (error.code === 'auth/requires-recent-login') {
      throw new Error('กรุณาเข้าสู่ระบบใหม่ก่อนลบบัญชี');
    }
    throw error;
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
    // Clean phone number - remove all non-digits and normalize
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('66')) {
      cleanPhone = '0' + cleanPhone.substring(2);
    }
    
    const usersRef = collection(db, USERS_COLLECTION);
    
    // Try to find with cleaned phone
    const q = query(usersRef, where('phone', '==', cleanPhone));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0];
      const data = docData.data();
      return {
        id: docData.id,
        uid: docData.id,
        ...data,
        isAdmin: data.isAdmin || isAdminEmail(data.email || ''),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate(),
      } as UserProfile;
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
        const data = docData.data();
        return {
          id: docData.id,
          uid: docData.id,
          ...data,
          isAdmin: data.isAdmin || isAdminEmail(data.email || ''),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate(),
        } as UserProfile;
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
    const userProfile = await findUserByPhone(phone);
    
    if (!userProfile) {
      throw new Error('ไม่พบบัญชีที่ลงทะเบียนด้วยเบอร์นี้\nกรุณาสมัครสมาชิกก่อน');
    }
    
    // Update last login
    await updateDoc(doc(db, USERS_COLLECTION, userProfile.uid), {
      lastLoginAt: serverTimestamp(),
      phoneVerified: true,
    });
    
    return userProfile;
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

