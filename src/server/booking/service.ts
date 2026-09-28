import 'server-only';
import { booking } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { isHoldExpired } from '@/domain/slot-hold';
import { cancellationOutcome, refundAmountFor, rescheduleOutcome, type BookingSnapshot } from '@/domain/booking/policy';
import { assertInsideAvailability, assertNoConflict } from '@/domain/availability/conflicts';
import { expandRules } from '@/domain/availability/compute';
import { site } from '@/config/site';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { notifyBookingCancelled, notifyBookingConfirmed, notifyWaitlistReady } from '@/server/booking/notify';
function isUniqueViolation(error: unknown): boolean { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'; }
function refFromId(id: string): string { return 'BK-' + id.slice(-8).toUpperCase(); }
export interface CreateBookingInput { holdId: string; userId?: string | null; anonymousId?: string | null; locationOption?: 'STUDIO' | 'CUSTOMER_LOCATION' | 'ONLINE'; customerAddress?: string | null; now: Date; }
export async function createBookingFromHold(input: CreateBookingInput) {
  const { holdId, userId, anonymousId, now } = input;
  if (!userId && !anonymousId) throw domainErrors.unauthorized();
  const hold = await db.slotHold.findUnique({ where: { id: holdId } });
  if (!hold) throw domainErrors.notFound();
  const owned = (userId && hold.userId === userId) || (anonymousId && hold.anonymousId === anonymousId);
  if (!owned) throw domainErrors.forbidden();
  if (isHoldExpired(hold, now)) throw domainErrors.holdExpired();
  let basePrice: number | null = null;
  let danceClass: { id: string; price: number; venueId: string | null } | null = null;
  let session: { id: string; capacity: number; bookedCount: number } | null = null;
  let sessionClassId: string | null = null;
  if (hold.sessionId) {
    const s = await db.classSession.findUnique({ where: { id: hold.sessionId }, select: { id: true, capacity: true, bookedCount: true, classId: true } });
    if (!s) throw domainErrors.notFound();
    session = { id: (s as { id: string }).id, capacity: (s as { capacity: number }).capacity, bookedCount: (s as { bookedCount: number }).bookedCount };
    sessionClassId = (s as { classId: string }).classId;
    const dc = await db.danceClass.findUnique({ where: { id: sessionClassId }, select: { id: true, price: true, venueId: true } });
    if (dc) danceClass = dc as { id: string; price: number; venueId: string | null };
  } else if (hold.instructorId) {
    const cls = await db.danceClass.findFirst({ where: { instructorId: hold.instructorId, isActive: true, deletedAt: null } as never, select: { id: true, price: true, venueId: true } });
    if (cls) { danceClass = cls as { id: string; price: number; venueId: string | null }; basePrice = (cls as { price: number }).price; }
    else { const { demoClasses } = await import('../../../prisma/fixtures/demo'); const demo = (demoClasses as readonly { instructorSlug: string; price: number }[]).find(c => c.instructorSlug === hold.instructorId); if (demo) basePrice = demo.price; }
  }
  if (basePrice == null) { if (danceClass) basePrice = danceClass.price; else throw domainErrors.notFound(); }
  const locationOption = (input.locationOption ?? 'STUDIO') as 'STUDIO' | 'CUSTOMER_LOCATION' | 'ONLINE';
  const travelFee = locationOption === 'CUSTOMER_LOCATION' ? booking.travelFee : 0;
  const totalPrice = basePrice + travelFee;
  const cancellationWindowHours = booking.freeCancellationHours;
  const lateCancellationRate = booking.lateCancellationFeeRate;
  const rescheduleWindowHours = booking.freeRescheduleHours;
  const maxReschedules = booking.maxReschedulesPerBooking;
  const customerId = userId ?? hold.userId ?? null;
  if (!customerId) throw domainErrors.unauthorized();
  const venueId = danceClass?.venueId ?? null;
  const bookedCheck = session;
  let createdId: string | null = null;
  try {
    const result = await db.$transaction(async (tx) => {
      if (bookedCheck && bookedCheck.bookedCount >= bookedCheck.capacity) throw domainErrors.capacityExceeded(0);
      const conflict = await (tx as unknown as { booking: { findFirst: (a: unknown)=>Promise<unknown> } }).booking.findFirst({ where: { instructorId: hold.instructorId ?? undefined, startsAt: { lt: hold.endsAt }, endsAt: { gt: hold.startsAt }, status: { in: ['PENDING', 'CONFIRMED'] } } } as never);
      if (conflict) throw domainErrors.slotConflict();
      const created = await tx.booking.create({ data: { reference: 'tmp-' + hold.id.slice(-6), subject: 'CLASS_SESSION', status: 'CONFIRMED', customerId, instructorId: hold.instructorId, venueId, roomId: hold.roomId, sessionId: hold.sessionId, startsAt: hold.startsAt, endsAt: hold.endsAt, participants: 1, locationOption, customerAddress: input.customerAddress ?? null, basePrice, travelFee, discountAmount: 0, totalPrice, cancellationWindowHours, lateCancellationRate, rescheduleWindowHours, maxReschedules }, select: { id: true, reference: true } });
      const ref = refFromId(created.id);
      const updated = await tx.booking.update({ where: { id: created.id }, data: { reference: ref }, select: { id: true, reference: true, totalPrice: true, startsAt: true, endsAt: true } });
      if (session) await tx.classSession.update({ where: { id: session.id }, data: { bookedCount: { increment: 1 } } });
      await tx.slotHold.delete({ where: { id: hold.id } });
      return updated;
    });
    createdId = result.id;
    void notifyBookingConfirmed(result.id).catch(() => {});
    return result;
  } catch (e) { if (isUniqueViolation(e)) throw domainErrors.slotConflict(); throw e; } finally { void createdId; }
}
export interface CancelBookingInput { bookingId: string; userId: string; now: Date; reason?: string | null; }
export async function cancelBooking(input: CancelBookingInput) {
  const b = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!b) throw domainErrors.notFound();
  if (b.customerId !== input.userId) throw domainErrors.forbidden();
  const snapshot: BookingSnapshot = { startsAt: b.startsAt, status: b.status as BookingSnapshot['status'], totalPrice: b.totalPrice, cancellationWindowHours: b.cancellationWindowHours, lateCancellationRate: Number(b.lateCancellationRate), rescheduleWindowHours: b.rescheduleWindowHours, rescheduleCount: b.rescheduleCount, maxReschedules: b.maxReschedules };
  const outcome = cancellationOutcome(snapshot, input.now);
  if (outcome.kind === 'forbidden') { if (outcome.reason === 'ALREADY_STARTED') throw domainErrors.validationFailed('startsAt'); throw domainErrors.cancellationWindowClosed(); }
  const fee = outcome.kind === 'fee' ? outcome.amount : 0;
  const refund = outcome.kind === 'free' ? b.totalPrice : (()=> { try { return refundAmountFor(outcome, b.totalPrice); } catch { return b.totalPrice; } })();
  const txResult = await db.$transaction(async (tx) => {
    const updated = await tx.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED_BY_CUSTOMER', cancelledAt: input.now, cancellationReason: input.reason ?? (outcome.kind==='fee' ? 'LATE_FEE:'+fee : null) }, select: { id:true, reference:true, status:true, totalPrice:true } });
    if (b.sessionId) await tx.classSession.update({ where: { id: b.sessionId }, data: { bookedCount: { decrement: 1 } } }).catch(()=>{});
    let waitlistClaimUntil: Date | null = null;
    let waitlistUserId: string | null = null;
    if (b.sessionId) { const next = await tx.waitlistEntry.findFirst({ where:{ sessionId: b.sessionId, notifiedAt: null }, orderBy:{ position:'asc' }}); if (next) { waitlistClaimUntil = new Date(input.now.getTime() + booking.waitlistClaimWindowMinutes*60_000); waitlistUserId = next.userId; await tx.waitlistEntry.update({ where:{ id: next.id }, data:{ notifiedAt: input.now, claimUntil: waitlistClaimUntil }}); } }
    return { booking: updated, fee, refund, outcome: outcome.kind, waitlistUserId, waitlistClaimUntil, sessionId: b.sessionId ?? null };
  });
  void notifyBookingCancelled(b.id, txResult.refund).catch(()=>{});
  if (txResult.waitlistUserId && txResult.sessionId && txResult.waitlistClaimUntil) {
    void notifyWaitlistReady(txResult.sessionId, txResult.waitlistUserId, txResult.waitlistClaimUntil).catch(()=>{});
  }
  return { booking: txResult.booking, fee: txResult.fee, refund: txResult.refund, outcome: txResult.outcome };
}
export interface RescheduleBookingInput { bookingId: string; userId: string; now: Date; newStartsAt: Date; newEndsAt: Date; newPrice?: number | null; }
export async function rescheduleBooking(input: RescheduleBookingInput) {
  const b = await db.booking.findUnique({ where: { id: input.bookingId } });
  if (!b) throw domainErrors.notFound();
  if (b.customerId !== input.userId) throw domainErrors.forbidden();
  const snapshot: BookingSnapshot = { startsAt: b.startsAt, status: b.status as BookingSnapshot['status'], totalPrice: b.totalPrice, cancellationWindowHours: b.cancellationWindowHours, lateCancellationRate: Number(b.lateCancellationRate), rescheduleWindowHours: b.rescheduleWindowHours, rescheduleCount: b.rescheduleCount, maxReschedules: b.maxReschedules };
  const target = { start: input.newStartsAt, end: input.newEndsAt, price: input.newPrice ?? b.totalPrice };
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
    if (profile) {
      rules = await db.availabilityRule.findMany({ where:{ instructorId: b.instructorId, isActive:true }, select:{ weekday:true, startTime:true, endTime:true, validFrom:true, validUntil:true, isActive:true }});
      const ex = await db.availabilityException.findMany({ where:{ instructorId: b.instructorId }, select:{ startsAt:true, endsAt:true, isAvailable:true }});
      exceptions = ex.map(e=>({ start:e.startsAt, end:e.endsAt, isAvailable:e.isAvailable }));
    } else { const { demoInstructorAvailability } = await import('../../../prisma/fixtures/demo'); const demo = (demoInstructorAvailability as Record<string, readonly {weekday:number;startTime:string;endTime:string}[]>)[b.instructorId]; if (demo) rules = demo.map(w=>({ weekday:w.weekday, startTime:w.startTime, endTime:w.endTime, validFrom:null, validUntil:null, isActive:true })); }
  }
  const windows = expandRules(rules as never, exceptions as never, { start: input.newStartsAt, end: input.newEndsAt }, site.timeZone);
  assertInsideAvailability(windows, { start: input.newStartsAt, end: input.newEndsAt });
  const busy = await db.booking.findMany({ where:{ id:{ not: b.id }, instructorId: b.instructorId ?? undefined, status:{ in:['PENDING','CONFIRMED'] as const }, startsAt:{ lt: input.newEndsAt }, endsAt:{ gt: input.newStartsAt } } as never, select:{ startsAt:true, endsAt:true }});
  const holds = await db.slotHold.findMany({ where:{ instructorId: b.instructorId ?? undefined, expiresAt:{ gt: input.now }, startsAt:{ lt: input.newEndsAt }, endsAt:{ gt: input.newStartsAt } } as never, select:{ startsAt:true, endsAt:true }});
  assertNoConflict([...busy, ...holds].map(r=>({ start:r.startsAt, end:r.endsAt })), { start: input.newStartsAt, end: input.newEndsAt }, booking.bufferBetweenBookingsMinutes);
  const newBase = input.newPrice ?? b.basePrice;
  const newTravel = b.travelFee;
  const newTotal = newBase + newTravel;
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
