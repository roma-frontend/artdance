/**
 * Шрифты. Self-hosted через `next/font` — нет запроса к fonts.googleapis.com,
 * нет FOUT и нет внешней зависимости в CSP.
 *
 * Пара взята из утверждённого прототипа: Playfair Display (editorial display)
 * + DM Sans (UI). Noto Sans Armenian подключён отдельно, потому что ни одна
 * из основных гарнитур не покрывает армянский алфавит полностью.
 */

import { DM_Sans, Playfair_Display } from 'next/font/google';
import localFont from 'next/font/local';

export const displayFont = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  // Variable font сохраняет 400/700 без статических Google kit URL,
  // которые Turbopack может неверно разобрать как несколько query-параметров.
  weight: 'variable',
  // italic нужен только для акцент-слова в hero — один начертания достаточно.
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
  adjustFontFallback: true,
  fallback: ['Times New Roman', 'Georgia', 'serif'],
});

export const sansFont = DM_Sans({
  subsets: ['latin'],
  // На первом экране геро-тексты это 400/600 — 500/700 ниже фолда.
  weight: ['400', '600'],
  display: 'swap',
  variable: '--font-dm-sans',
  preload: true,
  adjustFontFallback: true,
  fallback: ['system-ui', 'Segoe UI', 'sans-serif'],
});

/**
 * Noto Sans Armenian — локально, не через `next/font/google`.
 *
 * Причина: Turbopack на сборке падал с `next/font/google queries have exactly
 * one entry` ровно на армянском CSS (см. CI 22.10.2026) — ресолвер не справлялся
 * с подстановкой gstatic-URL. Файл лежит в репозитории: сборка больше не ходит
 * в сеть за этим шрифтом и не зависит от того, что вернёт fonts.googleapis.com.
 *
 * Взят только армянский сабсет (U+0530-058F и соседи), variable 100-900 —
 * латиница и кириллица приходят из DM Sans, дублировать их незачем.
 */
export const armenianFont = localFont({
  src: './fonts/noto-sans-armenian.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-noto-armenian',
  preload: false,
});

/** Классы для `<html>`: подключают CSS-переменные шрифтов. */
export const fontVariables = [displayFont.variable, sansFont.variable, armenianFont.variable].join(' ');
