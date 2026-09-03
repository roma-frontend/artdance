/**
 * Параллакс первого экрана и секции-заявления.
 *
 * Проверяется не «эффект красивый», а три проверяемых свойства:
 *   • слои двигаются с РАЗНОЙ скоростью — иначе это не параллакс, а прокрутка;
 *   • у hero содержимое уходит быстрее фона и гаснет, затемнение растворяется;
 *     у editorial скорость убывает от кадра к заголовку;
 *   • при просьбе убрать движение не двигается ничего.
 *
 * Значения коэффициентов не дублируются: тест берёт их из `motion.heroParallax`
 * и `motion.sectionParallax`, то есть из того же места, что и компоненты.
 */

import { expect, test, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';
import { motion } from '../src/design/motion';

const HOME = '/en';

/**
 * Сдвиг по вертикали, объявленный компонентом.
 *
 * Читается инлайновый стиль, а не матрица `transform`: у фона первого экрана
 * есть ещё и `scale`, и в итоговой матрице сдвиг оказывается умноженным на
 * масштаб (90px при масштабе 1.13 читаются как 101.7). Для проверки
 * коэффициентов нужно именно то значение, которое написал компонент.
 */
async function declaredTranslateY(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const node = document.querySelector<HTMLElement>(sel);
    if (!node) return Number.NaN;
    const match = /translateY\((-?[\d.]+)px\)/.exec(node.style.transform);
    return match ? Number.parseFloat(match[1]!) : 0;
  }, selector);
}

async function opacityOf(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const node = document.querySelector(sel);
    return node ? Number.parseFloat(getComputedStyle(node).opacity) : Number.NaN;
  }, selector);
}

test.describe('параллакс первого экрана', () => {
  test('фон и содержимое уходят с разной скоростью, затемнение гаснет', async ({ page }) => {
    await page.goto(HOME);

    const background = '[data-parallax="background"]';
    const content = '[data-parallax="content"]';
    const overlay = '[data-parallax="overlay"]';

    expect(await declaredTranslateY(page, content)).toBeCloseTo(0, 0);

    const scrollBy = 300;
    await page.evaluate((value) => window.scrollTo({ top: value }), scrollBy);
    /* Один кадр на применение стилей. */
    await expect.poll(() => declaredTranslateY(page, content)).not.toBeCloseTo(0, 0);

    const backgroundShift = await declaredTranslateY(page, background);
    const contentShift = await declaredTranslateY(page, content);

    /*
     * Фон идёт ВНИЗ (положительный сдвиг) медленнее, содержимое — ВВЕРХ
     * (отрицательный) быстрее. Именно разнонаправленность создаёт глубину.
     */
    expect(backgroundShift).toBeGreaterThan(0);
    expect(contentShift).toBeLessThan(0);
    expect(Math.abs(contentShift)).toBeGreaterThan(Math.abs(backgroundShift));

    /* Коэффициенты — те же, что в конфигурации движения. */
    expect(backgroundShift).toBeCloseTo(scrollBy * motion.heroParallax.backgroundFactor, 0);
    expect(contentShift).toBeCloseTo(scrollBy * motion.heroParallax.contentFactor, 0);

    /* Содержимое и затемнение гаснут по мере ухода экрана. */
    expect(await opacityOf(page, content)).toBeLessThan(1);
    expect(await opacityOf(page, overlay)).toBeLessThan(1);
  });

  test('при просьбе убрать движение слои не двигаются', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    await page.evaluate(() => window.scrollTo({ top: 300 }));
    await page.waitForTimeout(300);

    expect(await declaredTranslateY(page, '[data-parallax="content"]')).toBeCloseTo(0, 0);
    expect(await opacityOf(page, '[data-parallax="content"]')).toBeCloseTo(1, 1);
  });
});

test.describe('параллакс editorial-секции', () => {
  test('три слоя идут с разной скоростью, пока секция проходит через экран', async ({ page }) => {
    await page.goto(HOME);

    const heading = page.getByRole('heading', { level: 2 }).filter({
      hasText: en.home.editorial.titleAccent,
    });
    await heading.scrollIntoViewIfNeeded();

    const wide = (page.viewportSize()?.width ?? 0) >= motion.sectionParallax.minViewportWidth;
    test.skip(!wide, 'На узком экране параллакс секции выключен намеренно');

    /*
     * Селекторы вложены в обёртку секции: имена ролей те же, что у первого
     * экрана, и без этого уточнения `[data-parallax="background"]` нашёл бы hero.
     */
    const scope = '[data-slot="section-parallax"] ';
    const background = `${scope}[data-parallax="background"]`;
    const content = `${scope}[data-parallax="content"]`;
    const headingLayer = `${scope}[data-parallax="heading"]`;

    const before = {
      background: await declaredTranslateY(page, background),
      content: await declaredTranslateY(page, content),
      heading: await declaredTranslateY(page, headingLayer),
    };

    await page.evaluate(() => window.scrollBy({ top: 400 }));
    await expect.poll(() => declaredTranslateY(page, background)).not.toBeCloseTo(before.background, 1);

    const after = {
      background: await declaredTranslateY(page, background),
      content: await declaredTranslateY(page, content),
      heading: await declaredTranslateY(page, headingLayer),
    };

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
});
