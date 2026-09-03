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

  test('кадр перекрывает контейнер в каждой фазе сдвига', async ({ page }) => {
    await page.goto(HOME);
    await expect(heroVideo(page)).toHaveCount(1);

    /*
     * Сдвиг задаётся напрямую, а не выжидается по часам.
     *
     * Проверяемое свойство — геометрическое: при любом смещении в пределах
     * `slidePercent` правый край кадра обязан оставаться за границей контейнера.
     * Раньше тест ждал реальный четырнадцатисекундный цикл и брал шесть замеров
     * «на глазок»: он не покрывал крайнюю фазу, зависел от загруженности машины
     * и на занятом раннере падал без дефекта. Здесь перебираются все фазы,
     * включая крайнюю, и проверка занимает миллисекунды.
     *
     * Заодно это работает на всех ширинах: сам цикл сдвига живёт только от
     * 1024px, но ширина обёртки — общий CSS, и связка чисел обязана держаться
     * везде.
     */
    const gaps = await page.evaluate((slidePercent) => {
      const wrap = document.querySelector<HTMLElement>('.hero-video-wrap');
      const video = document.querySelector('.hero-video-wrap > video');
      if (!wrap || !video) return null;

      const limit = document.documentElement.clientWidth;
      const original = wrap.style.transform;
      const originalTransition = wrap.style.transition;
      /* Без перехода: замер должен относиться к заданной фазе, а не к пути к ней. */
      wrap.style.transition = 'none';

      const steps = 10;
      const measured: number[] = [];
      for (let step = 0; step <= steps; step += 1) {
        wrap.style.transform = `translateX(-${(slidePercent * step) / steps}%)`;
        measured.push(Math.round(limit - video.getBoundingClientRect().right));
      }

      wrap.style.transform = original;
      wrap.style.transition = originalTransition;
      return measured;
    }, motion.heroGhostTrail.slidePercent);

    expect(gaps, 'кадр первого экрана не найден').not.toBeNull();
    expect(
      Math.max(...gaps!),
      `зазоры справа по фазам сдвига: ${gaps!.join(', ')}`,
    ).toBeLessThanOrEqual(0);
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
    /*
     * Проверка идёт по живому циклу: копии рождаются раз в 900ms и живут пять
     * секунд, и подделать это временем нельзя — предел проверяется именно на
     * работающем цикле. Отсюда `slow`: тест по своей природе длинный, и на
     * занятой машине первая копия появляется не в первую секунду.
     */
    test.slow();
    await page.goto(HOME);

    const wideEnough =
      (page.viewportSize()?.width ?? 0) >= videoProcessing.heroLoop.ghostTrailMinViewportWidth;
    test.skip(!wideEnough, 'Шлейф включается только на широких экранах');

    /* Копии появляются не сразу: цикл стартует после первого кадра петли. */
    await expect
      .poll(() => ghosts(page).count(), { timeout: 25_000 })
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
