import { expect, test } from '@playwright/test';

const HOME = '/en';

test('Слова видимы, заголовок доступен, переполнения нет', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(HOME);
  const heading = page.locator('h1');
  await expect(heading).toBeVisible();
  const words = heading.locator('[data-reveal-word]');
  expect(await words.count()).toBeGreaterThan(1);
  for (const word of await words.all()) await expect(word).toHaveCSS('opacity', '1');
  await expect(heading).toHaveAccessibleName(/\S+/);
  const accent = heading.locator('.hero-shine [data-reveal-word]').first();
  await expect(accent).not.toHaveCSS('background-image', 'none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Параллакс имеет три скорости и выключается на телефоне', async ({ page }) => {
  await page.goto(HOME);
  const background = page.locator('[data-hero-background]');
  await expect(background).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }));
  if ((page.viewportSize()?.width ?? 0) < 768) {
    await expect(background).toHaveCSS('transform', 'none');
    await expect(page.locator('.hero-content')).toHaveCSS('translate', 'none');
    return;
  }
  await expect.poll(() => background.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBeLessThan(0);
  const offsets = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    return {
      back: new DOMMatrixReadOnly(style('[data-hero-background]').transform).m42,
      middle: Number.parseFloat(style('.hero-content').translate.split(' ')[1]!),
      front: new DOMMatrixReadOnly(style('.hero-light-sweep').transform).m42,
    };
  });
  expect(offsets.middle / offsets.back).toBeCloseTo(2, 1);
  expect(offsets.front / offsets.back).toBeCloseTo(3, 1);
});

test('Карточка появляется, реагирует на курсор и сохраняет клавиатурный фокус', async ({ page }) => {
  await page.goto(HOME);
  const card = page.locator('[data-animation-card]').last();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveCSS('opacity', '1');
  const link = card.locator('a[href]').first();
  await link.focus();
  await expect(link).toBeFocused();
  await expect(card).toHaveCSS('transform', 'none');
  await expect(card).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Магнитная навигация возвращается в исходное положение', async ({ page }) => {
  await page.goto(HOME);
  const fine = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
  test.skip(!fine || (page.viewportSize()?.width ?? 0) < 1024, 'На сенсорном экране магнит отключён');
  const link = page.locator('nav [data-magnetic]').first();
  await expect(link).toBeVisible();
  await link.hover({ position: { x: 4, y: 4 } });
  await expect.poll(() => link.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)).not.toBe(0);
  await page.mouse.move(0, 850);
  await expect(link).toHaveCSS('transform', 'none');
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS('transform', 'none');
});

test('Смена reduced motion останавливает эффекты и оставляет содержимое', async ({ page }) => {
  await page.goto(HOME);
  await page.evaluate(() => window.scrollTo({ top: 200, behavior: 'instant' }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-hero-background]')).toHaveCSS('transform', 'none');
  await expect(page.locator('.hero-content')).toHaveCSS('translate', 'none');
  for (const word of await page.locator('h1 [data-reveal-word]').all()) {
    await expect(word).toHaveCSS('opacity', '1');
    await expect(word).toHaveCSS('transform', 'none');
  }
  const card = page.locator('[data-animation-card]').last();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveCSS('opacity', '1');
  await expect(card).toHaveCSS('transform', 'none');
});

test.describe('Статические состояния', () => {
  test.use({ javaScriptEnabled: false });
  test('Без JavaScript текст и карточки доступны', async ({ page }) => {
    await page.goto(HOME);
    await expect(page.locator('h1 [data-reveal-word]').first()).toHaveCSS('opacity', '1');
    const card = page.locator('[data-animation-card]').last();
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCSS('opacity', '1');
    await expect(card).toBeVisible();
  });
});

test('Reduced motion при загрузке не скрывает слова и карточки', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(HOME);
  await expect(page.locator('h1 [data-reveal-word]').first()).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-animation-card]').last()).toHaveCSS('opacity', '1');
});

test('Карточки увеличиваются при входе и поворачиваются от прокрутки', async ({ page }) => {
  await page.goto(HOME);
  const card = page.locator('[data-animation-card]').last();
  await expect(card).toHaveCSS('opacity', '0');
  const matrix = () => card.evaluate((node) => {
    const m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
    return { scale: Math.hypot(m.a, m.b), angle: Math.atan2(m.b, m.a) * 180 / Math.PI };
  });
  expect((await matrix()).scale).toBeCloseTo(0.94, 2);
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveCSS('opacity', '1');
  await expect.poll(async () => (await matrix()).scale).toBeCloseTo(1, 2);
  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const before = (await matrix()).angle;
    await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }));
    await expect.poll(async () => (await matrix()).angle).not.toBeCloseTo(before, 1);
  } else {
    expect((await matrix()).angle).toBe(0);
  }
});

test('Соревнования сохраняют два видео и исходные пропорции', async ({ page }) => {
  await page.goto('/en/competitions', { waitUntil: 'domcontentloaded' });
  const videos = page.locator('iframe[src*="youtube-nocookie"]');
  await expect(videos).toHaveCount(2);
  for (const video of await videos.all()) {
    await expect(video).toHaveAttribute('allowfullscreen', '');
    const ratio = await video.evaluate((node) => node.clientWidth / node.clientHeight);
    expect(ratio).toBeCloseTo(16 / 9, 1);
  }
});
