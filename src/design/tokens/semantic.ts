/**
 * SEMANTIC DESIGN TOKENS — роли, а не цвета.
 *
 * Компонент никогда не знает, что «акцент» — это #8B1A2B. Он знает только роль
 * `accent`. Смена бренда = правка одного файла, без единого касания компонентов.
 *
 * Каждый ключ превращается в CSS custom property: `surface.canvas` -> `--surface-canvas`
 * (см. `scripts/build-tokens.ts`) и в Tailwind-утилиту через `@theme inline`.
 */

import { absolute, amber, blue, crimson, gold, green, ink, ivory, shadowDark, shadowLight } from './primitives';

/** Поддерживаемые цветовые схемы. `system` разрешается в одну из этих на клиенте. */
export const colorSchemes = ['light', 'dark'] as const;
export type ColorScheme = (typeof colorSchemes)[number];

/** Плоская карта семантических цветовых ролей. */
export interface SemanticColors {
  /* Поверхности */
  'surface-canvas': string;
  'surface-raised': string;
  'surface-sunken': string;
  'surface-card': string;
  'surface-overlay': string;
  'surface-inverse': string;
  /** Полноэкранные кинематографичные плоскости (hero, editorial). Не зависят от темы. */
  'surface-cinema': string;
  'surface-cinema-alt': string;

  /* Контент */
  'content-primary': string;
  'content-secondary': string;
  'content-tertiary': string;
  'content-disabled': string;
  'content-inverse': string;
  'content-on-accent': string;
  'content-on-cinema': string;
  'content-on-cinema-muted': string;
  /** Матовое стекло поверх кадра: круглые кнопки и метки на фотографии. */
  'surface-glass-on-cinema': string;
  /**
   * Акцент для текста поверх кинематографичных плоскостей.
   *
   * Значение — тот же брендовый бургунди, что и `accent`: в прототипе акцентное
   * слово в hero (`.hero-title em`) и в editorial (`.editorial-c .accent`)
   * окрашено `var(--accent)`, и заказчик подтвердил именно этот цвет.
   *
   * Роль при этом остаётся отдельной сущностью намеренно: на почти чёрном фоне
   * бургунди даёт 2.1:1, то есть не проходит WCAG AA. Когда для тёмных плоскостей
   * найдут решение (плашка под словом, обводка, другой носитель акцента), менять
   * придётся одну строку здесь, а не разметку hero, editorial, знака бренда и
   * поисковых чипов.
   */
  'accent-on-cinema': string;

  /* ─────────────────────────────────────────────────────────────────────────
     Текстовые варианты цветных ролей.

     Роль `accent` и статусные роли — это ЗАЛИВКИ: кнопка, плашка, полоса,
     точка. Как цвет текста они не работают, и это не мелочь: брендовый
     бургунди `#8B1A2B` на тёмной подложке даёт 1.8:1, золотой `#B89A5E` на
     белой карточке — 2.7:1, янтарный `#C4841D` — 3.2:1. Надзаголовки секций,
     цены, «осталось мало мест» и рейтинги были написаны именно ими.

     Поэтому у каждой цветной роли есть текстовый вариант, и он ЗАВИСИТ ОТ
     ТЕМЫ, даже когда заливка от темы не зависит. Пары проверяются
     `src/design/tokens/contrast.test.ts`, а страница целиком —
     `e2e/accessibility.spec.ts`.

     Исключение — кинематографичные плоскости: они одинаковы в обеих темах, и
     для них есть свои роли (`accent-on-cinema`, `metal`).
     ───────────────────────────────────────────────────────────────────────── */
  'content-accent': string;
  'content-metal': string;
  'content-success': string;
  'content-warning': string;
  'content-danger': string;
  'content-signal': string;

  /* Границы */
  'border-subtle': string;
  'border-default': string;
  'border-strong': string;
  'border-focus': string;
  'border-on-cinema': string;

  /* Акцент (брендовое действие) */
  accent: string;
  'accent-hover': string;
  'accent-active': string;
  'accent-soft': string;
  'accent-glow': string;
  'accent-contrast': string;

  /* Signal — «живое»: осталось N мест, идёт трансляция, urgency */
  signal: string;
  'signal-soft': string;

  /* Metal — verified, рейтинги, премиальные разделители */
  metal: string;
  'metal-soft': string;

  /* Статусы */
  success: string;
  'success-soft': string;
  warning: string;
  'warning-soft': string;
  danger: string;
  'danger-soft': string;
  info: string;
  'info-soft': string;

  /* Утилитарные */
  skeleton: string;
  'selection-bg': string;
  'selection-fg': string;
  scrollbar: string;
  /**
   * Фон интерактивного элемента под курсором и под клавиатурным выбором:
   * пункт меню, опция списка, ячейка календаря.
   *
   * Роль нужна отдельно от `accent`, потому что у shadcn/ui «accent» означает
   * именно это — подсветку наведения, а не брендовое действие. Если оставить
   * их одним токеном, наведение на пункт меню станет бургунди.
   */
  'interactive-hover': string;
}

