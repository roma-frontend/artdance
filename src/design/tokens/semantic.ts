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
}

const cinema = {
  'surface-cinema': ink[950],
  'surface-cinema-alt': crimson[700],
  'content-on-cinema': ivory[200],
  'content-on-cinema-muted': 'rgba(247, 244, 239, 0.55)',
  'border-on-cinema': 'rgba(247, 244, 239, 0.10)',
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
  'content-secondary': ink[500],
  'content-tertiary': ink[400],
  'content-disabled': ink[300],
  'content-inverse': ivory[200],
  'content-on-accent': absolute.white,

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

  metal: gold[600],
  'metal-soft': 'rgba(184, 154, 94, 0.12)',

  ...statuses,

  skeleton: ivory[400],
  'selection-bg': crimson[600],
  'selection-fg': absolute.white,
  scrollbar: ink[200],
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
  'content-tertiary': 'rgba(247, 244, 239, 0.38)',
  'content-disabled': 'rgba(247, 244, 239, 0.22)',
  'content-inverse': ink[900],
  'content-on-accent': absolute.white,

  'border-subtle': 'rgba(247, 244, 239, 0.05)',
  'border-default': 'rgba(247, 244, 239, 0.10)',
  'border-strong': 'rgba(247, 244, 239, 0.18)',
  'border-focus': crimson[300],

  /** На тёмном фоне burgundy теряет читаемость — поднимаем на один шаг светлее. */
  accent: crimson[500],
  'accent-hover': crimson[400],
  'accent-active': crimson[300],
  'accent-soft': 'rgba(214, 22, 43, 0.14)',
  'accent-glow': 'rgba(214, 22, 43, 0.30)',
  'accent-contrast': absolute.white,

  signal: crimson[400],
  'signal-soft': 'rgba(214, 22, 43, 0.16)',

  metal: gold[400],
  'metal-soft': 'rgba(184, 154, 94, 0.16)',

  ...statuses,
  'success-soft': 'rgba(45, 122, 79, 0.18)',
  'warning-soft': 'rgba(196, 132, 29, 0.18)',
  'danger-soft': 'rgba(214, 22, 43, 0.18)',
  'info-soft': 'rgba(47, 95, 160, 0.18)',

  skeleton: ink[700],
  'selection-bg': crimson[500],
  'selection-fg': absolute.white,
  scrollbar: ink[600],
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
  'display-hero': { size: '5xl', weight: 'black', lineHeight: 'display', tracking: 'tighter', family: 'display' },
  'display-editorial': { size: '6xl', weight: 'black', lineHeight: 'display', tracking: 'tighter', family: 'display' },
  'heading-1': { size: '4xl', weight: 'bold', lineHeight: 'tight', tracking: 'tight', family: 'display' },
  'heading-2': { size: '3xl', weight: 'bold', lineHeight: 'heading', tracking: 'tight', family: 'display' },
  'heading-3': { size: '2xl', weight: 'semibold', lineHeight: 'heading', tracking: 'normal', family: 'display' },
  'heading-4': { size: 'xl', weight: 'semibold', lineHeight: 'snug', tracking: 'normal', family: 'display' },
  'card-title': { size: 'lg', weight: 'semibold', lineHeight: 'snug', tracking: 'normal', family: 'display' },
  quote: { size: 'md', weight: 'regular', lineHeight: 'snug', tracking: 'normal', family: 'display' },
  'body-lg': { size: 'md', weight: 'regular', lineHeight: 'relaxed', tracking: 'normal', family: 'sans' },
  body: { size: 'base', weight: 'regular', lineHeight: 'normal', tracking: 'normal', family: 'sans' },
  'body-sm': { size: 'sm', weight: 'regular', lineHeight: 'normal', tracking: 'normal', family: 'sans' },
  caption: { size: 'xs', weight: 'medium', lineHeight: 'snug', tracking: 'normal', family: 'sans' },
  /** «Eyebrow» — надзаголовок секции: `Discover`, `Meet the Masters`. */
  eyebrow: { size: '2xs', weight: 'bold', lineHeight: 'none', tracking: 'widest', family: 'sans' },
  label: { size: 'xs', weight: 'semibold', lineHeight: 'none', tracking: 'wide', family: 'sans' },
  button: { size: 'xs', weight: 'semibold', lineHeight: 'none', tracking: 'wide', family: 'sans' },
  price: { size: 'md', weight: 'bold', lineHeight: 'none', tracking: 'tight', family: 'sans' },
  numeric: { size: 'base', weight: 'medium', lineHeight: 'none', tracking: 'normal', family: 'mono' },
} as const;

export type TextStyle = keyof typeof textStyles;
