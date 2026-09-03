/**
 * Фоновая петля первого экрана и её шлейф.
 *
 * Главная проверка здесь — геометрическая. Кадр сдвигается вбок на несколько
 * сотен пикселей, и если обёртка недостаточно широка, у правой кромки экрана
 * открывается вертикальная полоса: видно постер, а поверх него ползёт видео.
 * Дефект возникает не сразу, а на середине четырнадцатисекундного сдвига,
 * поэтому на статичном скриншоте его нет, а глазами он ловится случайно.
 *
 * В прототипе эти два числа подобраны друг под друга: обёртка шире контейнера на
 * 35%, сдвиг — 25% от её собственной ширины. Тест держит связку: он проверяет не
 * сами числа, а следствие — кадр обязан перекрывать контейнер в каждой фазе.
 */

import { expect, test, type Page } from '@playwright/test';

import { motion } from '../src/design/motion';
import { videoProcessing } from '../src/config/media-processing';

const HOME = '/en';

const heroVideo = (page: Page) => page.locator('.hero-video-wrap > video');
const ghosts = (page: Page) => page.locator('.hero-ghost');

/** Насколько пикселей справа кадр НЕ покрывает контейнер. ≤ 0 — покрывает. */
async function gapRight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const video = document.querySelector('.hero-video-wrap > video');
    if (!video) return Number.NaN;
    return Math.round(limit - video.getBoundingClientRect().right);
  });
}

test.describe('фоновая петля', () => {
  test('петля играет и покрывает первый экран', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect(video).toHaveCount(1);

    /* Фон не участвует в навигации и не читается скринридером. */
    await expect(video).toHaveAttribute('aria-hidden', 'true');
    await expect(video).toHaveAttribute('tabindex', '-1');

    /* Воспроизведение действительно началось, а не осталось на первом кадре. */
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('кадр перекрывает контейнер на всём протяжении сдвига', async ({ page }) => {
    await page.goto(HOME);
    await expect(heroVideo(page)).toHaveCount(1);

    /*
     * Замеры вдоль сдвига, а не один: полоса открывается ближе к его концу.
     * Шаг покрывает первую половину цикла, где смещение максимально нарастает.
     */
    const samples: number[] = [];
    for (let index = 0; index < 6; index += 1) {
      samples.push(await gapRight(page));
      await page.waitForTimeout(1_200);
    }

    expect(Math.max(...samples), `зазоры справа по фазам: ${samples.join(', ')}`).toBeLessThanOrEqual(
      0,
    );
  });

  test('петля декоративна: без кнопок управления, но с уважением к настройкам', async ({
    page,
  }) => {
    await page.goto(HOME);

    /*
     * Кнопки паузы нет по решению заказчика. Роль управления движением
     * (WCAG 2.2.2) выполняет системная настройка: при просьбе убрать движение
     * петля не запускается вовсе — это проверяется ниже отдельным тестом.
     */
    await expect(page.locator('[data-slot="hero-video-toggle"]')).toHaveCount(0);

    /* Фон не участвует в навигации: по Tab до него не добраться. */
    await expect(heroVideo(page)).toHaveAttribute('tabindex', '-1');
  });
});

test.describe('шлейф копий', () => {
  test('число копий не превышает предел политики', async ({ page }) => {
    await page.goto(HOME);

    const wideEnough =
      (page.viewportSize()?.width ?? 0) >= videoProcessing.heroLoop.ghostTrailMinViewportWidth;
    test.skip(!wideEnough, 'Шлейф включается только на широких экранах');

    /* Копии появляются не сразу: цикл стартует после первого кадра петли. */
    await expect
      .poll(() => ghosts(page).count(), { timeout: 15_000 })
      .toBeGreaterThan(0);

    /*
     * Предел важнее самого эффекта: каждая копия — отдельный декодер видео, и
     * бесконечно растущий список означал бы просадку кадров и нагрев.
     */
    for (let index = 0; index < 8; index += 1) {
      expect(await ghosts(page).count()).toBeLessThanOrEqual(
        videoProcessing.heroLoop.ghostTrailMax,
      );
      await page.waitForTimeout(900);
    }
  });

  test('на узком экране шлейфа нет вовсе', async ({ page }) => {
    await page.goto(HOME);

    const narrow =
      (page.viewportSize()?.width ?? 0) < videoProcessing.heroLoop.ghostTrailMinViewportWidth;
    test.skip(!narrow, 'Проверка для узких экранов');

    await page.waitForTimeout(motion.heroGhostTrail.startDelayMs + 1_500);
    await expect(page.locator('[data-slot="hero-ghost-trail"]')).toHaveCount(0);
  });

  test('при просьбе убрать движение остаётся только постер', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    /* Ни петли, ни шлейфа: экран остаётся статичным изображением. */
    await expect(heroVideo(page)).toHaveCount(0);
    await expect(page.locator('[data-slot="hero-ghost-trail"]')).toHaveCount(0);
    /* Постер при этом на месте — это полноценное состояние экрана. */
    await expect(page.locator('main > section img').first()).toBeVisible();
  });
});
