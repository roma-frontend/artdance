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
    const panels = page.locator('[data-stack-showcase] > *');
    await expect(panels).toHaveCount(3);
    if (width >= 768) {
      await expect(panels.first()).toHaveCSS('position', 'sticky');
      await panels.nth(1).evaluate((node) => window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - 250, behavior: 'instant' }));
      await expect.poll(async () => {
        const first = await panels.first().boundingBox();
        const second = await panels.nth(1).boundingBox();
        return first && second ? first.y + first.height - second.y : 0;
      }).toBeGreaterThan(50);
      const topmost = await panels.nth(1).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + 20));
      });
      expect(topmost).toBe(true);
    } else {
      await expect(panels.first()).toHaveCSS('position', 'relative');
    }
    const link = panels.first().locator('a').first();
    await link.focus();
    await expect(link).toBeFocused();
    await expect(panels.first()).toHaveCSS('position', 'relative');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(word).toHaveCSS('filter', 'none');
    await expect(panels.first()).toHaveCSS('position', 'relative');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
