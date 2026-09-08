/**
 * МЕДИА ИЗ БАЗЫ: `MediaAsset` → `MediaRef`.
 *
 * Один способ превратить строку таблицы в ссылку для компонента. Копия этого
 * преобразования в каждом запросе означала бы, что alt-текст однажды тихо
 * исчезнет на одном из экранов — а заметит это не разработчик, а незрячий
 * пользователь.
 *
 * ## Три решения
 *
 * **Alt-текст собирается из переводов, а не берётся один на все языки.**
 * `MediaAsset.altText` — базовое описание (английское в демо-данных),
 * `MediaAssetTranslation` — переводы. Локаль, у которой перевода нет, получает
 * базовое описание: пустой `alt` хуже неточного, потому что скринридер прочитает
 * имя файла.
 *
 * **Размеры и плейсхолдер едут вместе со ссылкой.** Они есть в схеме
 * (`width`, `height`, `blurDataUrl`) именно для того, чтобы разметка не зависела
 * от файлового манифеста: загруженное заказчиком изображение существует только в
 * базе и в бакете, и без размеров вёрстка прыгает при загрузке.
 *
 * **Порядок кадров задаёт `sortOrder`, а не база.** Без явного порядка галерея
 * товара меняет первый кадр от запроса к запросу — это выглядит как случайная
 * подмена главной фотографии.
 */

import 'server-only';

import type { LocalizedText, MediaRef } from '@/domain/content';
import { locales, type Locale } from '@/i18n/config';

/**
 * Поля `MediaAsset`, нужные компоненту.
 *
 * `select` вместо `include`: изображения тянутся почти каждым запросом каталога,
 * и лишние колонки (`bytes`, `mimeType`, `focalPoint` владельца) — это трафик
 * между базой и приложением на каждой карточке.
 */
export const mediaSelect = {
  storageKey: true,
  altText: true,
  width: true,
  height: true,
  blurDataUrl: true,
  focalPoint: true,
  sortOrder: true,
  translations: { select: { locale: true, altText: true } },
} as const;

export interface MediaRow {
  storageKey: string;
  altText: string;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
  focalPoint: string | null;
  sortOrder: number;
  translations: ReadonlyArray<{ locale: Locale; altText: string }>;
}

/**
 * Ключ файла для компонента.
 *
 * Сид добавляет к пути владельца (`…/style-salsa.webp#class:latin-fusion`),
 * потому что один файл используют несколько сущностей, а `storageKey` уникален.
 * Браузеру фрагмент безразличен, но `next/image` подставит его в URL, а
 * оптимизатор — в ключ кеша: два кадра одного файла закешируются дважды.
 * Поэтому фрагмент снимается здесь, в единственном месте.
 */
function fileKey(storageKey: string): string {
  const hash = storageKey.indexOf('#');
  return hash === -1 ? storageKey : storageKey.slice(0, hash);
}

/** Описание на трёх языках: перевод, а при его отсутствии — базовый текст. */
function altFrom(row: MediaRow): LocalizedText {
  const byLocale = new Map(row.translations.map((item) => [item.locale, item.altText]));
  return Object.fromEntries(
    locales.map((locale) => [locale, byLocale.get(locale) ?? row.altText]),
  ) as LocalizedText;
}

export function toMediaRef(row: MediaRow): MediaRef {
  return {
    key: fileKey(row.storageKey),
    alt: altFrom(row),
    ...(row.focalPoint ? { focalPoint: row.focalPoint } : {}),
    ...(row.width !== null ? { width: row.width } : {}),
    ...(row.height !== null ? { height: row.height } : {}),
    ...(row.blurDataUrl ? { blurDataUrl: row.blurDataUrl } : {}),
  };
}

/**
 * Первый кадр сущности — тот, что показывает карточка.
 *
 * `null` — легальное состояние: у направления без фотографии кадра нет, и
 * заглушка вместо него была бы обманом. Решает, что показать вместо, вызывающая
 * сторона (`Media` умеет `fallback`).
 */
export function firstMediaRef(rows: readonly MediaRow[]): MediaRef | null {
  const sorted = [...rows].sort((left, right) => left.sortOrder - right.sortOrder);
  return sorted[0] ? toMediaRef(sorted[0]) : null;
}

/** Галерея: все кадры сущности в объявленном порядке. */
export function galleryRefs(rows: readonly MediaRow[]): readonly MediaRef[] {
  return [...rows].sort((left, right) => left.sortOrder - right.sortOrder).map(toMediaRef);
}
