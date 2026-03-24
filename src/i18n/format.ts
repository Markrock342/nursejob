import {
  getGooglePlacesLanguage,
  getInitialResolvedLanguage,
  getLocaleTag,
  type ResolvedLanguage,
} from './config';

let currentResolvedLanguage: ResolvedLanguage = getInitialResolvedLanguage();

export function syncI18nFormatting(language: ResolvedLanguage) {
  currentResolvedLanguage = language;
}

export function getCurrentResolvedLanguage(): ResolvedLanguage {
  return currentResolvedLanguage;
}

export function getCurrentLocaleTag(): string {
  return getLocaleTag(currentResolvedLanguage);
}

export function getCurrentGooglePlacesLanguage(): 'th' | 'en' {
  return getGooglePlacesLanguage(currentResolvedLanguage);
}

const timeUnitNames: Record<ResolvedLanguage, Record<'hour' | 'day' | 'month' | 'shift', string>> = {
  th: {
    hour: 'ชม.',
    day: 'วัน',
    month: 'เดือน',
    shift: 'เวร',
  },
  en: {
    hour: 'hr',
    day: 'day',
    month: 'month',
    shift: 'shift',
  },
};

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getCurrentLocaleTag(), options).format(value);
}

export function formatCurrency(amount: number, options?: { includeCodeInEnglish?: boolean }): string {
  const formatted = formatNumber(amount, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (getCurrentResolvedLanguage() === 'en' && options?.includeCodeInEnglish) {
    return `THB ${formatted}`;
  }

  return `฿${formatted}`;
}

export function formatDateValue(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' },
): string {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  return date.toLocaleDateString(getCurrentLocaleTag(), options);
}

export function formatTimeValue(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  const date = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  return date.toLocaleTimeString(getCurrentLocaleTag(), options);
}

export function formatRelativeTimeValue(value: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - value.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const language = getCurrentResolvedLanguage();

  if (diffMins < 1) return language === 'th' ? 'เมื่อสักครู่' : 'Just now';
  if (diffMins < 60) return language === 'th' ? `${diffMins} นาทีที่แล้ว` : `${diffMins} min ago`;
  if (diffHours < 24) return language === 'th' ? `${diffHours} ชั่วโมงที่แล้ว` : `${diffHours} hr ago`;
  if (diffDays < 7) return language === 'th' ? `${diffDays} วันที่แล้ว` : `${diffDays} day ago`;
  return formatDateValue(value);
}

export function formatSalaryRangeValue(min: number, max: number, unit: 'hour' | 'day' | 'month' | 'shift' = 'month'): string {
  const unitLabel = timeUnitNames[getCurrentResolvedLanguage()][unit];
  const left = formatNumber(min);
  const right = formatNumber(max);

  if (getCurrentResolvedLanguage() === 'th') {
    if (min === max) return `${left} บาท/${unitLabel}`;
    return `${left}-${right} บาท/${unitLabel}`;
  }

  if (min === max) return `THB ${left}/${unitLabel}`;
  return `THB ${left}-${right}/${unitLabel}`;
}

export function getRateUnitLabel(rateType?: string): string {
  if (rateType === 'hour') return `/${timeUnitNames[getCurrentResolvedLanguage()].hour}`;
  if (rateType === 'day') return `/${timeUnitNames[getCurrentResolvedLanguage()].day}`;
  if (rateType === 'month') return `/${timeUnitNames[getCurrentResolvedLanguage()].month}`;
  return `/${timeUnitNames[getCurrentResolvedLanguage()].shift}`;
}