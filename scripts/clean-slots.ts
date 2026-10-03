/**
 * clean-slots — делает все слоты свободными для реального теста.
 *
 * Что чистит:
 *  - SlotHold      (все удержания слотов)
 *  - WaitlistEntry (лист ожидания)
 *  - ClassSession.bookedCount -> 0
 *  - Event.bookedCount        -> 0
 *
 * Что НЕ трогает:
 *  - InstructorProfile, User, Venue, Room, DanceClass, Product и т.д.
 *    Инструкторы остаются как реальные — их можно редактировать/удалять через админку.
 *
 * Флаги:
 *  --full  дополнительно удаляет Booking + Payment + Refund + WebhookEvent + CommissionRecord + ClassPassRedemption
 *          (полный сброс бронирований после тестовых прогонов)
 *
 * Запуск:
 *  npm run db:clean          — только слоты
 *  npm run db:clean:full     — слоты + все брони/платежи
 *  CLEAN_SLOTS=true npm run db:seed  — сид сразу без занятых мест (см. prisma/seed.ts)
 */

import { config as loadEnv } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error('clean-slots — не задан DIRECT_DATABASE_URL / DATABASE_URL');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const full = process.argv.includes('--full');

async function main() {
  console.log(`clean-slots — старт ${full ? '(FULL: + брони/платежи)' : '(только слоты)'}`);

  const before = {
    bookings: await prisma.booking.count(),
    holds: await prisma.slotHold.count(),
    waitlist: await prisma.waitlistEntry.count(),
    payments: await prisma.payment.count(),
    commissions: await prisma.commissionRecord.count(),
    sessionsWithBooked: await prisma.classSession.count({ where: { bookedCount: { gt: 0 } } }),
    eventsWithBooked: await prisma.event.count({ where: { bookedCount: { gt: 0 } } }),
  };
  console.log('  до:', before);

  if (full && before.bookings > 0) {
    // Порядок важен из-за FK
    const refunds = await prisma.refund.deleteMany({});
    console.log(`  refunds удалено: ${refunds.count}`);
    const webhooks = await prisma.webhookEvent.deleteMany({});
    console.log(`  webhookEvents удалено: ${webhooks.count}`);
    const paymentsDel = await prisma.payment.deleteMany({});
    console.log(`  payments удалено: ${paymentsDel.count}`);
    const commissions = await prisma.commissionRecord.deleteMany({});
    console.log(`  commissions удалено: ${commissions.count}`);
    // ClassPassRedemption / Dispute / Review с bookingId — чистим если есть
    try {
      const redemptions = await (prisma as unknown as { classPassRedemption: { deleteMany: (a: unknown) => Promise<{ count: number }> } }).classPassRedemption.deleteMany({});
      if (redemptions.count) console.log(`  redemptions удалено: ${redemptions.count}`);
    } catch {}
    try {
      const disputes = await (prisma as unknown as { dispute: { deleteMany: (a: unknown) => Promise<{ count: number }> } }).dispute.deleteMany({});
      if (disputes.count) console.log(`  disputes удалено: ${disputes.count}`);
    } catch {}
    const bookingsDel = await prisma.booking.deleteMany({});
    console.log(`  bookings удалено: ${bookingsDel.count}`);
  } else if (full) {
    console.log('  брони уже 0 — пропускаем каскад');
  }

  const holdsDel = await prisma.slotHold.deleteMany({});
  console.log(`  slotHolds удалено: ${holdsDel.count}`);

  const waitlistDel = await prisma.waitlistEntry.deleteMany({});
  console.log(`  waitlist удалено: ${waitlistDel.count}`);

  const sessionsUpd = await prisma.classSession.updateMany({
    where: { bookedCount: { gt: 0 } },
    data: { bookedCount: 0 },
  });
  console.log(`  classSessions обнулено: ${sessionsUpd.count}`);

  const eventsUpd = await prisma.event.updateMany({
    where: { bookedCount: { gt: 0 } },
    data: { bookedCount: 0 },
  });
  console.log(`  events обнулено: ${eventsUpd.count}`);

  const after = {
    bookings: await prisma.booking.count(),
    holds: await prisma.slotHold.count(),
    waitlist: await prisma.waitlistEntry.count(),
    payments: await prisma.payment.count(),
    commissions: await prisma.commissionRecord.count(),
    sessionsWithBooked: await prisma.classSession.count({ where: { bookedCount: { gt: 0 } } }),
    eventsWithBooked: await prisma.event.count({ where: { bookedCount: { gt: 0 } } }),
  };
  console.log('  после:', after);

  const clean = after.holds === 0 && after.waitlist === 0 && after.sessionsWithBooked === 0 && after.eventsWithBooked === 0 && (!full || (after.bookings === 0 && after.payments === 0));
  console.log(clean ? 'clean-slots — ГОТОВО: все слоты свободны' : 'clean-slots — ВНИМАНИЕ: остались занятые записи');
  if (!clean) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('clean-slots — ошибка:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
