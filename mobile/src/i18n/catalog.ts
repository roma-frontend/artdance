import type { Locale } from './config';
import hy from './messages/hy';
import ru from './messages/ru';
import en from './messages/en';
import type { Messages } from './types';

/** Полный каталог переводов веба (скопирован из src/i18n/messages). */
export const catalogs: Record<Locale, Messages> = {
  hy: hy as Messages,
  ru: ru as Messages,
  en: en as unknown as Messages,
};

export function catalogFor(locale: Locale): Messages {
  return catalogs[locale];
}
