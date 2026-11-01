/**
 * «Для тебя» в кабинете клиента: подборка берётся только из направлений анкеты.
 * Без направлений подборки нет, а вместо неё — пустое состояние с пояснением.
 *
 * Тест меняет направления демо-клиента в тестовой базе и возвращает их после себя.
 * Запускается только в desktop: один вход на тестовую базу.
 */

import { expect, test, type Page } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const client = demoAccounts.find((account) => account.role === 'CUSTOMER')!;

async function signInAndOpenAccount(page: Page): Promise<void> {
  await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/account')}`);
  await page.getByLabel(en.auth.signIn.emailLabel).fill(client.email);
  await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
  await page.getByRole('button', { name: en.auth.signIn.submit }).click();
  await completeTwoFactor(page);
  await page.waitForURL(/\/account$/, { timeout: 30_000 });
}

/** Ставит направления анкеты на время проверки и возвращает исходные после неё. */
async function withDancerStyles(styles: string[], check: () => Promise<void>): Promise<void> {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: client.email }, select: { id: true } });
    const profile = await db.dancerProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { styles: true } });
    const original = [...profile.styles];
    try {
      await db.dancerProfile.update({ where: { userId: user.id }, data: { styles: styles as never } });
      await check();
    } finally {
      await db.dancerProfile.update({ where: { userId: user.id }, data: { styles: original } });
    }
  } finally {
    await db.$disconnect();
  }
}

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу клиента: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('с направлениями в анкете подборка показывает только занятия этих направлений', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один вход на тестовую базу: только в desktop');

  await withDancerStyles(['SALSA'], async () => {
    await signInAndOpenAccount(page);

    const section = page.locator('section:has(#account-for-you)');
    await expect(section.getByRole('heading', { name: en.forYou.title })).toBeVisible();
    await expect(section.getByText('Latin Fusion', { exact: true })).toBeVisible();
    /* Занятия других направлений в подборку не попадают, даже если они есть в каталоге. */
    await expect(section.getByText('Contemporary Flow', { exact: true })).toHaveCount(0);
    await expect(section.getByText('Street Flow', { exact: true })).toHaveCount(0);
  });
});

test('без направлений вместо подборки показывается пояснение, а не чужие занятия', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'один вход на тестовую базу: только в desktop');

  await withDancerStyles([], async () => {
    await signInAndOpenAccount(page);

    const section = page.locator('section:has(#account-for-you)');
    await expect(section.getByRole('heading', { name: en.forYou.title })).toBeVisible();
    await expect(section.getByText(en.forYou.empty, { exact: true })).toBeVisible();
    await expect(section.getByText('Latin Fusion', { exact: true })).toHaveCount(0);
  });
});
