/**
 * Фоновая петля заявления бренда («EVERY BODY HAS A RHYTHM. FIND YOURS.»).
 *
 * Петля добавлена по просьбе заказчика поверх утверждённого макета, где на этом
 * месте статичный кадр. Отсюда состав проверок: они держат не «видео на месте»,
 * а те три свойства, потеря которых превращает эффект в дефект.
 *
 * 1. **Трафик.** Секция лежит ниже первого экрана, и файл обязан начинать
 *    качаться только на подходе. Ошибка здесь не видна глазами вовсе: страница
 *    выглядит так же, просто каждый посетитель платит за петлю, до которой может
 *    не долистать. Проверяется по сетевым запросам, а не по атрибутам.
 * 2. **Постер.** Он показывается до старта, при `prefers-reduced-motion` и при
 *    экономии данных, то есть является полноценным состоянием секции. Если он
 *    исчезнет, на время загрузки секция станет чёрным прямоугольником.
 * 3. **Пауза вне вида.** Полноэкранное декодирование 24 кадров в секунду для
 *    секции, которая уехала вверх, — это кадры прокрутки и батарея.
 */

import { expect, test, type Page } from '@playwright/test';

import { videoProcessing } from '../src/config/media-processing';
import en from '../src/i18n/messages/en';

const HOME = '/en';

/**
 * Запросы именно к файлам петли.
 *
 * Путь, а не одно имя: постер называется `editorial-loop-poster` и лежит среди
 * изображений, поэтому проверка «в URL есть имя петли» считала бы его загрузку
 * загрузкой видео. Он и должен грузиться — он показывается до старта.
 */
const LOOP_URL = `/media/video/${videoProcessing.editorialLoop.baseName}`;

const editorialSection = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { name: en.home.editorial.titleAccent }) });

const editorialVideo = (page: Page) => page.locator('.editorial-video');
const editorialPoster = (page: Page) => page.locator('[data-slot="editorial-backdrop"] img');

/**
 * Прокрутить к секции и дождаться, пока петля пойдёт.
 *
 * Именно `data-playing`, а не появление элемента: атрибут ставится, когда
 * воспроизведение действительно началось, и он же включает проявление кадра.
 */
async function scrollToEditorial(page: Page): Promise<void> {
  await editorialSection(page).scrollIntoViewIfNeeded();
  await expect(editorialVideo(page)).toHaveAttribute('data-playing', '', { timeout: 25_000 });
}

test.describe('петля заявления бренда', () => {
  test('постер на месте до того, как петля пошла', async ({ page }) => {
    await page.goto(HOME);

    /*
     * Постер существует с первого кадра разметки и не убирается никогда: видео
     * проявляется ПОВЕРХ него. Поэтому проверка идёт до прокрутки — в состоянии,
     * когда петля ещё даже не выбрана.
     */
    await expect(editorialPoster(page)).toHaveCount(1);
  });

  test('файл не качается, пока секция далеко', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes(LOOP_URL)) requested.push(request.url());
    });

    await page.goto(HOME);

    /*
     * Гидратация состоялась и компонент решил, что петля играбельна: элемент
     * `<video>` уже в разметке. Это точка, в которой проверка осмысленна — если
     * ждать просто «после goto», пустой список запросов мог бы означать «ещё не
     * успело», а не «не качается».
     */
    await expect(editorialVideo(page)).toHaveCount(1);

    /*
     * Проверка имеет смысл только если секция дальше запаса упреждения. На
     * коротком экране с высокими секциями это всегда так, но условие проверяется,
     * а не предполагается: иначе тест однажды начнёт падать из-за вёрстки, а не
     * из-за загрузки.
     */
    const beyondPreload = await editorialSection(page).evaluate(
      (node, factor) => node.getBoundingClientRect().top > window.innerHeight * (1 + factor),
      videoProcessing.preloadAheadViewportFactor,
    );
    test.skip(!beyondPreload, 'Секция ближе запаса упреждения — проверять нечего');

    expect(
      requested,
      'петля начала качаться при загрузке страницы, хотя секция ещё далеко',
    ).toEqual([]);
    /* Источника нет — значит и качать нечего: причина, а не только следствие. */
    await expect(editorialVideo(page)).not.toHaveAttribute('src', /.+/);

    /* А на подходе — качается: иначе кадр оживал бы уже на глазах у зрителя. */
    await scrollToEditorial(page);
    expect(requested.length).toBeGreaterThan(0);
  });

  test('петля играет, когда секция видна, и молчит без звука', async ({ page }) => {
    test.slow();
    await page.goto(HOME);
    await scrollToEditorial(page);

    const video = editorialVideo(page);

    /* Фон не участвует в навигации и не читается скринридером. */
    await expect(video).toHaveAttribute('aria-hidden', 'true');
    await expect(video).toHaveAttribute('tabindex', '-1');

    /* Дорожка звука удалена при кодировании, а элемент вдобавок muted. */
    expect(await video.evaluate((node: HTMLVideoElement) => node.muted)).toBe(true);

    /* Воспроизведение действительно началось, а не осталось на первом кадре. */
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime), { timeout: 15_000 })
      .toBeGreaterThan(0);
  });

  test('петля не декодируется, когда секция ушла из вида', async ({ page }) => {
    test.slow();
    await page.goto(HOME);
    await scrollToEditorial(page);

    const video = editorialVideo(page);
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime), { timeout: 15_000 })
      .toBeGreaterThan(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    /* Пауза приходит через IntersectionObserver — даём браузеру кадр на решение. */
    await expect
      .poll(() => video.evaluate((node: HTMLVideoElement) => node.paused), { timeout: 10_000 })
      .toBe(true);
  });

  test('кадр перекрывает секцию целиком', async ({ page }) => {
    await page.goto(HOME);
    await scrollToEditorial(page);

    /*
     * Кадр растворён к краям маской, поэтому «дырку» у кромки на скриншоте не
     * увидеть: край и должен быть прозрачным. Проверяется геометрия — рамка
     * видео обязана накрывать рамку секции, иначе при параллаксе (кадр уходит на
     * 200px) у кромки открывается полоса чистого фона.
     */
    const gaps = await editorialSection(page).evaluate((section) => {
      const video = section.querySelector('.editorial-video');
      if (!video) return null;
      const outer = section.getBoundingClientRect();
      const inner = video.getBoundingClientRect();
      return {
        top: Math.round(outer.top - inner.top),
        left: Math.round(outer.left - inner.left),
        right: Math.round(inner.right - outer.right),
        bottom: Math.round(inner.bottom - outer.bottom),
      };
    });

    expect(gaps, 'кадр editorial-секции не найден').not.toBeNull();
    for (const [side, value] of Object.entries(gaps!)) {
      expect(value, `кадр не покрывает секцию со стороны «${side}»`).toBeGreaterThanOrEqual(0);
    }
  });

  test('при просьбе убрать движение остаётся только постер', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    await editorialSection(page).scrollIntoViewIfNeeded();

    /* Петли нет вовсе — решение принимается в компоненте, а не гасится в CSS. */
    await expect(editorialVideo(page)).toHaveCount(0);
    /* Постер при этом на месте: это полноценное состояние секции. */
    await expect(editorialPoster(page)).toBeVisible();
  });
});
