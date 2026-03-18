import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

type GoogleSigninPackage = typeof import('@react-native-google-signin/google-signin');

const IS_EXPO_GO = Constants.executionEnvironment === 'storeClient';

function hasNativeGoogleSigninModule() {
  return Boolean((NativeModules as Record<string, unknown>).RNGoogleSignin);
}

export function getGoogleSigninModule(): GoogleSigninPackage | null {
  if (IS_EXPO_GO || !hasNativeGoogleSigninModule()) {
    return null;
  }

  try {
    return require('@react-native-google-signin/google-signin') as GoogleSigninPackage;
  } catch {
    return null;
  }
}

export function getGoogleSigninUnavailableMessage() {
  if (IS_EXPO_GO) {
    return 'Expo Go ไม่รองรับ native Google Sign-In กรุณาทดสอบผ่าน development build, APK หรือ IPA';
  }

  return 'Build ปัจจุบันยังไม่มี native Google Sign-In กรุณา rebuild แอปใหม่ให้รวมโมดูลนี้ก่อนใช้งาน Google Sign-In';
}
