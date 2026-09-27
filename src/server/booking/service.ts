import 'server-only';
import { booking } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { isHoldExpired } from '@/domain/slot-hold';
import { db } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
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
    return result;
  } catch (e) { if (isUniqueViolation(e)) throw domainErrors.slotConflict(); throw e; }
}
