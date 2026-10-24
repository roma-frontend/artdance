import 'server-only';
import { booking } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { publicClassWhere } from '@/server/queries/classes';
import { notTrashed } from '@/server/queries/relations';
import { slotBlockingBookingStatuses } from '@/domain/enums';
import { isHoldExpired } from '@/domain/slot-hold';
import { cancellationOutcome, refundAmountFor, rescheduleOutcome, type BookingSnapshot } from '@/domain/booking/policy';
import { assertInsideAvailability, assertNoConflict } from '@/domain/availability/conflicts';
import { expandRules } from '@/domain/availability/compute';
import { site } from '@/config/site';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { notifyBookingCancelled, notifyBookingConfirmed, notifyWaitlistReady } from '@/server/booking/notify';
import { creditWallet } from '@/server/wallet/service';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
function isUniqueViolation(error: unknown): boolean { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'; }
function refFromId(id: string): string { return 'BK-' + id.slice(-8).toUpperCase(); }
export interface CreateBookingInput { holdId: string; userId?: string | null; anonymousId?: string | null; locationOption?: 'STUDIO' | 'CUSTOMER_LOCATION' | 'ONLINE'; customerAddress?: string | null; partnerName?: string | null; useClassPass?: boolean; now: Date; }
export async function createBookingFromHold(input: CreateBookingInput) {
  const { holdId, userId, anonymousId, now } = input;
  if (!userId && !anonymousId) throw domainErrors.unauthorized();
  const hold = await db.slotHold.findUnique({ where: { id: holdId } });
  if (!hold) throw domainErrors.notFound();
  const owned = (userId && hold.userId === userId) || (anonymousId && hold.anonymousId === anonymousId);
  if (!owned) throw domainErrors.forbidden();
  if (isHoldExpired(hold, now)) throw domainErrors.holdExpired();
  let basePrice: number | null = null;
  let danceClass: { id: string; price: number; venueId: string | null; lessonType: 'GROUP' | 'PRIVATE' | 'PAIR' } | null = null;
  let session: { id: string; capacity: number; bookedCount: number } | null = null;
  let sessionClassId: string | null = null;
  if (hold.sessionId) {
    const s = await db.classSession.findFirst({
      where: { id: hold.sessionId, ...notTrashed, isCancelled: false, danceClass: { ...notTrashed, ...publicClassWhere } },
      select: { id: true, capacity: true, bookedCount: true, classId: true, startsAt: true, endsAt: true,
        danceClass: { select: { instructorId: true, lessonType: true } } },
    });
    if (!s) throw domainErrors.notFound();
    if (s.startsAt.getTime() !== hold.startsAt.getTime() || s.endsAt.getTime() !== hold.endsAt.getTime()
      || s.danceClass.instructorId !== hold.instructorId) throw domainErrors.slotUnavailable();
    if (s.startsAt <= now) throw domainErrors.slotUnavailable();
    if (input.locationOption && input.locationOption !== 'STUDIO') throw domainErrors.validationFailed('locationOption');
    session = { id: (s as { id: string }).id, capacity: (s as { capacity: number }).capacity, bookedCount: (s as { bookedCount: number }).bookedCount };
    sessionClassId = (s as { classId: string }).classId;
    const dc = await db.danceClass.findUnique({ where: { id: sessionClassId }, select: { id: true, price: true, venueId: true, lessonType: true } });
    if (dc) danceClass = dc as { id: string; price: number; venueId: string | null; lessonType: 'GROUP' | 'PRIVATE' | 'PAIR' };
  } else if (hold.instructorId) {
    const cls = await db.danceClass.findFirst({ where: { instructorId: hold.instructorId, isActive: true, deletedAt: null } as never, orderBy: { id: 'asc' }, select: { id: true, price: true, venueId: true, lessonType: true } });
    if (cls) { danceClass = cls as { id: string; price: number; venueId: string | null; lessonType: 'GROUP' | 'PRIVATE' | 'PAIR' }; basePrice = (cls as { price: number }).price; }
  }
  if (basePrice == null) { if (danceClass) basePrice = danceClass.price; else throw domainErrors.notFound(); }
  const locationOption = (input.locationOption ?? 'STUDIO') as 'STUDIO' | 'CUSTOMER_LOCATION' | 'ONLINE';
  // B-10 динамическая цена: пиковые/выходные по Asia/Yerevan, не по серверному UTC
  const { priceForSlot, isPeakHour, isWeekendDay } = await import('@/domain/dynamic-pricing');
  const { zonedParts } = await import('@/lib/time/schedule');
  const zParts = zonedParts(hold.startsAt, site.timeZone);
  const startHour = Math.floor(zParts.minutesOfDay / 60);
  // zonedParts не暴露 weekday; вычисляем через fromZonedParts-совместимый day, либо используем UTC-для-недели fallback на Yerevan через offset — берём getDay в Yerevan через Intl
  const yDay = new Intl.DateTimeFormat('en-US', { timeZone: site.timeZone, weekday: 'short' }).format(hold.startsAt);
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const startDow = dayMap[yDay] ?? hold.startsAt.getDay();
  const dynamicPrice = priceForSlot(basePrice, { isPeak: isPeakHour(startHour), isWeekend: isWeekendDay(startDow) });
  const travelFee = locationOption === 'CUSTOMER_LOCATION' ? booking.travelFee : 0;
  const totalPrice = dynamicPrice + travelFee;
  const cancellationWindowHours = booking.freeCancellationHours;
  const lateCancellationRate = booking.lateCancellationFeeRate;
  const rescheduleWindowHours = booking.freeRescheduleHours;
  const maxReschedules = booking.maxReschedulesPerBooking;
  const customerId = userId ?? hold.userId ?? null;
  if (!customerId) throw domainErrors.unauthorized();
  const venueId = danceClass?.venueId ?? null;
  const lessonType = session ? (danceClass?.lessonType ?? 'GROUP') : 'PRIVATE';
  const participants = lessonType === 'PAIR' ? 2 : 1;
  const partnerName = input.partnerName?.trim() || null;
  if (lessonType === 'PAIR' && (!partnerName || partnerName.length > 160)) throw domainErrors.validationFailed('partnerName');
  if (lessonType !== 'PAIR' && partnerName) throw domainErrors.validationFailed('partnerName');
  if (input.useClassPass && lessonType !== 'GROUP') throw domainErrors.validationFailed('classPass');
  const bookedCheck = session;
  let createdId: string | null = null;
  try {
    const result = await db.$transaction(async (tx) => {
      if (bookedCheck && bookedCheck.bookedCount + participants > bookedCheck.capacity) throw domainErrors.capacityExceeded(Math.max(0, bookedCheck.capacity - bookedCheck.bookedCount));
      const consumed = await tx.slotHold.deleteMany({ where: { id: hold.id, expiresAt: { gt: now } } });
      if (consumed.count !== 1) throw domainErrors.holdExpired();
      if (session) {
        const reserved = await tx.classSession.updateMany({
          where: { id: session.id, ...notTrashed, isCancelled: false, bookedCount: { lte: session.capacity - participants } },
          data: { bookedCount: { increment: participants } },
        });
        if (reserved.count !== 1) throw domainErrors.capacityExceeded(0);
      }
      // Buffer-aware conflict: расширяем окно запроса и учитываем roomId
      const bufMs = booking.bufferBetweenBookingsMinutes * 60_000;
      const conflictWhere: Record<string, unknown> = {
        ...(hold.instructorId ? { instructorId: hold.instructorId } : hold.roomId ? { roomId: hold.roomId } : {}),
        startsAt: { lt: new Date(hold.endsAt.getTime() + bufMs) },
        endsAt: { gt: new Date(hold.startsAt.getTime() - bufMs) },
        status: { in: [...slotBlockingBookingStatuses] },
      };
      if (session && hold.instructorId) {
        // Для групповых: конфликт если другая сессия в то же время у того же инструктора
        (conflictWhere as Record<string, unknown>).OR = [{ sessionId: null }, { sessionId: { not: session.id } }];
      }
      const conflict = await tx.booking.findFirst({ where: conflictWhere as never });
      if (conflict) throw domainErrors.slotConflict();
       const subject = lessonType === 'PRIVATE' ? 'PRIVATE_SESSION' : 'CLASS_SESSION';
        let classPassId: string | null = null;
        let discountAmount = 0;
        let payableTotal = totalPrice;
        if (input.useClassPass) {
          if (lessonType !== 'GROUP') throw domainErrors.validationFailed('classPass');
          // Entitlement guard (server-side, inside tx): packages disabled → FEATURE_DISABLED
          await assertEntitlementOrThrow('packages');
          const pass = await tx.classPass.findFirst({
           where: { purchaserId: customerId, lessonsRemaining: { gt: 0 }, expiresAt: { gt: now } },
           orderBy: [{ expiresAt: 'asc' }, { lessonsRemaining: 'asc' }],
           select: { id: true },
         });
         if (!pass) throw domainErrors.validationFailed('classPass');
         classPassId = pass.id;
         discountAmount = dynamicPrice;
         payableTotal = travelFee;
       }
       const created = await tx.booking.create({ data: { reference: 'tmp-' + hold.id.slice(-6), subject, lessonType, status: 'CONFIRMED', customerId, instructorId: hold.instructorId, venueId, roomId: hold.roomId, sessionId: hold.sessionId, startsAt: hold.startsAt, endsAt: hold.endsAt, participants, partnerName: lessonType === 'PAIR' ? partnerName : null, locationOption, customerAddress: input.customerAddress ?? null, basePrice, travelFee, discountAmount, totalPrice: payableTotal, cancellationWindowHours, lateCancellationRate, rescheduleWindowHours, maxReschedules }, select: { id: true, reference: true } });
       if (classPassId) {
         const redeemed = await tx.classPass.updateMany({ where: { id: classPassId, purchaserId: customerId, lessonsRemaining: { gt: 0 }, expiresAt: { gt: now } }, data: { lessonsRemaining: { decrement: 1 } } });
         if (redeemed.count !== 1) throw domainErrors.validationFailed('classPass');
         await tx.classPassRedemption.create({ data: { passId: classPassId, bookingId: created.id } });
       }
      const ref = refFromId(created.id);
      const updated = await tx.booking.update({ where: { id: created.id }, data: { reference: ref }, select: { id: true, reference: true, totalPrice: true, startsAt: true, endsAt: true } });
      return updated;
    });
    createdId = result.id;
    void notifyBookingConfirmed(result.id).catch(() => {});
    return result;
  } catch (e) { if (isUniqueViolation(e)) throw domainErrors.slotConflict(); throw e; } finally { void createdId; }
}
export interface CancelBookingInput { bookingId: string; userId: string; now: Date; reason?: string | null; creditInsteadOfRefund?: boolean }
export async function cancelBooking(input: CancelBookingInput) {
  const b = await db.booking.findUnique({ where: { id: input.bookingId }, include: { payments: { where: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } }, select: { paidAmount: true, refunds: { where: { status: { in: ['PENDING', 'PAID', 'REFUNDED'] } }, select: { amount: true } } } } } });
  if (!b) throw domainErrors.notFound();
  if (b.customerId !== input.userId) throw domainErrors.forbidden();
  const snapshot: BookingSnapshot = { startsAt: b.startsAt, status: b.status as BookingSnapshot['status'], totalPrice: b.totalPrice, cancellationWindowHours: b.cancellationWindowHours, lateCancellationRate: Number(b.lateCancellationRate), rescheduleWindowHours: b.rescheduleWindowHours, rescheduleCount: b.rescheduleCount, maxReschedules: b.maxReschedules };
  const outcome = cancellationOutcome(snapshot, input.now);
  if (outcome.kind === 'forbidden') { if (outcome.reason === 'ALREADY_STARTED') throw domainErrors.validationFailed('startsAt'); throw domainErrors.cancellationWindowClosed(); }
  const fee = outcome.kind === 'fee' ? outcome.amount : 0;
  const paid = b.payments.reduce((sum, payment) => sum + Math.max(0, payment.paidAmount - payment.refunds.reduce((total, refund) => total + refund.amount, 0)), 0);
  const refund = refundAmountFor(outcome, paid);
  const txResult = await db.$transaction(async (tx) => {
    // Compare-and-set locks the booking before returning seats or pass credit.
    const claimed = await tx.booking.updateMany({
      where: { id: b.id, customerId: input.userId, status: b.status, updatedAt: b.updatedAt },
      data: { status: 'CANCELLED_BY_CUSTOMER', cancelledAt: input.now, cancellationReason: input.reason ?? (outcome.kind === 'fee' ? 'LATE_FEE:' + fee : null) },
    });
    if (claimed.count !== 1) throw domainErrors.cancellationWindowClosed();
    const updated = await tx.booking.findUniqueOrThrow({ where: { id: b.id }, select: { id: true, reference: true, status: true, totalPrice: true } });
    if (b.sessionId) {
      const released = await tx.classSession.updateMany({ where: { id: b.sessionId, bookedCount: { gte: b.participants } }, data: { bookedCount: { decrement: b.participants } } });
      if (released.count !== 1) throw domainErrors.validationFailed('sessionId');
    }
     if (outcome.kind === 'free') {
       const redemption = await tx.classPassRedemption.findUnique({ where: { bookingId: b.id }, select: { id: true, passId: true } });
       if (redemption) {
         await tx.classPass.update({ where: { id: redemption.passId }, data: { lessonsRemaining: { increment: 1 } } });
         await tx.classPassRedemption.delete({ where: { id: redemption.id } });
       }
     }
    let waitlistClaimUntil: Date | null = null;
    let waitlistUserId: string | null = null;
    if (b.sessionId) { const next = await tx.waitlistEntry.findFirst({ where:{ sessionId: b.sessionId, notifiedAt: null }, orderBy:{ position:'asc' }}); if (next) { waitlistClaimUntil = new Date(input.now.getTime() + booking.waitlistClaimWindowMinutes*60_000); waitlistUserId = next.userId; await tx.waitlistEntry.update({ where:{ id: next.id }, data:{ notifiedAt: input.now, claimUntil: waitlistClaimUntil }}); } }
    return { booking: updated, fee, refund, outcome: outcome.kind, waitlistUserId, waitlistClaimUntil, sessionId: b.sessionId ?? null };
  });
  if (input.creditInsteadOfRefund && txResult.refund > 0) {
    try {
      await creditWallet({ userId: b.customerId, amount: txResult.refund, kind: 'CREDIT_REFUND', refId: b.id });
    } catch {}
  } else {
    void notifyBookingCancelled(b.id, txResult.refund).catch(()=>{});
  }
  if (txResult.waitlistUserId && txResult.sessionId && txResult.waitlistClaimUntil) {
    void notifyWaitlistReady(txResult.sessionId, txResult.waitlistUserId, txResult.waitlistClaimUntil).catch(()=>{});
  }
  return { booking: txResult.booking, fee: txResult.fee, refund: txResult.refund, outcome: txResult.outcome, credited: Boolean(input.creditInsteadOfRefund && txResult.refund > 0) };
}
/**
 * Автоотмена неоплаченных броней: PENDING старше `unpaidExpiryMinutes` без
 * успешного платежа переходит в EXPIRED, место и урок абонемента возвращаются.
 */
