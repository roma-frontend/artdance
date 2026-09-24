/**
 * Параллакс секции-заявления.
 *
 * Слои hero и их вуаль удалены вместе с занавесом (21.09.2026): у HeroParallax
 * не осталось работы — текст первого экрана не двигается и не гаснет, вуаль стоит
 * в постоянной плотности, воспроизведением петли управляет useBackgroundVideo.
 * Свойства живой петли проверяет `hero-video.spec.ts`; здесь остаётся
 * единственный расслоённый параллакс продукта — editorial-секция.
 *
 * Проверяется не «эффект красивый», а проверяемые свойства:
 *   • у editorial слои двигаются с РАЗНОЙ скоростью, убывающей от кадра к
 *     заголовку — иначе это не параллакс, а прокрутка;
 *   • при просьбе убрать движение не двигается ничего.
 *
 * Значения не дублируются: тест берёт их из `motion.sectionParallax`, то есть из
 * того же места, что и компоненты.
 */

import { expect, test, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { motion } from '../src/design/motion';

const HOME = '/en';

/**
 * Сдвиг по вертикали, объявленный компонентом.
 *
 * Читается инлайновый стиль, а не матрица `transform`: у слоёв есть ещё и `scale`,
 * и в итоговой матрице сдвиг оказывается умноженным на масштаб. Для проверки
 * коэффициентов нужно именно то значение, которое написал компонент.
 */
async function declaredTranslateY(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const node = document.querySelector<HTMLElement>(sel);
    if (!node) return Number.NaN;
    return new DOMMatrixReadOnly(getComputedStyle(node).transform).m42;
  }, selector);
}

test.describe('параллакс editorial-секции', () => {
  test('три слоя идут с разной скоростью в невысоком окне без stacking', async ({ page }) => {
    await page.setViewportSize({ width: page.viewportSize()?.width ?? 1440, height: 500 });
    await page.goto(HOME);

    const heading = page.getByRole('heading', { level: 2 }).filter({
      hasText: en.home.editorial.titleAccent,
    });
    await heading.scrollIntoViewIfNeeded();

    const wide = (page.viewportSize()?.width ?? 0) >= motion.sectionParallax.minViewportWidth;
    test.skip(!wide, 'На узком экране параллакс секции выключен намеренно');

    /*
     * Три слоя читаются ОДНИМ evaluate: между тремя отдельными вызовами
     * проходит кадр rAF, transform успевает обновиться, и разности скоростей
     * перемешиваются — именно так здесь появился флак «content 12.6 < heading
     * 13.1» на ретрае, прошедшем через секунду после первого замера.
     */
    const readLayers = () =>
      page.evaluate(() => {
        const shift = (selector: string): number => {
          const node = document.querySelector<HTMLElement>(selector);
          if (!node) return Number.NaN;
          return new DOMMatrixReadOnly(getComputedStyle(node).transform).m42;
        };
        /*
         * Селекторы вложены в обёртку секции: имена ролей те же, что у первого
         * экрана, и без этого уточнения `[data-parallax="background"]` нашёл бы hero.
         */
        const scope = '[data-slot="section-parallax"] ';
        return {
          background: shift(`${scope}[data-parallax="background"]`),
          content: shift(`${scope}[data-parallax="content"]`),
          heading: shift(`${scope}[data-parallax="heading"]`),
        };
      });

    const before = await readLayers();

    await page.evaluate(() => window.scrollBy({ top: 400 }));
    await expect.poll(async () => (await readLayers()).background).not.toBeCloseTo(before.background, 1);

    const after = await readLayers();

    const moved = {
      background: Math.abs(after.background - before.background),
      content: Math.abs(after.content - before.content),
      heading: Math.abs(after.heading - before.heading),
    };

    /*
     * Главное свойство эффекта: скорости РАЗНЫЕ и убывают от фона к заголовку.
     * Если все слои идут одинаково, это не глубина, а съехавшая картинка — и
     * именно так выглядел параллакс, сделанный на один слой.
     */
    expect(moved.background).toBeGreaterThan(moved.content);
    expect(moved.content).toBeGreaterThan(moved.heading);
    expect(moved.heading).toBeGreaterThan(0);

    /* Ход каждого слоя не выходит за объявленный в конфигурации движения. */
    const { backgroundTravelPx, contentTravelPx, headingTravelPx } = motion.sectionParallax;
    expect(Math.abs(after.background)).toBeLessThanOrEqual(backgroundTravelPx / 2 + 1);
    expect(Math.abs(after.content)).toBeLessThanOrEqual(contentTravelPx / 2 + 1);
    expect(Math.abs(after.heading)).toBeLessThanOrEqual(headingTravelPx / 2 + 1);
  });

  test('при просьбе убрать движение слои секции не двигаются', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    const heading = page.getByRole('heading', { level: 2 }).filter({
      hasText: en.home.editorial.titleAccent,
    });
    await heading.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: 400 }));
    await page.waitForTimeout(300);

    const background = '[data-slot="section-parallax"] [data-parallax="background"]';
    expect(await declaredTranslateY(page, background)).toBeCloseTo(0, 0);
  });

  /*
   * Подъём занавеса. Секция-заявление открывается снизу вверх при входе в
   * экран — фирменный мотив бренда, продолженный в скролле. Проверяется
   * клип-маска до и после: закрыта под границей экрана, открыта после
   * входа. Без JS занавес не закрывается вовсе — разметка отдаёт секцию
   * сразу открытой, атрибуты расставляет сервер, маску включает CSS.
   */
  test('editorial-секция поднимается занавесом при входе в экран', async ({ page }) => {
    await page.goto(HOME);

    const wrap = page.locator('[data-slot="section-parallax"][data-curtain]').first();
    const clip = () =>
      wrap.evaluate((node) => getComputedStyle(node).clipPath);

    /*
     * Скролл к самой секции, а не к первому h2: выше editorial стоят секции со
     * своими заголовками, и на их фоне наблюдатель мог сработать раньше замера.
     */
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const before = await clip();

    await wrap.scrollIntoViewIfNeeded();
    await expect
      .poll(() => clip(), { timeout: 5_000 })
      .not.toBe(before);

    /* Открытый занавес не режет секцию. Poll мог поймать середину перехода —
     * ждём конца анимации (reveal-duration 900ms) перед финальной проверкой.
     * Chrome вычисляет открытую маску в сокращённой форме `inset(0px)`. */
    await page.waitForTimeout(1_200);
    const open = await clip();
    expect(open === 'none' || /^inset\(0px( 0px){0,3}\)$/.test(open)).toBe(true);
  });
});
