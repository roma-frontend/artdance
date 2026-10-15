/** Synthetic illustration fixtures. NEVER permitted on a shared or remote DB. */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';

const connectionString = process.env.MANUAL_DATABASE_URL;
if (!connectionString) throw new Error('Set MANUAL_DATABASE_URL to a dedicated local *_manual_ci database.');
const url = new URL(connectionString);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_manual_ci')) {
  throw new Error('Refusing fixtures: only loopback *_manual_ci databases are allowed.');
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const now = new Date();
const later = new Date(now.getTime() + 14 * 86400000);
try {
  const support = await db.user.findUniqueOrThrow({ where: { email: 'support@demo.artdance.am' } });
  const customer = await db.user.findFirstOrThrow({ where: { role: 'CUSTOMER' } });
  const instructor = await db.instructorProfile.findFirstOrThrow();
  const session = await db.classSession.findFirstOrThrow({ orderBy: { startsAt: 'asc' } });
  const product = await db.product.findFirstOrThrow();
  // Separate demo-only profile lets the allowlisted operator illustrate their own schedule.
  await db.instructorProfile.upsert({ where: { id: 'manual-instructor' }, update: {}, create: {
    id: 'manual-instructor', userId: support.id, slug: 'manual-instructor',
    headline: 'Demonstration instructor', bio: 'Synthetic manual fixture, not a real service.',
    styles: ['BALLROOM'], specializations: ['Standard'], hourlyRateFrom: 12000, languages: ['en', 'hy'], moderation: 'APPROVED',
  } });
  for (const [index, startTime, endTime] of [[0, '09:00', '12:00'], [1, '13:00', '17:00']] as const) {
    await db.availabilityRule.upsert({ where: { id: `manual-rule-${index}` }, update: {}, create: {
      id: `manual-rule-${index}`, instructorId: 'manual-instructor', weekday: 1, startTime, endTime,
    } });
  }
  for (const [index, status] of (['CONFIRMED', 'PENDING', 'COMPLETED'] as const).entries()) {
    await db.booking.upsert({ where: { id: `manual-booking-${index}` }, update: {}, create: {
      id: `manual-booking-${index}`, reference: `DEMO-BOOK-${index + 1}`, subject: 'CLASS_SESSION',
      status, customerId: customer.id, instructorId: instructor.id, sessionId: session.id,
      startsAt: session.startsAt, endsAt: session.endsAt, lessonType: index === 0 ? 'PAIR' : 'GROUP',
      participants: index === 0 ? 2 : 1, partnerName: index === 0 ? 'Demo Partner' : null,
      basePrice: 12000, totalPrice: 12000, cancellationWindowHours: 24, lateCancellationRate: 0.5,
      rescheduleWindowHours: 24, maxReschedules: 2, notes: 'SYNTHETIC MANUAL EXAMPLE — no real payment.',
    } });
  }
  await db.classSession.update({ where: { id: session.id }, data: { bookedCount: 4 } });
  for (const [index, status] of (['PAID', 'PACKING', 'SHIPPED'] as const).entries()) {
    const id = `manual-order-${index}`;
    await db.order.upsert({ where: { id }, update: {}, create: {
      id, orderNumber: `DEMO-ORDER-${index + 1}`, userId: customer.id, status,
      contactName: 'Demo Customer', contactEmail: 'customer@example.invalid', contactPhone: '000000000',
      subtotal: 24000, total: 24000, vatRate: 0.2, paidAt: now,
      items: { create: { type: 'PRODUCT', titleSnapshot: 'Demonstration dance shoes', quantity: 1, unitPrice: 24000, lineTotal: 24000 } },
      payments: { create: { provider: 'manual-fixture', method: 'CARD', status: 'PAID', amount: 24000,
        paidAmount: 24000, paidAt: now, idempotencyKey: `manual-payment-${index}` } },
    } });
  }
  await db.review.upsert({ where: { id: 'manual-review' }, update: { moderation: 'PENDING' }, create: {
    id: 'manual-review', authorId: customer.id, productId: product.id, rating: 5,
    body: 'Demonstration review awaiting a moderation decision. / Ուսումնական կարծիք՝ ստուգման համար։', moderation: 'PENDING',
  } });
  await db.payoutAccount.upsert({ where: { id: 'manual-payout-account' }, update: {}, create: {
    id: 'manual-payout-account', instructorId: instructor.id, method: 'bank', accountName: 'Demo payee',
    accountMasked: 'DEMO **** 0000', bankName: 'Example bank — not real', isVerified: true,
  } });
  for (const [index, status] of (['SCHEDULED', 'PAID', 'ON_HOLD'] as const).entries()) {
    await db.payout.upsert({ where: { id: `manual-payout-${index}` }, update: {}, create: {
      id: `manual-payout-${index}`, reference: `DEMO-PAYOUT-${index + 1}`, accountId: 'manual-payout-account',
      periodStart: new Date(now.getTime() - 7 * 86400000), periodEnd: now, amount: 18000, status,
      idempotencyKey: `manual-payout-${index}`, processedAt: status === 'PAID' ? now : null,
    } });
  }
  await db.giftCard.upsert({ where: { id: 'manual-gift' }, update: {}, create: {
    id: 'manual-gift', code: 'DEMO-NOT-REDEEMABLE', purchaserId: customer.id,
    initialAmount: 20000, balance: 15000, expiresAt: later, recipientEmail: 'recipient@example.invalid',
  } });
  await db.banner.upsert({ where: { id: 'manual-banner' }, update: {}, create: {
    id: 'manual-banner', key: 'manual-demo', title: 'Demo banner', href: '/classes', isActive: false, order: 99,
  } });
  const retiredProduct = await db.product.findFirstOrThrow({ where: { deletedAt: null } });
  await db.product.update({ where: { id: retiredProduct.id }, data: { deletedAt: now } });
  await db.approvalRequest.upsert({ where: { id: 'manual-approval' }, update: { expiresAt: later }, create: {
    id: 'manual-approval', action: 'payments.refund', requestedById: support.id, expiresAt: later,
    payload: { orderId: 'manual-order-0', amount: 10000, reason: 'DEMO ONLY — do not approve; illustration of review controls.' },
  } });
  await db.supportTicket.upsert({ where: { id: 'manual-ticket' }, update: {}, create: {
    id: 'manual-ticket', name: 'Demo Customer', email: 'customer@example.invalid', topic: 'booking',
    message: 'Please help locate DEMO-BOOK-1. / Խնդրում եմ օգնել գտնել ուսումնական ամրագրումը։', locale: 'hy', status: 'OPEN',
  } });
  await db.auditLog.upsert({ where: { id: 'manual-audit' }, update: {}, create: {
    id: 'manual-audit', actorId: support.id, actorRole: 'SUPPORT', actorEmail: 'operator@example.invalid',
    action: 'manual.demo.fixture', entityType: 'Banner', entityId: 'manual-banner', reason: 'Synthetic documentation fixture',
  } });
  console.log('Manual-only fixtures ready: bookings, orders, reviews, payouts, gift cards, support, approvals, trash and availability.');
} finally { await db.$disconnect(); }