export async function expireUnpaidBookings(now: Date): Promise<{ expired: number }> {
  const cutoff = new Date(now.getTime() - booking.unpaidExpiryMinutes * 60_000);
  const stale = await db.booking.findMany({
    where: {
      status: 'PENDING',
      createdAt: { lte: cutoff },
      payments: { none: { status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } } },
    },
    select: { id: true, updatedAt: true, sessionId: true, participants: true },
  });
  let expired = 0;
  for (const b of stale) {
    const claimed = await db.$transaction(async (tx) => {
      // Compare-and-set: если бронь уже оплатили или изменили, не трогаем её.
      const result = await tx.booking.updateMany({
        where: { id: b.id, status: 'PENDING', updatedAt: b.updatedAt },
        data: { status: 'EXPIRED', cancellationReason: 'PAYMENT_TIMEOUT' },
      });
      if (result.count !== 1) return false;
      if (b.sessionId) {
        await tx.classSession.updateMany({ where: { id: b.sessionId, bookedCount: { gte: b.participants } }, data: { bookedCount: { decrement: b.participants } } });
      }
      const redemption = await tx.classPassRedemption.findUnique({ where: { bookingId: b.id }, select: { id: true, passId: true } });
      if (redemption) {
        await tx.classPass.update({ where: { id: redemption.passId }, data: { lessonsRemaining: { increment: 1 } } });
        await tx.classPassRedemption.delete({ where: { id: redemption.id } });
      }
      return true;
    });
    if (claimed) expired += 1;
  }
  return { expired };
}

