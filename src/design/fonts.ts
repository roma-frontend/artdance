/**
 * Шрифты. Self-hosted, без `next/font/google`: сборка не ходит в сеть и не
 * зависит от доступности Google Fonts на CI.
 *
 * - Playfair Display и DM Sans: woff2-файлы в `src/design/fonts/`, подключение
 *   через `fonts.css` (`@font-face` + CSS-переменные `--font-playfair`,
 *   `--font-dm-sans`). CSS импортируется в `src/app/[locale]/layout.tsx`.
 * - Noto Sans Armenian: `next/font/local`, потому что ни одна из основных
 *   гарнитур не покрывает армянский алфавит.
 */

import localFont from 'next/font/local';

/**
 * Noto Sans Armenian — локально, не через `next/font/google`.
 *
 * Причина: Turbopack на сборке падал с `next/font/google queries have exactly
 * one entry` ровно на армянском CSS (см. CI 22.10.2026) — ресолвер не справлялся
 * с подстановкой gstatic-URL. Файл лежит в репозитории: сборка больше не ходит
 * в сеть за этим шрифтом и не зависит от того, что вернёт fonts.googleapis.com.
 *
 * Взят только армянский сабсет (U+0530-058F и соседи), variable 100-900 —
 * латиница приходит из DM Sans, кириллица из Playfair Display, дублировать их незачем.
 */
export const armenianFont = localFont({
  src: './fonts/noto-sans-armenian.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-noto-armenian',
  preload: false,
});

/** Классы для `<html>`: подключают CSS-переменную армянского шрифта. */
export const fontVariables = armenianFont.variable;
