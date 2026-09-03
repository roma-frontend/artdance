/**
 * PRIMITIVE DESIGN TOKENS — единственный источник правды для «сырых» значений.
 *
 * Правила:
 *  1. Здесь и только здесь допустимы литеральные цвета, размеры, тайминги.
 *  2. Компоненты НИКОГДА не импортируют primitives напрямую — только `semantic.ts`
 *     или Tailwind-утилиты, сгенерированные из семантических токенов.
 *  3. Любое изменение здесь требует `npm run tokens:build` (перегенерация CSS).
 *
 * Источник значений: ArtDance Brand Guide 2026 (вариант «Ivory / Ink / Crimson»)
 * + токены утверждённого прототипа `final.html`.
 */

/* ────────────────────────────────────────────────────────────────────────────
   COLOR RAMPS
   ──────────────────────────────────────────────────────────────────────────── */

/** Тёплый ivory — базовая «бумага» бренда (45% использования по гайду). */
export const ivory = {
  50: '#FDFCFA',
  100: '#FAF8F4',
  200: '#F7F4EF', // brand ground
  300: '#F1ECE4',
  400: '#E8E1D6',
  500: '#D9D0C2',
  600: '#C4B8A6',
} as const;

/** Near-black «ink» — весь текст и кинематографичные плоскости (25%). */
export const ink = {
  50: '#F4F3F1',
  100: '#E8E2DA', // hairline border on ivory
  200: '#CFC8BF',
  300: '#A9A199',
  400: '#8F877D',
  500: '#6B645C', // secondary text on ivory
  600: '#57514A',
  700: '#37332F',
  800: '#1F1D1B',
  900: '#141414', // primary text (brand secondary colour)
  950: '#0B0A09', // deepest cinematic base
} as const;

/**
 * Crimson — брендовый акцент. Рампа связывает значения из утверждённого макета:
 *  400 `#D6162B` — «signal red» (живая доступность, urgency, alert)
 *  500 `#B31228` — осветлённый бургунди: наведение на тёмном фоне
 *  600 `#8B1A2B` — `--accent` макета: CTA, активная навигация, бегущая строка
 *  700 `#6E1422` — `--accent-hover` макета
 *
 * Важно: 600 — это бургунди, а не красный, и он один и тот же в светлой и
 * тёмной темах (в макете `--accent` объявлен в `:root` и не переопределяется).
 * Красный 400 живёт отдельной ролью `signal` и в акцент не превращается.
 */
export const crimson = {
  50: '#FDF3F4',
  100: '#FAE1E4',
  200: '#F2BFC6',
  300: '#E58C99',
  /**
   * Светлый сигнальный красный — только как ЦВЕТ ТЕКСТА в тёмной теме.
   *
   * Шаг 400 (`#D6162B`) — заливка: на почти чёрном он даёт 3.2:1 и как текст не
   * проходит AA. Шаг 300 подошёл бы по контрасту, но он розовый и в тёмной теме
   * сливается с акцентным текстом, а «осталось мало мест» обязано отличаться от
   * цены. Этот шаг сохраняет красный тон и даёт 5.7:1.
   */
  350: '#F26A79',
  400: '#D6162B',
  500: '#B31228',
  600: '#8B1A2B',
  700: '#6E1422',
  800: '#520B15',
  900: '#37070E',
} as const;

/** Gold — «металл»: verified, рейтинги, премиальные разделители. Строго дозированно.
 *  500 `#B89A5E` — `--gold` утверждённого макета, один и тот же в обеих темах. */
export const gold = {
  200: '#EADCBE',
  300: '#D9C48F',
  400: '#C9AE74',
  500: '#B89A5E',
  600: '#9A7F49',
  700: '#7A6437',
} as const;

/** Статусные шкалы. `danger` намеренно = crimson.400 (signal red) — см. semantic.ts.
 *
 *  Шаги 300 и 700 существуют не для «полноты рампы», а под конкретное требование:
 *  один и тот же статусный цвет не может быть текстом и в светлой, и в тёмной
 *  теме. Заливка `500` на белом даёт 2.7–3.2:1, поэтому для текста нужны
 *  крайние шаги — тёмный на светлом фоне и светлый на тёмном. */
