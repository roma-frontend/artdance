/**
 * Массовая отмена броней: администратор выбирает бронь в таблице и отправляет отмену
 * на согласование. Отмена не выполняется сразу: создаётся заявка booking.bulkCancel.
 *
 * Подготовка создаёт одну бронь демо-клиента в тестовой базе, после теста заявка и
 * бронь удаляются. Запускается только в проекте desktop: одна бронь на базу.
 */

import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const client = demoAccounts.find((account) => account.role === 'CUSTOMER')!;

test('админ отправляет выбранную бронь на отмену через согласование', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'одна тестовая бронь: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const reference = `E2E-BULK-${Date.now()}`;
  let bookingId: string | undefined;
  try {
    const customer = await db.user.findUniqueOrThrow({ where: { email: client.email }, select: { id: true } });
    const adminUser = await db.user.findUniqueOrThrow({ where: { email: admin.email }, select: { id: true } });
    const session = await db.classSession.findFirstOrThrow({
      where: { isCancelled: false, startsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, endsAt: true, classId: true },
    });
    const danceClass = await db.danceClass.findUniqueOrThrow({
      where: { id: session.classId },
      select: { instructorId: true },
    });
    const booking = await db.booking.create({
      data: {
        reference,
        subject: 'CLASS_SESSION',
        status: 'CONFIRMED',
        customerId: customer.id,
        instructorId: danceClass.instructorId,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        basePrice: 10_000,
        totalPrice: 10_000,
        cancellationWindowHours: 24,
        lateCancellationRate: 0.5,
        rescheduleWindowHours: 24,
        maxReschedules: 1,
      },
      select: { id: true },
    });
    bookingId = booking.id;

    try {
      await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/bookings')}`);
      await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
      await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
      await page.getByRole('button', { name: en.auth.signIn.submit }).click();
      await completeTwoFactor(page);
      await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

      await page.goto(`/en/admin/bookings?q=${encodeURIComponent(reference)}`);
      // Строка есть в мобильной карточке и в таблице; берём видимый чекбокс.
      await page.locator(`input[name="ids"][value="${booking.id}"]:visible`).check();
      await page.getByRole('button', { name: en.admin.bookings.bulkCancelCta }).click();

      await page.locator('#booking-bulk-cancel-reason').fill('E2E: проверка массовой отмены');
      await page.getByRole('button', { name: en.admin.bookings.bulkCancelSubmit }).click();

      await expect(page.getByRole('status').filter({ hasText: 'Cancellation request for' })).toContainText(
        'Cancellation request for 1 bookings sent for approval',
      );

      const requests = await db.approvalRequest.findMany({
        where: { action: 'booking.bulkCancel', requestedById: adminUser.id, status: 'PENDING' },
        select: { id: true, payload: true },
      });
      const ours = requests.filter((request) => {
        const ids = (request.payload as { bookingIds?: string[] } | null)?.bookingIds ?? [];
        return ids.includes(booking.id);
      });
      expect(ours).toHaveLength(1);

      const status = await db.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } });
      expect(status.status).toBe('CONFIRMED');

      await db.approvalRequest.deleteMany({ where: { id: { in: ours.map((request) => request.id) } } });
    } finally {
      await db.booking.deleteMany({ where: { id: bookingId } });
    }
  } finally {
    await db.$disconnect();
  }
});