const cinema = {
  'surface-cinema': ink[950],
  'surface-cinema-alt': crimson[700],
  /**
   * Матовое стекло поверх кадра: круглые кнопки и метки на фотографии
   * (`.nav-icon`, `.cat-a`, `.mobile-close` в прототипе — везде одно и то же
   * `rgba(255,255,255,.1)` с `backdrop-filter`). Значение то же, что у границы:
   * это одна и та же плёнка, просто в одном случае она заливка, в другом рамка.
   */
  'surface-glass-on-cinema': 'rgba(247, 244, 239, 0.10)',
  'content-on-cinema': ivory[200],
  'content-on-cinema-muted': 'rgba(247, 244, 239, 0.55)',
  'border-on-cinema': 'rgba(247, 244, 239, 0.10)',
  /**
   * Одно значение на обе темы: кинематографичная плоскость от темы не зависит.
   * Цвет — брендовый бургунди, как в прототипе (`var(--accent)`).
   */
  'accent-on-cinema': crimson[300],
} as const;

const statuses = {
  success: green[500],
  'success-soft': green[100],
  warning: amber[500],
  'warning-soft': amber[100],
  /** danger = signal red: в бренде красный уже «сигнальный», отдельный оттенок дробил бы палитру. */
  danger: crimson[400],
  'danger-soft': crimson[100],
  info: blue[500],
  'info-soft': blue[100],
} as const;

export const lightColors: SemanticColors = {
  'surface-canvas': ivory[200],
  'surface-raised': ivory[100],
  'surface-sunken': ivory[300],
  'surface-card': absolute.white,
  'surface-overlay': 'rgba(11, 10, 9, 0.55)',
  'surface-inverse': ink[900],
  ...cinema,

  'content-primary': ink[900],
  /*
   * Второстепенный и третьестепенный текст сдвинуты на шаг темнее прежних.
   *
   * Было `ink[500]` / `ink[400]`: третьестепенный давал 3.0:1 на утопленной
   * подложке и 3.5:1 на карточке — ниже порога AA для текста 12px, которым он и
   * набран (метаданные карточек, единицы у цены, подписи под звёздами). Иерархия
   * сохранена: между шагами 500 и 600 разница видна.
   */
  'content-secondary': ink[600],
  'content-tertiary': ink[500],
  'content-disabled': ink[300],
  'content-inverse': ivory[200],
  'content-on-accent': absolute.white,

  'content-accent': crimson[600],
  'content-metal': gold[700],
  'content-success': green[600],
  'content-warning': amber[700],
  'content-danger': crimson[700],
  'content-signal': crimson[500],

  'border-subtle': ivory[400],
  'border-default': ink[100],
  'border-strong': ink[200],
  'border-focus': crimson[600],

  accent: crimson[600],
  'accent-hover': crimson[700],
  'accent-active': crimson[800],
  'accent-soft': 'rgba(139, 26, 43, 0.08)',
  'accent-glow': 'rgba(139, 26, 43, 0.25)',
  'accent-contrast': absolute.white,

  signal: crimson[400],
  'signal-soft': 'rgba(214, 22, 43, 0.10)',

  metal: gold[500],
  'metal-soft': 'rgba(184, 154, 94, 0.12)',

  ...statuses,

  skeleton: ivory[400],
  'selection-bg': crimson[600],
  'selection-fg': absolute.white,
  scrollbar: ink[200],
  'interactive-hover': ivory[300],
};

export const darkColors: SemanticColors = {
  'surface-canvas': ink[950],
  'surface-raised': ink[800],
  'surface-sunken': absolute.black,
  'surface-card': ink[800],
  'surface-overlay': 'rgba(0, 0, 0, 0.70)',
  'surface-inverse': ivory[200],
  ...cinema,

  'content-primary': ivory[200],
  'content-secondary': 'rgba(247, 244, 239, 0.62)',
  /*
   * Было 0.38 — 3.4:1 на карточке, ниже порога для текста 12px. 0.50 даёт
   * 4.8:1 и остаётся заметно тише второстепенного.
   */
  'content-tertiary': 'rgba(247, 244, 239, 0.50)',
  'content-disabled': 'rgba(247, 244, 239, 0.22)',
  'content-inverse': ink[900],
  'content-on-accent': absolute.white,

  /*
   * Текстовые варианты в тёмной теме. Заливки остаются прежними: кнопка обязана
   * быть брендового бургунди в обеих темах — и текст, по решению заказчика,
   * тоже. Розовых и золотых подмен здесь нет.
   */
  'content-accent': crimson[300],
  'content-metal': gold[400],
  'content-success': green[300],
  'content-warning': amber[400],
  'content-danger': crimson[300],
  'content-signal': crimson[350],

  'border-subtle': 'rgba(247, 244, 239, 0.05)',
  'border-default': 'rgba(247, 244, 239, 0.10)',
  'border-strong': 'rgba(247, 244, 239, 0.18)',
  'border-focus': crimson[300],

  /**
   * Акцент в тёмной теме — ТОТ ЖЕ бургунди, что и в светлой.
   *
   * В макете `--accent` объявлен в `:root` и в `[data-theme="dark"]` не
   * переопределяется, то есть бренд-цвет один на обе темы. Осветление до
   * `crimson[500]` делало кнопки и бегущую строку заметно краснее макета —
   * бренд превращался из бордо в красный.
   *
   * Осветляется только наведение: на почти чёрном фоне затемнение прочитывается
   * как «кнопка гаснет», а не как отклик.
   */
  accent: crimson[600],
  'accent-hover': crimson[500],
  'accent-active': crimson[700],
  'accent-soft': 'rgba(139, 26, 43, 0.20)',
  'accent-glow': 'rgba(139, 26, 43, 0.35)',
  'accent-contrast': absolute.white,

  signal: crimson[400],
  'signal-soft': 'rgba(214, 22, 43, 0.16)',

  metal: gold[500],
  'metal-soft': 'rgba(184, 154, 94, 0.16)',

  ...statuses,
  'success-soft': 'rgba(45, 122, 79, 0.18)',
  'warning-soft': 'rgba(196, 132, 29, 0.18)',
  'danger-soft': 'rgba(214, 22, 43, 0.18)',
  'info-soft': 'rgba(47, 95, 160, 0.18)',

  skeleton: ink[700],
  'selection-bg': crimson[600],
  'selection-fg': absolute.white,
  scrollbar: ink[600],
  'interactive-hover': ink[700],
};

