import { initializeApp } from 'firebase/app';
import { initializeAuth, getAuth, Auth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Extra values embedded at build time via app.config.js
// Falls back to process.env for local dev (Expo Go)
const extra = Constants.expoConfig?.extra || {};

const get = (extraKey: string, envKey: string): string =>
  extra[extraKey] || process.env[envKey] || '';

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
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

export { auth, firebaseConfig };

// Initialize other services
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
