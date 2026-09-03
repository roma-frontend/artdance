/**
 * Ожидание, пока элемент перестанет двигаться.
 *
 * Секции лендинга въезжают в экран переходом (`Reveal`), поэтому после прокрутки
 * координаты элемента меняются ещё десятки кадров. Синтетическое наведение —
 * это ОДНО событие `pointermove` в одну точку: если между замером рамки и
 * движением курсора блок сдвинулся, событие приходит мимо цели.
 *
 * У живого курсора события идут потоком, и эффект успевает подхватиться, поэтому
 * дефект существует только в тесте — но делает его случайным, а случайный тест
 * хуже красного: на него перестают смотреть.
 *
 * Помощник живёт отдельным файлом, потому что нужен всем проверкам наведения.
 * Playwright собирает только `*.spec.ts`, поэтому этот модуль тестом не считается.
 */

import { expect, type Locator } from '@playwright/test';

export async function waitUntilStill(locator: Locator): Promise<void> {
  let previous = '';
  let stableSamples = 0;

  await expect
    .poll(async () => {
      const current = JSON.stringify(await locator.boundingBox());
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      /*
       * Три совпадения подряд, а не два: на загруженной машине отрисовка
       * останавливается сама по себе, и два одинаковых замера означают
       * «кадры не шли», а не «блок доехал».
       */
      return stableSamples >= 2;
    })
    .toBe(true);
}

/**
 * Прокрутить к элементу, дождаться остановки и навести курсор.
 *
 * Точка наведения задаётся долями от размеров элемента: у наклона в центре
 * эффект нулевой, поэтому проверкам нужен именно угол.
 */
export async function settleAndHover(
  locator: Locator,
  position?: { xRatio: number; yRatio: number },
): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  await waitUntilStill(locator);

  if (!position) {
    await locator.hover();
    return;
  }

  const box = (await locator.boundingBox())!;
  await locator.hover({
    position: { x: box.width * position.xRatio, y: box.height * position.yRatio },
  });
}
