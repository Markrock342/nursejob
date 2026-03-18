// app.config.js — replaces app.json for EAS builds
// Reads .env values and embeds them into extra + configures all native plugins
require('dotenv').config();
const fs = require('fs');

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
  || 'AIzaSyAJVBDwB2sl0XJc3FTvLi_l7lsOGgHBfwc';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
  || '427547114323-87ibkaeo6kun7cfhc20919c9gn7ntp24.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
  || '427547114323-o1qs4cq0kdbcao0mpvcti88la81p2nre.apps.googleusercontent.com';

// Firebase config is safe to embed in client (security = Firestore Rules)
const FIREBASE = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || 'AIzaSyCePlG5nmTJfOGa_P-j0Xm8c0GVF5xZ3zg',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'nurse-go-th.firebaseapp.com',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || 'nurse-go-th',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'nurse-go-th.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID|| '427547114323',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || '1:427547114323:android:a89c6f0e5659ae8a19bfa6',
};

const IOS_GOOGLE_SERVICES_FILE = './GoogleService-Info.plist';
const IOS_GOOGLE_SERVICES_FALLBACK_FILE = './ios/NurseGo/GoogleService-Info.plist';
const RESOLVED_IOS_GOOGLE_SERVICES_FILE = fs.existsSync(IOS_GOOGLE_SERVICES_FILE)
  ? IOS_GOOGLE_SERVICES_FILE
  : (fs.existsSync(IOS_GOOGLE_SERVICES_FALLBACK_FILE) ? IOS_GOOGLE_SERVICES_FALLBACK_FILE : null);
const PUBLIC_DOMAIN = 'nursego.co';
const PUBLIC_WWW_DOMAIN = `www.${PUBLIC_DOMAIN}`;

function parseBooleanEnv(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function parsePositiveIntEnv(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readPlistValue(filePath, key) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`));
  return match?.[1] || '';
}

const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  || readPlistValue(RESOLVED_IOS_GOOGLE_SERVICES_FILE, 'CLIENT_ID')
  || GOOGLE_WEB_CLIENT_ID
  || '';
const GOOGLE_IOS_REVERSED_CLIENT_ID = readPlistValue(RESOLVED_IOS_GOOGLE_SERVICES_FILE, 'REVERSED_CLIENT_ID');
const IOS_BUILD_NUMBER = String(process.env.EXPO_PUBLIC_IOS_BUILD_NUMBER || '1');
const ANDROID_VERSION_CODE = parsePositiveIntEnv(process.env.EXPO_PUBLIC_ANDROID_VERSION_CODE, 1);

module.exports = {
  expo: {
    name: 'NurseGo',
    slug: 'nurse-job-app',
    version: '1.0.0',
    runtimeVersion: {
      policy: 'appVersion',
    },
    scheme: 'nursego',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#4A90D9',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.nursego.app',
      buildNumber: IOS_BUILD_NUMBER,
      associatedDomains: [`applinks:${PUBLIC_DOMAIN}`, `applinks:${PUBLIC_WWW_DOMAIN}`],
      ...(RESOLVED_IOS_GOOGLE_SERVICES_FILE
        ? { googleServicesFile: RESOLVED_IOS_GOOGLE_SERVICES_FILE }
        : {}),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: 'NurseGo ต้องการตำแหน่งเพื่อหางานใกล้คุณ',
        NSLocationAlwaysUsageDescription: 'NurseGo ต้องการตำแหน่งเพื่อหางานใกล้คุณ',
        NSPhotoLibraryUsageDescription: 'เพื่ออัปโหลดรูปโปรไฟล์และเอกสาร',
        NSCameraUsageDescription: 'เพื่อถ่ายภาพโปรไฟล์และเอกสาร',
        ...(GOOGLE_IOS_REVERSED_CLIENT_ID
          ? {
              CFBundleURLTypes: [
                {
                  CFBundleURLSchemes: [GOOGLE_IOS_REVERSED_CLIENT_ID],
                },
              ],
            }
          : {}),
      },
      config: {
        googleMapsApiKey: GOOGLE_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#4A90D9',
      },
      package: 'com.nursego.app',
      versionCode: ANDROID_VERSION_CODE,
      googleServicesFile: './google-services.json',
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: PUBLIC_DOMAIN,
              pathPrefix: '/',
            },
            {
              scheme: 'https',
              host: PUBLIC_WWW_DOMAIN,
              pathPrefix: '/',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
      config: {
        googleMaps: {
          apiKey: GOOGLE_API_KEY,
        },
      },
      permissions: [
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    updates: {
      url: 'https://u.expo.dev/ab76f7f0-0e2f-4976-83ab-a7204452425f',
    },
    plugins: [
      '@react-native-firebase/app',
      '@react-native-firebase/app-check',
      '@react-native-firebase/auth',
      '@react-native-google-signin/google-signin',
      'expo-web-browser',
      [
        'expo-build-properties',
        {
          ios: {
            useFrameworks: 'static',
          },
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'NurseGo ต้องการตำแหน่งเพื่อหางานใกล้คุณ',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'เพื่ออัปโหลดรูปโปรไฟล์และเอกสาร',
          cameraPermission: 'เพื่อถ่ายภาพโปรไฟล์และเอกสาร',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#4A90D9',
          defaultChannel: 'default',
          sounds: [],
        },
      ],
    ],
    extra: {
      // Firebase (hardcoded fallbacks so EAS cloud builds without .env still work)
      firebaseApiKey:            FIREBASE.apiKey,
      firebaseAuthDomain:        FIREBASE.authDomain,
      firebaseProjectId:         FIREBASE.projectId,
      firebaseStorageBucket:     FIREBASE.storageBucket,
      firebaseMessagingSenderId: FIREBASE.messagingSenderId,
      firebaseAppId:             FIREBASE.appId,
      // Google OAuth (สำหรับ Google Sign-In)
      // วิธีได้ client IDs: ดูขั้นตอนใน README หรือ docs/google-signin-setup.md
      googleWebClientId:     GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientId: GOOGLE_ANDROID_CLIENT_ID,
      googleIosClientId:     GOOGLE_IOS_CLIENT_ID,
      // Google Places
      googlePlacesApiKey: GOOGLE_API_KEY,
      longdoApiKey: process.env.EXPO_PUBLIC_LONGDO_API_KEY || '42cbc4a02c0bc712bafa5e0b44ae2cd7',
      commerceFreeAccessStartDate: process.env.EXPO_PUBLIC_COMMERCE_FREE_ACCESS_START_DATE || '2026-03-09',
      commerceFreeAccessMonths: process.env.EXPO_PUBLIC_COMMERCE_FREE_ACCESS_MONTHS || '3',
      commerceFreeAccessMaxUsers: process.env.EXPO_PUBLIC_COMMERCE_FREE_ACCESS_MAX_USERS || '1000',
      commerceBillingProviderReady: parseBooleanEnv(process.env.EXPO_PUBLIC_COMMERCE_BILLING_PROVIDER_READY, false),
      // EAS
      eas: {
        projectId: 'ab76f7f0-0e2f-4976-83ab-a7204452425f',
      },
    },
  },
};
