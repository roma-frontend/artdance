import { expect, test } from '@playwright/test';

const tiles = '[data-slot="style-accordion"]';
const clips = `${tiles} video[data-tile-video]`;

test('видеокарточки загружают только активный ролик и останавливаются вне экрана', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ARTDANCE_LITE_MODE', 'false'));
  const requested = new Set<string>();
  page.on('request', (request) => {
    if (/\/media\/style-tiles\/.*\.(mp4|webm)/.test(request.url())) requested.add(request.url());
  });
  await page.goto('/en');
  await page.locator(tiles).scrollIntoViewIfNeeded();
  const active = page.locator(`${tiles} [data-active="true"] video`);
  await expect.poll(() => active.evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await expect(page.locator(`${clips}[src]`)).toHaveCount(1);
  expect(requested.size).toBe(1);

  const next = page.locator(`${tiles} [data-style-panel]`).first();
  // Клавиатурный фокус раскрывает панель и на desktop, и на touch.
  await next.locator('a').focus();
  await expect.poll(() => next.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await expect(page.locator(`${clips}[src]`)).toHaveCount(1);
  await expect.poll(() => page.locator(clips).evaluateAll((videos) =>
    videos.filter((node) => !(node as HTMLVideoElement).paused).length,
  )).toBe(1);

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => page.locator(clips).evaluateAll((videos) =>
    videos.every((node) => (node as HTMLVideoElement).paused),
  )).toBe(true);
});

test('лёгкий режим оставляет все карточки и постеры без загрузки видео', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ARTDANCE_LITE_MODE', 'true'));
  const requested: string[] = [];
  page.on('request', (request) => {
    if (/\/media\/style-tiles\/.*\.(mp4|webm)/.test(request.url())) requested.push(request.url());
  });
  await page.goto('/en');
  await page.locator(tiles).scrollIntoViewIfNeeded();
  await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
  await expect(page.locator(`${clips}[src]`)).toHaveCount(0);
  await expect(page.locator(`${tiles} [data-style-panel]`)).toHaveCount(5);
  await expect(page.locator(`${tiles} [data-active="true"] img`).first()).toBeVisible();
  // Позволяет обнаружить отложенную загрузку, которая раньше обходила lite-mode.
  await page.waitForTimeout(1000);
  expect(requested).toEqual([]);
});
