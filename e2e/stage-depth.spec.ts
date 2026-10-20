import { expect, test, type Locator, type Page } from '@playwright/test';

import en from '../src/i18n/messages/en';

const HOME = '/en';

const heroViewport = (page: Page): Locator => page.locator('.hero-viewport').first();
const heroStage = (page: Page): Locator => page.locator('[data-hero-stage]');
const heroCamera = (page: Page): Locator => page.locator('[data-hero-camera]');

interface StageDepthSnapshot {
  perspectivePx: number;
  transformStyle: string;
  active3d: boolean;
}

/**
 * Read the rendered 3D contract instead of matching one browser's CSS string.
 * A perspective matrix alone is a static stage setup, not active depth.
 */
const readStageDepth = (node: Locator): Promise<StageDepthSnapshot> =>
  node.evaluate((element) => {
    const style = getComputedStyle(element);
    const epsilon = 0.001;
    const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform);
    const linearValues = matrix
      ? [
          matrix.m11 - 1,
          matrix.m12,
          matrix.m13,
          matrix.m21,
          matrix.m22 - 1,
          matrix.m23,
          matrix.m31,
          matrix.m32,
          matrix.m33 - 1,
        ]
      : [];
    const hasActiveMatrix =
      linearValues.some((value) => Math.abs(value) > epsilon) ||
      (matrix !== null && Math.abs(matrix.m43) > epsilon);
    const numbers = (value: string): number[] =>
      value.match(/-?(?:\d+\.?\d*|\.\d+)/g)?.map(Number) ?? [];
    const hasActiveRotate = numbers(style.rotate).some((value) => Math.abs(value) > epsilon);
    const translate = numbers(style.translate);
    const hasActiveZTranslate = translate.length >= 3 && Math.abs(translate[2]!) > epsilon;
    const propertyPerspective = Number.parseFloat(style.perspective);
    const functionPerspective = /perspective\(\s*([^)]+)\)/.exec(style.transform);
    const transformPerspective = functionPerspective
      ? Number.parseFloat(functionPerspective[1]!)
      : Number.NaN;

    return {
      perspectivePx: Math.max(
        Number.isFinite(propertyPerspective) ? propertyPerspective : 0,
        Number.isFinite(transformPerspective) ? transformPerspective : 0,
      ),
      transformStyle: style.transformStyle,
      active3d: hasActiveMatrix || hasActiveRotate || hasActiveZTranslate,
    };
  });

async function expectNoActiveStageDepth(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const cameras = await heroCamera(page).all();
      if (cameras.length === 0) return true;
      const snapshots = await Promise.all(cameras.map(readStageDepth));
      return snapshots.every((snapshot) => !snapshot.active3d);
    })
    .toBe(true);
}

async function moveAcrossHero(page: Page, hero: Locator): Promise<void> {
  const box = await hero.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.35);
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.65);
}

async function expectHeroContent(page: Page): Promise<void> {
  const hero = heroViewport(page);
  await expect(hero).toBeVisible();

  const heading = hero.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveAccessibleName(/\S+/);
  await expect(heading).toContainText(en.home.hero.titleLine1);
  await expect(heading).toContainText(en.home.hero.titleAccent);
  await expect(hero.locator('h1 + p')).toContainText(en.home.hero.subtitle);
  await expect(hero.getByRole('link', { name: en.home.hero.primaryCta, exact: true })).toBeVisible();
  await expect(hero.getByRole('link', { name: en.home.hero.secondaryCta, exact: true })).toBeVisible();
  await expect(hero.locator('[data-hero-shine]')).toHaveCount(1);
  await expect(hero.locator('[data-slot="hero-search-trigger"]')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const measured = await page.evaluate(() => {
    const root = document.documentElement;
    const hero = document.querySelector<HTMLElement>('.hero-viewport');
    const heroRect = hero?.getBoundingClientRect();
    const viewport = root.clientWidth;
    const scrollWidth = Math.max(root.scrollWidth, document.body.scrollWidth);
    return {
      viewport,
      pageOverflow: scrollWidth - viewport,
      heroLeft: heroRect?.left ?? Number.NaN,
      heroRight: heroRect?.right ?? Number.NaN,
    };
  });

  expect(measured.pageOverflow, 'homepage has horizontal overflow').toBeLessThanOrEqual(1);
  expect(measured.heroLeft, 'hero starts outside the viewport').toBeGreaterThanOrEqual(-1);
  expect(measured.heroRight, 'hero ends outside the viewport').toBeLessThanOrEqual(measured.viewport + 1);
}

test.describe('Stage Depth 2.0 — homepage hero', () => {
  test('keeps hero semantics visible without horizontal overflow', async ({ page }) => {
    await page.goto(HOME);
    await expectHeroContent(page);
    await expectNoHorizontalOverflow(page);
  });

  test('desktop Full mode exposes a visible 3D stage', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 1024, 'Stage Depth runs on wide desktop only');
    await page.addInitScript((value) => localStorage.setItem('ARTDANCE_LITE_MODE', value), 'false');
    await page.goto(HOME);

    const finePointer = await page.evaluate(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    test.skip(!finePointer, '3D pointer depth is not required without a fine pointer');

    await expect(page.locator('html')).toHaveAttribute('data-lite', 'false');
    await expectHeroContent(page);

    const stage = heroStage(page);
    await expect(stage).toHaveCount(1);
    await expect(stage).toBeVisible();
    const stageSnapshot = await readStageDepth(stage.first());
    expect(stageSnapshot.perspectivePx, 'stage has no rendered perspective').toBeGreaterThan(0);
    expect(stageSnapshot.transformStyle, 'stage does not preserve a 3D context').toBe('preserve-3d');

    const camera = heroCamera(page);
    await expect(camera).toHaveCount(1);
    await moveAcrossHero(page, heroViewport(page));
    await expect
      .poll(async () => (await readStageDepth(camera.first())).active3d)
      .toBe(true);
    await expectNoHorizontalOverflow(page);
  });

  test('reduced motion keeps the hero and stage depth static', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(HOME);

    await expectHeroContent(page);
    await moveAcrossHero(page, heroViewport(page));
    await expectNoActiveStageDepth(page);
    await expectNoHorizontalOverflow(page);
  });

  test('Lite mode keeps the hero and stage depth static', async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('ARTDANCE_LITE_MODE', value), 'true');
    await page.goto(HOME);

    await expect(page.locator('html')).toHaveAttribute('data-lite', 'true');
    await expectHeroContent(page);
    await moveAcrossHero(page, heroViewport(page));
    await expectNoActiveStageDepth(page);
    await expectNoHorizontalOverflow(page);
  });

  test('coarse/mobile context remains usable without pointer 3D', async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('ARTDANCE_LITE_MODE', value), 'false');
    await page.goto(HOME);

    const coarsePointer = await page.evaluate(
      () => window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches,
    );
    test.skip(!coarsePointer, 'Pointer-depth opt-out is covered by the coarse/mobile project');

    await expectHeroContent(page);
    await page.evaluate(() => {
      document.querySelector('.hero-viewport')?.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: window.innerWidth * 0.8,
          clientY: window.innerHeight * 0.6,
          pointerType: 'touch',
        }),
      );
    });
    await expectNoActiveStageDepth(page);
    await expectNoHorizontalOverflow(page);
  });
});
