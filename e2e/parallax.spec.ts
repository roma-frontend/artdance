/**
 * Слои первого экрана и параллакс секции-заявления.
 *
 * Проверяется не «эффект красивый», а проверяемые свойства:
 *   • текст первого экрана НЕ двигается и НЕ гаснет — он виден до конца раскрытия;
 *   • вуаль под ним, наоборот, густеет: к развязке за текстом открытая сцена, и
 *     растворяющаяся вуаль означала бы ivory-заголовок на светлом фоне;
 *   • у editorial слои двигаются с РАЗНОЙ скоростью, убывающей от кадра к
 *     заголовку — иначе это не параллакс, а прокрутка;
 *   • при просьбе убрать движение не двигается ничего.
 *
 * Значения не дублируются: тест берёт их из `motion.heroParallax` и
 * `motion.sectionParallax`, то есть из того же места, что и компоненты.
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

/** Прокрутить на заданную долю полосы разгона первого экрана. */
async function scrollToProgress(page: Page, progress: number): Promise<void> {
  await page.evaluate((value) => {
    const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
    if (!stage) throw new Error('обёртка первого экрана не найдена');
    const runway = stage.getBoundingClientRect().height - window.innerHeight;
    window.scrollTo({ top: stage.offsetTop + runway * value, behavior: 'instant' });
  }, progress);
}

test.describe('слои первого экрана', () => {
  /*
   * Селекторы уточнены обёрткой первого экрана: те же имена ролей носит и
   * секция-заявление ниже, и без уточнения `[data-parallax="overlay"]` находит
   * два элемента сразу.
   */
  const stage = '[data-hero-stage] ';

  /** Прокрутить на заданную долю полосы разгона. */
  async function scrollToReveal(page: Page, reveal: number): Promise<void> {
    await scrollToProgress(page, reveal);
  }

  test('текст первого экрана не двигается и не гаснет до конца раскрытия', async ({ page }) => {
    await page.goto(HOME);

    /*
     * Решение заказчика от 05.09.2026: заголовок, кнопки и показатели видны до
     * конца. Прежде текст уезжал вверх на 180 пикселей и гас к 0.13 прохода —
     * проверка держит именно отказ от этого поведения, потому что вернуть его
     * случайной правкой параллакса легко, а заметить трудно.
     */
    const heading = page.getByRole('heading', { level: 1 });
    const before = await heading.boundingBox();

    await scrollToReveal(page, 1);

    const after = await heading.boundingBox();
    expect(before, 'заголовок первого экрана не найден').not.toBeNull();
    expect(after).not.toBeNull();
    /* Приколотый экран стоит: заголовок обязан остаться на том же месте. */
    expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);

    await expect(heading).toBeVisible();
    expect(await opacityOf(page, `${stage}h1`)).toBeCloseTo(1, 2);
  });

  test('вуаль под текстом густеет по мере прихода света', async ({ page }) => {
    await page.goto(HOME);

    const overlay = `${stage}[data-parallax="overlay"]`;
    const { overlayOpacityAtStart, overlayFullAtProgress } = motion.heroParallax;

    /*
     * Направление важнее самих значений. Вуаль защищает текст, который остаётся на
     * виду; в начале за ним почти абсолютно чёрный бархат, в конце — открытая
     * сцена. Растворяющаяся вуаль здесь означала бы ivory-заголовок на светлом
     * фоне, то есть потерю контраста ровно в развязке.
     */
    await expect.poll(() => opacityOf(page, overlay)).toBeCloseTo(overlayOpacityAtStart, 2);

    await scrollToReveal(page, overlayFullAtProgress / 2);
    /*
     * Через ожидание, а не прямым чтением: плотность пишется на кадре анимации, и
     * сразу после прокрутки в узле ещё стоит прежнее значение.
     */
    await expect.poll(() => opacityOf(page, overlay)).toBeGreaterThan(overlayOpacityAtStart);
    expect(await opacityOf(page, overlay)).toBeLessThan(1);

    await scrollToReveal(page, 1);
    await expect.poll(() => opacityOf(page, overlay)).toBeCloseTo(1, 2);
  });

  test('при просьбе убрать движение вуаль остаётся в начальной плотности', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    await page.evaluate(() => window.scrollTo({ top: 300 }));
    await page.waitForTimeout(300);

    expect(await opacityOf(page, `${stage}[data-parallax="overlay"]`)).toBeCloseTo(
      motion.heroParallax.overlayOpacityAtStart,
      2,
    );
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
