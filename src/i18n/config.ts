/**
 * I18N CONFIG — локали и правила форматирования.
 *
 * Армянский — язык по умолчанию для домена .am: это основной рынок, и он же
 * должен получать канонические URL без префикса при `localePrefix: 'as-needed'`.
 * Мы, однако, используем `always`: явный префикс у всех локалей даёт
 * предсказуемые canonical/hreflang и упрощает кеширование на CDN.
 */

export const locales = ['hy', 'ru', 'en'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'hy';

/** Локаль, к которой откатываются недостающие ключи перевода. */
export const fallbackLocale: Locale = 'en';

export interface LocaleMeta {
  code: Locale;
  /** BCP 47 — для `Intl.*`, `lang`, hreflang. */
  bcp47: string;
  /** Самоназвание — единственное место, где имя языка не переводится. */
  nativeName: string;
  direction: 'ltr' | 'rtl';
  /** Флаг-эмодзи не используем: язык ≠ страна. Показываем код. */
  shortLabel: string;
  /** Начало недели: 1 = понедельник. */
  firstDayOfWeek: 0 | 1;
  numberingSystem: string;
}

export const localeMeta: Record<Locale, LocaleMeta> = {
  hy: {
    code: 'hy',
    bcp47: 'hy-AM',
    nativeName: 'Հայերեն',
    direction: 'ltr',
    shortLabel: 'ՀԱՅ',
    firstDayOfWeek: 1,
    numberingSystem: 'latn',
  },
  ru: {
    code: 'ru',
    bcp47: 'ru-RU',
    nativeName: 'Русский',
    direction: 'ltr',
    shortLabel: 'РУС',
    firstDayOfWeek: 1,
    numberingSystem: 'latn',
  },
  en: {
    code: 'en',
    bcp47: 'en-US',
    nativeName: 'English',
    direction: 'ltr',
    shortLabel: 'ENG',
    firstDayOfWeek: 1,
    numberingSystem: 'latn',
  },
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Форматы для `next-intl`. Объявлены глобально, чтобы в компонентах писали
 * `format.dateTime(date, 'slotTime')`, а не набор опций Intl каждый раз.
 */
export const formats = {
  dateTime: {
    slotTime: { hour: '2-digit', minute: '2-digit', hour12: false },
    shortDate: { day: 'numeric', month: 'short' },
    mediumDate: { day: 'numeric', month: 'long', year: 'numeric' },
    weekdayShort: { weekday: 'short' },
    weekdayLong: { weekday: 'long' },
    /**
     * «сб, 7 сент.» — день без года и без времени. Нужен там, где год очевиден
     * из контекста (выбранная дата в календаре брони, заголовок списка слотов),
     * а время указано рядом отдельным элементом.
     */
    dayWithWeekday: { weekday: 'short', day: 'numeric', month: 'short' },
    monthYear: { month: 'long', year: 'numeric' },
    bookingStamp: {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    },
  },
  number: {
    /** Цена в драмах: без дробной части, символ ֏ после числа. */
    price: { style: 'currency', currency: 'AMD', maximumFractionDigits: 0 },
    priceCompact: { style: 'currency', currency: 'AMD', notation: 'compact', maximumFractionDigits: 0 },
    plain: { maximumFractionDigits: 0 },
    rating: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
    percent: { style: 'percent', maximumFractionDigits: 0 },
    compact: { notation: 'compact', maximumFractionDigits: 1 },
  },
  list: {
    enumeration: { style: 'long', type: 'conjunction' },
    alternatives: { style: 'long', type: 'disjunction' },
  },
} as const;
