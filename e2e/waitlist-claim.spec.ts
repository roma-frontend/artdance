/**
 * Лист ожидания: клиент из письма «место освободилось» входит, занимает место и
 * попадает на подтверждение брони.
 *
 * Подготовка пишет в тестовую базу напрямую: занятие заполняется, клиент встаёт в
 * лист с уже открытым окном удержания. После теста состояние возвращается, а
 * удержание, созданное кнопкой, удаляется. Запускается только в проекте desktop:
 * все проекты делят одну тестовую базу, и занятие нельзя занять параллельно.
 */

import { expect, test } from '@playwright/test';
import { PrismaPg } from '@prisma/adapter-pg';

import { demoAccounts, demoPassword } from '../prisma/fixtures/demo';
import { PrismaClient } from '../src/generated/prisma/client';
import en from '../src/i18n/messages/en';
import { completeTwoFactor } from './support/two-factor';

const client = demoAccounts.find((account) => account.role === 'CUSTOMER')!;

test('клиент из письма занимает место и попадает на подтверждение брони', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'одна тестовая сессия: только в desktop');

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email: client.email }, select: { id: true } });
    const session = await db.classSession.findFirstOrThrow({
      where: { isCancelled: false, startsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, capacity: true, bookedCount: true },
    });

    await db.waitlistEntry.deleteMany({ where: { sessionId: session.id, userId: user.id } });
    await db.slotHold.deleteMany({ where: { sessionId: session.id, userId: user.id } });
    await db.classSession.update({ where: { id: session.id }, data: { bookedCount: session.capacity - 1 } });
    await db.waitlistEntry.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        position: 1,
        notifiedAt: new Date(),
        claimUntil: new Date(Date.now() + 60 * 60_000),
      },
    });

    try {
      await page.goto(`/en/sign-in?redirectTo=${encodeURIComponent(`/waitlist/${session.id}`)}`);
      await page.getByLabel(en.auth.signIn.emailLabel).fill(client.email);
      await page.getByLabel(en.auth.signIn.passwordLabel).fill(demoPassword);
      await page.getByRole('button', { name: en.auth.signIn.submit }).click();
      await completeTwoFactor(page);

      await page.waitForURL(/\/waitlist\//, { timeout: 30_000 });
      await expect(page.getByRole('heading', { level: 1, name: en.waitlistClaim.title })).toBeVisible();
      const claim = page.getByRole('button', { name: en.waitlistClaim.cta });
      await expect(claim).toBeVisible();
      await claim.click();

      await page.waitForURL(/\/booking\/[^/]+\/confirm/, { timeout: 30_000 });
      expect(new URL(page.url()).pathname).toMatch(/\/booking\/[^/]+\/confirm$/);
    } finally {
      await db.slotHold.deleteMany({ where: { sessionId: session.id, userId: user.id } });
      await db.waitlistEntry.deleteMany({ where: { sessionId: session.id, userId: user.id } });
      await db.classSession.update({ where: { id: session.id }, data: { bookedCount: session.bookedCount } });
    }
  } finally {
    await db.$disconnect();
  }
});
