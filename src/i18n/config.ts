import { getLocales, type Locale } from 'expo-localization';

export type LanguagePreference = 'system' | 'th' | 'en';
export type ResolvedLanguage = 'th' | 'en';

export const DEFAULT_LANGUAGE_PREFERENCE: LanguagePreference = 'system';

type LocaleLike = Pick<Locale, 'languageCode' | 'regionCode' | 'languageTag'>;

export function normalizeLanguagePreference(value?: string | null): LanguagePreference {
  if (value === 'th' || value === 'en' || value === 'system') return value;
  return DEFAULT_LANGUAGE_PREFERENCE;
}

export function resolveLanguageFromLocales(locales?: readonly LocaleLike[] | null): ResolvedLanguage {
  const primary = locales?.[0];
  const languageCode = primary?.languageCode?.toLowerCase();
  const languageTag = primary?.languageTag?.toLowerCase() || '';
  const regionCode = primary?.regionCode?.toUpperCase();

  if (languageCode === 'th' || languageTag.startsWith('th')) return 'th';
  if (languageCode === 'en' || languageTag.startsWith('en')) return 'en';
  if (regionCode === 'TH') return 'th';
  return 'en';
}

export function resolveLanguagePreference(
  preference: LanguagePreference,
  locales?: readonly LocaleLike[] | null,
): ResolvedLanguage {
  if (preference === 'th' || preference === 'en') return preference;
  return resolveLanguageFromLocales(locales);
}

export function getInitialResolvedLanguage(): ResolvedLanguage {
  return resolveLanguageFromLocales(getLocales());
}

export function getLocaleTag(language: ResolvedLanguage): string {
  return language === 'th' ? 'th-TH' : 'en-US';
}

export function getGooglePlacesLanguage(language: ResolvedLanguage): 'th' | 'en' {
  return language === 'th' ? 'th' : 'en';
}