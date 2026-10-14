/**
 * Нижняя стопка профиля инструктора — fixed CTA, мобильный док и cinema-футер.
 *
 * Эти элементы живут в разных слоях: CTA и док вынуты из потока, а ARTDANCE
 * остаётся декоративным содержимым футера. Проверяем их геометрию в конце
 * страницы, где раньше панель записи ложилась прямо на слово и на док.
 */

import { expect, test } from '@playwright/test';

import { demoInstructors } from '../prisma/fixtures/demo';
import { raw } from '../src/design/tokens';
import { routes } from '../src/config/routes';

const PROFILE = `/en${routes.instructor(demoInstructors[0]!.slug)}`;

test('на узком экране нижние слои профиля образуют читаемую стопку', async ({ page }) => {
  test.skip(
    (page.viewportSize()?.width ?? raw.breakpoint.lg) >= raw.breakpoint.lg,
    'StickyActionBar скрыта на широком экране',
  );

  await page.goto(PROFILE, { waitUntil: 'domcontentloaded' });
  const action = page.locator('[data-slot="sticky-action-bar"]');
  await expect(action).toBeVisible();

  await page.evaluate(() =>
    window.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: 'instant' }),
  );

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const node = document.querySelector<HTMLElement>(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, left: box.left, right: box.right };
    };

    return {
      action: rect('[data-slot="sticky-action-bar"]'),
      dock: rect('.mobile-dock'),
      word: rect('body footer.footer-cinema [data-footer-word]'),
    };
  });

  expect(geometry.action).not.toBeNull();
  expect(geometry.dock).not.toBeNull();
  expect(geometry.word).not.toBeNull();

  /* Между CTA и доком остаётся визуальный зазор, а не 12px overlap оболочек. */
  expect(geometry.action!.bottom).toBeLessThanOrEqual(geometry.dock!.top - 7);
  /* Декоративное слово не просвечивает через карточку записи. */
  expect(geometry.word!.bottom).toBeLessThanOrEqual(geometry.action!.top - 7);
  /* Карточка CTA выровнена по ширине дока, а не растянута второй полосой. */
  expect(geometry.action!.left).toBeGreaterThanOrEqual(geometry.dock!.left - 1);
  expect(geometry.action!.right).toBeLessThanOrEqual(geometry.dock!.right + 1);
});
