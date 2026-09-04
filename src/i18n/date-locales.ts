/**
 * Локали календаря.
 *
 * `react-day-picker` берёт названия месяцев и дней у `date-fns`, а не у `Intl`,
 * поэтому нашим трём локалям нужно сопоставить три объекта date-fns. Импорт идёт
 * из `react-day-picker/locale`, а не напрямую из `date-fns/locale`: пакет
 * реэкспортирует их сам, и версия локалей гарантированно совпадает с версией
 * календаря.
 *
 * Карта живёт в `src/i18n/`, потому что это часть локализации, а не дизайна: тут
 * же лежат `formats`, метаданные локалей и каталоги сообщений. Компонент
 * календаря получает готовый объект и о существовании date-fns не знает.
 *
 * Все три локали статические, а не подгружаемые: вместе они добавляют около
 * двух килобайт, а `await import()` в компоненте календаря дал бы пустую сетку
 * на время загрузки чанка.
 */

import { enUS, hy, ru } from 'react-day-picker/locale';
import type { DayPickerLocale } from 'react-day-picker/locale';

import type { Locale } from './config';

export const dayPickerLocales: Record<Locale, Partial<DayPickerLocale>> = {
  hy,
  ru,
  en: enUS,
};
