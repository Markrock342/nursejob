import { en } from './dictionaries/en';
import { th } from './dictionaries/th';
import type { ResolvedLanguage } from './config';

type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends string ? string : TranslationShape<T[Key]>;
};

type TranslationDictionary = TranslationShape<typeof th>;

type NestedTranslationKey<T> = {
  [Key in Extract<keyof T, string>]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${NestedTranslationKey<T[Key]>}`
      : never;
}[Extract<keyof T, string>];

export type TranslationKey = NestedTranslationKey<TranslationDictionary>;
export type TranslationVariables = Record<string, string | number | null | undefined>;

const dictionaries: Record<ResolvedLanguage, TranslationDictionary> = {
  th,
  en,
};

function getNestedTranslation(dictionary: TranslationDictionary, key: TranslationKey): string | undefined {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (current == null || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[segment];
  }, dictionary) as string | undefined;
}

function interpolate(template: string, variables?: TranslationVariables): string {
  if (!variables) return template;

  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = variables[token];
    return value == null ? '' : String(value);
  });
}

export function translate(
  language: ResolvedLanguage,
  key: TranslationKey,
  variables?: TranslationVariables,
): string {
  const primary = getNestedTranslation(dictionaries[language], key);
  const fallback = getNestedTranslation(dictionaries.th, key);
  const value = primary ?? fallback;

  if (!value) {
    if (__DEV__) {
      console.warn(`[i18n] Missing translation key: ${key}`);
    }
    return key;
  }

  return interpolate(value, variables);
}

export { th, en, dictionaries };
export * from './config';
export * from './format';
export { useI18n } from './I18nProvider';