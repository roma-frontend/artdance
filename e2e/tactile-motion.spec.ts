import { expect, test } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { settleAndHover } from './support/settle';

test.beforeEach(async ({ page }) => {
  await page.goto('/en/instructors');
  await expect(page.locator('.favorite-motion').first()).toHaveAttribute('aria-pressed', 'false');
  // Hydration must have attached the interaction handlers before a test clicks.
  await expect(page.locator('.favorite-motion').first()).toBeEnabled();
});

test('кнопки нажимаются тактильно без изменения layout', async ({ page }) => {
  const button = page.locator('main .button-motion').first();
  await button.scrollIntoViewIfNeeded();
  const size = await button.evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }));
  await button.hover();
  await page.mouse.down();
  await expect(button).toHaveCSS('scale', '0.97');
  expect(await button.evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight }))).toEqual(size);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  await expect(button).toHaveCSS('scale', '1');
});

test('hover фотографии небольшой, а цена и рейтинг остаются видимыми', async ({ page }) => {
  const fine = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  const card = page.locator('.card-surface').first();
  if (fine) {
    await settleAndHover(card);
    await expect(card.locator('.card-media')).toHaveCSS('scale', '1.045');
    await expect(card.locator('.card-cta')).toHaveCSS('opacity', '1');
  } else {
    await card.scrollIntoViewIfNeeded();
    await expect(card.locator('.card-media')).toHaveCSS('scale', 'none');
  }
  await expect(card.locator('.card-foot-line:not(.card-cta)')).toHaveCSS('opacity', '1');
  await card.locator('h3 a').focus();
  await expect(card.locator('h3 a')).toBeFocused();
  await expect(card.locator('.card-foot-line:not(.card-cta)')).toHaveCSS('opacity', '1');
});

test('избранное: импульс при клике, отмена с клавиатуры, сохранение после reload', async ({ page }) => {
  const heart = page.locator('.favorite-motion').first();
  await heart.scrollIntoViewIfNeeded();
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(en.favorites.added, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ARTDANCE_FAVORITES'))).toContain('instructor:');
  await heart.focus();
  await heart.press('Space');
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await heart.press('Enter');
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('.favorite-motion').first()).toHaveAttribute('aria-pressed', 'true');
  expect(new URL(page.url()).pathname).toBe('/en/instructors');
});

test('reduced motion: сохранение работает без движения и повторного импульса', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const button = page.locator('main .button-motion').first();
  await button.hover();
  await expect(button).toHaveCSS('translate', 'none');
  await expect(button).toHaveCSS('scale', 'none');
  const heart = page.locator('.favorite-motion').first();
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(await heart.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(page.locator('.card-surface').first().locator('.card-foot-line:not(.card-cta)')).toHaveCSS('opacity', '1');
});
