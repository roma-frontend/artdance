/**
 * Живая фоновая петля первого экрана.
 *
 * Проверяется не «эффект красивый», а те свойства, потеря которых превращает приём
 * в дефект и при этом не видна на скриншоте:
 *
 *   • петля играет сама и закольцована — движение не требует действия
 *     пользователя и не останавливается на последнем кадре;
 *   • пауза вне видимости — декодирование самого дорогого кадра страницы
 *     продолжать за экраном означает греть процессор впустую;
 *   • кадр декоративен и не участвует в навигации;
 *   • постер на месте при просьбе убрать движение;
 *   • первый экран — обычная секция высотой в одно окно: занавес удалён
 *     21.09.2026, и возврат полосы разгона или приколотого экрана случайной
 *     правкой вёрстки должен быть пойман.
 *
 * Числа не дублируются: тест берёт их из `videoProcessing.heroLoop`, то есть из
 * того же места, что и компоненты.
 */

import { expect, test, type Page } from '@playwright/test';

import { videoProcessing } from '../src/config/media-processing';

const HOME = '/en';

const heroVideo = (page: Page) => page.locator('[data-slot="hero-clip"]');
const heroViewport = (page: Page) => page.locator('.hero-viewport');

test.describe('живая петля первого экрана', () => {
  test('кадр декоративен и не участвует в навигации', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute('aria-hidden', 'true');
    await expect(video).toHaveAttribute('tabindex', '-1');
    await expect(video).toHaveAttribute('loop', '');
  });

  test('петля играет сама', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);

    /* Старт по `canplay`, а не по первым байтам: иначе рывок на медленном соединении. */
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);

    /* Время растёт само — движение не ждёт прокрутки. */
    const before = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
    await page.waitForTimeout(1_000);
    const after = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
    expect(after).toBeGreaterThan(before);
  });

  test('вне видимости петля встаёт на паузу', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);

    /* Прокрутка дальше первого экрана: декодировать невидимое — трата батареи. */
    await page.evaluate(() =>
      window.scrollTo({ top: window.innerHeight * 2, behavior: 'instant' }),
    );
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);

    /* Возврат наверх возобновляет воспроизведение. */
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(false);
  });

  test('первый экран — одна высота окна без полосы разгона', async ({ page }) => {
    await page.goto(HOME);

    /*
     * Занавес удалён 21.09.2026. Возврат `.hero-stage` (две высоты окна) или
     * `position: sticky` случайной правкой означает возврат «один скролл — и
     * дожидайся видео», с которого и началась переделка.
     */
    const measured = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>('.hero-viewport');
      if (!hero) return null;
      return {
        height: hero.getBoundingClientRect().height,
        viewport: window.innerHeight,
        stageCount: document.querySelectorAll('[data-hero-stage]').length,
      };
    });

    expect(measured, 'первый экран не найден').not.toBeNull();
    expect(measured!.stageCount).toBe(0);
    /* Допуск 5% — dvh против innerHeight на мобильных отличается адресной строкой. */
    expect(Math.abs(measured!.height - measured!.viewport) / measured!.viewport).toBeLessThan(0.05);
  });

  test('видео укладывается в бюджет и длительность политики', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);

    const info = await video.evaluate((node: HTMLVideoElement) => ({
      duration: node.duration,
      muted: node.muted,
    }));

    /*
     * Клип не длиннее политики. Точнее `maxDurationSeconds` требовать нельзя:
     * после склейки шва петля короче исходника на длительность растворения.
     */
    expect(info.duration).toBeGreaterThan(0);
    expect(info.duration).toBeLessThanOrEqual(videoProcessing.heroLoop.maxDurationSeconds);
    expect(info.muted).toBe(true);
  });

  test('при просьбе убрать движение остаётся постер', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    /* Ни клипа, ни движения: экран остаётся статичным изображением. */
    await expect(heroVideo(page)).toHaveCount(0);

    /* Постер при этом на месте — это полноценное состояние экрана. */
    await expect(heroViewport(page).locator('img').first()).toBeVisible();
  });
});
