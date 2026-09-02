/**
 * MOTION — параметры сценариев анимации из утверждённого прототипа.
 *
 * Отдельно от `tokens/primitives.ts`: там сырые шкалы (`duration`, `easing`),
 * которые превращаются в CSS-переменные. Здесь — составные поведения, у которых
 * есть числа, но нет CSS-эквивалента: пороги IntersectionObserver, коэффициенты
 * параллакса, шаг stagger, параметры трейла видео.
 *
 * Эти значения в версии прототипа от 02.09.2026 заданы литералами в inline-JS
 * (`SLIDE_PX`, `GHOST_EVERY`, `MAX_GHOST`…). В продукте они обязаны быть
 * объявлены: «сделайте появление секций поспокойнее» должно быть правкой одной
 * строки, а не поиском магических чисел по десяти компонентам.
 *
 * Единицы указаны в имени: `Ms` — миллисекунды, `Px` — пиксели, `Factor` —
 * безразмерный множитель.
 */

import { duration, easing } from './tokens/primitives';

/**
 * Появление секций при скролле (`.reveal`, `.reveal-left/right/scale`).
 *
 * `rootMarginBottom` отрицательный: анимация запускается, когда блок вошёл в
 * экран на 60px, а не в момент касания края — иначе она проигрывается за
 * пределами видимой области и пользователь видит уже проявленный блок.
 */
export const revealMotion = {
  threshold: 0.15,
  rootMarginBottomPx: -60,
  durationMs: 900,
  easing: easing.brand,
  offset: {
    up: '60px',
    side: '80px',
    scale: 0.85,
  },
  /** Появление однократное: повтор при обратном скролле раздражает и мешает читать. */
  once: true,
} as const;

/** Поочерёдное появление детей контейнера (`.stagger`). */
export const staggerMotion = {
  /** Задержка первого ребёнка: в прототипе 0.05s, дальше шаг 0.07s. */
  baseDelayMs: 50,
  stepMs: 70,
  durationMs: 700,
  offsetPx: 40,
  /**
   * Больше восьми задержек не имеет смысла: последний элемент сетки ждал бы
   * почти секунду, и это читается как подвисание, а не как анимация.
   */
  maxChildren: 8,
} as const;

/**
 * Параллакс первого экрана при уходе вверх.
 *
 * Контент уезжает быстрее фона и гаснет — эффект глубины. Множители из макета:
 * фон 0.3 вниз, контент −0.6 вверх, прозрачность гаснет к 55% высоты экрана.
 */
export const heroParallax = {
  /** Доля высоты экрана, на которой hero считается «ушедшим». */
  exitAtViewportFraction: 0.85,
  backgroundFactor: 0.3,
  contentFactor: -0.6,
  /** Множитель скорости затухания контента относительно прогресса ухода. */
  contentFadeFactor: 1.8,
  overlayFadeFactor: 2,
  zoom: { base: 1.04, perPixel: 0.0003 },
} as const;

/** Параллакс изображений внутри секций. Слабее, чем у hero: это фон, а не сцена. */
export const sectionParallax = {
  maxOffsetPx: 24,
  /** Включается только при достаточной ширине: на телефоне он съедает кадры. */
  minViewportWidth: 768,
} as const;

/**
 * Трейл фонового видео (`.hero-ghosts`).
 *
 * В макете копий до шести и живут они 5 секунд — до семи одновременно
 * декодируемых потоков 1080p. Здесь значения приведены к безопасным:
 * `videoProcessing.heroLoop.ghostTrailMax` ограничивает число копий, а
 * `enabledFromViewportWidth` отключает эффект на мобильных, где он не читается.
 */
export const heroGhostTrail = {
  spawnEveryMs: 900,
  lifetimeMs: 5_000,
  opacity: 0.35,
  filter: 'saturate(0.1) brightness(0.45)',
  slidePx: 25,
  slideMs: 14_000,
  returnMs: 2_500,
  fadeAllMs: 3_000,
  pauseMs: 600,
  /** Ширина обёртки видео: запас на горизонтальный сдвиг без белых краёв. */
  wrapWidthPercent: 135,
} as const;

/** Счётчики показателей hero (`data-count`). */
export const counterMotion = {
  durationMs: 1_600,
  /** ease-out quartic — как в макете: быстрый старт, мягкая остановка. */
  easingPower: 4,
  /** Порог видимости, при котором счётчик стартует. */
  threshold: 0.5,
} as const;

/** Свечение под курсором. Только для устройств с точным указателем. */
export const pointerGlow = {
  sizePx: 300,
  opacity: 0.08,
  fadeMs: 400,
  requiresFinePointer: true,
} as const;

/**
 * 3D-наклон карточки под курсором (в прототипе — `.cat`, `.inst`, `.card`).
 *
 * Эффект есть в макете, но его не было в карте компонентов: он живёт в inline-JS
 * и применяется к трём классам сразу. Значения перенесены как есть; `scale` и
 * `liftPx` дублируют hover-подъём карточки, поэтому применяются вместе с ним, а
 * не поверх — иначе карточка дёргается на два состояния.
 */
export const cardTilt = {
  perspectivePx: 800,
  maxRotateDeg: 6,
  liftPx: -4,
  scale: 1.01,
  /** На touch-устройствах наклона нет: без курсора он не воспроизводится. */
  requiresFinePointer: true,
} as const;

/** Полоса прогресса чтения страницы. */
export const scrollProgress = {
  /** 3px из прототипа: тоньше — не читается на мониторе с высоким DPI. */
  heightPx: 3,
  /**
   * Скрывать на коротких страницах: полоса без хода бессмысленна.
   * Множитель к высоте окна — ниже этого страница считается короткой.
   */
  minPageHeightFactor: 1.5,
  /** Сглаживание рывков при быстрой прокрутке. */
  transitionMs: 150,
} as const;

/**
 * Переключение шапки между «над hero» и «прокручено».
 *
 * В прототипе — `nav.classList.toggle('scrolled', window.scrollY > 60)`.
 * Порог объявлен здесь, потому что его знают двое: сам компонент шапки и тест,
 * проверяющий смену состояния. Литерал в компоненте разошёлся бы с тестом.
 */
export const headerScroll = {
  thresholdPx: 60,
} as const;

/** Горизонтальная прокрутка карусели кнопками (`.scroll-arrow`). */
export const carouselScroll = {
  stepPx: 340,
  behavior: 'smooth',
  /** Кнопка гасится на краю списка, а не молча ничего не делает. */
  disableAtEdge: true,
  edgeTolerancePx: 10,
} as const;

/**
 * Что отключается при `prefers-reduced-motion: reduce`.
 *
 * Список явный, потому что «отключить все анимации» — неверно: скрытые
 * `.reveal`-блоки должны стать видимыми, а не остаться прозрачными. Конечное
 * состояние обязано применяться всегда.
 */
export const reducedMotionDisables = [
  'heroParallax',
  'heroGhostTrail',
  'sectionParallax',
  'pointerGlow',
  'counterMotion',
  'videoAutoplay',
  'marquee',
  'kenBurns',
] as const;

/** Агрегат: один импорт на весь слой движения. */
export const motion = {
  reveal: revealMotion,
  stagger: staggerMotion,
  heroParallax,
  sectionParallax,
  heroGhostTrail,
  counter: counterMotion,
  pointerGlow,
  cardTilt,
  scrollProgress,
  headerScroll,
  carousel: carouselScroll,
  reducedMotionDisables,
  /** Базовые шкалы — чтобы не импортировать primitives отдельно. */
  duration,
  easing,
} as const;
