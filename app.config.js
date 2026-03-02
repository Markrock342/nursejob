// app.config.js — replaces app.json for EAS builds
// Reads .env values and embeds them into extra + configures all native plugins
require('dotenv').config();

const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY
  || 'AIzaSyAJVBDwB2sl0XJc3FTvLi_l7lsOGgHBfwc';

// Firebase config is safe to embed in client (security = Firestore Rules)
const FIREBASE = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY            || 'AIzaSyCePlG5nmTJfOGa_P-j0Xm8c0GVF5xZ3zg',
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN        || 'nurse-go-th.firebaseapp.com',
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID         || 'nurse-go-th',
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET     || 'nurse-go-th.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID|| '427547114323',
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID             || '1:427547114323:android:a89c6f0e5659ae8a19bfa6',
};

module.exports = {
  expo: {
    name: 'NurseGo',
    slug: 'nurse-job-app',
    version: '1.0.0',
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
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        NSLocationWhenInUseUsageDescription: 'NurseGo ต้องการตำแหน่งเพื่อหางานใกล้คุณ',
        NSLocationAlwaysUsageDescription: 'NurseGo ต้องการตำแหน่งเพื่อหางานใกล้คุณ',
        NSPhotoLibraryUsageDescription: 'เพื่ออัปโหลดรูปโปรไฟล์และเอกสาร',
        NSCameraUsageDescription: 'เพื่อถ่ายภาพโปรไฟล์และเอกสาร',
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
      googleServicesFile: './google-services.json',
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
    plugins: [
      'expo-web-browser',
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
      googleWebClientId:     process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID     || '427547114323-87ibkaeo6kun7cfhc20919c9gn7ntp24.apps.googleusercontent.com',
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '', // ← ใส่หลัง setup SHA-1
      googleIosClientId:     process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID     || '',
      // Google Places
      googlePlacesApiKey: GOOGLE_API_KEY,
      longdoApiKey: process.env.EXPO_PUBLIC_LONGDO_API_KEY || '42cbc4a02c0bc712bafa5e0b44ae2cd7',
      // Admin
      adminUsername:     process.env.EXPO_PUBLIC_ADMIN_USERNAME     || 'adminmark',
      adminPasswordHash: process.env.EXPO_PUBLIC_ADMIN_PASSWORD_HASH || '9b4555ae53a43a3fb6d3b2eca73de89c918a8d0483c26fe548c6ce03829a7776',
      // EAS
      eas: {
        projectId: 'ab76f7f0-0e2f-4976-83ab-a7204452425f',
      },
    },
  },
};