/** Тени тоже семантические: в темной теме нужна другая плотность. */
export const lightShadows = {
  'shadow-sm': shadowLight.sm,
  'shadow-md': shadowLight.md,
  'shadow-lg': shadowLight.lg,
  'shadow-xl': shadowLight.xl,
} as const;

export const darkShadows = {
  'shadow-sm': shadowDark.sm,
  'shadow-md': shadowDark.md,
  'shadow-lg': shadowDark.lg,
  'shadow-xl': shadowDark.xl,
} as const;

export const schemeTokens: Record<
  ColorScheme,
  { colors: SemanticColors; shadows: Record<string, string> }
> = {
  light: { colors: lightColors, shadows: lightShadows },
  dark: { colors: darkColors, shadows: darkShadows },
};

/**
 * Семантические роли типографики: связывают шкалу primitives с назначением.
 * Компонент пишет `text-style="heading-2"`, а не набор из шести классов.
 */
export const textStyles = {
  'display-hero': { size: '5xl', weight: 'black', lineHeight: 'display', tracking: 'tighter', family: 'display', wrap: 'balance' },
  'display-editorial': { size: '6xl', weight: 'black', lineHeight: 'display', tracking: 'tighter', family: 'display', wrap: 'balance' },
  'heading-1': { size: '4xl', weight: 'bold', lineHeight: 'tight', tracking: 'tight', family: 'display', wrap: 'balance' },
  'heading-2': { size: '3xl', weight: 'bold', lineHeight: 'heading', tracking: 'tight', family: 'display', wrap: 'balance' },
  'heading-3': { size: '2xl', weight: 'semibold', lineHeight: 'heading', tracking: 'normal', family: 'display', wrap: 'balance' },
  'heading-4': { size: 'xl', weight: 'semibold', lineHeight: 'snug', tracking: 'normal', family: 'display', wrap: 'balance' },
  'card-title': { size: 'lg', weight: 'semibold', lineHeight: 'snug', tracking: 'normal', family: 'display', wrap: 'balance' },
  quote: { size: 'md', weight: 'regular', lineHeight: 'snug', tracking: 'normal', family: 'display', wrap: 'pretty' },
  'body-lg': { size: 'md', weight: 'regular', lineHeight: 'relaxed', tracking: 'normal', family: 'sans', wrap: 'pretty' },
  body: { size: 'base', weight: 'regular', lineHeight: 'normal', tracking: 'normal', family: 'sans', wrap: 'pretty' },
  'body-sm': { size: 'sm', weight: 'regular', lineHeight: 'normal', tracking: 'normal', family: 'sans', wrap: 'pretty' },
  caption: { size: 'xs', weight: 'medium', lineHeight: 'snug', tracking: 'normal', family: 'sans' },
  /** «Eyebrow» — надзаголовок секции: `Discover`, `Meet the Masters`. */
  eyebrow: { size: '2xs', weight: 'bold', lineHeight: 'none', tracking: 'widest', family: 'sans' },
  label: { size: 'xs', weight: 'semibold', lineHeight: 'none', tracking: 'wide', family: 'sans' },
  button: { size: 'xs', weight: 'semibold', lineHeight: 'none', tracking: 'wide', family: 'sans' },
  price: { size: 'md', weight: 'bold', lineHeight: 'none', tracking: 'tight', family: 'sans', numeric: 'tabular-nums' },
  numeric: { size: 'base', weight: 'medium', lineHeight: 'none', tracking: 'normal', family: 'mono', numeric: 'tabular-nums' },
} as const;

export type TextStyle = keyof typeof textStyles;

