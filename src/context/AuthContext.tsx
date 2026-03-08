// ============================================
// AUTH CONTEXT - Production Ready
// ============================================

import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../components/common/CustomAlert';
import { 
  loginUser, 
  registerUser, 
  logoutUser, 
  subscribeToAuthChanges,
  getUserProfile,
  resolveAuthenticatedUserProfile,
  updateUserProfile as updateProfile,
  resetPassword,
  loginWithGoogle as loginWithGoogleService,
  loginAsAdmin as loginAsAdminService,
  loginWithPhoneOTP,
  findEmailByUsername,
  updateOnlineStatus,
  UserProfile,
} from '../services/authService';
import { ADMIN_CONFIG } from '../config/adminConfig';
import { getErrorMessage } from '../utils/helpers';

// ============================================
// Types
// ============================================
interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

interface AuthContextType extends AuthState {
  // Actions
  login: (emailOrUsername: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<{ isNewUser: boolean }>;
  loginAsAdmin: (username: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
    register: (email: string, password: string, displayName: string, role?: 'user' | 'nurse' | 'hospital', username?: string, phone?: string, staffType?: string, orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency') => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  
  // Admin
  isAdmin: boolean;
  
  // Guest mode
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  pendingAction: (() => void) | null;
  requireAuth: (action: () => void) => void;
  executePendingAction: () => void;
  authAlert: { visible: boolean; title?: string; message?: string } | null;
  setAuthAlert: (alert: { visible: boolean; title?: string; message?: string } | null) => void;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

// ============================================
// Context
// ============================================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================
// Provider
// ============================================
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // State
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authAlert, setAuthAlert] = useState<{ visible: boolean; title?: string; message?: string } | null>(null);

  // ✅ Refs to prevent race conditions and memory leaks
  const isMountedRef = useRef(true);
  const profileFetchInProgressRef = useRef(false);
  const isInitializedRef = useRef(false); // ref version เพื่อใช้ใน async callbacks

  // Listen for auth state changes
  useEffect(() => {
    // Mark as mounted
    isMountedRef.current = true;

    const unsubscribe = subscribeToAuthChanges(async (firebaseUser) => {
      // ⚠️ Skip if component is unmounted
      if (!isMountedRef.current) return;
      
      if (firebaseUser) {
        try {
          // ✅ Prevent multiple simultaneous profile fetches
          if (profileFetchInProgressRef.current) {
            console.log('Profile fetch already in progress, skipping duplicate');
            return;
          }
          
          profileFetchInProgressRef.current = true;
          const profile = await resolveAuthenticatedUserProfile(firebaseUser, {
            fallbackPhone: firebaseUser.phoneNumber || undefined,
          });
          // ⚠️ Only update state if still mounted
          if (isMountedRef.current) {
            // Merge Firestore profile with AsyncStorage cache:
            // ป้องกัน nearbyJobAlert หายเมื่อ Firestore อ่านข้อมูลเก่า
            let mergedProfile = profile;
            try {
              const cachedStr = await AsyncStorage.getItem('user');
              const cachedUser = cachedStr ? JSON.parse(cachedStr) : null;
              if (mergedProfile && cachedUser) {
                // ถ้า Firestore ไม่มี nearbyJobAlert แต่ cache มี → ใช้ค่าจาก cache
                if (!mergedProfile.nearbyJobAlert && cachedUser.nearbyJobAlert) {
                  mergedProfile = { ...mergedProfile, nearbyJobAlert: cachedUser.nearbyJobAlert };
                }
                // ถ้า cache มี nearbyJobAlert ที่ enabled แต่ Firestore มี disabled → เชื่อ cache
                // (กรณี Firestore อ่านจาก offline cache เก่าก่อนที่ write จะ sync)
                if (
                  cachedUser.nearbyJobAlert?.enabled === true &&
                  mergedProfile.nearbyJobAlert?.enabled === false
                ) {
                  mergedProfile = { ...mergedProfile, nearbyJobAlert: cachedUser.nearbyJobAlert };
                }
              }
            } catch (_) {}

            setUser(mergedProfile);
            if (mergedProfile) {
              await AsyncStorage.setItem('user', JSON.stringify(mergedProfile));
            }
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          if (isMountedRef.current) {
            setUser(null);
          }
        } finally {
          profileFetchInProgressRef.current = false;
        }
      } else {
        if (isMountedRef.current) {
          setUser(null);
          await AsyncStorage.removeItem('user');
        }
      }
      
      if (isMountedRef.current) {
        isInitializedRef.current = true;
        setIsInitialized(true);
      }
    });

    // Try to restore cached user on app start
    loadCachedUser();

    // ✅ Cleanup: mark as unmounted and prevent state updates
    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, []);

  // ============================================
  // Online Status via AppState
  // ============================================
  useEffect(() => {
    // Wait for real Firebase auth (not cached user) before writing to Firestore
    if (!user?.uid || !isInitialized) return;

    // Mark online when this effect runs (user just logged in or re-mounted)
    updateOnlineStatus(user.uid, true);

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (!user?.uid) return;
      if (nextState === 'active') {
        updateOnlineStatus(user.uid, true);
      } else if (nextState === 'background' || nextState === 'inactive') {
        updateOnlineStatus(user.uid, false);
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      // Mark offline when effect cleans up (logout / unmount)
      updateOnlineStatus(user.uid, false);
      subscription.remove();
    };
  }, [user?.uid, isInitialized]);

  // Load cached user for faster startup
  const loadCachedUser = async () => {
    try {
      const cached = await AsyncStorage.getItem('user');
      if (cached) {
        const cachedUser = JSON.parse(cached);
        // Never trust cached admin profile without a real Firebase auth session.
        if (cachedUser?.isAdmin) {
          return;
        }
        // Only use cache if still loading (use ref to avoid stale closure)
        if (!isInitializedRef.current) {
          setUser(cachedUser);
        }
      }
    } catch (err) {
      console.error('Error loading cached user:', err);
    }
  };

  // Login (supports both email and username)
  const login = async (emailOrUsername: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let email = emailOrUsername;
      
      // Route admin username directly to server-side admin verification.
      const inputNormalized = emailOrUsername.trim().toLowerCase();
      const adminUsername = (ADMIN_CONFIG.username || 'adminmark').toLowerCase();
      const isAdminUsername = inputNormalized === adminUsername;
      if (isAdminUsername) {
        const profile = await loginAsAdminService(emailOrUsername, password);
        await AsyncStorage.setItem('user', JSON.stringify(profile));
        // ⚠️ Only update state if still mounted
        if (isMountedRef.current) {
          setUser(profile);
          setIsInitialized(true);
          setShowLoginModal(false);
        }
        if (pendingAction) {
          setTimeout(() => {
            if (isMountedRef.current) {
              pendingAction();
              setPendingAction(null);
            }
          }, 100);
        }
        return;
      }
      
      // Check if it's a username (doesn't contain @)
      if (!emailOrUsername.includes('@')) {
        const foundEmail = await findEmailByUsername(emailOrUsername);
        if (foundEmail) {
          email = foundEmail;
        } else {
          throw new Error('ไม่พบ Username นี้ในระบบ');
        }
      }
      
      const profile = await loginUser(email, password);
      
      // Note: Email verification is optional - user can verify later
      // We allow login without verification but show reminder in profile
      
      // Save to AsyncStorage first
      await AsyncStorage.setItem('user', JSON.stringify(profile));
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      // Execute pending action after login
      if (pendingAction) {
        setTimeout(() => {
          if (isMountedRef.current) {
            pendingAction();
            setPendingAction(null);
          }
        }, 100);
      }
    } catch (err: any) {
      // If error message is already in Thai (from authService), use it directly
      const isThai = /[\u0E00-\u0E7F]/.test(err.message || '');
      const errorMessage = isThai ? err.message : getErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Login with Google
  const loginWithGoogle = async (idToken: string): Promise<{ isNewUser: boolean }> => {
    setIsLoading(true);
    setError(null);
    try {
      const { profile, isNewUser } = await loginWithGoogleService(idToken);
      // Save to AsyncStorage first
      await AsyncStorage.setItem('user', JSON.stringify(profile));
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      // Execute pending action only for returning users
      if (!isNewUser && pendingAction) {
        setTimeout(() => {
          if (isMountedRef.current) {
            pendingAction();
            setPendingAction(null);
          }
        }, 100);
      }
      return { isNewUser };
    } catch (err: any) {
      const isThai = /[\u0E00-\u0E7F]/.test(err.message || '');
      const errorMessage = isThai ? err.message : getErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Login as Admin with username/password
  const loginAsAdmin = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await loginAsAdminService(username, password);
      // Save to AsyncStorage first
      await AsyncStorage.setItem('user', JSON.stringify(profile));
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      // Execute pending action after login
      if (pendingAction) {
        setTimeout(() => {
          if (isMountedRef.current) {
            pendingAction();
            setPendingAction(null);
          }
        }, 100);
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Login with Phone (after OTP verification)
  const loginWithPhone = async (phone: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await loginWithPhoneOTP(phone);
      // Save to AsyncStorage first
      await AsyncStorage.setItem('user', JSON.stringify(profile));
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      // Execute pending action after login
      if (pendingAction) {
        setTimeout(() => {
          if (isMountedRef.current) {
            pendingAction();
            setPendingAction(null);
          }
        }, 100);
      }
    } catch (err: any) {
      // Use error message directly if it's in Thai
      const isThai = /[\u0E00-\u0E7F]/.test(err.message || '');
      const errorMessage = isThai ? err.message : getErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Register
  const register = async (
    email: string, 
    password: string, 
    displayName: string,
    role: 'user' | 'nurse' | 'hospital' = 'user', // Default = ผู้ใช้ทั่วไป
    username?: string,
    phone?: string,
    staffType?: string,
    orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency'
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await registerUser(email, password, displayName, role, username, phone, staffType, orgType);
      // Save to AsyncStorage first
      await AsyncStorage.setItem('user', JSON.stringify(profile));
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      if (pendingAction) {
        setTimeout(() => {
          if (isMountedRef.current) {
            pendingAction();
            setPendingAction(null);
          }
        }, 100);
      }
    } catch (err: any) {
      // authService already translates errors to Thai, so use err.message directly
      // Only use getErrorMessage if it's a raw Firebase error
      const errorMessage = err.code ? getErrorMessage(err) : (err.message || getErrorMessage(err));
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Logout
  const logout = async () => {
    setIsLoading(true);
    try {
      // Always sign out from Firebase Auth (covers email, phone, Google, and anonymous admin sessions)
      await logoutUser();
      // Clear AsyncStorage
      await AsyncStorage.removeItem('user');
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(null);
      }
    } catch (err: any) {
      console.error('Logout error:', err);
      // Still clear state even if error (only if mounted)
      if (isMountedRef.current) {
        setUser(null);
      }
      await AsyncStorage.removeItem('user');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Update user profile
  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user?.uid) throw new Error('ไม่ได้เข้าสู่ระบบ');
    
    setIsLoading(true);
    try {
      // Never allow profile edit path to change authz fields.
      // Role/isAdmin can only be changed by secure admin/server flows.
      const blockedKeys = new Set(['role', 'isAdmin', 'uid', 'id', 'email']);

      // Filter out undefined values and prepare for Firestore
      const cleanUpdates: Record<string, any> = {};
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && !blockedKeys.has(key)) {
          cleanUpdates[key] = value;
        }
      });
      
      await updateProfile(user.uid, cleanUpdates as Partial<UserProfile>);
      const updatedProfile = { ...user, ...cleanUpdates };
      
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(updatedProfile);
      }
      await AsyncStorage.setItem('user', JSON.stringify(updatedProfile));
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Forgot password
  const forgotPassword = async (email: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await resetPassword(email);
    } catch (err: any) {
      const errorMessage = getErrorMessage(err);
      if (isMountedRef.current) {
        setError(errorMessage);
      }
      throw new Error(errorMessage);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Refresh user data
  const refreshUser = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      // ✅ Prevent multiple simultaneous refresh calls
      if (profileFetchInProgressRef.current) {
        console.log('Profile refresh already in progress, skipping duplicate');
        return;
      }
      
      profileFetchInProgressRef.current = true;
      const profile = await getUserProfile(user.uid);
      
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current && profile) {
        setUser(profile);
        await AsyncStorage.setItem('user', JSON.stringify(profile));
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    } finally {
      profileFetchInProgressRef.current = false;
    }
  }, [user?.uid]);

  // Require authentication (for guest mode)
  const requireAuth = (action: () => void) => {
    if (user) {
      action();
    } else {
      // Show custom alert instead of native Alert.alert
      setAuthAlert({
        visible: true,
        title: '🔐 กรุณาเข้าสู่ระบบ',
        message: 'คุณต้องเข้าสู่ระบบก่อนใช้งานฟีเจอร์นี้'
      });
      setPendingAction(() => action);
    }
  };

  // Execute pending action
  const executePendingAction = () => {
    if (pendingAction && user) {
      pendingAction();
      setPendingAction(null);
    }
  };

  // Clear error
  const clearError = () => setError(null);

  // Check admin from persisted profile only (no email-based elevation)
  const isAdmin = user?.isAdmin === true || user?.role === 'admin';

  // Context value
  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isInitialized,
    login,
    loginWithGoogle,
    loginAsAdmin,
    loginWithPhone,
    register,
    logout,
    updateUser,
    forgotPassword,
    refreshUser,
    isAdmin,
    showLoginModal,
    setShowLoginModal,
    pendingAction,
    requireAuth,
    executePendingAction,
    authAlert,
    setAuthAlert,
    error,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      {/* Auth Alert Modal */}
      {authAlert?.visible && (
        <CustomAlert
          visible={true}
          type="warning"
          title={authAlert.title || '⚠️ แจ้งเตือน'}
          message={authAlert.message || ''}
          buttons={[
            {
              text: 'ยกเลิก',
              onPress: () => setAuthAlert(null),
              style: 'cancel'
            },
            {
              text: 'เข้าสู่ระบบ',
              onPress: () => {
                setAuthAlert(null);
                setShowLoginModal(true);
              },
              style: 'default'
            }
          ]}
          onClose={() => setAuthAlert(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

// ============================================
// Hook
// ============================================
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
