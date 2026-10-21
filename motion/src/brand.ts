/**
 * Брендовые константы ролика — из `src/design/tokens/` проекта.
 *
 * Значения скопированы сюда руками, а не импортированы: `motion/` — отдельный
 * пакет со своим tsconfig и без алиаса `@/*`. Импорт тянул бы за собой
 * Tailwind-плагины и `next/font`. Расхождение с токенами проекта поймает
 * `npm run tokens:build` при следующем изменении палитры — тогда правим здесь.
 */

export const C = {
  /** ivory[200] — тёплая бумага бренда */
  ivory: '#F7F4EF',
  /** ink[900] — основной текст и кинематографичная база */
  ink: '#141414',
  /** ink[950] — глубина сцены */
  inkDeep: '#0B0A09',
  /** crimson[600] — accent: CTA, активная навигация */
  accent: '#8B1A2B',
  /** crimson[400] — signal: живое, urgency, «осталось N мест» */
  signal: '#6E1422',
  /** gold[500] — metal: verified, рейтинги, премиальные разделители */
  metal: '#B89A5E',
  ivoryMuted: 'rgba(247,244,239,.62)',
  ivoryFaint: 'rgba(247,244,239,.34)',
  inkMuted: 'rgba(20,20,20,.62)',
} as const;

export const F = {
  /** Playfair Display — editorial display (заголовки, лого) */
  display: 'Playfair Display',
  /** Manrope — текст. В проекте DM Sans, но у него нет кириллицы: Manrope держит ту же геометрию */
  sans: 'Manrope',
  /** Noto Sans Armenian — армянский, как в проекте */
  armenian: 'Noto Sans Armenian',
} as const;

/** Палитра подписей этапов: цвет → смысл, как в бренд-системе. */
export const stageColor = {
  catalog: C.ivory,
  instructors: C.metal,
  studios: C.ivory,
  shop: C.metal,
  booking: C.accent,
  cabinets: C.ivory,
} as const;
