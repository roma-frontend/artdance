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
     * Предел важнее самого эффекта: каждая копия — отдельный слой, и бесконечно
     * растущий список означал бы просадку кадров и нагрев.
     */
    for (let index = 0; index < 8; index += 1) {
      expect(await ghosts(page).count()).toBeLessThanOrEqual(
        videoProcessing.heroLoop.ghostTrailMax,
      );
      await page.waitForTimeout(900);
    }
  });

  test('копия шлейфа — снимок кадра, а не второй декодер', async ({ page }) => {
    /*
     * Главное решение по производительности первого экрана, и его легко потерять
     * при возврате «как в макете»: там копии — настоящие `<video>`, то есть до
     * семи параллельных декодов одного файла. Аппаратный декодер обрабатывает
     * один поток, остальные уходят на процессор, и фон начинает дёргаться вместе
     * со всей прокруткой. Проверяется факт: у первого экрана ровно один
     * видеоэлемент, а копии — растры.
     *
     * Счёт идёт по видеоэлементам ПЕРВОГО ЭКРАНА: с 04.09.2026 своя петля есть и
     * у заявления бренда (`editorial-video.spec.ts`), и проверка «на странице один
     * <video>» ловила бы её, хотя к шлейфу она не относится.
     */
    test.slow();
    await page.goto(HOME);

    const wideEnough =
      (page.viewportSize()?.width ?? 0) >= videoProcessing.heroLoop.ghostTrailMinViewportWidth;
    test.skip(!wideEnough, 'Шлейф включается только на широких экранах');

    await expect.poll(() => ghosts(page).count(), { timeout: 25_000 }).toBeGreaterThan(0);

    await expect(page.locator('.hero-ghost > canvas').first()).toHaveCount(1);
    await expect(page.locator('video:not(.editorial-video)')).toHaveCount(1);
  });

  test('петля не декодируется, когда первый экран ушёл из вида', async ({ page }) => {
    /*
     * Декодирование — самая дорогая работа на странице, и по умолчанию браузер
     * продолжает её, пока элемент существует: пользователь читает подвал, а
     * процессор всё ещё разбирает 25 кадров в секунду для экрана, которого не
     * видно. Проверяется, что время воспроизведения перестаёт расти.
     */
    test.slow();
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime), { timeout: 25_000 })
      .toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 3));
    /* Пауза приходит через IntersectionObserver — даём браузеру кадр на решение. */
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.paused), { timeout: 10_000 })
      .toBe(true);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.paused), { timeout: 10_000 })
      .toBe(false);
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
