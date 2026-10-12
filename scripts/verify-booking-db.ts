import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const url = new URL(process.env.BOOKING_TEST_DATABASE_URL ?? '');
process.env.DATABASE_URL = url.toString();
// Verification must never send real email, even if the shell contains credentials.
process.env.RESEND_API_KEY = '';
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_ci')) {
  throw new Error('Verification requires an isolated loopback database whose name ends with _ci.');
}

const { db } = await import('../src/lib/db');
const { createBookingFromHold, cancelBooking } = await import('../src/server/booking/service');
const { redeemClassPassForBooking } = await import('../src/server/class-pass/service');
const prefix = `booking-probe-${randomUUID()}`;
const now = new Date();
const startsAt = new Date(now.getTime() + 7 * 86400000);
const endsAt = new Date(startsAt.getTime() + 3600000);
const customer = await db.user.create({ data: { email: `${prefix}@example.test`, name: 'Database probe' } });
const teacher = await db.user.create({ data: { email: `${prefix}-teacher@example.test`, name: 'Teacher probe' } });
const instructor = await db.instructorProfile.create({ data: { userId: teacher.id, slug: prefix, headline: 'Probe', bio: 'Probe', styles: ['BALLROOM'], yearsExperience: 1, hourlyRateFrom: 20000, moderation: 'APPROVED', publishedAt: now } });
const danceClass = await db.danceClass.create({ data: { instructorId: instructor.id, slug: prefix, title: 'Pair probe', description: 'Probe', style: 'BALLROOM', level: 'BEGINNER', durationMinutes: 60, price: 20000, capacity: 2, learningPoints: [], lessonType: 'PAIR' } });
const session = await db.classSession.create({ data: { classId: danceClass.id, startsAt, endsAt, capacity: 2 } });
const results: string[] = [];
try {
  const hold = await db.slotHold.create({ data: { userId: customer.id, instructorId: instructor.id, sessionId: session.id, startsAt, endsAt, expiresAt: new Date(now.getTime() + 600000) } });
  const pair = await createBookingFromHold({ holdId: hold.id, userId: customer.id, partnerName: 'Partner', now });
  const saved = await db.booking.findUniqueOrThrow({ where: { id: pair.id } });
  assert.equal(saved.partnerName, 'Partner');
  assert.equal(saved.participants, 2);
  assert.equal(saved.basePrice, 20000);
  assert.equal((await db.classSession.findUniqueOrThrow({ where: { id: session.id } })).bookedCount, 2);
  const cancellations = await Promise.allSettled(Array.from({ length: 8 }, () => cancelBooking({ bookingId: pair.id, userId: customer.id, now })));
  assert.equal(cancellations.filter(result => result.status === 'fulfilled').length, 1);
  for (const result of cancellations) if (result.status === 'rejected') assert.equal(result.reason.code, 'CANCELLATION_WINDOW_CLOSED');
  assert.equal((await db.classSession.findUniqueOrThrow({ where: { id: session.id } })).bookedCount, 0);
  results.push('pair persists partner, reserves two seats and releases them once across 8 concurrent cancellations');

  const pass = await db.classPass.create({ data: { purchaserId: customer.id, lessonsTotal: 1, lessonsRemaining: 1, pricePaid: 10000, expiresAt: new Date(now.getTime() + 30 * 86400000) } });
  const bookingData = { customerId: customer.id, subject: 'CLASS_SESSION' as const, lessonType: 'GROUP' as const, status: 'CONFIRMED' as const, startsAt, endsAt, basePrice: 10000, totalPrice: 10000, cancellationWindowHours: 24, lateCancellationRate: 0.5, rescheduleWindowHours: 24, maxReschedules: 2 };
  const bookings = await Promise.all(Array.from({ length: 8 }, (_, index) => db.booking.create({ data: { ...bookingData, reference: `${prefix}-${index}` } })));
  const redemptionResults = await Promise.allSettled(bookings.map(booking => redeemClassPassForBooking({ userId: customer.id, passId: pass.id, bookingId: booking.id, now })));
  assert.equal(redemptionResults.filter(result => result.status === 'fulfilled').length, 1);
  for (const result of redemptionResults) if (result.status === 'rejected') assert.equal(result.reason.code, 'VALIDATION_FAILED');
  assert.equal((await db.classPass.findUniqueOrThrow({ where: { id: pass.id } })).lessonsRemaining, 0);
  assert.equal(await db.classPassRedemption.count({ where: { passId: pass.id } }), 1);
  const redemption = await db.classPassRedemption.findFirstOrThrow({ where: { passId: pass.id } });
  const returns = await Promise.allSettled(Array.from({ length: 8 }, () => cancelBooking({ bookingId: redemption.bookingId, userId: customer.id, now })));
  assert.equal(returns.filter(result => result.status === 'fulfilled').length, 1);
  for (const result of returns) if (result.status === 'rejected') assert.equal(result.reason.code, 'CANCELLATION_WINDOW_CLOSED');
  assert.equal((await db.classPass.findUniqueOrThrow({ where: { id: pass.id } })).lessonsRemaining, 1);
  assert.equal(await db.classPassRedemption.count({ where: { passId: pass.id } }), 0);
  results.push('one remaining lesson cannot be spent twice across 8 concurrent redemptions; cancellation returns it once');

  await db.danceClass.update({ where: { id: danceClass.id }, data: { lessonType: 'GROUP' } });
  const groupHolds = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
    const start = new Date(startsAt.getTime() + (index + 1) * 86400000);
    const end = new Date(start.getTime() + 3600000);
    const group = await db.classSession.create({ data: { classId: danceClass.id, startsAt: start, endsAt: end, capacity: 2 } });
    return db.slotHold.create({ data: { userId: customer.id, instructorId: instructor.id, sessionId: group.id, startsAt: start, endsAt: end, expiresAt: new Date(now.getTime() + 600000) } });
  }));
  const created = await Promise.allSettled(groupHolds.map(hold => createBookingFromHold({ holdId: hold.id, userId: customer.id, useClassPass: true, now })));
  assert.equal(created.filter(result => result.status === 'fulfilled').length, 1);
  for (const result of created) if (result.status === 'rejected') assert.equal(result.reason.code, 'VALIDATION_FAILED');
  assert.equal((await db.classPass.findUniqueOrThrow({ where: { id: pass.id } })).lessonsRemaining, 0);
  assert.equal(await db.classPassRedemption.count({ where: { passId: pass.id } }), 1);
  const remainingHolds = await db.slotHold.count({ where: { userId: customer.id } });
  assert.equal(remainingHolds, 7, 'Failed bookings must roll back consumed holds');
  const reserved = await db.classSession.aggregate({ where: { classId: danceClass.id }, _sum: { bookedCount: true } });
  assert.equal(reserved._sum.bookedCount, 1, 'Failed bookings must roll back reserved seats');
  results.push('8 concurrent bookings using one pass create one booking; losing transactions retain holds and do not reserve seats');
  for (const result of results) console.log(`PASS ${result}`);
} finally {
  // Only records owned by this randomly named probe are removed.
  await db.classPassRedemption.deleteMany({ where: { booking: { customerId: customer.id } } });
  await db.notification.deleteMany({ where: { userId: customer.id } });
  await db.booking.deleteMany({ where: { customerId: customer.id } });
  await db.slotHold.deleteMany({ where: { userId: customer.id } });
  await db.classPass.deleteMany({ where: { purchaserId: customer.id } });
  await db.classSession.deleteMany({ where: { classId: danceClass.id } });
  await db.danceClass.delete({ where: { id: danceClass.id } });
  await db.instructorProfile.delete({ where: { id: instructor.id } });
  await db.user.deleteMany({ where: { id: { in: [customer.id, teacher.id] } } });
  await db.$disconnect();
}
