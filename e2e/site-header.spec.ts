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
const dock = (page: Page): Locator => page.locator('.mobile-dock');
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



/**
 * Нижний док и шторка с сеткой разделов.
 *
 * Заменили бургер с выезжающим списком. Проверяется то, что при переносе
 * навигации вниз теряется чаще всего:
 *   • геометрия дока — центральная кнопка обязана остаться по центру, а вкладки
 *     стоять на одной линии независимо от длины подписи;
 *   • док не накрывает подвал: фиксированный элемент исключён из потока, и без
 *     компенсации последние ссылки сайта становятся недостижимы;
 *   • шторка остаётся полноценным диалогом — фокус, `Esc`, возврат фокуса.
 */
test.describe('MobileDock', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HOME);
    test.skip(!(await isMobileLayout(page)), 'Док показывается только на узких экранах');
  });

  test('вкладки стоят на одной линии, а кнопка — по центру', async ({ page }) => {
    const tabs = dock(page).getByRole('link');
    await expect(tabs).toHaveCount(4);

    /*
     * Одна линия — не про красоту: разъехавшиеся по вертикали цели попадаются
     * мимо. Сравниваем верхние кромки блоков подписи, а не иконок: именно
     * подпись переносится на вторую строку в армянской локали.
     */
    const tops = await tabs.evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().top)),
    );
    expect(new Set(tops).size).toBe(1);

    const bar = await dock(page).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { center: rect.left + rect.width / 2 };
    });
    const button = await menuButton(page).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return { center: rect.left + rect.width / 2 };
    });
    expect(button.center).toBeCloseTo(bar.center, 0);
  });

  test('док не накрывает подвал', async ({ page }) => {
    /*
     * `behavior: 'instant'` перебивает `scroll-behavior: smooth` документа.
     * Иначе замер попадает в середину плавной прокрутки: подвал ещё за нижней
     * кромкой, и тест «находит» дефект, которого нет. Ожидание остановки здесь
     * не годится — под нагрузкой два одинаковых замера подряд означают «кадры не
     * шли», а не «прокрутка доехала».
     */
    await page.evaluate(() =>
      window.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: 'instant' }),
    );

    const footerBottom = await page
      .locator('body footer')
      .last()
      .evaluate((node) => node.getBoundingClientRect().bottom);
    const dockTop = await dock(page).evaluate((node) => node.getBoundingClientRect().top);

    /* Последняя строка подвала обязана оказаться выше панели. */
    expect(footerBottom).toBeLessThanOrEqual(dockTop + 1);
  });

  test('шторка открывается, запирает фокус и блокирует прокрутку', async ({ page }) => {
    await menuButton(page).click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAccessibleName(en.nav.menuTitle);
    await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');

    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await sheet.evaluate((node) => node.contains(document.activeElement));
      expect(inside).toBe(true);
    }
  });

  test('закрывается по Esc и возвращает фокус на кнопку', async ({ page }) => {
    await menuButton(page).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
  });

  test('закрывается нажатием на полоску-ручку', async ({ page }) => {
    await menuButton(page).click();
    await page.getByRole('button', { name: en.nav.closeMenu }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('затемнение перекрывает шапку, а не наоборот', async ({ page }) => {
    await menuButton(page).click();

    /*
     * Шапка ищется структурно (прямой ребёнок body), а не ролью: Radix помечает
     * остальную страницу `aria-hidden`, и роли `banner` для скринридера больше
     * не существует — именно так и должен вести себя модальный диалог.
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

  test('остальная страница скрыта от скринридера', async ({ page }) => {
    await menuButton(page).click();
    await expect(page.getByRole('banner')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('banner')).toHaveCount(1);
  });

  test('шторка выезжает и уходит с анимацией, а не щелчком', async ({ page }) => {
    /*
     * Проверка появилась после дефекта, который иначе не заметить статически.
     * Вендорный `Sheet` рассчитывает на утилиты `animate-in` и
     * `slide-in-from-bottom` из отдельного пакета; пакета в проекте нет, классы
     * в разметке остались, CSS они не генерировали — и шторка появлялась
     * мгновенно. Tailwind на несуществующую утилиту не жалуется, сборка зелёная,
     * а разметка выглядит правильной.
     *
     * Поэтому сверяется не класс, а факт: у элемента есть анимация с ненулевой
     * длительностью в обоих состояниях.
     */
    await menuButton(page).click();

    const sheet = page.locator('[data-slot="sheet-content"]');
    const overlay = page.locator('[data-slot="sheet-overlay"]');
    await expect(sheet).toBeVisible();

    const opening = await sheet.evaluate((node) => {
      const style = getComputedStyle(node);
      return { name: style.animationName, duration: Number.parseFloat(style.animationDuration) };
    });
    expect(opening.name).not.toBe('none');
    expect(opening.duration).toBeGreaterThan(0.2);

    /* Затемнение проявляется, а не возникает: иначе выезд читается как рывок. */
    const overlayAnimation = await overlay.evaluate((node) => {
      const style = getComputedStyle(node);
      return { name: style.animationName, duration: Number.parseFloat(style.animationDuration) };
    });
    expect(overlayAnimation.name).not.toBe('none');
    expect(overlayAnimation.duration).toBeGreaterThan(0);

    /*
     * Уход: состояние `closed` появляется до размонтирования, и именно на нём
     * держится анимация закрытия. Ловим его, пока Radix ждёт `animationend`.
     */
    await page.keyboard.press('Escape');
    const closing = await sheet.evaluate((node) => {
      const style = getComputedStyle(node);
      return { state: node.getAttribute('data-state'), duration: Number.parseFloat(style.animationDuration) };
    });
    expect(closing.state).toBe('closed');
    expect(closing.duration).toBeGreaterThan(0.1);
  });

  test('переход по плитке уводит на раздел и закрывает шторку', async ({ page }) => {
    await menuButton(page).click();

    const sheet = page.getByRole('dialog');
    await sheet.getByRole('link', { name: en.nav.instructors }).click();

    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/en\/instructors$/, { timeout: 15_000 });
  });

  test('активная вкладка помечена для скринридера', async ({ page }) => {
    const current = dock(page).locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute('href', HOME);
  });
});
