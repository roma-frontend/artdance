/**
 * Места соревнований (DS-04): админ записывает место по утверждённой регистрации, и оно
 * попадает в рейтинг и достижения атлета на /account/athlete.
 *
 * Событие, категория и регистрация создаются в тестовой базе с уникальным названием и
 * удаляются в конце. Профиль атлета демо-клиента создаётся, только если его не было;
 * созданный профиль удаляется, чтобы остальные тесты работали с исходным аккаунтом.
 * Запускается только в desktop: одна тестовая база, один вход админа.
 */

import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const client = demoAccounts.find((account) => account.role === 'CUSTOMER')!;

test.beforeEach(async ({ page }, testInfo) => {
  /* Вход ограничен по адресу: у каждого теста свой адрес, чтобы соседи не делили лимит. */
  await isolateRateLimit(page, `${testInfo.project.name}-${testInfo.title}`);
});

test('админ записывает место, и оно попадает в рейтинг атлета', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'одна тестовая база: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const stamp = Date.now();
  const title = `E2E Cup ${stamp}`;
  let eventId: string | undefined;
  let createdProfileUserId: string | undefined;
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: client.email }, select: { id: true } });
    const existing = await db.athleteProfile.findUnique({ where: { userId: user.id }, select: { id: true } });
    const profile =
      existing ??
      (await db.athleteProfile.create({ data: { userId: user.id, programs: ['STANDARD'] }, select: { id: true } }));
    if (!existing) createdProfileUserId = user.id;

    /* Соревнование уже началось: без этого место записать нельзя. */
    const startsAt = new Date(Date.now() - 60 * 60 * 1000);
    const event = await db.event.create({
      data: {
        slug: `e2e-cup-${stamp}`,
        type: 'COMPETITION',
        title,
        description: 'E2E',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000),
        capacity: 10,
      },
      select: { id: true },
    });
    eventId = event.id;
    const category = await db.competitionCategory.create({
      data: { eventId: event.id, name: `E2E Open ${stamp}`, ageGroup: 'ADULT', program: 'STANDARD' },
      select: { id: true },
    });
    const registration = await db.competitionRegistration.create({
      data: { eventId: event.id, categoryId: category.id, athleteProfileId: profile.id, status: 'APPROVED' },
      select: { id: true },
    });

    /* 1. Админ записывает золото по утверждённой регистрации. */
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/competition-results')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/admin/competition-results');
    await page.getByLabel(en.competitionResults.admin.registration, { exact: true }).selectOption(registration.id);
    await page.getByLabel(en.competitionResults.admin.place, { exact: true }).selectOption('GOLD');
    await page.getByRole('button', { name: en.competitionResults.admin.record, exact: true }).click();

    await expect
      .poll(
        async () =>
          (await db.competitionResult.findUnique({ where: { registrationId: registration.id }, select: { place: true } }))?.place,
        { timeout: 15_000 },
      )
      .toBe('GOLD');
    await expect(page.locator('td', { hasText: title })).toBeVisible();

    /* 2. Атлет входит и видит место в достижениях и рейтинг не меньше 10 (золото). */
    await page.context().clearCookies();
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/account/athlete')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(client.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await page.waitForURL(/\/account\/athlete$/, { timeout: 30_000 });

    await expect(page.getByRole('heading', { level: 1, name: en.athlete.cabinet.title })).toBeVisible();
    await expect(page.locator('li', { hasText: title })).toContainText(en.competitionPlace.GOLD);

    const rating = page.getByRole('region', { name: en.athlete.cabinet.ratingTitle, exact: true });
    const points = Number((await rating.locator('p').first().textContent())?.trim());
    expect(points).toBeGreaterThanOrEqual(10);
  } finally {
    /* Удаление соревнования каскадно уносит категорию, регистрацию и место. */
    if (eventId) await db.event.deleteMany({ where: { id: eventId } });
    if (createdProfileUserId) await db.athleteProfile.deleteMany({ where: { userId: createdProfileUserId } });
    await db.$disconnect();
  }
});
