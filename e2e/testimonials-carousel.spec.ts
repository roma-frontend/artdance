import { expect, test } from '@playwright/test';
import { waitUntilStill } from './support/settle';

async function openCarousel(page: import('@playwright/test').Page) {
  await page.goto('/en');
  const stage = page.locator('[data-slot="testimonials-carousel"]');
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toBeVisible();
  return stage;
}

test('Reviews: arrows, dots, keyboard and responsive card geometry', async ({ page }) => {
  const stage = await openCarousel(page);
  const rail = stage.locator('.reviews-rail');
  const count = await stage.locator('.review-slide').count();
  expect(count).toBeGreaterThan(1);
  await stage.locator('.reviews-controls > button').nth(2).click();
  await expect(stage.getByRole('button', { name: 'Play stories' })).toBeVisible();
  await stage.getByRole('button', { name: 'Go to story 2' }).click();
  await expect(rail).toHaveAttribute('data-active', '1');
  await rail.focus();
  await rail.press('End');
  await expect(rail).toHaveAttribute('data-active', String(count - 1));
  await rail.press('ArrowRight');
  await expect(rail).toHaveAttribute('data-active', '0');
  await rail.press('ArrowLeft');
  await expect(rail).toHaveAttribute('data-active', String(count - 1));
  await rail.press('Home');
  await expect(rail).toHaveAttribute('data-active', '0');
  const dimensions = await rail.evaluate((node) => {
    const card = node.firstElementChild as HTMLElement;
    return { card: card.offsetWidth, viewport: node.clientWidth };
  });
  expect(dimensions.card).toBeLessThan(dimensions.viewport);
  expect(dimensions.card).toBeGreaterThan(Math.min(240, dimensions.viewport * 0.65));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Reviews: mouse drag and pointer light', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Native touch swipe is tested separately');
  const stage = await openCarousel(page);
  await stage.getByRole('button', { name: 'Pause stories' }).click();
  const card = stage.locator('.review-slide').first();
  await waitUntilStill(card);
  await card.hover({ position: { x: 60, y: 80 } });
  await expect(card.locator('figure')).not.toHaveCSS('transform', 'none');
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.85, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.15, box.y + 100, { steps: 15 });
  await page.mouse.up();
  await expect(stage.locator('.reviews-rail')).toHaveAttribute('data-active', '1');
  await expect(stage.locator('.reviews-rail')).not.toHaveAttribute('data-dragging');
});

test('Reviews: reduced motion keeps navigation and readable quotes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const stage = await openCarousel(page);
  await expect(stage.getByRole('button', { name: 'Pause stories' })).toHaveCount(0);
  await expect(stage.locator('blockquote').first()).toBeVisible();
  await expect(stage.locator('.review-card-depth').first()).toHaveCSS('transform', 'none');
  await stage.getByRole('button', { name: 'Go to story 2' }).click();
  await expect(stage.locator('.reviews-rail')).toHaveAttribute('data-active', '1');
  await page.screenshot({ path: `test-results/reviews-reduced-${page.viewportSize()?.width}.png`, fullPage: false });
});

test('Reviews: Play advances with focus and hover, Pause freezes the camera', async ({ page }) => {
  // Includes page loading plus two real autoplay intervals; dev image processing can consume 20s.
  test.setTimeout(60_000);
  const stage = await openCarousel(page);
  const rail = stage.locator('.reviews-rail');
  await stage.getByRole('button', { name: 'Pause stories' }).click();
  await expect(rail).not.toHaveAttribute('data-animating');
  const play = stage.getByRole('button', { name: 'Play stories' });
  await play.click();
  await expect(stage.getByRole('button', { name: 'Pause stories' })).toBeFocused();
  await expect(rail).toHaveAttribute('data-animating', 'true');
  await expect(rail).toHaveAttribute('data-active', '1');
  await expect(rail).not.toHaveAttribute('data-animating');
  // The focused and hovered control must not silently block the next automatic slide.
  await expect(rail).toHaveAttribute('data-active', '2', { timeout: 9000 });
  await stage.getByRole('button', { name: 'Pause stories' }).click();
  await expect(rail).not.toHaveAttribute('data-animating');
  const stopped = await rail.evaluate((node) => node.scrollLeft);
  await page.waitForTimeout(6000);
  expect(await rail.evaluate((node) => node.scrollLeft)).toBeCloseTo(stopped, 0);
});
