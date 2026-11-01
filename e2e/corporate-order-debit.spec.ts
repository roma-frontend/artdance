/**
 * Списание баланса компании за заказ (B-06): админ запрашивает списание по оплаченному
 * счёту заказа, второй админ одобряет. Только после одобрения баланс уменьшается, а заказ
 * переходит в оплаченный.
 *
 * Компания, заказ, счёт и пользователь создаются в тестовой базе с уникальными именами и
 * удаляются в конце. Запускается только в desktop: одна тестовая база, два входа админов.
 */

import { randomUUID } from 'node:crypto';

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const approver = demoAccounts.find((account) => account.role === 'SUPPORT')!;
const AMOUNT = 30_000;

async function signIn(page: Page, email: string, redirectTo: string): Promise<void> {
  await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent(redirectTo)}`);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await completeTwoFactor(page);
}

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('списание с баланса за заказ идёт через второго админа и оплачивает заказ', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'одна тестовая база: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const key = `debit-e2e-${randomUUID()}`;
  const name = `E2E Debit ${key}`;
  const orderNumber = `E2E-DEBIT-${Date.now()}`;
  let userId: string | undefined;
  let orderId: string | undefined;
  let accountId: string | undefined;
  try {
    /* Подготовка: оплаченный счёт по заказу, баланс компании равен сумме счёта. */
    const user = await db.user.create({ data: { email: `${key}@example.test`, name: 'Debit customer' } });
    userId = user.id;
    const order = await db.order.create({
      data: {
        orderNumber,
        userId: user.id,
        contactEmail: user.email,
        contactPhone: '+37400000000',
        contactName: 'Debit customer',
        subtotal: AMOUNT,
        total: AMOUNT,
        vatRate: 0,
      },
      select: { id: true },
    });
    orderId = order.id;
    const account = await db.corporateAccount.create({
      data: { name, contactEmail: `${key}-corp@example.test`, balance: AMOUNT },
      select: { id: true },
    });
    accountId = account.id;
    await db.invoice.create({
      data: {
        number: `E2E-INV-${key}`,
        amount: AMOUNT,
        status: 'PAID',
        paidAt: new Date(),
        corporateAccountId: account.id,
        orderId: order.id,
      },
    });

    /* 1. Админ запрашивает списание по счёту заказа. */
    await signIn(page, admin.email, '/admin/corporate');
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });
    await page.goto('/en/admin/corporate');

    const invoiceRow = page.getByRole('row').filter({ hasText: orderNumber });
    await expect(invoiceRow).toHaveCount(1, { timeout: 15_000 });
    page.once('dialog', (dialog) => dialog.accept());
    await invoiceRow.getByRole('button', { name: en.corporate.admin.debitOrder }).click();
    await expect(page.getByText(en.corporate.admin.debitRequested)).toBeVisible({ timeout: 15_000 });

    /* До одобрения ни баланс, ни заказ не меняются. */
    const waiting = await db.corporateAccount.findUniqueOrThrow({ where: { id: account.id }, select: { balance: true } });
    expect(waiting.balance).toBe(AMOUNT);
    const pending = await db.approvalRequest.findMany({
      where: { action: 'corporate.order.debit', status: 'PENDING', payload: { path: ['orderId'], equals: order.id } },
      select: { id: true },
    });
    expect(pending).toHaveLength(1);

    /* 2. Второй админ одобряет заявку на странице одобрений. */
    await page.context().clearCookies();
    await signIn(page, approver.email, '/admin/approvals');
    await page.waitForURL(/\/admin\/approvals/, { timeout: 30_000 });

    const card = page.locator('li').filter({ hasText: order.id });
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: en.admin.actions.approve }).click();

    /* После одобрения баланс списан, заказ оплачен. */
    await expect
      .poll(async () => (await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } })).status, {
        timeout: 30_000,
      })
      .toBe('PAID');
    const after = await db.corporateAccount.findUniqueOrThrow({ where: { id: account.id }, select: { balance: true } });
    expect(after.balance).toBe(0);
  } finally {
    if (orderId) {
      await db.approvalRequest.deleteMany({
        where: { action: 'corporate.order.debit', payload: { path: ['orderId'], equals: orderId } },
      });
      await db.invoice.deleteMany({ where: { orderId } });
    }
    if (accountId) await db.corporateAccount.deleteMany({ where: { id: accountId } });
    if (orderId) await db.order.deleteMany({ where: { id: orderId } });
    if (userId) {
      await db.notification.deleteMany({ where: { userId } });
      await db.user.deleteMany({ where: { id: userId } });
    }
    await db.$disconnect();
  }
});
