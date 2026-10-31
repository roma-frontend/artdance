/**
 * Entitlements: админ выключает магазин тумблером в панели, и публичный сайт
 * перестаёт его показывать; включение возвращает его обратно.
 *
 * Тумблер меняет переопределение FeatureFlagOverride и сбрасывает кэш страниц
 * (`revalidatePath` в действии). Тест откатывает переопределение в конце, чтобы
 * вернуть пресет. Запускается только в desktop: один тумблер на тестовую базу.
 */

import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { completeTwoFactor } from './support/two-factor';

// Панель entitlements открыта владельцам из config/security.ts (entitlementEmails): демо-аккаунт поддержки в их числе.
const owner = demoAccounts.find((account) => account.role === 'SUPPORT')!;

/** Ответ серверного действия переключения: POST на страницу панели. */
function toggleSettled(page: import('@playwright/test').Page) {
  return page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/admin/support/entitlements'));
}

/** Сколько ссылок на товары отдаёт главная прямо сейчас (без кэша браузера). */
async function productLinksOnHome(page: import('@playwright/test').Page): Promise<number> {
  const html = await (await page.request.get('/en')).text();
  return (html.match(/href="\/en\/shop\//g) ?? []).length;
}

test('админ выключает магазин через entitlements: публичный сайт его больше не показывает', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один тумблер на тестовую базу: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/support/entitlements')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(owner.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/admin/support/entitlements');
    const shop = page.getByRole('switch', { name: 'shop' });
    await expect(shop).toBeChecked();

    // Ждём, пока серверное действие закончит запись и сброс кэша, а не только переключение в UI.
    await Promise.all([toggleSettled(page), shop.click()]);
    await expect(shop).not.toBeChecked({ timeout: 15_000 });
    await expect.poll(() => productLinksOnHome(page), { timeout: 20_000 }).toBe(0);
    expect((await page.request.get('/en/shop')).status()).toBe(404);

    await page.goto('/en/admin/support/entitlements');
    await expect(shop).not.toBeChecked();
    await Promise.all([toggleSettled(page), shop.click()]);
    await expect(shop).toBeChecked({ timeout: 15_000 });
    await expect.poll(() => productLinksOnHome(page), { timeout: 20_000 }).toBeGreaterThan(0);
    expect((await page.request.get('/en/shop')).status()).toBe(200);
  } finally {
    await db.featureFlagOverride.deleteMany({ where: { key: 'shop' } });
    await db.$disconnect();
  }
});
