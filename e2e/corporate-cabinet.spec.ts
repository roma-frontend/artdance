/**
 * Кабинет компании (B-06): администратор привязывает пользователя к компании, и тот
 * видит баланс и счета своей компании на странице /account/company.
 *
 * Компания создаётся в тестовой базе с уникальным именем и удаляется в конце; привязка
 * демо-клиента снимается в конце, чтобы остальные тесты работали с исходным аккаунтом.
 * Запускается только в desktop: одна тестовая база, один вход админа.
 */

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const client = demoAccounts.find((account) => account.role === 'CUSTOMER')!;

/** Форма с заголовком: кнопки «Сохранить» есть в нескольких формах, поэтому ищем по заголовку. */
function formWithHeading(page: Page, heading: string) {
  return page.locator('form').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
}

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('админ привязывает клиента к компании, и клиент видит её баланс и счёт', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'одна тестовая база: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const name = `E2E Cabinet ${Date.now()}`;
  let clientId: string | undefined;
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: client.email }, select: { id: true, corporateAccountId: true } });
    clientId = user.id;
    const account = await db.corporateAccount.create({
      data: { name, contactEmail: `e2e-cabinet-${Date.now()}@example.test`, balance: 42_000 },
      select: { id: true },
    });

    /* 1. Админ привязывает клиента к компании. */
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/corporate')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/admin/corporate');
    const memberForm = formWithHeading(page, en.corporate.admin.memberTitle);
    await memberForm.getByLabel(en.corporate.admin.memberEmail).fill(client.email);
    await memberForm.getByLabel(en.corporate.admin.account).selectOption({ label: name });
    await memberForm.getByRole('button', { name: en.corporate.admin.save }).click();

    await expect
      .poll(async () => (await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { corporateAccountId: true } })).corporateAccountId, {
        timeout: 15_000,
      })
      .toBe(account.id);

    /* 2. Клиент входит и видит счёт компании: баланс и название. */
    await page.context().clearCookies();
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/account/company')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(client.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await page.waitForURL(/\/account\/company$/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: en.corporate.cabinet.title })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    await expect(page.getByText(`${en.corporate.cabinet.balance}:`)).toBeVisible();

    /* Очистка: отвязываем клиента и удаляем компанию. */
    await db.user.update({ where: { id: user.id }, data: { corporateAccountId: user.corporateAccountId } });
    await db.corporateAccount.deleteMany({ where: { id: account.id } });
  } finally {
    if (clientId) {
      await db.user.update({ where: { id: clientId }, data: { corporateAccountId: null } });
    }
    await db.corporateAccount.deleteMany({ where: { name } });
    await db.$disconnect();
  }
});