export interface RescheduleBookingInput { bookingId: string; userId: string; now: Date; newStartsAt: Date; newEndsAt: Date; newPrice?: number | null; }
export async function rescheduleBooking(input: RescheduleBookingInput) {
  const b = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!b) throw domainErrors.notFound();
  if (b.customerId !== input.userId) throw domainErrors.forbidden();
  const snapshot: BookingSnapshot = { startsAt: b.startsAt, status: b.status as BookingSnapshot['status'], totalPrice: b.totalPrice, cancellationWindowHours: b.cancellationWindowHours, lateCancellationRate: Number(b.lateCancellationRate), rescheduleWindowHours: b.rescheduleWindowHours, rescheduleCount: b.rescheduleCount, maxReschedules: b.maxReschedules };
  // newPrice с клиента игнорируем — цену считаем серверно по тарифу инструктора + пиковый мультипликатор Asia/Yerevan
  const target = { start: input.newStartsAt, end: input.newEndsAt, price: b.totalPrice };
  const outcome = rescheduleOutcome(snapshot, target, input.now);
  if (outcome.kind === 'forbidden') {
    if (outcome.reason === 'LIMIT_REACHED') throw domainErrors.rescheduleLimitReached();
    if (outcome.reason === 'WINDOW_CLOSED') throw domainErrors.cancellationWindowClosed();
    if (outcome.reason === 'ALREADY_STARTED' || outcome.reason === 'INVALID_TARGET') throw domainErrors.validationFailed('startsAt');
    if (outcome.reason === 'SAME_TIME') throw domainErrors.validationFailed('startsAt');
    throw domainErrors.validationFailed('startsAt');
  }
  const durationMinutes = Math.round((input.newEndsAt.getTime() - input.newStartsAt.getTime())/60_000);
  let rules: { weekday:number; startTime:string; endTime:string; validFrom?: Date|null; validUntil?: Date|null; isActive?: boolean }[] = [];
  let exceptions: { start: Date; end: Date; isAvailable:boolean }[] = [];
  if (b.instructorId) {
    const profile = await db.instructorProfile.findUnique({ where:{ id: b.instructorId }, select:{ id:true }});
    if (!profile) throw domainErrors.notFound();
    rules = await db.availabilityRule.findMany({ where:{ instructorId: b.instructorId, isActive:true }, select:{ weekday:true, startTime:true, endTime:true, validFrom:true, validUntil:true, isActive:true }});
    const ex = await db.availabilityException.findMany({ where:{ instructorId: b.instructorId }, select:{ startsAt:true, endsAt:true, isAvailable:true }});
    exceptions = ex.map(e=>({ start:e.startsAt, end:e.endsAt, isAvailable:e.isAvailable }));
  }
  const windows = expandRules(rules as never, exceptions as never, { start: input.newStartsAt, end: input.newEndsAt }, site.timeZone);
  assertInsideAvailability(windows, { start: input.newStartsAt, end: input.newEndsAt });
  const busy = await db.booking.findMany({ where:{ id:{ not: b.id }, instructorId: b.instructorId ?? undefined, status:{ in:['PENDING','CONFIRMED'] as const }, startsAt:{ lt: input.newEndsAt }, endsAt:{ gt: input.newStartsAt } } as never, select:{ startsAt:true, endsAt:true }});
  const holds = await db.slotHold.findMany({ where:{ instructorId: b.instructorId ?? undefined, expiresAt:{ gt: input.now }, startsAt:{ lt: input.newEndsAt }, endsAt:{ gt: input.newStartsAt } } as never, select:{ startsAt:true, endsAt:true }});
  assertNoConflict([...busy, ...holds].map(r=>({ start:r.startsAt, end:r.endsAt })), { start: input.newStartsAt, end: input.newEndsAt }, booking.bufferBetweenBookingsMinutes);
  const newBase = b.basePrice;
  const newTravel = b.travelFee;
  // Moving a scheduled session requires reserving another session, not changing
  // timestamps while retaining its old ID. Keep that unsupported path closed.
  if (b.sessionId) throw domainErrors.validationFailed('sessionId');
  const newTotal = Math.max(0, newBase - b.discountAmount) + newTravel;
  return db.$transaction(async (tx)=>{
    const updated = await tx.booking.update({ where:{ id: b.id }, data:{ startsAt: input.newStartsAt, endsAt: input.newEndsAt, basePrice: newBase, totalPrice: newTotal, rescheduleCount:{ increment:1 } }, select:{ id:true, reference:true, startsAt:true, endsAt:true, totalPrice:true, rescheduleCount:true } });
    return { booking: updated, priceDifference: outcome.priceDifference, remaining: outcome.remaining, durationMinutes };
  });
}
export async function joinWaitlist(input: { sessionId: string; userId: string; now: Date }) {
  if (!booking.waitlistEnabled) throw domainErrors.featureDisabled();
  const session = await db.classSession.findUnique({ where: { id: input.sessionId }, select: { id:true, capacity:true, bookedCount:true, isCancelled:true } });
  if (!session || session.isCancelled) throw domainErrors.notFound();
  if (session.bookedCount < session.capacity) throw domainErrors.validationFailed('sessionId');
  const count = await db.waitlistEntry.count({ where: { sessionId: input.sessionId } });
  if (count >= booking.waitlistMaxSize) throw domainErrors.validationFailed('waitlist');
  const existing = await db.waitlistEntry.findUnique({ where: { sessionId_userId: { sessionId: input.sessionId, userId: input.userId } } });
  if (existing) throw domainErrors.validationFailed('sessionId');
  const maxPos = await db.waitlistEntry.aggregate({ where:{ sessionId: input.sessionId }, _max:{ position:true }});
  const position = (maxPos._max.position ?? 0) + 1;
  return db.waitlistEntry.create({ data: { sessionId: input.sessionId, userId: input.userId, position }, select:{ id:true, position:true }});
}
export async function claimWaitlistSlot(input: { sessionId: string; userId: string; now: Date }) {
  const entry = await db.waitlistEntry.findUnique({ where:{ sessionId_userId:{ sessionId: input.sessionId, userId: input.userId }}});
  if (!entry) throw domainErrors.notFound();
  if (!entry.notifiedAt || !entry.claimUntil) throw domainErrors.validationFailed('claimUntil');
  if (input.now.getTime() > entry.claimUntil.getTime()) throw domainErrors.validationFailed('claimUntil');
  const session = await db.classSession.findUnique({ where:{ id: input.sessionId }, select:{ id:true, startsAt:true, endsAt:true, classId:true, roomId:true }});
  if (!session) throw domainErrors.notFound();
  const danceClass = await db.danceClass.findUnique({ where:{ id: session.classId }, select:{ instructorId:true }});
  const expiresAt = new Date(input.now.getTime() + booking.holdTtlMinutes * 60_000);
  const hold = await db.slotHold.create({ data:{ instructorId: danceClass?.instructorId, roomId: session.roomId, sessionId: session.id, startsAt: session.startsAt, endsAt: session.endsAt, userId: input.userId, expiresAt, extensions:0 }, select:{ id:true, expiresAt:true }});
  await db.waitlistEntry.delete({ where:{ id: entry.id }});
  const rest = await db.waitlistEntry.findMany({ where:{ sessionId: input.sessionId }, orderBy:{ position:'asc' }, select:{ id:true }});
  for (const [i, row] of rest.entries()) await db.waitlistEntry.update({ where:{ id: row.id }, data:{ position: i+1 }});
  return hold;
}
export async function notifyNextInWaitlist(sessionId: string, now: Date) {
  const next = await db.waitlistEntry.findFirst({ where:{ sessionId, notifiedAt: null }, orderBy:{ position:'asc' }});
  if (!next) return null;
  const claimUntil = new Date(now.getTime() + booking.waitlistClaimWindowMinutes * 60_000);
  return db.waitlistEntry.update({ where:{ id: next.id }, data:{ notifiedAt: now, claimUntil }});
}
