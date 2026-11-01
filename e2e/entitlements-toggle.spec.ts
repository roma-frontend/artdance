/**
 * Entitlements: админ выключает модуль тумблером в панели, и публичный сайт
 * перестаёт его показывать; включение возвращает его обратно.
 *
 * Тумблер меняет переопределение FeatureFlagOverride и сбрасывает кэш страниц
 * (`revalidatePath` в действии). Тесты откатывают переопределение в конце, чтобы
 * вернуть пресет. Запускаются только в desktop: один тумблер на тестовую базу.
 */

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoBanners, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

// Панель entitlements открыта владельцам из config/security.ts (entitlementEmails): демо-аккаунт поддержки в их числе.
const owner = demoAccounts.find((account) => account.role === 'SUPPORT')!;

/** Английский заголовок первого демо-баннера: по нему видно, что промо-полоса отдана главной. */
const promoTitle = demoBanners[0].translations.en;

/** Ответ серверного действия переключения: POST на страницу панели. */
function toggleSettled(page: Page) {
  return page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/admin/support/entitlements'));
}

/** Вход демо-аккаунтом поддержки с двухфакторной проверкой; заканчивается в админке. */
async function signInAsOwner(page: Page) {
  await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/support/entitlements')}`);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(owner.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await completeTwoFactor(page);
  await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });
}

/** Сколько ссылок на товары отдаёт главная прямо сейчас (без кэша браузера). */
async function productLinksOnHome(page: Page): Promise<number> {
  const html = await (await page.request.get('/en')).text();
  return (html.match(/href="\/en\/shop\//g) ?? []).length;
}

/**
 * Отдаёт ли главная промо-полосу прямо сейчас. Полоса появляется в DOM только
 * после прокрутки, поэтому смотрим ответ сервера: при выключенном cms заголовка в нём нет.
 */
async function homeShowsPromo(page: Page): Promise<boolean> {
  const html = await (await page.request.get('/en')).text();
  return html.includes(promoTitle);
}

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('админ выключает магазин через entitlements: публичный сайт его больше не показывает', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один тумблер на тестовую базу: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await signInAsOwner(page);

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

test('админ выключает CMS: промо-полоса уходит с главной и возвращается', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один тумблер на тестовую базу: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    await signInAsOwner(page);
    await expect.poll(() => homeShowsPromo(page), { timeout: 20_000 }).toBe(true);

    await page.goto('/en/admin/support/entitlements');
    const cms = page.getByRole('switch', { name: 'cms' });
    await expect(cms).toBeChecked();
    await Promise.all([toggleSettled(page), cms.click()]);
    await expect(cms).not.toBeChecked({ timeout: 15_000 });
    await expect.poll(() => homeShowsPromo(page), { timeout: 20_000 }).toBe(false);

    await page.goto('/en/admin/support/entitlements');
    await expect(cms).not.toBeChecked();
    await Promise.all([toggleSettled(page), cms.click()]);
    await expect(cms).toBeChecked({ timeout: 15_000 });
    await expect.poll(() => homeShowsPromo(page), { timeout: 20_000 }).toBe(true);
  } finally {
    await db.featureFlagOverride.deleteMany({ where: { key: 'cms' } });
    await db.$disconnect();
  }
});
