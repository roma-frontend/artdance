/**
 * Публичный API дизайн-системы.
 *
 * Приложение импортирует ТОЛЬКО отсюда:
 *   import { tokens, cssVar, type TextStyle } from '@/design/tokens';
 *
 * `primitives` реэкспортируются под namespace `raw` исключительно для
 * генератора CSS и Storybook/визуальных тестов.
 */

import * as primitives from './primitives';
import {
  colorSchemes,
  darkColors,
  darkShadows,
  lightColors,
  lightShadows,
  schemeTokens,
  textStyles,
} from './semantic';

export type { ColorScheme, SemanticColors, TextStyle } from './semantic';
export type { Breakpoint } from './primitives';
export { colorSchemes, schemeTokens, textStyles, lightColors, darkColors, lightShadows, darkShadows };

export const raw = primitives;

/**
 * Токены, не зависящие от цветовой схемы. Ровно эти ключи попадают в
 * `:root` как CSS-переменные и в Tailwind `@theme`.
 */
export const tokens = {
  fontFamily: primitives.fontFamily,
  fontWeight: primitives.fontWeight,
  fontSize: primitives.fontSize,
  lineHeight: primitives.lineHeight,
  letterSpacing: primitives.letterSpacing,
  space: primitives.space,
  layout: primitives.layout,
  radius: primitives.radius,
  borderWidth: primitives.borderWidth,
  easing: primitives.easing,
  duration: primitives.duration,
  zIndex: primitives.zIndex,
  breakpoint: primitives.breakpoint,
  aspectRatio: primitives.aspectRatio,
  opacity: primitives.opacity,
  scrim: primitives.scrim,
  mask: primitives.mask,
} as const;

/**
 * Ссылка на CSS-переменную по семантическому ключу.
 * Нужна там, где значение приходится передавать в inline-style
 * (например, height у виртуализированного списка).
 *
 *   cssVar('accent')            -> 'var(--accent)'
 *   cssVar('space-4', '1rem')   -> 'var(--space-4, 1rem)'
 */
export function cssVar(name: string, fallback?: string): string {
  const varName = name.startsWith('--') ? name : `--${name}`;
  return fallback ? `var(${varName}, ${fallback})` : `var(${varName})`;
}

/** Media query из карты breakpoints — чтобы `768px` не появлялось в коде дважды. */
export function mediaUp(bp: primitives.Breakpoint): string {
  return `(min-width: ${primitives.breakpoint[bp]}px)`;
}

export function mediaDown(bp: primitives.Breakpoint): string {
  return `(max-width: ${primitives.breakpoint[bp] - 0.02}px)`;
}
