import { expect, test } from '@playwright/test';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';

const admin = demoAccounts.find(account => account.role === 'ADMIN')!;

test('админка: нижний пункт сайдбара остаётся в окне после клика', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'в мобильной раскладке сайдбар скрыт в шторке');

  await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.84.${testInfo.parallelIndex}.1` });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 760 });
  await page.goto('/en/admin');
  await expect(page.locator('[data-slot="theme-toggle"][data-theme-choice]')).toHaveCount(1);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

  const panel = page.locator('.admin-sidebar-panel');
  await expect(panel).toBeVisible();
  // Самый нижний пункт меню: его кликаем, чтобы проверить прокрутку именно до него.
  const lastLink = page.locator('.admin-sidebar-panel a').last();
  await lastLink.scrollIntoViewIfNeeded();
  await lastLink.click();

  await expect.poll(async () => {
    const box = await lastLink.boundingBox();
    if (!box) return false;
    const viewport = page.viewportSize()!;
    return box.y >= 0 && box.y + box.height <= viewport.height;
  }, { timeout: 8_000 }).toBe(true);

  // Страница не должна уехать из-за клика по сайдбару.
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(40);
});
