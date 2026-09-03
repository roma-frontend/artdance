/**
 * Светлая и тёмная темы.
 *
 * Три свойства, каждое из которых легко потерять:
 *
 * 1. **До первого выбора тема следует за системой** — включая случай без
 *    JavaScript. В прототипе тема читается из `localStorage` в конце страницы,
 *    поэтому пользователь с тёмной системой видит светлый экран всегда, а с
 *    сохранённым выбором — вспышку светлого на каждой загрузке.
 * 2. **Выбор переживает перезагрузку** и перебивает системную настройку.
 * 3. **Hero и editorial остаются тёмными в обеих темах**: это `surface-cinema`,
 *    отдельная роль в дизайн-системе, а не тёмная тема. Если переключатель их
 *    трогает — роль перепутана с темой.
 */

import { expect, test, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';

const HOME = '/en';

const toggle = (page: Page) =>
  page.getByRole('button', { name: new RegExp(`${en.common.theme.switchToLight}|${en.common.theme.switchToDark}|${en.common.theme.switchToSystem}`) });

const themeAttribute = (page: Page) =>
  page.evaluate(() => document.documentElement.getAttribute('data-theme'));

/** Фон канвы: по нему видно, какая тема фактически применена. */
const canvasColor = (page: Page) =>
  page.evaluate(() =>
    window.getComputedStyle(document.documentElement).getPropertyValue('--surface-canvas').trim(),
  );

test.describe('тема по системной настройке', () => {
  test('тёмная система даёт тёмную тему без единого клика', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(HOME);

    await expect.poll(() => themeAttribute(page)).toBe('dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 10, 9)');
  });

  test('светлая система даёт светлую тему', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(HOME);

    await expect.poll(() => themeAttribute(page)).toBe('light');
  });

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('тёмная система работает без скрипта — значит, и без вспышки', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(HOME);

      /*
       * Атрибута нет — его ставит скрипт, которого здесь нет. Тему целиком
       * определяет медиа-запрос в tokens.css, и это же убирает мигание в
       * первый кадр у пользователей с системной темой.
       */
      expect(await themeAttribute(page)).toBeNull();
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 10, 9)');
    });
  });
});

test.describe('переключатель темы', () => {
  test('перебирает светлую, тёмную и системную', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(HOME);

    const button = toggle(page);
    /* Системная тема при светлой системе: кнопка предлагает светлую. */
    await expect(button).toHaveAttribute('data-theme-choice', 'system');

    await button.click();
    await expect(button).toHaveAttribute('data-theme-choice', 'light');
    expect(await themeAttribute(page)).toBe('light');

    await button.click();
    await expect(button).toHaveAttribute('data-theme-choice', 'dark');
    expect(await themeAttribute(page)).toBe('dark');

    await button.click();
    await expect(button).toHaveAttribute('data-theme-choice', 'system');
  });

  test('кнопка называет следующее действие, а не текущее состояние', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(HOME);

    const button = toggle(page);
    await expect(button).toHaveAttribute('aria-label', en.common.theme.switchToLight);

    await button.click();
    await expect(button).toHaveAttribute('aria-label', en.common.theme.switchToDark);
  });

  test('выбор переживает перезагрузку и перебивает систему', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(HOME);

    const button = toggle(page);
    await button.click();
    await button.click();
    expect(await themeAttribute(page)).toBe('dark');

    await page.reload();
    await expect.poll(() => themeAttribute(page)).toBe('dark');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 10, 9)');
  });
});

test('кинематографичные секции не зависят от темы', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(HOME);
  await expect.poll(() => themeAttribute(page)).toBe('light');

  const lightCanvas = await canvasColor(page);
  /*
   * По роли, а не по позиции в дереве: hero завёрнут в обёртку параллакса, и
   * поиск «первой секции внутри main» находил бы уже discover.
   */
  const hero = page.locator('.cinema-surface').first();
  await expect(hero).toHaveCSS('background-color', 'rgb(11, 10, 9)');

  await toggle(page).click();
  await toggle(page).click();
  await expect.poll(() => themeAttribute(page)).toBe('dark');

  /* Канва изменилась, а hero — нет: роль и тема остались разными вещами. */
  expect(await canvasColor(page)).not.toBe(lightCanvas);
  await expect(hero).toHaveCSS('background-color', 'rgb(11, 10, 9)');
});


/**
 * Цвет интерфейса браузера следует за выбранной темой.
 *
 * `<meta name="theme-color">` с медиа-запросом умеет следить только за
 * СИСТЕМНОЙ настройкой. У нас тема может быть выбрана вручную и переживает
 * перезагрузку — и тогда над тёмной страницей остаётся светлая адресная строка,
 * что на телефоне читается как незагруженный экран.
 */
test('цвет адресной строки соответствует выбранной теме, а не системной', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(HOME);

  const canvas = () =>
    page.evaluate(() =>
      window.getComputedStyle(document.documentElement).getPropertyValue('--surface-canvas').trim(),
    );

  /** Значение меты без медиа-запроса: ею управляет выбор пользователя. */
  const themeColor = () =>
    page.evaluate(
      () =>
        document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])')?.content ??
        null,
    );

  await expect.poll(themeColor).toBe(await canvas());

  /* Светлая → тёмная: мета обязана догнать канву. */
  await toggle(page).click();
  await toggle(page).click();
  await expect.poll(() => themeAttribute(page)).toBe('dark');

  const dark = await canvas();
  await expect.poll(themeColor).toBe(dark);
  expect(dark).not.toBe('');
});
