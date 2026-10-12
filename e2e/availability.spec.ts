import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { createLocalAccountIssuer } from '@better-auth/core/db';
import { hashPassword } from 'better-auth/crypto';
import { demoPassword } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';

const CREDENTIAL_PROVIDER = 'credential';
const CREDENTIAL_ISSUER = createLocalAccountIssuer(CREDENTIAL_PROVIDER);

/**
 * E2E расписания инструктора.
 *
 * Пишет в базу, поэтому требует изолированную локальную PostgreSQL — тот же
 * контракт, что у pair-booking. Проверяются три вещи: форма сохраняет правило
 * (строка появляется и попадает в базу), блокировка дня создаёт
 * AvailabilityException, а чужие строки недоступны (updateMany по instructorId
 * не трогает чужое правило — второй инструктор остаётся с окном).
 */
test('instructor edits availability: rule saved, exception saved, other rows untouched', async ({ page }, testInfo) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
    throw new Error('Availability e2e writes require isolated local PostgreSQL.');
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const key = `avail-e2e-${randomUUID()}`;

  // Инструктор-владелец и второй инструктор, чьё правило трогать нельзя.
  const owner = await db.user.create({ data: { email: `${key}@example.test`, name: 'Avail owner', role: 'INSTRUCTOR' } });
  const stranger = await db.user.create({ data: { email: `${key}-stranger@example.test`, name: 'Avail stranger', role: 'INSTRUCTOR' } });
  const ownerHash = await hashPassword(demoPassword);
  await db.account.create({ data: { userId: owner.id, issuer: CREDENTIAL_ISSUER, accountId: owner.id, providerId: CREDENTIAL_PROVIDER, password: ownerHash } });
  const ownerProfile = await db.instructorProfile.create({ data: { userId: owner.id, slug: key, headline: 'Avail', bio: 'Avail', styles: ['BALLROOM'], yearsExperience: 1, hourlyRateFrom: 20000, moderation: 'APPROVED', publishedAt: new Date() } });
  const strangerProfile = await db.instructorProfile.create({ data: { userId: stranger.id, slug: `${key}-s`, headline: 'Stranger', bio: 'Stranger', styles: ['BALLROOM'], yearsExperience: 1, hourlyRateFrom: 20000, moderation: 'APPROVED', publishedAt: new Date() } });

  const strangerRule = await db.availabilityRule.create({
    data: { instructorId: strangerProfile.id, weekday: 2, startTime: '10:00', endTime: '12:00' },
  });

  try {
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.241.${testInfo.workerIndex}.19` });
    await page.goto('/en/sign-in');
    await page.getByLabel(en.auth.signIn.emailLabel).fill(owner.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await page.waitForURL(/\/account$/);

    // В кабинете инструктора теперь есть вход в студию (кнопка ведёт на /studio).
    await expect(page.locator(`a[href$='/studio']`, { hasText: en.account.studioCta })).toBeVisible();
    await page.locator(`a[href$='/studio']`, { hasText: en.account.studioCta }).click();
    await page.waitForURL(/\/studio$/);

    await page.locator(`a[href='/en/studio/availability']`, { hasText: en.footer.studioDashboardAvailability }).click();
    await page.waitForURL(/\/studio\/availability$/);
    await expect(page.getByRole('heading', { name: en.studio.availability.title })).toBeVisible();

    // 1. Новое недельное окно: вторник 18:00–21:00.
    const rulesSection = page.locator('section:has(#rules-title)');
    await rulesSection.getByLabel(en.studio.availability.weekdayLabel).selectOption({ label: en.studio.availability.weekday.tue });
    await rulesSection.getByLabel(en.studio.availability.startTime, { exact: true }).fill('18:00');
    await rulesSection.getByLabel(en.studio.availability.endTime, { exact: true }).fill('21:00');
    await rulesSection.getByRole('button', { name: en.studio.availability.addRule }).click();
    await expect(page.getByText(en.studio.availability.saved)).toBeVisible();
    await expect(page.getByText('18:00–21:00')).toBeVisible();

    const savedRule = await db.availabilityRule.findFirstOrThrow({
      where: { instructorId: ownerProfile.id, weekday: 2, startTime: '18:00' },
    });
    expect(savedRule.endTime).toBe('21:00');
    expect(savedRule.isActive).toBe(true);

    // 2. Исключение: блокировка среды 08:00–10:00, причина «Отпуск».
    await page.locator('section:has(#exceptions-title) input[name="date"]').fill('2026-10-28');
    await page.locator('section:has(#exceptions-title) input[name="startTime"]').fill('08:00');
    await page.locator('section:has(#exceptions-title) input[name="endTime"]').fill('10:00');
    await page.locator('section:has(#exceptions-title) input[name="reason"]').fill('Vacation');
    await page.getByRole('button', { name: en.studio.availability.addException }).click();
    await expect(page.getByText(en.studio.availability.saved)).toBeVisible();
    await expect(page.getByText(en.studio.availability.blocked)).toBeVisible();

    const savedException = await db.availabilityException.findFirstOrThrow({
      where: { instructorId: ownerProfile.id, reason: 'Vacation' },
    });
    expect(savedException.isAvailable).toBe(false);
    expect(savedException.startsAt.toISOString().slice(0, 10)).toBe('2026-10-28');

    // 3. Чужое правило не должно измениться или удалиться.
    const untouchedStrangerRule = await db.availabilityRule.findUniqueOrThrow({ where: { id: strangerRule.id } });
    expect(untouchedStrangerRule).toMatchObject({ instructorId: strangerProfile.id, weekday: 2, startTime: '10:00', endTime: '12:00' });

    // Список на странице показывает только свои строки.
    await expect(page.getByText('10:00–12:00')).toHaveCount(0);
  } finally {
    // Очистка: каскад не нужен, удаляем руками в порядке зависимостей.
    await db.availabilityRule.deleteMany({ where: { instructorId: { in: [ownerProfile.id, strangerProfile.id] } } });
    await db.availabilityException.deleteMany({ where: { instructorId: ownerProfile.id } });
    await db.danceClass.deleteMany({ where: { instructorId: { in: [ownerProfile.id, strangerProfile.id] } } });
    await db.instructorProfile.deleteMany({ where: { id: { in: [ownerProfile.id, strangerProfile.id] } } });
    await db.account.deleteMany({ where: { userId: owner.id } });
    await db.user.deleteMany({ where: { id: { in: [owner.id, stranger.id] } } });
  }
});
