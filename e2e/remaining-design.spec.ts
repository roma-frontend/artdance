import { expect, test } from '@playwright/test';

for (const width of [390, 768, 1440]) {
  test(`Размытие, стекло и наложение: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/ru', { waitUntil: 'domcontentloaded' });
    const word = page.locator('h1 [data-reveal-word]').last();
    await expect(word).toHaveCSS('filter', 'blur(0px)');
    const glass = page.locator('.hero-content .liquid-glass');
    await expect(glass).toHaveCSS('backdrop-filter', 'blur(4px)');
    const masks = await glass.evaluate((node) => getComputedStyle(node, '::before').maskComposite.split(',').map((value) => value.trim()));
    expect(masks.length).toBeGreaterThan(0);
    expect(masks.every((value) => value === 'exclude')).toBe(true);
    const panels = page.locator('[data-aperture] > *');
    await expect(panels).toHaveCount(3);
    const openOf = (index: number) =>
      panels.nth(index).evaluate((node) => Number(getComputedStyle(node).getPropertyValue('--aperture-open')));
    if (width >= 1024) {
      await expect(page.locator('[data-aperture]')).toHaveAttribute('data-aperture', 'on');
      await expect(panels.first()).toHaveCSS('position', 'relative');
      // Панель у нижней кромки — экран ещё закрыт, маска с полями.
      await panels.first().evaluate((node) => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - window.innerHeight + 50, behavior: 'instant' }));
      await expect.poll(() => openOf(0)).toBeLessThan(0.1);
      await expect(panels.first()).not.toHaveCSS('clip-path', 'none');
      // Поднялась к верху — раскрыта на весь кадр.
      await panels.first().evaluate((node) => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY, behavior: 'instant' }));
      await expect.poll(() => openOf(0)).toBe(1);
      // Фокус внутри закрытой панели раскрывает её целиком.
      await panels.nth(2).evaluate((node) => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - window.innerHeight + 50, behavior: 'instant' }));
      const link = panels.nth(2).locator('a').first();
      await link.focus();
      await expect(link).toBeFocused();
      await expect.poll(() => openOf(2)).toBe(1);
    } else {
      await expect(page.locator('[data-aperture]')).toHaveAttribute('data-aperture', 'off');
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(word).toHaveCSS('filter', 'none');
    await expect(page.locator('[data-aperture]')).toHaveAttribute('data-aperture', 'off');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
