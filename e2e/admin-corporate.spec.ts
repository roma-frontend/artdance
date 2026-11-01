/**
 * Корпоративные счета (B-06): администратор создаёт аккаунт компании, выставляет счёт,
 * отмечает его оплаченным, и баланс компании растёт на сумму счёта.
 *
 * Аккаунт и счёт создаются с уникальным именем и удаляются в конце. Запускается
 * только в desktop: одна тестовая база, один вход админа.
 */

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const AMOUNT = 50_000;

/** Форма с заголовком: кнопки «Сохранить» есть в обеих формах, поэтому ищем по заголовку. */
function formWithHeading(page: Page, heading: string) {
  return page.locator('form').filter({ has: page.getByRole('heading', { name: heading, exact: true }) });
}

test('админ создаёт аккаунт компании, выставляет счёт и отмечает его оплаченным', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'одна тестовая база: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const name = `E2E Corp ${Date.now()}`;
  try {
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

    page.once('dialog', (dialog) => dialog.accept());
    await invoiceRow.getByRole('button', { name: en.corporate.admin.markPaid }).click();
    await expect(page.getByRole('row').filter({ hasText: name }).filter({ hasText: en.corporate.admin.status.PAID })).toHaveCount(1, {
      timeout: 15_000,
    });

    const account = await db.corporateAccount.findFirstOrThrow({ where: { name }, select: { balance: true } });
    expect(account.balance).toBe(AMOUNT);
  } finally {
    await db.invoice.deleteMany({ where: { corporateAccount: { name } } });
    await db.corporateAccount.deleteMany({ where: { name } });
    await db.$disconnect();
  }
});
