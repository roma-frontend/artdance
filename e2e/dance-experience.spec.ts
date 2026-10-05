import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const locale of ['en', 'ru', 'hy']) {
  test(`${locale}: dance finder sends real catalog filters and preserves other answers`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
    const finder = page.locator('[data-slot="dance-finder"]');
    await finder.scrollIntoViewIfNeeded();
    await expect(finder).toBeVisible();
    await expect(finder).toHaveAttribute('data-hydrated', 'true');
    await finder.locator('select[name="level"]').selectOption('INTERMEDIATE');
    await finder.locator('input[name="date"]').fill('2026-12-01');
    await finder.locator('label:has(input[value="partner"])').click();
    await expect(finder.locator('select[name="level"]')).toHaveValue('INTERMEDIATE');
    await expect(finder.locator('input[name="date"]')).toHaveValue('2026-12-01');
    const style = await finder.locator('select[name="style"]').inputValue();
    await finder.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/discover\?`));
    const url = new URL(page.url());
    expect(url.searchParams.get('scope')).toBe('classes');
    expect(url.searchParams.get('style')).toBe(style || null);
    expect(url.searchParams.get('level')).toBe('INTERMEDIATE');
    expect(url.searchParams.get('date')).toBe('2026-12-01');
    await expect(page.locator('h1')).toBeVisible();
  });
}

test('First-class tips and event poster stay usable without animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  const tips = page.locator('[data-slot="first-lesson"]');
  await tips.scrollIntoViewIfNeeded();
  await expect(tips.locator('details')).toHaveCount(3);
  await tips.getByText('Do I need a partner?', { exact: true }).click();
  await expect(tips.locator('details').first()).toHaveAttribute('open', '');
  await expect(tips.locator('details').first().locator('p')).toBeVisible();
  const poster = page.locator('[data-slot="event-spotlight"]');
  await poster.scrollIntoViewIfNeeded();
  await expect(poster).toBeVisible();
  await expect(poster.locator('time')).toHaveAttribute('datetime', /\d{4}-\d{2}-\d{2}/);
  await expect(poster.getByRole('link', { name: 'Explore the event' })).toHaveAttribute('href', /\/en\/events\//);
  expect(await poster.locator('img').evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).isIdentity)).toBe(true);
  await expect(poster.locator('img')).toHaveCSS('transition-duration', '0s');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Mood, teacher facts and new blocks pass accessibility in both themes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Layout checked on every viewport; axe runs once per theme');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en', { waitUntil: 'domcontentloaded' });
  const finder = page.locator('[data-slot="dance-finder"]');
  await finder.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-style-panel]').first()).toHaveAttribute('data-dance-mood', /pulse|flow|embrace|stage/);
  await expect(page.getByText('Open the profile for classes, levels and available booking times.').first()).toBeAttached();
  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => { document.documentElement.classList.remove('light', 'dark'); document.documentElement.classList.add(value); }, theme);
    const audit = await new AxeBuilder({ page })
      .include('[data-slot="dance-finder"]')
      .include('[data-slot="first-lesson"]')
      .include('[data-slot="event-spotlight"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(audit.violations).toEqual([]);
  }
});

test('Finder and first-class tips work before hydration and without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/en`, { waitUntil: 'domcontentloaded' });
  const finder = page.locator('[data-slot="dance-finder"]');
  await expect(finder).toHaveAttribute('data-hydrated', 'false');
  await expect(finder).toHaveAttribute('action', '/en/discover');
  await finder.locator('select[name="level"]').selectOption('INTERMEDIATE');
  await finder.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/discover\?/);
  expect(new URL(page.url()).searchParams.get('scope')).toBe('classes');
  expect(new URL(page.url()).searchParams.get('level')).toBe('INTERMEDIATE');
  await page.goto(`${baseURL}/en`, { waitUntil: 'domcontentloaded' });
  const tip = page.locator('[data-slot="first-lesson"] details').first();
  await tip.locator('summary').click();
  await expect(tip).toHaveAttribute('open', '');
  await expect(tip.locator('p')).toBeVisible();
  await context.close();
});
