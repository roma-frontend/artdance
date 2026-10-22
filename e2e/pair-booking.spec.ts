import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { randomUUID } from 'node:crypto';
import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import en from '../src/i18n/messages/en';

for (const locale of ['en', 'ru', 'hy']) {
  /*
   * Карточка пакета не бывает тупиком: она либо продаёт, либо объясняет словами,
   * почему продать нельзя. Что именно из двух — зависит от настроенного
   * платёжного провайдера, и e2e не должен это предполагать: в CI провайдер
   * mock, то есть покупка доступна, а на старте без договора — нет.
   */
  test(`${locale}: package cards sell or explain, never dead ends`, async ({ page }) => {
    const response = await page.goto(`/${locale}/pricing`);
    expect(response?.status()).toBe(200);

    const cards = page.getByRole('main').locator('[data-slot="class-pass"]');
    /* Пакеты — модуль пресета; при выключенном раздел показывает «скоро». */
    test.skip((await cards.count()) === 0, 'пакеты выключены текущим пресетом');
    await expect(cards).toHaveCount(3);

    for (const card of await cards.all()) {
      const controls = await card.locator('button, form, a').count();
      const explanation = await card.locator('p.text-caption.mt-6').count();
      expect(controls + explanation, `${locale}: у карточки нет ни покупки, ни объяснения`).toBeGreaterThan(0);
      expect(await card.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
  });
}

test('pair booking requires partner, stores two participants and cancels once', async ({ page }, testInfo) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
    throw new Error('Pair booking e2e writes require isolated local PostgreSQL.');
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  const key = `pair-e2e-${randomUUID()}`;
  const teacher = await db.user.create({ data: { email: `${key}@example.test`, name: 'Pair teacher' } });
  const instructor = await db.instructorProfile.create({ data: { userId: teacher.id, slug: key, headline: 'Pair teacher', bio: 'Pair lesson', styles: ['BALLROOM'], yearsExperience: 1, hourlyRateFrom: 20000, moderation: 'APPROVED', publishedAt: new Date() } });
  const danceClass = await db.danceClass.create({ data: { instructorId: instructor.id, slug: key, title: 'Pair lesson', description: 'Pair lesson', style: 'BALLROOM', level: 'BEGINNER', durationMinutes: 60, price: 20000, capacity: 2, learningPoints: [], lessonType: 'PAIR' } });
  const startsAt = new Date(Date.now() + 7 * 86400000);
  startsAt.setUTCHours(10, 0, 0, 0);
  const session = await db.classSession.create({ data: { classId: danceClass.id, startsAt, endsAt: new Date(startsAt.getTime() + 3600000), capacity: 2 } });
  let bookingId: string | undefined;
  try {
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.242.${testInfo.workerIndex}.19` });
    const customer = demoAccounts.find(account => account.role === 'CUSTOMER')!;
    await page.goto('/en/sign-in');
    await page.getByLabel(en.auth.signIn.emailLabel).fill(customer.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await page.waitForURL(/\/account$/);
    const holdResponse = page.waitForResponse(response => response.url().includes('/api/booking/hold') && response.request().method() === 'POST');
    await page.goto(`/en/instructors/${key}/book?class=${key}`);
    expect((await holdResponse).status()).toBe(201);
    const continueButton = page.getByRole('button', { name: en.booking.continueCta });
    await expect(continueButton).toBeDisabled();
    await page.getByLabel(en.booking.partnerName).fill('Partner Example');
    await expect(continueButton).toBeEnabled();
    const booked = page.waitForResponse(response => new URL(response.url()).pathname === '/api/booking' && response.request().method() === 'POST');
    await continueButton.click();
    const response = await booked;
    expect(response.status()).toBe(201);
    const payload = (await response.json()).booking;
    bookingId = payload.id;
    await page.waitForURL(new RegExp(`/booking/${payload.reference}/confirm$`));
    const saved = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });
    expect(saved).toMatchObject({ lessonType: 'PAIR', participants: 2, partnerName: 'Partner Example', basePrice: 20000 });
    expect((await db.classSession.findUniqueOrThrow({ where: { id: session.id } })).bookedCount).toBe(2);
    await page.goto(`/en/account/bookings/${bookingId}`);
    await expect(page.getByRole('main').getByText('Partner Example', { exact: true }).first()).toBeVisible();
    const cancelled = await page.request.post(`/api/booking/${bookingId}/cancel`, { data: {} });
    expect(cancelled.status()).toBe(200);
    expect((await db.classSession.findUniqueOrThrow({ where: { id: session.id } })).bookedCount).toBe(0);
    const repeated = await page.request.post(`/api/booking/${bookingId}/cancel`, { data: {} });
    expect(repeated.status()).toBe(422);
    expect((await db.classSession.findUniqueOrThrow({ where: { id: session.id } })).bookedCount).toBe(0);
  } finally {
    if (bookingId) {
      await db.notification.deleteMany({ where: { OR: ['confirmed', 'cancelled'].map(action => ({ payload: { path: ['dedupeKey'], equals: `booking:${bookingId}:${action}` } })) } });
      await db.booking.delete({ where: { id: bookingId } });
    }
    await db.slotHold.deleteMany({ where: { instructorId: instructor.id } });
    await db.classSession.deleteMany({ where: { classId: danceClass.id } });
    await db.danceClass.delete({ where: { id: danceClass.id } });
    await db.instructorProfile.delete({ where: { id: instructor.id } });
    await db.user.delete({ where: { id: teacher.id } });
    await db.$disconnect();
  }
});
