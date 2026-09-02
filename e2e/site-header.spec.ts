/**
 * Шапка и мобильное меню — поведение в настоящем браузере.
 *
 * Тексты берутся из каталога переводов, а не пишутся строками: правка формулировки
 * в `en.ts` не должна ронять тест, а тест не должен фиксировать копирайт.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { motion } from '../src/design/motion';
import { raw } from '../src/design/tokens';

/** Английская локаль: у неё в каталоге эталонные строки. */
const HOME = '/en';

const header = (page: Page): Locator => page.getByRole('banner');
const menuButton = (page: Page): Locator =>
  page.getByRole('button', { name: en.nav.openMenu, exact: true });

async function isMobileLayout(page: Page): Promise<boolean> {
  return menuButton(page).isVisible();
}

test.describe('SiteHeader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
  });

  test('над hero шапка прозрачная, после прокрутки — сплошная', async ({ page }) => {
    await expect(header(page)).toHaveAttribute('data-state', 'top');

    await page.mouse.wheel(0, motion.headerScroll.thresholdPx + 40);
    await expect(header(page)).toHaveAttribute('data-state', 'scrolled');

    /* Возврат наверх обязан вернуть прозрачность: состояние двустороннее. */
    await page.mouse.wheel(0, -(motion.headerScroll.thresholdPx + 40));
    await expect(header(page)).toHaveAttribute('data-state', 'top');
  });

  test('первый Tab попадает на ссылку «к содержимому», и она ведёт к main', async ({ page }) => {
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: en.nav.skipToContent });
    await expect(skipLink).toBeFocused();
    /* sr-only-ссылка обязана становиться видимой в фокусе, иначе она бесполезна зрячим. */
    await expect(skipLink).toBeVisible();

    await skipLink.press('Enter');
    await expect(page.locator('main')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#content');
  });

  test('в шапке нет ссылок на выключенные разделы', async ({ page }) => {
    /* Ссылка ведёт либо в существующий раздел, либо её нет: 404 из навигации недопустим. */
    const hrefs = await header(page).getByRole('link').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith('/en')).toBe(true);
      expect(href).not.toContain('undefined');
    }
  });

  test('активный раздел помечен для скринридера', async ({ page }) => {
    const current = header(page).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', HOME);
  });

  test('раскладка соответствует ширине экрана', async ({ page }) => {
    const links = header(page).getByRole('navigation').getByRole('link');

    if (await isMobileLayout(page)) {
      /* Узкий экран: строка ссылок скрыта, но доступ к разделам остаётся через меню. */
      await expect(links).toHaveCount(0);
    } else {
      await expect(links.first()).toBeVisible();
      await expect(menuButton(page)).toBeHidden();
    }
  });
});

test.describe('MobileNavDrawer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    test.skip(!(await isMobileLayout(page)), 'Бургер показывается только на узких экранах');
  });

  test('открывается, имеет ширину из токена и запирает фокус', async ({ page }) => {
    await menuButton(page).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer).toHaveAccessibleName(en.nav.menuTitle);

    const width = await drawer.evaluate((node) => node.getBoundingClientRect().width);
    const expectedWidth = Number.parseFloat(raw.layout.drawerWidth) * 16;
    expect(width).toBeCloseTo(expectedWidth, 0);

    /* Прокрутка страницы под открытым меню должна быть заблокирована. */
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    /* Фокус не должен уходить из панели: пять Tab по кругу остаются внутри. */
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await drawer.evaluate((node) => node.contains(document.activeElement));
      expect(inside).toBe(true);
    }
  });

  test('закрывается по Esc и возвращает фокус на бургер', async ({ page }) => {
    await menuButton(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });

  test('закрывается кнопкой внутри панели', async ({ page }) => {
    await menuButton(page).click();
    await page.getByRole('button', { name: en.nav.closeMenu }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('затемнение перекрывает шапку, а не наоборот', async ({ page }) => {
    await menuButton(page).click();

    /*
     * Здесь шапка ищется структурно (прямой ребёнок body), а не ролью: Radix
     * помечает остальную страницу `aria-hidden`, и роли `banner` для скринридера
     * больше не существует — именно так и должен вести себя модальный диалог.
     * Внутри секций страницы есть свои <header>, поэтому селектор строгий.
     */
    const headerElement = page.locator('body > header');

    const overlayZ = await page
      .locator('[data-slot="sheet-overlay"]')
      .evaluate((node) => Number.parseInt(getComputedStyle(node).zIndex, 10));
    const headerZ = await headerElement.evaluate((node) =>
      Number.parseInt(getComputedStyle(node).zIndex, 10),
    );

    expect(overlayZ).toBeGreaterThan(headerZ);
    expect(headerZ).toBe(Number.parseInt(raw.zIndex.header, 10));
  });

  test('остальная страница скрыта от скринридера и недоступна с клавиатуры', async ({ page }) => {
    await menuButton(page).click();

    /* `banner` пропадает из дерева доступности — страница под меню изолирована. */
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    /* После закрытия шапка обязана вернуться в дерево доступности. */
    await expect(page.getByRole('banner')).toHaveCount(1);
  });

  test('переход по ссылке уводит на раздел и закрывает меню', async ({ page }) => {
    await menuButton(page).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('link', { name: en.nav.instructors }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/en\/instructors$/);
  });
});
