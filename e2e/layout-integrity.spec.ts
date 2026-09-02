/**
 * Целостность раскладки: ничего не выходит за правый и левый край окна.
 *
 * Проверка появилась после конкретной поломки. `Reveal` с боковым сдвигом
 * выносил блок на 80px за край экрана. На десктопе это незаметно, а мобильный
 * Chrome расширяет layout viewport на величину переполнения: `innerWidth`
 * становится больше `clientWidth`, страница получает горизонтальную прокрутку,
 * и координаты касаний перестают совпадать с картинкой — кнопка бургера
 * нажималась «мимо», попадая в иконку корзины. Шесть проверок мобильной шапки
 * падали по таймауту, и по симптому это выглядело как флаки-тест, а не как
 * дефект вёрстки.
 *
 * Поэтому здесь не «нет ли горизонтальной полосы» (её можно спрятать одним
 * `overflow-x: clip` на `html` и потерять сам сигнал), а точный вопрос: есть ли
 * элемент, который вылез за край, и не обрезал ли его кто-то намеренно. Второе —
 * законно: так работают бегущая строка, фоновое видео и боковое появление.
 */

import { expect, test, type Page } from '@playwright/test';

import { locales } from '../src/i18n/config';

interface Overflowing {
  tag: string;
  cls: string;
  left: number;
  right: number;
}

/** Элементы, вылезшие за края окна и не обрезанные ни одним предком. */
async function findOverflowing(page: Page): Promise<Overflowing[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    /** Полпикселя допуска: субпиксельная раскладка даёт 412.004 на ровном месте. */
    const tolerance = 1;

    const clipsHorizontally = (element: HTMLElement): boolean => {
      const { overflowX } = window.getComputedStyle(element);
      return overflowX !== 'visible';
    };

    const result: Overflowing[] = [];

    for (const element of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right <= limit + tolerance && rect.left >= -tolerance) continue;

      let clipped = false;
      let parent = element.parentElement;
      while (parent && parent !== document.documentElement) {
        if (clipsHorizontally(parent)) {
          clipped = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (clipped) continue;

      result.push({
        tag: element.tagName.toLowerCase(),
        cls: element.className.toString().slice(0, 80),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      });
    }

    return result;
  });
}

for (const locale of locales) {
  test(`/${locale}: ничего не вылезает за края окна`, async ({ page }) => {
    await page.goto(`/${locale}`);

    /* Первый экран: эффекты появления ещё в начальном состоянии. */
    const beforeScroll = await findOverflowing(page);
    expect(beforeScroll, JSON.stringify(beforeScroll, null, 1)).toEqual([]);

    /* После прокрутки до конца: сработали все появления и параллаксы. */
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.waitForTimeout(1200);

    const afterScroll = await findOverflowing(page);
    expect(afterScroll, JSON.stringify(afterScroll, null, 1)).toEqual([]);
  });
}

test('layout viewport совпадает с окном устройства', async ({ page }) => {
  await page.goto('/en');

  /*
   * Расхождение `innerWidth` и `clientWidth` на мобильном означает, что браузер
   * расширил layout viewport под переполнение. Это и есть механизм, из-за
   * которого сдвигаются координаты касаний.
   */
  const { innerWidth, clientWidth, scrollWidth } = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(innerWidth).toBe(clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
