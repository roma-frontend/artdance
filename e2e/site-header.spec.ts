/**
 * Шапка и мобильное меню — поведение в настоящем браузере.
 *
 * Тексты берутся из каталога переводов, а не пишутся строками: правка формулировки
 * в `en.ts` не должна ронять тест, а тест не должен фиксировать копирайт.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
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

  test('над кинематографичным экраном шапка прозрачная, после него — сплошная', async ({
    page,
  }) => {
    await expect(header(page)).toHaveAttribute('data-state', 'top');

    /*
     * Прокрутка внутри первого экрана состояние НЕ меняет, и это главное свойство
     * проверки. Прежде шапка становилась сплошной после 60 пикселей; с приколотым
     * первым экраном это давало светлую полосу поверх тёмного театра на две
     * высоты окна вперёд.
     */
    await page.mouse.wheel(0, 200);
    await expect(header(page)).toHaveAttribute('data-state', 'top');

    /* За обёрткой первого экрана — сплошная. */
    await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
      const end = stage ? stage.offsetTop + stage.getBoundingClientRect().height : 0;
      window.scrollTo({ top: end + 200, behavior: 'instant' });
    });
    await expect(header(page)).toHaveAttribute('data-state', 'scrolled');

    /* Возврат наверх обязан вернуть прозрачность: состояние двустороннее. */
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
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
      .locator('[data-slot="drawer-overlay"]')
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

  test('шторка выезжает и уходит плавно, а не щелчком', async ({ page }) => {
    /*
     * Проверка появилась после замечания заказчика и переживает уже вторую
     * причину того же симптома, поэтому сверяется не класс и не библиотека, а
     * ФАКТ движения: за какое время панель проходит путь и приходит ли она в
     * конечное положение постепенно.
     *
     * Первая причина: вендорный `Sheet` рассчитывал на утилиты `animate-in` и
     * `slide-in-from-bottom` из пакета, которого в проекте нет — классы в
     * разметке были, CSS они не генерировали. Вторая: даже с анимацией наша
     * брендовая кривая проходила 96% пути за первые 230ms из 500 и последние
     * четыре пиксела ползла. Обе выглядели в коде правильно.
     */
    /*
     * Открытие и замеры — внутри страницы, без обращений к драйверу между
     * кадрами: путь панели длится около 350ms, и любой round-trip между `click`
     * и первым замером успевает его пропустить. Именно так первая версия этой
     * проверки «увидела» нулевое смещение на уже приехавшей шторке.
     */
    const tops = await page.evaluate(async (label) => {
      const trigger = [...document.querySelectorAll('button')].find(
        (node) => node.getAttribute('aria-label') === label,
      );
      trigger?.click();

      const samples: number[] = [];
      await new Promise<void>((resolve) => {
        let frames = 0;
        const tick = () => {
          const node = document.querySelector('[data-slot="drawer-content"]');
          if (node) samples.push(Math.round(node.getBoundingClientRect().top));
          frames += 1;
          if (frames < 24) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return samples;
    }, en.nav.openMenu);

    const sheet = page.locator('[data-slot="drawer-content"]');
    await expect(sheet).toBeVisible();

    /* Панель едет: между первым и последним замером есть заметный путь. */
    expect(tops.length).toBeGreaterThan(4);
    expect(tops[0]! - tops.at(-1)!).toBeGreaterThan(40);

    /*
     * И едет ПОСТЕПЕННО: минимум три разных положения. Мгновенный переход дал бы
     * одно и то же значение во всех замерах — ровно то, что видел заказчик.
     */
    expect(new Set(tops).size).toBeGreaterThanOrEqual(3);

    const declared = await sheet.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        property: style.transitionProperty,
        duration: Number.parseFloat(style.transitionDuration),
      };
    });
    expect(declared.property).toContain('transform');
    expect(declared.duration).toBeGreaterThan(0.2);

    /* Затемнение проявляется, а не возникает. */
    const overlay = await page.locator('[data-slot="drawer-overlay"]').evaluate((node) => {
      const style = getComputedStyle(node);
      return { name: style.animationName, duration: Number.parseFloat(style.animationDuration) };
    });
    expect(overlay.name).not.toBe('none');
    expect(overlay.duration).toBeGreaterThan(0);
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
