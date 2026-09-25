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

/**
 * Глубина hero при прокрутке (25.09.2026): дальние планы отстают от прокрутки,
 * передний обгоняет. Работает на всех ширинах — на узком экране ход вдвое
 * меньше (`heroDepth.narrowFactor`), порядок планов тот же.
 */
test('Слои hero уходят с разной скоростью: кадр → слово → текст, свет обгоняет', async ({ page }) => {
  await page.goto(HOME);
  const background = page.locator('[data-hero-background]');
  await expect(background).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 250, behavior: 'instant' }));
  await expect.poll(() => background.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42)).toBeGreaterThan(0);
  const offsets = await page.evaluate(() => {
    const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
    const translateY = (selector: string) => Number.parseFloat(style(selector).translate.split(' ')[1] ?? '0');
    return {
      back: new DOMMatrixReadOnly(style('[data-hero-background]').transform).m42,
      word: translateY('[data-hero-depth="word"]'),
      middle: translateY('.hero-content'),
      front: new DOMMatrixReadOnly(style('.hero-light-sweep').transform).m42,
    };
  });
  expect(offsets.back).toBeGreaterThan(offsets.word);
  expect(offsets.word).toBeGreaterThan(offsets.middle);
  expect(offsets.middle).toBeGreaterThan(0);
  expect(offsets.front).toBeLessThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
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

test('Карточки появляются с масштабом и не вращаются от прокрутки', async ({ page }) => {
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
  /*
   * Вращение от прокрутки убрано с карточек (решение заказчика): текст должен
   * стоять ровно. Теперь оно живёт на печати финального CTA (см. ScrollSeal).
   */
  expect((await matrix()).angle).toBe(0);
  await page.evaluate(() => window.scrollBy({ top: 120, behavior: 'instant' }));
  expect((await matrix()).angle).toBe(0);
});

test('Печать финального CTA вращается от прокрутки, а не от таймера', async ({ page }) => {
  await page.goto(HOME);
  const seal = page.locator('[data-slot="scroll-seal"]');
  await expect(seal).toBeAttached();

  const angle = () =>
    seal.evaluate((node) => {
      const transform = node.style.transform;
      const match = /rotate\((-?[\d.]+)deg\)/.exec(transform);
      return match ? Number.parseFloat(match[1]!) : 0;
    });

  /*
   * Каждый угол ждётся через expect.poll: transform пишет rAF после события
   * скролла, и чтение сразу после scrollTo ловит прошлое значение.
   */
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => angle()).toBeCloseTo(0, 1);

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' }));
  await expect.poll(() => angle()).not.toBeCloseTo(0, 1);

  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => angle()).toBeCloseTo(45, 1);

  /*
   * Угол — функция положения прокрутки: назад страница крутит печать обратно.
   * Сравниваем с формулой на текущей высоте, а не с прошлым замером: ленивый
   * контент меняет высоту страницы между проходами.
   */
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' }));
  const expectedAngle = () =>
    page.evaluate(() => {
      const travel = document.documentElement.scrollHeight - window.innerHeight;
      return travel > 0 ? (window.scrollY / travel) * 45 : 0;
    });
  await expect
    .poll(async () => Math.abs((await angle()) - (await expectedAngle())))
    .toBeLessThan(0.5);
  expect(await angle()).toBeGreaterThan(1);
});

/*
 * Горизонтальная лента направлений: pinned-секция, едет вбок при вертикальном
 * скролле. Проверяются обе стороны: лента реально сдвигается по прогрессу И
 * высота секции даёт запас прокрутки, из которого прогресс считается. Вне
 * эффекта (touch, reduced-motion, без JS) секция остаётся обычной сеткой —
 * sticky и запас высоты не включаются, это проверяет reduced-motion-тест ниже.
 */
test('Лента направлений едет вбок при вертикальном скролле', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Лента включается только от 1024px, ниже — обычная сетка');
  await page.goto(HOME);
  const rail = page.locator('[data-slot="style-rail"]');
  await expect(rail).toBeAttached();

  /*
   * Предмет проверки — сам сдвиг трека. Меряется положение плитки в окне:
   * к концу проезда последняя плитка обязана доехать до правой кромки.
   * Разбирать computed translate бессмысленно — он остаётся строкой calc().
   */
  const lastTileLeft = () =>
    rail.evaluate((node) => {
      const items = node.querySelectorAll<HTMLElement>('[data-rail-track] li');
      const last = items[items.length - 1];
      return last ? last.getBoundingClientRect().right : Number.NaN;
    });

  const top = await rail.evaluate((node) => node.getBoundingClientRect().top + window.scrollY);
  const viewport = page.viewportSize()?.height ?? 900;

  const firstTileCenter = () =>
    rail.evaluate((node) => {
      const first = node.querySelector<HTMLElement>('[data-rail-track] li');
      return first ? first.getBoundingClientRect().left + first.getBoundingClientRect().width / 2 : Number.NaN;
    });

  /* Начало: первая плитка стоит центром окна, а последняя ещё за правой кромкой. */
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  const viewportWidth = await rail.evaluate(() => window.innerWidth);
  await expect.poll(() => firstTileCenter()).toBeCloseTo(viewportWidth / 2, 0);
  await expect.poll(() => lastTileLeft()).toBeGreaterThan(viewportWidth);

  /* На середине измеряем реальное положение трека, а не только CSS-переменную. */
  const height = await rail.evaluate((node) => (node as HTMLElement).offsetHeight);
  await page.evaluate(
    ({ y, half }) => window.scrollTo({ top: y + half / 2, behavior: 'instant' }),
    { y: top, half: height - viewport },
  );
  await expect.poll(() => firstTileCenter()).toBeLessThan(viewportWidth / 2 - 80);

  /* Конец запаса: последняя плитка также приходит центром в центр окна. */
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: 'instant' }),
    top + height - viewport,
  );
  const lastTileCenter = () =>
    rail.evaluate((node) => {
      const items = node.querySelectorAll<HTMLElement>('[data-rail-track] li');
      const last = items[items.length - 1];
      return last ? last.getBoundingClientRect().left + last.getBoundingClientRect().width / 2 : Number.NaN;
    });
  await expect.poll(() => lastTileCenter()).toBeCloseTo(viewportWidth / 2, 0);
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
