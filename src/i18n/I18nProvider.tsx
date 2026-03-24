import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocales } from 'expo-localization';
import { loadAppSettings, mergeAppSettings, saveAppSettings } from '../services/settingsService';
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  getLocaleTag,
  normalizeLanguagePreference,
  resolveLanguagePreference,
  type LanguagePreference,
  type ResolvedLanguage,
} from './config';
import { syncI18nFormatting } from './format';
import { translate, type TranslationKey, type TranslationVariables } from './index';

interface I18nContextValue {
  languagePreference: LanguagePreference;
  resolvedLanguage: ResolvedLanguage;
  localeTag: string;
  setLanguagePreference: (preference: LanguagePreference) => Promise<void>;
  t: (key: TranslationKey, variables?: TranslationVariables) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locales = useLocales();
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(DEFAULT_LANGUAGE_PREFERENCE);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const settings = await loadAppSettings();
        if (!isMounted) return;
        setLanguagePreferenceState(normalizeLanguagePreference(settings.preferences.language));
      } catch (error) {
        console.error('Error loading language preference:', error);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedLanguage = useMemo(
    () => resolveLanguagePreference(languagePreference, locales),
    [languagePreference, locales],
  );
  const localeTag = useMemo(() => getLocaleTag(resolvedLanguage), [resolvedLanguage]);

  useEffect(() => {
    syncI18nFormatting(resolvedLanguage);
  }, [resolvedLanguage]);

  const setLanguagePreference = useCallback(async (preference: LanguagePreference) => {
    const normalized = normalizeLanguagePreference(preference);
    setLanguagePreferenceState(normalized);

    const currentSettings = await loadAppSettings();
    await saveAppSettings(mergeAppSettings({
      ...currentSettings,
      preferences: {
        ...currentSettings.preferences,
        language: normalized,
      },
    }));
  }, []);

  const t = useCallback(
    (key: TranslationKey, variables?: TranslationVariables) => translate(resolvedLanguage, key, variables),
    [resolvedLanguage],
  );

  const value = useMemo(
    () => ({ languagePreference, resolvedLanguage, localeTag, setLanguagePreference, t }),
    [languagePreference, resolvedLanguage, localeTag, setLanguagePreference, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}