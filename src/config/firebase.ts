import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Extra values embedded at build time via app.config.js
// Falls back to process.env for local dev (Expo Go)
const extra = Constants.expoConfig?.extra || {};
const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

const get = (extraKey: string, envKey: string): string =>
  extra[extraKey] || process.env[envKey] || '';

function getReactNativePersistenceConfig() {
  try {
    const authModule = require('firebase/auth');
    if (typeof authModule.getReactNativePersistence !== 'function') {
      return undefined;
    }
    return authModule.getReactNativePersistence(AsyncStorage);
  } catch {
    return undefined;
  }
}

let nativeAppCheckInitialization: Promise<boolean> | null = null;

export function canUseNativeFirebaseModules(): boolean {
  return Platform.OS !== 'web' && !IS_EXPO_GO;
}

export async function initializeNativeAppCheck(): Promise<boolean> {
  if (!canUseNativeFirebaseModules()) {
    return false;
  }

  if (!nativeAppCheckInitialization) {
    nativeAppCheckInitialization = (async () => {
      try {
        const { getApp: getNativeApp } = require('@react-native-firebase/app');
        const {
          initializeAppCheck,
          ReactNativeFirebaseAppCheckProvider,
        } = require('@react-native-firebase/app-check');

        const provider = new ReactNativeFirebaseAppCheckProvider();
        provider.configure({
          android: {
            provider: __DEV__ ? 'debug' : 'playIntegrity',
          },
          apple: {
            provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
          },
        });

        await initializeAppCheck(getNativeApp(), {
          provider,
          isTokenAutoRefreshEnabled: true,
        });

        return true;
      } catch (error) {
        console.warn('[Firebase] Native App Check initialization failed:', error);
        return false;
      }
    })();
  }

  return nativeAppCheckInitialization;
}

// Firebase configuration
const firebaseConfig = {
  apiKey:            get('firebaseApiKey',            'EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain:        get('firebaseAuthDomain',        'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId:         get('firebaseProjectId',         'EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket:     get('firebaseStorageBucket',     'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: get('firebaseMessagingSenderId', 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId:             get('firebaseAppId',             'EXPO_PUBLIC_FIREBASE_APP_ID'),
};

if (__DEV__) {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.warn(`[Firebase] Missing config: ${missing.join(', ')}`);
  }
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth — แยก web กับ native เพื่อ persistence ที่ถูกต้อง
let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    const persistence = getReactNativePersistenceConfig();
    auth = persistence
      ? initializeAuth(app, { persistence })
      : getAuth(app);
  } catch {
    auth = getAuth(app);
  }
}

export { auth, firebaseConfig };

// Initialize other services
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;

void initializeNativeAppCheck();
