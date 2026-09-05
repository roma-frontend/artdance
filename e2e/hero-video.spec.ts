/**
 * Раскрытие занавеса на первом экране.
 *
 * Проверяется не «эффект красивый», а те свойства, потеря которых превращает приём
 * в дефект и при этом не видна на скриншоте:
 *
 *   • позиция клипа во времени равна доле пройденной полосы разгона — иначе
 *     раскрытие либо не доходит до конца, либо проскакивает его;
 *   • клип НЕ проигрывается сам: движение существует только как следствие
 *     действия пользователя (этим и закрывается WCAG 2.2.2);
 *   • раскрытие обратимо — прокрутка вверх закрывает занавес;
 *   • хвостовое укрупнение не выходит за предел, за которым начинается
 *     растягивание пикселей;
 *   • при просьбе убрать движение полосы разгона нет вовсе и остаётся постер.
 *
 * Числа не дублируются: тест берёт их из `motion.heroParallax` и
 * `videoProcessing.heroLoop`, то есть из того же места, что и компоненты.
 */

import { expect, test, type Page } from '@playwright/test';

import { motion } from '../src/design/motion';
import { videoProcessing } from '../src/config/media-processing';

const HOME = '/en';

/**
 * Прямой клип. Селектор по роли, а не по вложенности: в обёртке кадра лежат ДВА
 * видеоэлемента — прямой и перевёрнутый для обратного прохода.
 */
const heroVideo = (page: Page) => page.locator('[data-slot="hero-clip"]');
const heroStage = (page: Page) => page.locator('[data-hero-stage]');

/** Прокрутить на заданную долю прохода первого экрана. */
async function scrollToProgress(page: Page, progress: number): Promise<void> {
  await page.evaluate((value) => {
    const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
    if (!stage) throw new Error('обёртка первого экрана не найдена');
    const travel = stage.getBoundingClientRect().height;
    window.scrollTo({ top: stage.offsetTop + travel * value, behavior: 'instant' });
  }, progress);
}

/** Доля пройденного прохода прямо сейчас. */
async function revealProgress(page: Page): Promise<number> {
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
    if (!stage) return Number.NaN;
    const rect = stage.getBoundingClientRect();
    return Math.min(Math.max(-rect.top / rect.height, 0), 1);
  });
}

/** Время в клипе как доля его длительности. */
async function timeFraction(page: Page): Promise<number> {
  return heroVideo(page).evaluate((node: HTMLVideoElement) =>
    Number.isFinite(node.duration) && node.duration > 0 ? node.currentTime / node.duration : Number.NaN,
  );
}

async function wrapScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const wrap = document.querySelector<HTMLElement>('.hero-video-wrap');
    if (!wrap) return Number.NaN;
    const match = /scale\(([\d.]+)\)/.exec(wrap.style.transform);
    return match ? Number.parseFloat(match[1]!) : 1;
  });
}

