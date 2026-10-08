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

  // Return to an already loaded video: changing src must reattach playback readiness.
  await page.locator(`${tiles} [data-style-panel]`).nth(2).locator('a').focus();
  await expect.poll(() => active.evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);

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
  for (const panel of await page.locator(`${tiles} [data-style-panel]`).all()) {
    const poster = await panel.locator('video').getAttribute('poster');
    expect(poster).toMatch(/\/media\/style-tiles\/.*-poster\.webp/);
    const imageSource = await panel.locator('img').getAttribute('src');
    expect(decodeURIComponent(imageSource!)).toContain(poster!);
    await expect(panel.locator('img')).toBeVisible();
    await expect.poll(() => panel.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
  // Позволяет обнаружить отложенную загрузку, которая раньше обходила lite-mode.
  await page.waitForTimeout(1000);
  expect(requested).toEqual([]);
});

test('Full и Lite сохраняются после reload и используют один постер видео', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
  });
  await page.goto('/en');
  const toggle = page.locator('[data-slot="header-lite-toggle"]');
  // Шапка прячется при скролле (useHeaderHideOnScroll) — в тесте она может
  // оказаться с hidden/inert после parallel-прогонов. Поднимаем скролл к верху.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeEnabled();
  await toggle.click();
  const liteOption = page.getByRole('menuitemradio', { name: /^Lite/ });
  await expect(liteOption).toBeVisible();
  await liteOption.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(toggle).toBeVisible();
  await toggle.click();
  const liteOption2 = page.getByRole('menuitemradio', { name: /^Lite/ });
  await expect(liteOption2).toBeVisible();
  await expect(liteOption2).toHaveAttribute('aria-checked', 'true');
  const fullOption = page.getByRole('menuitemradio', { name: /^Full/ });
  await expect(fullOption).toBeVisible();
  await fullOption.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-lite', 'false');
  await page.locator(tiles).scrollIntoViewIfNeeded();
  const panel = page.locator(`${tiles} [data-style-panel]`).first();
  await panel.locator('a').focus();
  await expect.poll(() => panel.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await expect(panel.locator('video')).toHaveAttribute('poster', /\/style-tiles\//);
});

test('автоматический лёгкий режим сохраняется на слабом устройстве', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.removeItem('ARTDANCE_LITE_MODE');
    Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 2 });
    Object.defineProperty(navigator, 'deviceMemory', { configurable: true, get: () => 2 });
  });
  await page.goto('/en');
  await page.locator(tiles).scrollIntoViewIfNeeded();
  await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
  await expect(page.locator(`${clips}[src]`)).toHaveCount(0);
  const panel = page.locator(`${tiles} [data-style-panel]`).first();
  await panel.locator('a').focus();
  await expect(panel).toHaveAttribute('data-active', 'true');
  await expect(panel.locator('[data-style-count]')).toBeVisible();
  expect(await panel.evaluate(node => getComputedStyle(node).transitionProperty)).toContain('flex');
});

for (const mode of ['true', 'false']) {
  test(`hover карточек остаётся плавным в ${mode === 'true' ? 'Lite' : 'Full'}`, async ({ page }) => {
    await page.addInitScript(value => localStorage.setItem('ARTDANCE_LITE_MODE', value), mode);
    await page.goto('/en');
    const accordion = page.locator(tiles);
    await accordion.scrollIntoViewIfNeeded();
    const panel = accordion.locator('[data-style-panel]').first();
    const transition = await panel.evaluate(node => ({
      property: getComputedStyle(node).transitionProperty,
      duration: getComputedStyle(node).transitionDuration,
    }));
    expect(transition.property).toContain('flex-grow');
    expect(Math.max(...transition.duration.split(',').map(value => Number.parseFloat(value)))).toBeGreaterThan(0.2);
    const before = await panel.boundingBox();
    await panel.locator('a').focus();
    await expect(panel).toHaveAttribute('data-active', 'true');
    await expect.poll(async () => {
      const after = await panel.boundingBox();
      return Math.max(after!.width / before!.width, after!.height / before!.height);
    }).toBeGreaterThan(2);
    if (mode === 'true') await expect(page.locator(`${clips}[src]`)).toHaveCount(0);
  });
}

test('переход из карточки увеличивает только transform, без layout и blur', async ({ page }) => {
  await page.goto('/en');
  const accordion = page.locator(tiles);
  await accordion.scrollIntoViewIfNeeded();
  const panel = accordion.locator('[data-style-panel]').nth(2);
  await panel.locator('a').focus();
  await page.waitForTimeout(1300);
  await panel.locator('a').click();
  const overlay = page.locator('[data-slot="portal-transition"]');
  await expect(overlay).toBeVisible();
  const window = overlay.locator(':scope > div').nth(1);
  const geometry = await window.evaluate(node => ({ width: (node as HTMLElement).offsetWidth, height: (node as HTMLElement).offsetHeight, transform: getComputedStyle(node).transform }));
  expect(geometry.width).toBe(page.viewportSize()!.width);
  expect(geometry.height).toBe(page.viewportSize()!.height);
  await expect(overlay.locator('img')).toHaveCSS('filter', 'none');
  await expect(overlay.locator(':scope > div').first()).toHaveCSS('backdrop-filter', 'none');
  await expect(page).toHaveURL(/\/en\/styles\//);
  await expect(overlay).toHaveCount(0);
});

test('раскрытие не меняет размер фото и видео и не запускает декодер одновременно', async ({ page }) => {
  await page.goto('/en');
  const accordion = page.locator(tiles);
  await accordion.scrollIntoViewIfNeeded();
  const panel = accordion.locator('[data-style-panel]').first();
  const surface = panel.locator('.dance-style-media');
  await expect.poll(() => surface.evaluate(node => node.clientWidth)).toBeGreaterThan(100);
  const result = await page.evaluate(async () => {
    const panel = document.querySelector<HTMLElement>('[data-slot="style-accordion"] [data-style-panel]')!;
    const surface = panel.querySelector<HTMLElement>('.dance-style-media')!;
    const video = panel.querySelector<HTMLVideoElement>('video')!;
    const samples: { width: number; height: number; clip: number }[] = [];
    const events: { name: string; at: number }[] = [];
    const start = performance.now();
    video.addEventListener('playing', () => events.push({ name: 'playing', at: performance.now() - start }));
    const before = { width: surface.clientWidth, height: surface.clientHeight };
    panel.querySelector('a')!.focus();
    await new Promise<void>(resolve => {
      const tick = () => {
        samples.push({ width: surface.clientWidth, height: surface.clientHeight, clip: panel.getBoundingClientRect().width });
        if (performance.now() - start < 1400) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    return { before, samples, events };
  });
  for (const sample of result.samples) {
    expect(sample.width).toBe(result.before.width);
    expect(sample.height).toBe(result.before.height);
  }
  for (const event of result.events) expect(event.at).toBeGreaterThanOrEqual(1200);
  await expect(panel).toHaveAttribute('data-active', 'true');
  await expect.poll(() => panel.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false);
  await expect(panel.locator('video')).toHaveAttribute('data-playing', '');
  const properties = await surface.evaluate(node => getComputedStyle(node).transitionProperty);
  expect(properties).toBe('transform');
});
