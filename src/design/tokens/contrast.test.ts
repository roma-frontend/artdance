/**
 * Контраст семантических пар в обеих темах.
 *
 * Проверяется палитра, а не страница. Браузерный аудит
 * (`e2e/accessibility.spec.ts`) видит только те пары, которые оказались на
 * экране; здесь перечислены все, которыми компонентам РАЗРЕШЕНО пользоваться —
 * включая те, что встретятся на ещё не сверстанных экранах.
 *
 * Список пар и есть контракт: если роли в нём нет, она не предназначена для
 * текста, и в разметке в качестве цвета текста появляться не должна.
 */

import { describe, expect, it } from 'vitest';

import { AA_NON_TEXT, AA_TEXT, flatten, ratioOf } from './contrast';
import { schemeTokens, type ColorScheme } from './semantic';

/** Подложки, на которых может оказаться текст обычного размера. */
const TEXT_SURFACES = [
  'surface-canvas',
  'surface-raised',
  'surface-card',
  'surface-sunken',
] as const;

/**
 * Роли, которыми разрешено красить текст на обычных подложках.
 *
 * `content-disabled` намеренно отсутствует: WCAG выводит недоступные элементы
 * из-под требования 1.4.3, и поднимать их контраст означало бы стирать разницу
 * между «нельзя нажать» и «можно».
 */
const TEXT_ROLES = [
  'content-primary',
  'content-secondary',
  'content-tertiary',
  'content-accent',
  'content-metal',
  'content-success',
  'content-warning',
  'content-danger',
  'content-signal',
] as const;

/** Текст на цветной плашке: подложка — тоже роль, а не фон страницы. */
const ON_FILL_PAIRS = [
  ['content-on-accent', 'accent'],
  ['content-on-cinema', 'surface-cinema'],
  ['content-on-cinema-muted', 'surface-cinema'],
  ['accent-on-cinema', 'surface-cinema'],
  ['content-inverse', 'surface-inverse'],
] as const;

/**
 * Мягкие плашки: полупрозрачный фон роли поверх карточки, текст — та же роль.
 *
 * Так собраны метки (`Badge`), и именно здесь браузерный аудит нашёл 1.7:1 —
 * бургунди на бургунди, разведённом до 20% на почти чёрном.
 */
const SOFT_BADGE_PAIRS = [
  ['content-accent', 'accent-soft'],
  ['content-success', 'success-soft'],
  ['content-warning', 'warning-soft'],
  ['content-danger', 'danger-soft'],
  ['content-signal', 'signal-soft'],
  ['content-metal', 'metal-soft'],
] as const;

/** Нетекстовые элементы: рамка фокуса (1.4.11).
 *
 * `border-strong` и `border-default` здесь намеренно отсутствуют: это
 * разделители и тонкие линии карточек, а критерий 1.4.11 распространяется на
 * ГРАНИЦЫ ЭЛЕМЕНТОВ УПРАВЛЕНИЯ и значимую графику. Роль для рамки поля ввода
 * появится вместе с `FormField` — и попадёт в этот список. */
const NON_TEXT_PAIRS = [
  ['border-focus', 'surface-canvas'],
  ['border-focus', 'surface-card'],
] as const;

const schemes = Object.keys(schemeTokens) as ColorScheme[];

describe.each(schemes)('контраст токенов — тема %s', (scheme) => {
  const colors: Record<string, string> = { ...schemeTokens[scheme].colors };

  const value = (role: string): string => {
    const found = colors[role];
    if (!found) throw new Error(`[contrast] Роли «${role}» нет в теме «${scheme}».`);
    return found;
  };

  it.each(TEXT_ROLES)('%s читается на всех подложках страницы', (role) => {
    for (const surface of TEXT_SURFACES) {
      const ratio = ratioOf(value(role), value(surface));
      expect(
        ratio,
        `${role} на ${surface}: ${ratio.toFixed(2)}:1, нужно ${AA_TEXT}:1`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it.each(ON_FILL_PAIRS)('%s читается на %s', (role, surface) => {
    const ratio = ratioOf(value(role), value(surface));
    expect(
      ratio,
      `${role} на ${surface}: ${ratio.toFixed(2)}:1, нужно ${AA_TEXT}:1`,
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(SOFT_BADGE_PAIRS)('%s читается на плашке %s поверх карточки', (role, soft) => {
    /* Двойное наложение: плашка на карточку, затем текст на результат. */
    const background = flatten(value(soft), value('surface-card'));
    const ratio = ratioOf(value(role), background);
    expect(
      ratio,
      `${role} на ${soft} поверх surface-card (${background}): ${ratio.toFixed(2)}:1, нужно ${AA_TEXT}:1`,
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(NON_TEXT_PAIRS)('%s различима на %s', (role, surface) => {
    const ratio = ratioOf(value(role), value(surface));
    expect(
      ratio,
      `${role} на ${surface}: ${ratio.toFixed(2)}:1, нужно ${AA_NON_TEXT}:1`,
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
