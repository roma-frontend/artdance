/**
 * Шрифты. Self-hosted через `next/font` — нет запроса к fonts.googleapis.com,
 * нет FOUT и нет внешней зависимости в CSP.
 *
 * Пара взята из утверждённого прототипа: Playfair Display (editorial display)
 * + DM Sans (UI). Noto Sans Armenian подключён отдельно, потому что ни одна
 * из основных гарнитур не покрывает армянский алфавит полностью.
 */

import { DM_Sans, Noto_Sans_Armenian, Playfair_Display } from 'next/font/google';

export const displayFont = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
});

export const sansFont = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
  preload: true,
});

export const armenianFont = Noto_Sans_Armenian({
  subsets: ['armenian'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-armenian',
  preload: false,
});

/** Классы для `<html>`: подключают CSS-переменные шрифтов. */
export const fontVariables = [displayFont.variable, sansFont.variable, armenianFont.variable].join(' ');
