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


/**
 * Открытие модального окна не должно сдвигать страницу под ним.
 *
 * Проверка появилась после конкретной поломки, и её было видно глазом: при
 * открытии шторки у правого края возникала полоса чужого цвета, а содержимое
 * дёргалось — в момент открытия и ещё раз в момент закрытия.
 *
 * Причин было две, и обе в чужом коде. Первая: Radix (а vaul построен на нём)
 * блокирует прокрутку и возвращает ширину исчезнувшей полосы отступом на
 * `<body>`. Логика рассчитана на однородный фон страницы, а у нас секции во всю
 * ширину и тёмные — оставленная справа полоса пустого места оказывается светлой
 * канвой под затемнением, то есть видимым дефектом. Вторая: сам замок не
 * работал, потому что `html` объявлен с `overflow-x: clip`, из-за чего область
 * просмотра слушает `html`, а не `body`, и страница под затемнением продолжала
 * прокручиваться.
 *
 * Решение в `globals.css`: библиотечный отступ отменяется, страница остаётся во
 * всю ширину области просмотра, а сдвиг компенсируется у `.page-container` —
 * единственного места, где заданы ширина контента и боковые поля.
 *
 * Проверяются измеримые факты, а не «выглядит ли нормально»: содержимое в потоке
 * занимает всю ширину окна (значит, полосы пустого места нет), правый край блока
 * иконок шапки не двинулся, прокрутка заперта, после закрытия всё вернулось.
 */
test('модальное окно не оставляет полосы у края и не сдвигает содержимое', async ({ page }) => {
  await page.goto('/en');

  const measure = () =>
    page.evaluate(() => ({
      innerWidth: window.innerWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.getBoundingClientRect().width,
      /* Правый край шапки и блока её иконок: они первыми выдают сдвиг. */
      headerRight: document.querySelector('header')!.getBoundingClientRect().right,
      iconsRight:
        document.querySelector('header .page-container > div:last-child')?.getBoundingClientRect()
          .right ?? null,
      bodyMarginRight: getComputedStyle(document.body).marginRight,
      bodyPaddingRight: getComputedStyle(document.body).paddingRight,
      htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
    }));

  const before = await measure();

  /*
   * Проверка имеет смысл только там, где полоса прокрутки занимает место. В
   * headless-браузере (и на телефонах) полосы наложены поверх содержимого,
   * ширина от них не зависит, и любое утверждение о сдвиге пройдёт само собой,
   * ничего не проверив. Пропуск объявлен явно, чтобы зелёный прогон в CI не
   * выглядел доказательством того, чего он не проверял.
   */
  const hasClassicScrollbar = before.innerWidth > before.clientWidth;

  /* Поиск открывается сочетанием клавиш — самый короткий путь к диалогу. */
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('dialog')).toBeVisible();
  /* Ждём именно замок, а не появление окна: компенсация висит на его атрибуте. */
  await page.waitForFunction(() => document.body.hasAttribute('data-scroll-locked'));

  const during = await measure();

  /* Это верно в любом браузере: замок сработал, компенсация страницы отменена. */
  expect(during.htmlOverflowY).toBe('hidden');
  expect(during.bodyMarginRight).toBe('0px');
  expect(during.bodyPaddingRight).toBe('0px');

  if (hasClassicScrollbar) {
    /* Страница занимает всё окно: полосы пустого места у края нет. */
    expect(during.bodyWidth).toBeCloseTo(during.innerWidth, 0);
    /* А фиксированная обвязка и её содержимое стоят на месте. */
    expect(during.headerRight).toBeCloseTo(before.headerRight, 0);
    expect(during.iconsRight).toBeCloseTo(before.iconsRight ?? 0, 0);
  }

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.waitForFunction(() => !document.body.hasAttribute('data-scroll-locked'));

  /* И обратно: закрытие не должно дёргать раскладку так же, как открытие. */
  const after = await measure();
  expect(after.bodyWidth).toBeCloseTo(before.bodyWidth, 0);
  expect(after.headerRight).toBeCloseTo(before.headerRight, 0);
  expect(after.iconsRight).toBeCloseTo(before.iconsRight ?? 0, 0);
});
