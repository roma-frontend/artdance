import type { Messages } from '@/i18n/types';
import { localeMeta, type Locale } from '@/i18n/config';
import { API_URL } from './config';

const STYLE_KEYS: Record<string, keyof Messages['danceStyles']> = {
  HIP_HOP: 'hipHop', BALLET: 'ballet', SALSA: 'salsa', BACHATA: 'bachata', CONTEMPORARY: 'contemporary',
  HEELS: 'heels', KPOP: 'kpop', LATIN: 'latin', TANGO: 'tango', ARMENIAN_FOLK: 'armenianFolk', JAZZ: 'jazz',
  BREAKING: 'breaking', FLAMENCO: 'flamenco', BALLROOM: 'ballroom', AFRO: 'afro', WEDDING_DANCE: 'weddingDance',
  KIDS: 'kids', STRETCHING: 'stretching', KIZOMBA: 'kizomba',
};

const LEVEL_KEYS: Record<string, keyof Messages['levels']> = {
  BEGINNER: 'beginner', INTERMEDIATE: 'intermediate', ADVANCED: 'advanced', PROFESSIONAL: 'professional',
};

/** Ключ направления в словаре: тот же для названия и для текстов хаба `styleHub.styles`. */
export function styleKey(style: string): keyof Messages['danceStyles'] | undefined {
  return STYLE_KEYS[style];
}

export function styleLabel(style: string, t: Messages): string {
  const key = styleKey(style);
  return key ? t.danceStyles[key] : style;
}

export function levelLabel(level: string, t: Messages): string {
  const key = LEVEL_KEYS[level];
  return key ? t.levels[key] : level;
}

export function price(amount: number, locale: Locale): string {
  const number = new Intl.NumberFormat(localeMeta[locale].bcp47, { maximumFractionDigits: 0 }).format(amount);
  return locale === 'en' ? `֏${number}` : `${number} ֏`;
}

// Hermes не содержит Intl.PluralRules, поэтому правила для hy/ru/en заданы вручную.
function pluralCategory(count: number, locale: Locale): string {
  if (locale === 'en') return count === 1 ? 'one' : 'other';
  if (locale === 'ru') {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'one';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
    return 'many';
  }
  return 'other';
}

/** Минимальный ICU-плюрал для строк каталога веба: `{count, plural, =0 {…} one {# …} other {# …}}`. */
export function plural(template: string, count: number, locale: Locale): string {
  const match = /\{count, plural,(.*)\}$/.exec(template);
  if (!match) return template.replace('{count}', String(count));
  const forms: Record<string, string> = {};
  for (const [, key, value] of match[1].matchAll(/(=?\w+)\s*\{([^}]*)\}/g)) forms[key] = value;
  const category = pluralCategory(count, locale);
  const form = forms[`=${count}`] ?? forms[category] ?? forms.other ?? '';
  return form.replace('#', String(count));
}

export function weekdayShort(weekday: number, locale: Locale): string {
  // 2023-01-01 — воскресенье, поэтому день недели совпадает с Date.getDay().
  const date = new Date(Date.UTC(2023, 0, 1 + weekday, 12));
  return new Intl.DateTimeFormat(localeMeta[locale].bcp47, { weekday: 'short', timeZone: 'UTC' }).format(date);
}

export function dateLabel(iso: string, locale: Locale, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeMeta[locale].bcp47, options).format(new Date(iso));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'A';
}

export function webUrl(locale: Locale, path: string): string {
  return `${API_URL}/${locale}${path}`;
}
