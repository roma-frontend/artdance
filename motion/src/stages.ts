/**
 * КАРКАС РОЛИКА — тайминги и геометрия сцен.
 *
 * Тексты живут в `locales.ts` (три языка), здесь только время и раскладка:
 * так сдвиг этапа и правка подписи не задевают друг друга.
 *
 * Кадры при 30 fps. Ролик 60 с = 1800 кадров.
 */

import type { Layout } from './Stage';

export interface StageTiming {
  /** Номер на плашке: 01…06 */
  n: string;
  /** Задник сцены — луп проекта */
  backdrop: string;
  /** Секунда в лупе, с которой играем */
  from: number;
  start: number;
  end: number;
  /** Раскладка сцены: у каждого этапа своя, иначе шесть сцен читаются как один слайд */
  layout: Layout;
}

const S = 30;

export const STAGES: StageTiming[] = [
  { n: '01', backdrop: 'assets/hero-loop.mp4', from: 2, start: 4 * S, end: 12 * S, layout: 'right' },
  { n: '02', backdrop: 'assets/competition-loop.mp4', from: 1.5, start: 12 * S, end: 20 * S, layout: 'left' },
  { n: '03', backdrop: 'assets/editorial-loop.mp4', from: 2, start: 20 * S, end: 28 * S, layout: 'split' },
  { n: '04', backdrop: 'assets/editorial-loop.mp4', from: 5, start: 28 * S, end: 36 * S, layout: 'right' },
  // Сетка 2×2 — только там, где строк ровно четыре: при трёх строках
  // половина сетки пустует, и пара «подпись — значение» разрывается.
  { n: '05', backdrop: 'assets/hero-loop.mp4', from: 6, start: 36 * S, end: 44 * S, layout: 'split' },
  { n: '06', backdrop: 'assets/competition-loop.mp4', from: 4, start: 44 * S, end: 52 * S, layout: 'grid' },
];

/** Финал: лого собирается в луче. */
export const FINALE = { start: 52 * S, end: 60 * S };
export const DURATION = 60 * S;

/** Хук: занавес расходится, первая фраза. */
export const INTRO_END = 4 * S;

/**
 * Безопасные поля кадра 1920×1080.
 *
 * Карточки не должны подходить к краю ближе 120 px: на проекторе и в плеере
 * с обрезкой края съедаются, и значение «20 000 ֏/час» уходит за кадр — это
 * и было видно на проверке. Отсюда ширина колонки: 1920 − 120 − 120 = 1680,
 * при двух колонках — по 820.
 */
export const SAFE = { x: 120, right: 1920 - 120, top: 110, bottom: 1080 - 110 };
/** Ширина колонки карточек в раскладках right / left. */
export const COL_W = 820;
