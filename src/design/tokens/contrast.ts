/**
 * Контраст цветовых пар по WCAG 2.1.
 *
 * Зачем это в дизайн-слое, а не в тесте: контраст — свойство ПАЛИТРЫ, а не
 * страницы. Браузерный аудит (`e2e/accessibility.spec.ts`) находит нарушение
 * там, где на него наткнулся, и только для тех пар, которые оказались на
 * экране; здесь проверяются все объявленные пары сразу, включая те, что
 * встретятся на ещё не сверстанных страницах.
 *
 * Практический повод: роль `accent` в тёмной теме давала 1.8:1 в качестве цвета
 * текста — надзаголовки секций, цены и метки читались с трудом. Дефект дожил до
 * готового лендинга, потому что «цвет из макета» и «цвет, пригодный для текста»
 * никто не различал. Теперь различает проверка.
 *
 * Формулы — из спецификации: относительная яркость sRGB и отношение
 * (L₁ + 0.05) / (L₂ + 0.05).
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Порог AA для обычного текста. */
export const AA_TEXT = 4.5;
/** Порог AA для крупного текста (≥18.66px bold или ≥24px). */
export const AA_LARGE_TEXT = 3;
/** Порог AA для границ, иконок и прочих нетекстовых элементов (1.4.11). */
export const AA_NON_TEXT = 3;

function parseHex(value: string): Rgb {
  const hex = value.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

/**
 * Наложение полупрозрачного цвета на непрозрачный фон.
 *
 * Без этого шага роли вида `accent-soft` (плашка метки) проверить нельзя: их
 * фактический цвет зависит от того, на чём они лежат, и именно так его считает
 * браузер. Метка «−3 ещё» на тёмной карточке даёт `#351c1e`, и ни одно из двух
 * исходных значений об этом не говорит.
 */
export function composite(color: Rgb, alpha: number, background: Rgb): Rgb {
  return {
    r: color.r * alpha + background.r * (1 - alpha),
    g: color.g * alpha + background.g * (1 - alpha),
    b: color.b * alpha + background.b * (1 - alpha),
  };
}

/**
 * Разбор значения токена: `#RRGGBB`, `#RGB`, `rgb(...)`, `rgba(...)`.
 *
 * Полупрозрачное значение требует фона — иначе результат был бы выдумкой, а не
 * цветом, который увидит пользователь.
 */
export function parseColor(value: string, background?: Rgb): Rgb {
  const trimmed = value.trim();

  if (trimmed.startsWith('#')) return parseHex(trimmed);

  const match = /^rgba?\(([^)]+)\)$/.exec(trimmed);
  if (!match) throw new Error(`[contrast] Не разобрать цвет: «${value}».`);

  const parts = match[1]!.split(/[,/]/).map((part) => Number.parseFloat(part.trim()));
  const [r = 0, g = 0, b = 0, alpha = 1] = parts;
  const color = { r, g, b };

  if (alpha >= 1) return color;
  if (!background) {
    throw new Error(
      `[contrast] Полупрозрачный цвет «${value}» нельзя оценить без фона: ` +
        'его итоговый оттенок зависит от подложки.',
    );
  }
  return composite(color, alpha, background);
}

/** Относительная яркость sRGB по определению WCAG. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (raw: number) => {
    const value = raw / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Отношение контраста двух непрозрачных цветов: от 1 до 21. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Контраст пары значений токенов.
 *
 * Передний цвет может быть полупрозрачным — тогда он накладывается на фон.
 * Фон обязан быть непрозрачным: это подложка, и других слоёв под ней нет.
 */
export function ratioOf(foreground: string, background: string): number {
  const backgroundRgb = parseColor(background);
  return contrastRatio(parseColor(foreground, backgroundRgb), backgroundRgb);
}

function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Полупрозрачное значение, приведённое к непрозрачному на заданной подложке.
 *
 * Нужно для двойного наложения: мягкая плашка метки ложится на карточку, а
 * поверх получившегося цвета ложится текст. Без промежуточного шага текст
 * сравнивался бы с исходной картой, а не с тем, что под ним на самом деле.
 */
export function flatten(value: string, background: string): string {
  return toHex(parseColor(value, parseColor(background)));
}
