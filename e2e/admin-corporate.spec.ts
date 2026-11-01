/**
 * Корпоративные счета (B-06): администратор создаёт аккаунт компании, выставляет счёт и
 * отправляет его на отметку оплаты. Баланс компании растёт только после того, как второй
 * администратор одобрит заявку: отметка оплаты денежная, поэтому она не выполняется сразу.
 *
 * Аккаунт и счёт создаются с уникальным именем и удаляются в конце. Запускается
 * только в desktop: одна тестовая база, один вход админа и один вход второго админа.
 */

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const approver = demoAccounts.find((account) => account.role === 'SUPPORT')!;
const AMOUNT = 50_000;

/** Форма с заголовком: кнопки «Сохранить» есть в обеих формах, поэтому ищем по заголовку. */
function formWithHeading(page: Page, heading: string) {
  return page.locator('form').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
}

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('отметка оплаты счёта меняет баланс только после одобрения вторым админом', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'одна тестовая база: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const name = `E2E Corp ${Date.now()}`;
  let invoiceId: string | undefined;
  try {
    /* 1. Админ создаёт аккаунт компании и выставляет счёт. */
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/corporate')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/admin/corporate');

    const accountForm = formWithHeading(page, en.corporate.admin.createAccount);
    await accountForm.getByLabel(en.corporate.admin.name).fill(name);
    await accountForm.getByLabel(en.corporate.admin.contactEmail).fill(`e2e-corp-${Date.now()}@example.test`);
    await accountForm.getByRole('button', { name: en.corporate.admin.save }).click();
    await expect(page.getByRole('cell', { name, exact: true })).toBeVisible({ timeout: 15_000 });

    const invoiceForm = formWithHeading(page, en.corporate.admin.issueInvoice);
    await invoiceForm.getByLabel(en.corporate.admin.account).selectOption({ label: name });
    await invoiceForm.getByLabel(en.corporate.admin.amount).fill(String(AMOUNT));
    await invoiceForm.getByRole('button', { name: en.corporate.admin.save }).click();

    const invoiceRow = page.getByRole('row').filter({ hasText: name }).filter({ hasText: en.corporate.admin.status.PENDING });
    await expect(invoiceRow).toHaveCount(1, { timeout: 15_000 });
    const invoice = await db.invoice.findFirstOrThrow({ where: { corporateAccount: { name } }, select: { id: true } });
    invoiceId = invoice.id;

    /* 2. Админ отправляет счёт на отметку оплаты: баланс пока не меняется. */
    page.once('dialog', (dialog) => dialog.accept());
    await invoiceRow.getByRole('button', { name: en.corporate.admin.markPaid }).click();
    await expect(page.getByText(en.corporate.admin.markPaidRequested)).toBeVisible({ timeout: 15_000 });

    const waiting = await db.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: { status: true } });
    expect(waiting.status).toBe('PENDING');
    const beforeApproval = await db.corporateAccount.findFirstOrThrow({ where: { name }, select: { balance: true } });
    expect(beforeApproval.balance).toBe(0);

    const requests = await db.approvalRequest.findMany({
      where: { action: 'corporate.invoice.markPaid', status: 'PENDING', payload: { path: ['invoiceId'], equals: invoice.id } },
      select: { id: true },
    });
    expect(requests).toHaveLength(1);

    /* 3. Второй админ одобряет заявку на странице одобрений. */
    await page.context().clearCookies();
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/approvals')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(approver.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await page.waitForURL(/\/admin\/approvals/, { timeout: 30_000 });

    const card = page.locator('li').filter({ hasText: invoice.id });
    await expect(card).toHaveCount(1);
    await card.getByRole('button', { name: en.admin.actions.approve }).click();

    /* После одобрения счёт оплачен и баланс компании вырос на сумму счёта. */
    await expect
      .poll(async () => (await db.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: { status: true } })).status, {
        timeout: 30_000,
      })
      .toBe('PAID');
    const account = await db.corporateAccount.findFirstOrThrow({ where: { name }, select: { balance: true } });
    expect(account.balance).toBe(AMOUNT);
  } finally {
    if (invoiceId) {
      await db.approvalRequest.deleteMany({
        where: { action: 'corporate.invoice.markPaid', payload: { path: ['invoiceId'], equals: invoiceId } },
      });
    }
    await db.invoice.deleteMany({ where: { corporateAccount: { name } } });
    await db.corporateAccount.deleteMany({ where: { name } });
    await db.$disconnect();
  }
});
