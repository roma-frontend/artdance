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
 */

import { expect, test } from '@playwright/test';

import { locales } from '../src/i18n/config';

/** Ноутбучные высоты — проект конфига их не покрывает, см. шапку файла. */
const SHORT_HEIGHTS = [800, 700] as const;

for (const locale of locales) {
  for (const height of SHORT_HEIGHTS) {
    test(`/${locale}: строка поиска целиком в первом экране на ноутбуке ${height}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height });
      await test.step('замер на ноутбуке', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto(`/${locale}`);

        const form = page
          .locator('form')
          .filter({ has: page.locator('input[type="search"]') })
          .first();
        await expect(form).toBeVisible();

        const box = (await form.boundingBox())!;
        expect(
          Math.round(box.y + box.height),
          `нижняя кромка строки поиска (${Math.round(box.y + box.height)}) должна быть выше нижней границы окна ${height}px`,
        ).toBeLessThanOrEqual(height);
      });
    });
  }

  test(`/${locale}: строка поиска целиком в первом экране`, async ({ page }) => {
    /* Без анимаций появления: замер идёт по конечному состоянию раскладки. */
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${locale}`);

    const form = page.locator('form').filter({ has: page.locator('input[type="search"]') }).first();
    const stats = page.locator('dl').first();
    /*
     * Ожидание обоих узлов до замера, а не после: на армянской версии React
     * доводит гидратацию заметно дольше, и снимок геометрии, взятый в этот
     * момент, приходил на уже открепленный узел.
     */
    await expect(form).toBeVisible();
    await expect(stats).toBeVisible();

    const box = (await form.boundingBox())!;
    const viewportHeight = page.viewportSize()!.height;

    /*
     * Док фиксирован у нижней кромки и перекрывает содержимое, поэтому граница
     * доступной области — его верх, а не низ окна. На широких экранах дока нет.
     */
    const dock = await page.locator('.mobile-dock-shell').boundingBox();
    const limit = dock ? dock.y : viewportHeight;

    expect(
      Math.round(box.y + box.height),
      `нижняя кромка строки поиска (${Math.round(box.y + box.height)}) должна быть выше границы ${Math.round(limit)}`,
    ).toBeLessThanOrEqual(Math.round(limit));

    /* Наезд не должен закрывать показатели: они выше верхней кромки строки. */
    const statsBox = (await stats.boundingBox())!;
    expect(
      Math.round(statsBox.y + statsBox.height),
      'показатели первого экрана не закрыты строкой поиска',
    ).toBeLessThanOrEqual(Math.round(box.y));
  });
}
