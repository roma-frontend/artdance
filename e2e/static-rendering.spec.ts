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

import { demoBanners } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';
import { locales } from '../src/i18n/config';

const demoBanner = demoBanners[0];

test.describe('лендинг отдаётся готовым HTML', () => {
  for (const locale of locales) {
    test(`/${locale}: контент виден без JavaScript`, async ({ page }) => {
      await page.route('**/*', (route) => {
        // Без JS видео-постеры и шрифты не должны блокировать загрузку страницы.
        if (route.request().resourceType() === 'media') return route.abort();
        return route.continue();
      });
      await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });

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
    await page.goto('/en', { waitUntil: 'domcontentloaded' });

    for (const title of [en.home.discover.title, en.pricing.title]) {
      await expect(page.locator('h2').filter({ hasText: title })).toBeVisible();
    }
  });

  test('en: активный баннер из CMS появляется после первого экрана и закрывается', async ({
    page,
  }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' });

    const banner = page.locator(`[data-banner-key="${demoBanner.key}"]`);

    /* Пока первый экран на виду, промо нет: hero должен остаться нетронутым. */
    await expect(banner).toBeHidden();

    /*
     * Прокручиваем за нижнюю кромку hero, а не на фиксированное число пикселей:
     * высота первого экрана зависит от ширины окна и мобильного дока.
     */
    await page.evaluate(() => {
      const hero = document.querySelector('.hero-viewport');
      const bottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : window.innerHeight;
      window.scrollTo({ top: bottom + 50, behavior: 'instant' });
    });

    await expect(banner).toBeVisible();
    await expect(banner).toContainText(demoBanner.title);

    await banner.getByRole('button', { name: en.common.actions.close }).click();
    await expect(banner).toHaveCount(0);
  });

  test('ru: заголовок баннера берётся из перевода, а не из базового текста', async ({ page }) => {
    await page.goto('/ru', { waitUntil: 'domcontentloaded' });

    const banner = page.locator(`[data-banner-key="${demoBanner.key}"]`);
    await page.evaluate(() => {
      const hero = document.querySelector('.hero-viewport');
      const bottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : window.innerHeight;
      window.scrollTo({ top: bottom + 50, behavior: 'instant' });
    });

    await expect(banner).toBeVisible();
    await expect(banner).toContainText(demoBanner.translations.ru);
    /* Базовый английский текст на русской странице означал бы, что перевод не подключён. */
    await expect(banner).not.toContainText(demoBanner.title);
  });

  test('en: у футера промо складывается, чтобы не лежать на ARTDANCE', async ({ page }) => {
    await page.goto('/en', { waitUntil: 'domcontentloaded' });

    const banner = page.locator(`[data-banner-key="${demoBanner.key}"]`);
    await page.evaluate(() => {
      const hero = document.querySelector('.hero-viewport');
      const bottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : window.innerHeight;
      window.scrollTo({ top: bottom + 50, behavior: 'instant' });
    });
    await expect(banner).toBeVisible();

    /* Докрутили до конца: контурное ARTDANCE в кадре → панель сворачивается вниз. */
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    await expect(banner).toBeHidden();
  });
});
