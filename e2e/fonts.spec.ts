/** Шрифты должны реально загружаться, а не молча заменяться системным fallback. */
import { expect, test } from '@playwright/test';

import { localeMeta, locales } from '../src/i18n/config';

for (const locale of locales) {
  test(`/${locale} загружает шрифты и применяет гарнитуру локали`, async ({ page }) => {
    const fontResponses: Array<{ url: string; status: number }> = [];
    page.on('response', (response) => {
      if (response.request().resourceType() === 'font') {
        fontResponses.push({ url: response.url(), status: response.status() });
      }
    });

    const response = await page.goto(`/${locale}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', localeMeta[locale].bcp47);
    await expect(page.locator('h1').first()).toBeVisible();

    const typography = await page.evaluate(async () => {
      const root = getComputedStyle(document.documentElement);
      const primaryFamily = (variable: string) => root.getPropertyValue(variable).trim().split(',')[0]!.trim();
      const display = primaryFamily('--font-playfair');
      const sans = primaryFamily('--font-dm-sans');
      const armenian = primaryFamily('--font-noto-armenian');
      const loaded = [];

      // Обе письменности и все используемые веса/стили Playfair — исходная регрессия.
      for (const style of ['normal', 'italic']) {
        for (const weight of ['400', '700']) {
          for (const text of ['Dance', 'Танец']) {
            const descriptor = `${style} ${weight} 32px ${display}`;
            const faces = await document.fonts.load(descriptor, text);
            loaded.push({ descriptor, text, count: faces.length, statuses: faces.map((face) => face.status) });
          }
        }
      }
      for (const [family, text] of [[sans, 'Dance'], [armenian, 'Հայերեն']]) {
        for (const weight of ['400', '600']) {
          const descriptor = `normal ${weight} 16px ${family}`;
          const faces = await document.fonts.load(descriptor, text);
          loaded.push({ descriptor, text, count: faces.length, statuses: faces.map((face) => face.status) });
        }
      }

      return {
        display,
        sans,
        armenian,
        bodyFamily: getComputedStyle(document.body).fontFamily,
        loaded,
      };
    });

    for (const family of [typography.display, typography.sans, typography.armenian]) {
      expect(family, 'CSS-переменная гарнитуры должна быть определена').not.toBe('');
    }
    expect(typography.bodyFamily.split(',')[0]!.trim()).toBe(
      locale === 'hy' ? typography.armenian : typography.sans,
    );
    for (const face of typography.loaded) {
      expect(face.count, `${face.descriptor}: ${face.text} не должен уходить в fallback`).toBeGreaterThan(0);
      expect(face.statuses, `${face.descriptor}: ${face.text}`).toEqual(Array(face.count).fill('loaded'));
    }

    expect(fontResponses.length).toBeGreaterThan(0);
    for (const font of fontResponses) {
      expect(font.status, font.url).toBe(200);
      expect(new URL(font.url).origin, 'шрифты должны быть self-hosted').toBe(new URL(page.url()).origin);
    }
  });
}