export const green = {
  100: '#DFF0E6',
  /** Текст статуса «есть места» в тёмной теме: 400 на почти чёрном даёт 4.3:1. */
  300: '#6FBE90',
  400: '#4A9E70',
  500: '#2D7A4F',
  600: '#20603D',
} as const;

export const amber = {
  100: '#FBEEDA',
  400: '#DDA23A',
  500: '#C4841D',
  600: '#9C6813',
  /** Текст статуса «мало мест» в светлой теме: 600 на ivory даёт 4.1:1. */
  700: '#7A5210',
} as const;

export const blue = {
  100: '#DFE8F5',
  400: '#4C7FC4',
  500: '#2F5FA0',
  600: '#22467A',
} as const;

/** Абсолютные значения, не зависящие от темы. */
export const absolute = {
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   TYPOGRAPHY
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Обе гарнитуры — SIL OFL (Google Fonts), self-hosted через `next/font`:
 * нулевой юридический риск и нулевой внешний запрос в runtime.
 * (Neue Haas Grotesk из альтернативного гайда — платная лицензия, отклонена.)
 */
export const fontFamily = {
  display: "var(--font-playfair), 'Times New Roman', Georgia, serif",
  sans: "var(--font-dm-sans), system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'SF Mono', Menlo, monospace",
  /** Армянский требует отдельного фоллбэка с полным покрытием глифов. */
  armenian: "var(--font-noto-armenian), var(--font-dm-sans), system-ui, sans-serif",
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  black: '900',
} as const;

/**
 * Fluid type scale. Значения `clamp(min, preferred, max)` — ни один размер
 * шрифта не должен появляться в компоненте как литерал.
 */
export const fontSize = {
  '2xs': 'clamp(0.625rem, 0.61rem + 0.08vw, 0.6875rem)',
  xs: 'clamp(0.6875rem, 0.67rem + 0.09vw, 0.75rem)',
  sm: 'clamp(0.8125rem, 0.79rem + 0.11vw, 0.875rem)',
  base: 'clamp(0.9375rem, 0.91rem + 0.13vw, 1rem)',
  md: 'clamp(1rem, 0.96rem + 0.2vw, 1.125rem)',
  lg: 'clamp(1.125rem, 1.07rem + 0.28vw, 1.3125rem)',
  xl: 'clamp(1.25rem, 1.15rem + 0.5vw, 1.5rem)',
  '2xl': 'clamp(1.5rem, 1.32rem + 0.9vw, 2rem)',
  '3xl': 'clamp(1.75rem, 1.4rem + 1.75vw, 2.75rem)',
  '4xl': 'clamp(2.25rem, 1.6rem + 3.25vw, 4rem)',
  '5xl': 'clamp(2.75rem, 1.5rem + 6.25vw, 6rem)',
  '6xl': 'clamp(3rem, 0.8rem + 11vw, 8rem)',
} as const;

export const lineHeight = {
  none: '1',
  display: '0.95',
  tight: '1.06',
  heading: '1.14',
  snug: '1.35',
  normal: '1.55',
  relaxed: '1.7',
} as const;

export const letterSpacing = {
  tighter: '-0.03em',
  tight: '-0.015em',
  normal: '0',
  wide: '0.05em',
  wider: '0.1em',
  widest: '0.18em',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   SPACE / SIZE / RADII
   ──────────────────────────────────────────────────────────────────────────── */

/** База 4px. Ключи — шаги, а не пиксели, чтобы шкалу можно было пересобрать. */
export const space = {
  0: '0rem',
  px: '0.0625rem',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
  32: '8rem',
  40: '10rem',
} as const;

/** Вертикальные ритмы секций и горизонтальные отступы контейнера. */
export const layout = {
  containerMaxWidth: '82.5rem', // 1320px — из прототипа
  contentMaxWidth: '46rem',
  proseMaxWidth: '38rem',
  gutter: 'clamp(1.25rem, 4vw, 3rem)',
  sectionY: 'clamp(4rem, 10vw, 8rem)',
  sectionYTight: 'clamp(3rem, 8vw, 6rem)',
  sectionYWide: 'clamp(6rem, 15vw, 12rem)',
  navHeight: '4.5rem',
  navHeightScrolled: '3.5rem',
  bottomNavHeight: '4rem',
  /** Мобильное меню: 280px из прототипа. Уже, чем `sm`, — контент не растягивается. */
  drawerWidth: '17.5rem',
} as const;

export const radius = {
  none: '0',
  sm: '0.375rem', // 6px
  md: '0.625rem', // 10px
  lg: '1rem', // 16px
  xl: '1.5rem', // 24px
  full: '999px',
} as const;

export const borderWidth = {
  hairline: '1px',
  thin: '1.5px',
  thick: '2px',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   ELEVATION
   ──────────────────────────────────────────────────────────────────────────── */

export const shadowLight = {
  none: 'none',
  sm: '0 1px 2px rgba(20, 20, 20, 0.04)',
  md: '0 4px 20px rgba(20, 20, 20, 0.06)',
  lg: '0 12px 40px rgba(20, 20, 20, 0.10)',
  xl: '0 24px 64px rgba(20, 20, 20, 0.14)',
} as const;

export const shadowDark = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.24)',
  md: '0 4px 20px rgba(0, 0, 0, 0.30)',
  lg: '0 12px 40px rgba(0, 0, 0, 0.40)',
  xl: '0 24px 64px rgba(0, 0, 0, 0.50)',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   MOTION
   ──────────────────────────────────────────────────────────────────────────── */

export const easing = {
  /** Основной «премиальный» ease-out прототипа. */
  brand: 'cubic-bezier(0.16, 1, 0.3, 1)',
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  entrance: 'cubic-bezier(0, 0, 0.2, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  linear: 'linear',
} as const;

export const duration = {
  instant: '80ms',
  fast: '160ms',
  normal: '300ms',
  slow: '500ms',
  slower: '800ms',
  cinematic: '1200ms',
  marquee: '40s',
  kenBurns: '12s',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   Z-INDEX — единая карта слоёв. Магические числа в компонентах запрещены.
   ──────────────────────────────────────────────────────────────────────────── */

export const zIndex = {
  base: '0',
  raised: '10',
  sticky: '100',
  header: '1000',
  /** Полоса прогресса чтения — поверх шапки, но под всем интерактивным. */
  scrollProgress: '1050',
  dropdown: '1100',
  drawer: '1200',
  modal: '1300',
  popover: '1400',
  toast: '1500',
  tooltip: '1600',
  commandPalette: '1700',
} as const;

/* ────────────────────────────────────────────────────────────────────────────
   BREAKPOINTS — держим в TS, чтобы JS-логика и CSS не расходились.
   ──────────────────────────────────────────────────────────────────────────── */

export const breakpoint = {
  /**
   * 360 и 1441 добавлены по версии прототипа от 02.09.2026: в нём появились
   * `@media (max-width: 360px)` (узкие Android) и `@media (min-width: 1441px)`
   * (крупный десктоп, где заголовок hero фиксируется на 6.5rem).
   * Шкала обязана совпадать с макетом, иначе JS и CSS разъедутся на границе.
   */
  xxs: 360,
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  wide: 1441,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoint;

/** Соотношения сторон медиа — используются и в CSS, и в next/image. */
export const aspectRatio = {
  square: '1 / 1',
  portrait: '3 / 4',
  poster: '2 / 3',
  landscape: '16 / 10',
  video: '16 / 9',
  cinema: '21 / 9',
} as const;

export const opacity = {
  0: '0',
  subtle: '0.06',
  muted: '0.3',
  soft: '0.45',
  medium: '0.6',
  strong: '0.75',
  full: '1',
} as const;

/** Плотность/непрозрачность градиентных вуалей на фото. */
export const scrim = {
  bottomStrong:
    'linear-gradient(to top, rgba(11,10,9,0.90) 0%, rgba(11,10,9,0.10) 50%, transparent 100%)',
  bottomSoft: 'linear-gradient(to top, rgba(11,10,9,0.70), transparent)',
  heroDiagonal:
    'linear-gradient(160deg, rgba(11,10,9,0.92) 0%, rgba(11,10,9,0.60) 35%, rgba(139,26,43,0.25) 100%)',
  editorialRadial:
    'radial-gradient(ellipse at center, rgba(110,15,28,0.30) 0%, rgba(11,10,9,0.90) 70%)',
} as const;
