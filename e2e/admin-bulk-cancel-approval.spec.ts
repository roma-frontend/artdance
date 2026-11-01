/**
 * Массовая отмена броней: заявку подаёт один админ, одобряет другой, и только тогда
 * бронь отменяется. Автор заявки в списке одобрений видит её без кнопки «Одобрить».
 *
 * Бронь создаётся на отдельных тестовых клиенте и инструкторе: отмена пишет уведомления
 * им, и демо-аккаунты, которыми входят другие тесты, в этом не участвуют. Всё созданное
 * удаляется после теста. Запускается только в проекте desktop: одна бронь на базу.
 */

import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { isolateRateLimit } from './support/rate-limit';
import { completeTwoFactor } from './support/two-factor';

const admin = demoAccounts.find((account) => account.role === 'ADMIN')!;
const approver = demoAccounts.find((account) => account.role === 'SUPPORT')!;

test('второй админ одобряет заявку на массовую отмену, и бронь отменяется', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'одна тестовая бронь: только в desktop');
  await isolateRateLimit(page, `bulk-cancel-approval-${testInfo.project.name}`);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const key = `approval-e2e-${randomUUID()}`;
  const reference = `E2E-APPROVE-${Date.now()}`;
  let customerId: string | undefined;
  let teacherId: string | undefined;
  let instructorId: string | undefined;
  let classId: string | undefined;
  let bookingId: string | undefined;
  let requestIds: string[] = [];
  try {
    const customer = await db.user.create({ data: { email: `${key}-customer@example.test`, name: 'Approval customer' } });
    customerId = customer.id;
    const teacher = await db.user.create({ data: { email: `${key}-teacher@example.test`, name: 'Approval teacher' } });
    teacherId = teacher.id;
    const instructor = await db.instructorProfile.create({
      data: {
        userId: teacher.id,
        slug: key,
        headline: 'Approval teacher',
        bio: 'Approval lesson',
        styles: ['BALLROOM'],
        yearsExperience: 1,
        hourlyRateFrom: 20000,
        moderation: 'APPROVED',
        publishedAt: new Date(),
      },
    });
    instructorId = instructor.id;
    const danceClass = await db.danceClass.create({
      data: {
        instructorId: instructor.id,
        slug: key,
        title: 'Approval lesson',
        description: 'Approval lesson',
        style: 'BALLROOM',
        level: 'BEGINNER',
        durationMinutes: 60,
        price: 20000,
        capacity: 2,
        learningPoints: [],
        lessonType: 'PAIR',
      },
    });
    classId = danceClass.id;
    const startsAt = new Date(Date.now() + 7 * 86_400_000);
    startsAt.setUTCHours(10, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 3_600_000);
    await db.classSession.create({ data: { classId: danceClass.id, startsAt, endsAt, capacity: 2 } });

    const booking = await db.booking.create({
      data: {
        reference,
        subject: 'CLASS_SESSION',
        status: 'CONFIRMED',
        customerId: customer.id,
        instructorId: instructor.id,
        startsAt,
        endsAt,
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

    const adminUser = await db.user.findUniqueOrThrow({ where: { email: admin.email }, select: { id: true } });
    const approverUser = await db.user.findUniqueOrThrow({ where: { email: approver.email }, select: { id: true } });

    /* 1. Первый админ подаёт заявку. */
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/bookings')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(admin.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await expect(page.locator('.admin-shell')).toBeVisible({ timeout: 30_000 });

    await page.goto(`/en/admin/bookings?q=${encodeURIComponent(reference)}`);
    await page.locator(`input[name="ids"][value="${booking.id}"]:visible`).check();
    await page.getByRole('button', { name: en.admin.bookings.bulkCancelCta }).click();
    await page.locator('#booking-bulk-cancel-reason').fill('E2E: одобрение второго админа');
    await page.getByRole('button', { name: en.admin.bookings.bulkCancelSubmit }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Cancellation request for' })).toContainText(
      'Cancellation request for 1 bookings sent for approval',
    );

    const requests = await db.approvalRequest.findMany({
      where: { action: 'booking.bulkCancel', requestedById: adminUser.id, status: 'PENDING' },
      select: { id: true, payload: true },
    });
    requestIds = requests
      .filter((request) => ((request.payload as { bookingIds?: string[] } | null)?.bookingIds ?? []).includes(booking.id))
      .map((request) => request.id);
    expect(requestIds).toHaveLength(1);

    /* Автор не видит у своей заявки кнопку одобрения. */
    await page.goto('/en/admin/approvals');
    const ownCard = page.locator('li').filter({ hasText: booking.id });
    await expect(ownCard).toHaveCount(1);
    await expect(ownCard.getByRole('button', { name: en.admin.actions.approve })).toHaveCount(0);

    /* 2. Второй админ одобряет ту же заявку. */
    await page.context().clearCookies();
    await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent('/admin/approvals')}`);
    await page.getByLabel(en.auth.signIn.emailLabel).fill(approver.email);
    await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
    await page.getByRole('button', { name: en.auth.signIn.submit }).click();
    await completeTwoFactor(page);
    await page.waitForURL(/\/admin\/approvals/, { timeout: 30_000 });

    const approverCard = page.locator('li').filter({ hasText: booking.id });
    await expect(approverCard).toHaveCount(1);
    await approverCard.getByRole('button', { name: en.admin.actions.approve }).click();

    /* Отмена выполняется после одобрения, а не при подаче заявки. */
    await expect
      .poll(async () => (await db.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { status: true } })).status, { timeout: 30_000 })
      .toMatch(/^CANCELLED_/);

    const decided = await db.approvalRequest.findUniqueOrThrow({
      where: { id: requestIds[0] },
      select: { status: true, reviewedById: true },
    });
    expect(decided.status).toBe('APPROVED');
    expect(decided.reviewedById).toBe(approverUser.id);
  } finally {
    const userIds = [customerId, teacherId].filter((id): id is string => Boolean(id));
    if (userIds.length > 0) {
      await db.notification.deleteMany({ where: { userId: { in: userIds } } });
    }
    await db.approvalRequest.deleteMany({ where: { id: { in: requestIds } } });
    if (bookingId) await db.booking.deleteMany({ where: { id: bookingId } });
    if (classId) {
      await db.classSession.deleteMany({ where: { classId } });
      await db.danceClass.delete({ where: { id: classId } });
    }
    if (instructorId) await db.instructorProfile.delete({ where: { id: instructorId } });
    if (userIds.length > 0) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
});
