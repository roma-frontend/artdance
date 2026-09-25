/**
 * Поисковая строка первого экрана видна целиком.
 *
 * Проверка появилась после двух замечаний об одном и том же симптоме: строка
 * «наезжает» на hero отрицательным отступом, а hero занимает ровно экран —
 * вместе это означало, что строка начинается у кромки окна и видна наполовину.
 * Ниже проверяется факт, а не разметка: нижняя кромка формы выше нижней границы
 * доступной области, а показатели первого экрана строкой не закрыты.
 *
 * Три ширины и три локали, потому что ломается это именно на них: армянский текст
 * длиннее, на телефоне поле переносится в две строки, а нижнюю часть экрана
 * занимает мобильный док.
 *
 * Ноутбучные высоты (800/700px) добавлены после третьего замечания: стандартные
 * проекты гоняют hero на 900–1000px, где всё помещается, а реальный ноутбук с
 * панелью браузера даёт окно 640–700px — там строка резалась складкой окна.
 * Размер экрана задаётся `setViewportSize` внутри теста, а не проектом конфига:
 * этот кейс — про высоту окна, а не про устройство.
 *
 * С переносом поиска в круглую кнопку в правом верхнем углу hero (форма
 * раскрывается диалогом поверх экрана) проверяется то же обещание: кнопка
 * видна целиком в первом экране, а по нажатию форма с полем поиска открыта и
 * помещается в окно.
 */

import { expect, test, type Page } from '@playwright/test';

import { locales } from '../src/i18n/config';

/** Ноутбучные высоты — проект конфига их не покрывает, см. шапку файла. */
const SHORT_HEIGHTS = [800, 700] as const;

async function expectSearchInFirstScreen(page: Page, limit: number) {
  const trigger = page.locator('[data-slot="hero-search-trigger"]');
  await expect(trigger).toBeVisible();

  const box = (await trigger.boundingBox())!;
  expect(
    Math.round(box.y + box.height),
    `нижняя кромка кнопки поиска (${Math.round(box.y + box.height)}) должна быть выше границы ${Math.round(limit)}`,
  ).toBeLessThanOrEqual(Math.round(limit));

  await trigger.click();
  const form = page
    .getByRole('dialog')
    .locator('form')
    .filter({ has: page.locator('input[type="search"]') });
  await expect(form).toBeVisible();

  const formBox = (await form.boundingBox())!;
  expect(
    Math.round(formBox.y + formBox.height),
    `нижняя кромка формы поиска (${Math.round(formBox.y + formBox.height)}) должна быть выше границы ${Math.round(limit)}`,
  ).toBeLessThanOrEqual(Math.round(limit));
}

for (const locale of locales) {
  for (const height of SHORT_HEIGHTS) {
    test(`/${locale}: строка поиска целиком в первом экране на ноутбуке ${height}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height });
      await test.step('замер на ноутбуке', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`/${locale}`);
        await expectSearchInFirstScreen(page, height);
      });
    });
  }

  test(`/${locale}: строка поиска целиком в первом экране`, async ({ page }) => {
    /* Без анимаций появления: замер идёт по конечному состоянию раскладки. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${locale}`);

    /*
     * Док фиксирован у нижней кромки и перекрывает содержимое, поэтому граница
     * доступной области — его верх, а не низ окна. На широких экранах дока нет.
     */
    const dock = await page.locator('.mobile-dock-shell').boundingBox();
    const limit = dock ? dock.y : page.viewportSize()!.height;

    await expectSearchInFirstScreen(page, limit);
  });
}