test.describe('раскрытие занавеса', () => {
  test('кадр декоративен и не участвует в навигации', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect(video).toHaveCount(1);
    await expect(video).toHaveAttribute('aria-hidden', 'true');
    await expect(video).toHaveAttribute('tabindex', '-1');

    /* Кнопки управления движением нет: движения без действия пользователя нет. */
    await expect(page.locator('[data-slot="hero-video-toggle"]')).toHaveCount(0);
  });

  test('полоса разгона даёт раскрытию ход прокрутки', async ({ page }) => {
    await page.goto(HOME);

    /*
     * Главное свойство геометрии: обёртка выше окна ровно на объявленную полосу
     * разгона. Без неё занавес открывался бы уже за кромкой окна — именно тот
     * дефект, из-за которого раскрытие и вынесли из видео в прокрутку.
     */
    const measured = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
      if (!stage) return null;
      return {
        stage: stage.getBoundingClientRect().height,
        viewport: window.innerHeight,
      };
    });

    expect(measured, 'обёртка первого экрана не найдена').not.toBeNull();
    const expected = measured!.viewport * (1 + motion.heroParallax.revealRunwayViewports);
    /*
     * Допуск в 5%: высота задана в `dvh`, а `innerHeight` в мобильных браузерах
     * отличается от него на высоту адресной строки. Проверяется порядок величины,
     * а не пиксель: дефект, который тест ловит, — это отсутствие полосы разгона
     * вовсе, а не расхождение в единицах измерения.
     */
    expect(Math.abs(measured!.stage - expected) / expected).toBeLessThan(0.05);
  });

  test('позиция в клипе следует за прокруткой и возвращается назад', async ({ page }) => {
    await page.goto(HOME);
    await expect(heroVideo(page)).toHaveCount(1);

    /* Клип обязан быть готов к перемотке: без загруженных данных перематывать нечего. */
    await expect
      .poll(
        () => heroVideo(page).evaluate((node: HTMLVideoElement) => node.readyState),
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(2);

    expect(await timeFraction(page)).toBeLessThan(0.05);

    /*
     * Прокрутка задаётся программно, а не колесом: доигрывание вооружается
     * ЖЕСТОМ, поэтому программная прокрутка позволяет проверить саму связь
     * «позиция страницы — позиция в клипе» без вмешательства доигрывания.
     * Доигрыванию посвящена отдельная проверка ниже.
     *
     * Ожидание с запасом по времени — из-за инерции: позиция догоняет цель за
     * несколько кадров анимации, а не встаёт в неё мгновенно.
     */
    for (const reveal of [0.35, 0.7, 1]) {
      await scrollToProgress(page, reveal);
      await expect.poll(() => timeFraction(page), { timeout: 15_000 }).toBeGreaterThan(reveal - 0.1);
      expect(await timeFraction(page)).toBeLessThan(reveal + 0.1);
    }

    /* Раскрытие обратимо: жест назад закрывает занавес. */
    await scrollToProgress(page, 0);
    await expect.poll(() => timeFraction(page), { timeout: 15_000 }).toBeLessThan(0.05);
  });

  test('один жест доигрывает раскрытие до конца, обратный — до закрытого занавеса', async ({
    page,
  }) => {
    test.slow();
    await page.goto(HOME);
    await expect
      .poll(
        () => heroVideo(page).evaluate((node: HTMLVideoElement) => node.readyState),
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(2);

    /*
     * Главное свойство приёма: промежуточных положений не существует. Короткий
     * толчок колеса — это меньше десятой части пути, и без доигрывания первый экран
     * навсегда остался бы полуоткрытым занавесом, то есть кадром, которого в
     * замысле нет.
     */
    await page.mouse.wheel(0, 120);

    await expect
      .poll(() => revealProgress(page), {
        timeout: motion.heroParallax.revealLockTimeoutMs + 10_000,
      })
      .toBeGreaterThan(0.99);
    /* Клип обязан доехать вместе со страницей, а не остаться позади. */
    await expect.poll(() => timeFraction(page), { timeout: 15_000 }).toBeGreaterThan(0.93);

    /* Обратный жест возвращает к закрытому занавесу так же целиком. */
    await page.mouse.wheel(0, -120);

    await expect
      .poll(() => revealProgress(page), {
        timeout: motion.heroParallax.revealLockTimeoutMs + 10_000,
      })
      .toBeLessThan(0.01);
    await expect.poll(() => timeFraction(page), { timeout: 15_000 }).toBeLessThan(0.05);
  });

  test('последний кадр приходит одновременно со второй секцией', async ({ page }) => {
    await page.goto(HOME);
    await expect
      .poll(
        () => heroVideo(page).evaluate((node: HTMLVideoElement) => node.readyState),
        { timeout: 30_000 },
      )
      .toBeGreaterThanOrEqual(2);

    /*
     * Требование заказчика: конец видео и приход второй секции — один момент, а не
     * два движения подряд. Проверяется совпадение: на конце прохода клип на
     * последнем кадре, а первый экран полностью отдал окно следующей секции.
     */
    await scrollToProgress(page, 1);
    await expect.poll(() => timeFraction(page), { timeout: 15_000 }).toBeGreaterThan(0.93);

    const bottom = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
      return stage ? stage.getBoundingClientRect().bottom : null;
    });

    expect(bottom, 'обёртка первого экрана не найдена').not.toBeNull();
    /* Нижняя кромка первого экрана — у верхней кромки окна: дальше только вторая секция. */
    expect(Math.abs(bottom!)).toBeLessThan(4);
  });

  test('клип не проигрывается сам', async ({ page }) => {
    await page.goto(HOME);

    const video = heroVideo(page);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);

    /*
     * Прогрев декодера коротко запускает воспроизведение и сразу его
     * останавливает — иначе Safari на iOS не отдаёт кадры по `currentTime`.
     * Проверяется итог: элемент стоит на паузе и время само не растёт.
     */
    await expect.poll(() => video.evaluate((node: HTMLVideoElement) => node.paused)).toBe(true);

    const before = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
    await page.waitForTimeout(1_500);
    const after = await video.evaluate((node: HTMLVideoElement) => node.currentTime);
    expect(after).toBeCloseTo(before, 2);
  });

  test('хвостовое укрупнение не выходит за предел резкости', async ({ page }) => {
    await page.goto(HOME);

    const { tailZoom, tailZoomFromProgress } = motion.heroParallax;

    /* До порога укрупнения кадр в натуральном масштабе. */
    await scrollToProgress(page, tailZoomFromProgress / 2);
    await expect.poll(() => wrapScale(page)).toBeCloseTo(1, 2);

    await scrollToProgress(page, 1);
    await expect.poll(() => wrapScale(page)).toBeCloseTo(tailZoom, 2);

    /*
     * Предел не абстрактный: широкая версия кадра 1920, и увеличение выше
     * `1920 / ширина окна` растягивает пиксели. Проверяется, что объявленный
     * предел этого не допускает на окне теста.
     */
    const widest = videoProcessing.heroLoop.renditions.at(-1)!.width;
    const viewport = page.viewportSize()?.width ?? widest;
    expect(widest / tailZoom).toBeGreaterThanOrEqual(Math.min(viewport, widest) * 0.95);
  });

  test('при просьбе убрать движение остаётся постер и нет полосы разгона', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    /* Ни клипа, ни разгона: экран остаётся статичным изображением высотой в окно. */
    await expect(heroVideo(page)).toHaveCount(0);

    const collapsed = await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
      if (!stage) return null;
      return stage.getBoundingClientRect().height / window.innerHeight;
    });
    expect(collapsed, 'обёртка первого экрана не найдена').not.toBeNull();
    expect(collapsed!).toBeLessThan(1 + motion.heroParallax.revealRunwayViewports / 2);

    /* Постер при этом на месте — это полноценное состояние экрана. */
    await expect(heroStage(page).locator('img').first()).toBeVisible();
  });
});
