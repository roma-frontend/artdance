/**
 * Шрифты ролика: брендовые, self-hosted в `public/fonts/`.
 *
 * Пары по локалям — в `locales.ts` (`FONTS`). Почему три набора:
 *   • Playfair Display не покрывает армянский алфавит;
 *   • Manrope не покрывает армянский;
 *   • DM Sans не покрывает кириллицу.
 * Поэтому ru — Playfair + Manrope, en — Playfair + DM Sans, hy — Noto
 * Serif/Sans Armenian. Это те же гарнитуры, что в проекте
 * (`src/design/fonts.ts`), поэтому ролик и сайт выглядят одним брендом.
 *
 * Файлы скачаны из @fontsource, поэтому офлайн-рендер не ходит в сеть.
 * `font-display:block` — при рендере кадров подмена шрифта недопустима:
 * она даёт разные метрики в разных кадрах.
 */

import { staticFile } from 'remotion';

const face = (family: string, file: string, weight: number) => `
@font-face{font-family:'${family}';src:url('${staticFile(`fonts/${file}`)}') format('woff2');font-weight:${weight};font-style:normal;font-display:block;}`;

/** Стили для вставки в сцену: `<style>{fontFaces}</style>`. */
export const fontFaces = [
  // Playfair Display — заголовки ru/en и словесная марка
  face('Playfair Display', 'playfair-latin-400.woff2', 400),
  face('Playfair Display', 'playfair-latin-700.woff2', 700),
  face('Playfair Display', 'playfair-latin-900.woff2', 900),
  face('Playfair Display', 'playfair-cyrillic-400.woff2', 400),
  face('Playfair Display', 'playfair-cyrillic-700.woff2', 700),
  face('Playfair Display', 'playfair-cyrillic-900.woff2', 900),
  // Manrope — текст ru (DM Sans без кириллицы)
  face('Manrope', 'manrope-latin-400.woff2', 400),
  face('Manrope', 'manrope-latin-500.woff2', 500),
  face('Manrope', 'manrope-latin-700.woff2', 700),
  face('Manrope', 'manrope-latin-800.woff2', 800),
  face('Manrope', 'manrope-cyrillic-400.woff2', 400),
  face('Manrope', 'manrope-cyrillic-500.woff2', 500),
  face('Manrope', 'manrope-cyrillic-700.woff2', 700),
  face('Manrope', 'manrope-cyrillic-800.woff2', 800),
  // DM Sans — текст en (как в проекте)
  face('DM Sans', 'dmsans-latin-400.woff2', 400),
  face('DM Sans', 'dmsans-latin-500.woff2', 500),
  face('DM Sans', 'dmsans-latin-700.woff2', 700),
  face('DM Sans', 'dmsans-latin-800.woff2', 800),
  // Noto Serif/Sans Armenian — заголовки и текст hy
  face('Noto Serif Armenian', 'notoserif-arm-400.woff2', 400),
  face('Noto Serif Armenian', 'notoserif-arm-700.woff2', 700),
  face('Noto Serif Armenian', 'notoserif-arm-900.woff2', 900),
  face('Noto Sans Armenian', 'noto-arm-400.woff2', 400),
  face('Noto Sans Armenian', 'noto-arm-500.woff2', 500),
  face('Noto Sans Armenian', 'noto-arm-700.woff2', 700),
  face('Noto Sans Armenian', 'noto-arm-900.woff2', 900),
].join('\n');
