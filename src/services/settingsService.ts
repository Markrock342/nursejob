import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguagePreference } from '../i18n';

export interface AppSettings {
  notifications: {
    pushEnabled: boolean;
    newJobs: boolean;
    messages: boolean;
    applications: boolean;
    marketing: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showOnlineStatus: boolean;
  };
  preferences: {
    language: LanguagePreference;
    theme: 'light' | 'dark' | 'system';
  };
}

export const SETTINGS_STORAGE_KEY = 'settings';

export const defaultAppSettings: AppSettings = {
  notifications: {
    pushEnabled: true,
    newJobs: true,
    messages: true,
    applications: true,
    marketing: false,
  },
  privacy: {
    profileVisible: true,
    showOnlineStatus: true,
  },
  preferences: {
    language: 'system',
    theme: 'light',
  },
};

export function mergeAppSettings(partial?: Partial<AppSettings> | null): AppSettings {
  return {
    notifications: {
      ...defaultAppSettings.notifications,
      ...(partial?.notifications || {}),
    },
    privacy: {
      ...defaultAppSettings.privacy,
      ...(partial?.privacy || {}),
    },
    preferences: {
      ...defaultAppSettings.preferences,
      ...(partial?.preferences || {}),
    },
  };
}

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const saved = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!saved) return defaultAppSettings;
    return mergeAppSettings(JSON.parse(saved));
  } catch (error) {
    console.error('Error loading app settings:', error);
    return defaultAppSettings;
  }
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(mergeAppSettings(settings)));
  } catch (error) {
    console.error('Error saving app settings:', error);
    throw error;
  }
}

export async function isNotificationSettingEnabled(
  key: keyof AppSettings['notifications']
): Promise<boolean> {
  const settings = await loadAppSettings();
  return Boolean(settings.notifications.pushEnabled && settings.notifications[key]);
}