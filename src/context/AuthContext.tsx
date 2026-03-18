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
import { LegalConsentRecord } from '../types';
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
    register: (email: string, password: string, displayName: string, role?: 'user' | 'nurse' | 'hospital', username?: string, phone?: string, staffType?: string, orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency', legalConsent?: LegalConsentRecord) => Promise<void>;
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

const LEGACY_USER_CACHE_KEY = 'user';
const NEARBY_JOB_ALERT_CACHE_KEY = 'nearbyJobAlert';

function isPermissionDeniedError(error: any): boolean {
  const code = error?.code;
  const message = String(error?.message || '');
  return code === 'permission-denied' || message.includes('Missing or insufficient permissions');
}

async function loadCachedNearbyJobAlert() {
  try {
    const raw = await AsyncStorage.getItem(NEARBY_JOB_ALERT_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function persistNearbyJobAlertCache(userProfile: UserProfile | null) {
  try {
    const nearbyJobAlert = userProfile?.nearbyJobAlert || null;
    if (!nearbyJobAlert) {
      await AsyncStorage.removeItem(NEARBY_JOB_ALERT_CACHE_KEY);
      return;
    }
    await AsyncStorage.setItem(NEARBY_JOB_ALERT_CACHE_KEY, JSON.stringify(nearbyJobAlert));
  } catch {}
}

async function clearLegacyUserCache() {
  try {
    await AsyncStorage.removeItem(LEGACY_USER_CACHE_KEY);
  } catch {}
}

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

  useEffect(() => {
    void clearLegacyUserCache();
  }, []);

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
            let mergedProfile = profile;
            try {
              const cachedNearbyJobAlert = await loadCachedNearbyJobAlert();
              if (mergedProfile && cachedNearbyJobAlert) {
                if (!mergedProfile.nearbyJobAlert) {
                  mergedProfile = { ...mergedProfile, nearbyJobAlert: cachedNearbyJobAlert };
                }
                if (
                  cachedNearbyJobAlert?.enabled === true &&
                  mergedProfile.nearbyJobAlert?.enabled === false
                ) {
                  mergedProfile = { ...mergedProfile, nearbyJobAlert: cachedNearbyJobAlert };
                }
              }
            } catch (_) {}

            setUser(mergedProfile);
            await persistNearbyJobAlertCache(mergedProfile);
          }
        } catch (err: any) {
          if (!isPermissionDeniedError(err)) {
            console.error('Error fetching user profile:', err);
          }
          if (isMountedRef.current) {
            setUser(null);
          }
        } finally {
          profileFetchInProgressRef.current = false;
        }
      } else {
        if (isMountedRef.current) {
          setUser(null);
          await clearLegacyUserCache();
          await AsyncStorage.removeItem(NEARBY_JOB_ALERT_CACHE_KEY);
        }
      }
      
      if (isMountedRef.current) {
        isInitializedRef.current = true;
        setIsInitialized(true);
      }
    });

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

  // Login (supports both email and username)
  const login = async (emailOrUsername: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let email = emailOrUsername.trim();

      // Check if it's a username (doesn't contain @)
      if (!emailOrUsername.includes('@')) {
        const foundEmail = await findEmailByUsername(emailOrUsername);
        if (foundEmail) {
          email = foundEmail;
        } else {
          const profile = await loginAsAdminService(emailOrUsername, password);
          if (isMountedRef.current) {
            setUser(profile);
            setIsInitialized(true);
            setShowLoginModal(false);
          }
          await persistNearbyJobAlertCache(profile);
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
      }
      
      const profile = await loginUser(email, password);
      
      // Note: Email verification is optional - user can verify later
      // We allow login without verification but show reminder in profile
      
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      await persistNearbyJobAlertCache(profile);
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
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      await persistNearbyJobAlertCache(profile);
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
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      await persistNearbyJobAlertCache(profile);
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

  // Login with Phone (after OTP verification)
  const loginWithPhone = async (phone: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await loginWithPhoneOTP(phone);
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      await persistNearbyJobAlertCache(profile);
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
    orgType?: 'public_hospital' | 'private_hospital' | 'clinic' | 'agency',
    legalConsent?: LegalConsentRecord,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await registerUser(email, password, displayName, role, username, phone, staffType, orgType, legalConsent);
      // ⚠️ Only update state if still mounted
      if (isMountedRef.current) {
        setUser(profile);
        setIsInitialized(true);
        setShowLoginModal(false);
      }
      await persistNearbyJobAlertCache(profile);
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
      await clearLegacyUserCache();
      await AsyncStorage.removeItem(NEARBY_JOB_ALERT_CACHE_KEY);
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
      await clearLegacyUserCache();
      await AsyncStorage.removeItem(NEARBY_JOB_ALERT_CACHE_KEY);
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
      const blockedKeys = new Set([
        'role',
        'isAdmin',
        'uid',
        'id',
        'email',
        'adminTags',
        'adminWarningTag',
        'postingSuspended',
        'postingSuspendedReason',
      ]);

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
      await persistNearbyJobAlertCache(updatedProfile);
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
        await persistNearbyJobAlertCache(profile);
      }
    } catch (err: any) {
      if (!isPermissionDeniedError(err)) {
        console.error('Error refreshing user:', err);
      }
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
