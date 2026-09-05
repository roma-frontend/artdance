/**
 * Доступ к оптимизированным ассетам прототипа.
 *
 * Отделено от `design/asset-manifest.ts` намеренно: тот манифест — документ для
 * человека и скриптов (какой файл дизайна чем стал, где переиспользован,
 * что требует пережатия). Компоненту из этого нужны только путь и размеры,
 * и тянуть в бандл описания и связи ни к чему.
 *
 * Расширение файла здесь не фигурирует: после `npm run media:optimize` все
 * ассеты в WebP, и знание формата не должно расползаться по компонентам.
 */

import { seedMedia as generated, type SeedMediaEntry } from './seed-media.generated';

export type { SeedMediaEntry };
export type SeedMediaName = keyof typeof generated;

export interface ResolvedSeedMedia extends SeedMediaEntry {
  /** Путь для `next/image`, относительно `public`. */
  src: string;
}

/**
 * Возвращает параметры ассета по семантическому имени.
 * `undefined` для любого другого значения — значит, это обычный путь или URL.
 *
 * К имени файла добавлен отпечаток содержимого (`hero-loop-poster.f4fca815.webp`).
 * Без него замена ассета не меняет URL, а по URL кешируют браузер, CDN и
 * оптимизатор изображений Next: после подмены постера первого экрана страница целую
 * секунду показывала кадр из прошлого макета, потому что производная лежала в
 * `.next/cache/images` под тем же адресом. Отпечаток делает адрес новым для всех
 * трёх. В query его положить нельзя — Next 16 отклоняет локальные изображения с
 * query-строкой, не описанной в `images.localPatterns`.
 */
export function seedMedia(name: string): ResolvedSeedMedia | undefined {
  const entry = generated[name as SeedMediaName];
  if (!entry) return undefined;
  return { ...entry, src: `/media/seed/${entry.file}` };
}

/** Путь к оптимизированному файлу. Пустая строка, если такого ассета нет. */
export function seedMediaPath(name: string): string {
  return seedMedia(name)?.src ?? '';
}

/** Все известные имена — для проверок в тестах и скриптах. */
export const seedMediaNames = Object.keys(generated) as readonly SeedMediaName[];
