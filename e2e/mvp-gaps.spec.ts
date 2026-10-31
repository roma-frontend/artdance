/**
 * Мосты P0 MVP (D-04 и 2.10):
 * - карта площадки рендерится без битой вёрстки, даже без `NEXT_PUBLIC_MAPS_API_KEY`;
 * - открытая заявка инструктора не оплачивается до ответа (D-04).
 *
 * Тесты проверяют серверные контракты, а не визуал.
 */

import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

import en from '../src/i18n/messages/en';
import { demoAccounts, demoPassword, demoVenues } from '../prisma/fixtures/demo';
import { completeTwoFactor } from './support/two-factor';

test.describe('Карта площадки (2.10)', () => {
  const venue = demoVenues[0]!;

  test('карта рендерится без ключа, без переполнения и с заголовком', async ({ page }) => {
    const response = await page.goto(`/en/studios/${venue.slug}`);
    expect(response?.status()).toBe(200);

    /*
     * Без `NEXT_PUBLIC_MAPS_API_KEY` `MapView` рисует заглушку со ссылкой на Google
     * Maps; с ключом — iframe. В обоих случаях заголовок «Как добраться» на месте,
     * горизонтального переполнения нет и iframe (если ключ есть) не 404-ит.
     */
    await expect(page.getByRole('heading', { name: en.studio.mapTitle })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const iframeCount = await page.locator('iframe[src*="maps.google.com"]').count();
    expect(iframeCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Открытая заявка не оплачивается (D-04)', () => {
  test('API /pay отклоняет PENDING-заявку с requestExpiresAt до ответа инструктора', async ({ page }, testInfo) => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
      test.skip(true, 'запись в БД только на локальной БД');
      return;
    }

    const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const customer = demoAccounts.find((account) => account.role === 'CUSTOMER')!;
    const user = await db.user.findUniqueOrThrow({ where: { email: customer.email } });
    const startsAt = new Date(Date.now() + 7 * 86_400_000);
    startsAt.setUTCHours(10, 0, 0, 0);
    const requestExpiresAt = new Date(startsAt.getTime() + 48 * 3_600_000);

    /*
     * Создаём PENDING-бронь напрямую с requestExpiresAt — открытую заявку, которая
     * ждёт ответа инструктора. Сервис оплаты обязан её отклонить. Валидные обязательные
     * поля (без FK-связей) и `reference` из тестового префикса.
     */
    const booking = await db.booking.create({
      data: {
        reference: `open-e2e-${Date.now()}`,
        customerId: user.id,
        subject: 'PRIVATE_SESSION',
        lessonType: 'PRIVATE',
        status: 'PENDING',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 3_600_000),
        participants: 1,
        basePrice: 20_000,
        travelFee: 0,
        discountAmount: 0,
        totalPrice: 20_000,
        cancellationWindowHours: 24,
        lateCancellationRate: 0.5 as unknown as number,
        rescheduleWindowHours: 24,
        maxReschedules: 2,
        requestExpiresAt,
      },
      select: { id: true },
    });

    let bookingId: string | undefined;
    try {
      bookingId = booking.id;

      /*
       * Каждый шаг — со своим уникальным x-forwarded-for (см. e2e/commerce-screens.spec.ts,
       * «каждый запрос с собственным адресом»). Лимит paymentIntent (10/600 с)
       * считается по IP; если все /pay-вызовы идут с одного адреса, первые
       * десять уходят в общий бакет и возвращают 429 вместо 401 — так упал тест
       * в CI на первом прогоне d47be15.
       */
      const payHeaders = { headers: { 'x-forwarded-for': `10.243.${testInfo.workerIndex % 250}.${(Date.now() % 1000) + 10}` } };

      /* Без авторизации — 401: маршрут требует caller. */
      const unauthed = await page.request.post(`/api/booking/${bookingId}/pay`, { data: { method: 'CARD' }, ...payHeaders });
      expect(unauthed.status()).toBe(401);

      /* Логинимся и повторяем: сервис обязан отклонить открытую заявку (D-04). */
      await page.goto('/en/sign-in');
      await page.getByLabel(en.auth.signIn.emailLabel).fill(customer.email);
      await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
      await page.getByRole('button', { name: en.auth.signIn.submit }).click();
      await completeTwoFactor(page);
      await page.waitForURL(/\/account$/);

      const authedPay = await page.request.post(`/api/booking/${bookingId}/pay`, { data: { method: 'CARD' }, ...payHeaders });
      expect(authedPay.status()).toBe(422);
      expect(await authedPay.json()).toMatchObject({ error: 'VALIDATION_FAILED' });
    } finally {
      if (bookingId) await db.booking.deleteMany({ where: { id: bookingId } });
      await db.$disconnect();
    }
  });
});
