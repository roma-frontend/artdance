/**
 * Статическая отдача страницы.
 *
 * Проверка появилась после конкретной находки: `loading.tsx` на уровне сегмента
 * `[locale]` оборачивал КАЖДУЮ страницу под ним в Suspense. В прегенерированном
 * HTML это выглядело так: пользователю отдавался скелет, а настоящий `<main>`
 * лежал в `<div hidden>` и вставлялся на место инлайновым скриптом. Страница
 * оставалась пустой без JavaScript, а первым кадром всегда был скелет — на
 * странице, у которой нет ни одного запроса в момент запроса.
 *
 * Тест держит инвариант: у статического маршрута контент лежит в разметке на
 * своём месте. Загрузочные состояния добавляются динамическим сегментам
 * (каталог с фильтрами, кабинет, админка), а не корню локали.
 */

import { expect, test } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { locales } from '../src/i18n/config';

test.describe('лендинг отдаётся готовым HTML', () => {
  test.use({ javaScriptEnabled: false });

  for (const locale of locales) {
    test(`/${locale}: контент виден без JavaScript`, async ({ page }) => {
      await page.goto(`/${locale}`);

      const main = page.locator('main');
      await expect(main).toBeVisible();

      /* Ни один предок `main` не должен быть скрытым контейнером стриминга. */
      const hiddenAncestors = await main.evaluate((node) => {
        let count = 0;
        let parent = node.parentElement;
        while (parent) {
          if (parent.hasAttribute('hidden') || getComputedStyle(parent).display === 'none') count += 1;
          parent = parent.parentElement;
        }
        return count;
      });
      expect(hiddenAncestors).toBe(0);

      /* Шапка и первый экран — тоже часть разметки, а не результат гидратации. */
      await expect(page.locator('body > header')).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
    });
  }

  test('en: заголовки секций на своих местах', async ({ page }) => {
    await page.goto('/en');

    for (const title of [en.home.discover.title, en.pricing.title]) {
      await expect(page.locator('h2').filter({ hasText: title })).toBeVisible();
    }
  });
});
