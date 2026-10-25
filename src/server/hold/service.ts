import 'server-only';
import { booking, venue } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { assertRentalDuration, isRentalHold, rentalMinutes } from '@/domain/rental';
import { assertValidSlotHoldInput, isHoldExpired, slotHoldExpiresAt } from '@/domain/slot-hold';
import { assertInsideAvailability, assertNoConflict, assertWithinPolicy } from '@/domain/availability/conflicts';
import { expandRules, type AvailabilityRule } from '@/domain/availability/compute';
import { publicHolidaysBetween } from '@/domain/holidays';
import { site } from '@/config/site';
import { db } from '@/lib/db';
import type { Interval } from '@/lib/time/interval';
import { Prisma } from '@/generated/prisma/client';

export interface HoldRequest {
  instructorId?: string | null;
  roomId?: string | null;
  sessionId?: string | null;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  userId?: string | null;
  anonymousId?: string | null;
  rules: readonly AvailabilityRule[];
  exceptions?: readonly { start: Date; end: Date; isAvailable: boolean }[];
  busy: readonly Interval[];
  holidays?: readonly Date[];
  capacity?: { booked: number; requested: number; total: number };
  now: Date;
}

export interface HoldResult {
  id: string;
  startsAt: Date;
  endsAt: Date;
  expiresAt: Date;
  extensions: number;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function createSlotHold(request: HoldRequest): Promise<HoldResult> {
  const now = request.now;
  const candidate: Interval = { start: request.startsAt, end: request.endsAt };
  const ttl = booking.holdTtlMinutes;
  const expiresAt = slotHoldExpiresAt(now, ttl);
  assertValidSlotHoldInput({ instructorId: request.instructorId ?? null, roomId: request.roomId ?? null, startsAt: request.startsAt, endsAt: request.endsAt, userId: request.userId ?? null, anonymousId: request.anonymousId ?? null, expiresAt });
  const rental = isRentalHold({ roomId: request.roomId ?? null, instructorId: request.instructorId ?? null, sessionId: request.sessionId ?? null });
  assertWithinPolicy(candidate, { minLeadMinutes: booking.minLeadTimeMinutes, maxAdvanceDays: booking.maxAdvanceDays, allowedDurationsMinutes: rental ? [] : booking.durationsMinutes, granularityMinutes: booking.slotGranularityMinutes, timeZone: site.timeZone }, now);
  if (rental) assertRentalDuration(rentalMinutes(request.startsAt, request.endsAt), { minMinutes: venue.minRentalMinutes, maxMinutes: venue.maxRentalMinutes, granularityMinutes: venue.rentalGranularityMinutes });
  if (request.capacity) {
    const { booked, requested, total } = request.capacity;
    if (booked + requested > total) throw domainErrors.capacityExceeded(Math.max(0, total - booked));
  }
  const holidays = request.holidays ?? publicHolidaysBetween(candidate.start, candidate.end).map((h) => h.date);
  const range: Interval = { start: candidate.start, end: candidate.end };
  const windows = expandRules(request.rules, (request.exceptions ?? []) as never, range, site.timeZone, holidays as Date[]);
  assertInsideAvailability(windows, candidate);
  assertNoConflict(request.busy as readonly Interval[], candidate, booking.bufferBetweenBookingsMinutes);
  try {
    return await db.$transaction(async transaction => {
      // Удаляем только истёкшие холды конкретного ресурса (не NULL-фильтр)
      const expiredWhere: Record<string, unknown> = { startsAt: request.startsAt, expiresAt: { lte: now } };
      if (request.instructorId) (expiredWhere as Record<string, unknown>).instructorId = request.instructorId;
      else if (request.roomId) (expiredWhere as Record<string, unknown>).roomId = request.roomId;
      await transaction.slotHold.deleteMany({ where: expiredWhere as never });
      return transaction.slotHold.create({ data: { instructorId: request.instructorId ?? null, roomId: request.roomId ?? null, sessionId: request.sessionId ?? null, startsAt: request.startsAt, endsAt: request.endsAt, userId: request.userId ?? null, anonymousId: request.anonymousId ?? null, expiresAt, extensions: 0 }, select: { id: true, startsAt: true, endsAt: true, expiresAt: true, extensions: true } });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw domainErrors.slotConflict();
    throw error;
  }
}

export async function extendSlotHold(holdId: string, owner: { userId?: string | null; anonymousId?: string | null }, now: Date): Promise<HoldResult> {
  const existing = await db.slotHold.findUnique({ where: { id: holdId } });
  if (!existing) throw domainErrors.notFound();
  const owned = (owner.userId && existing.userId === owner.userId) || (owner.anonymousId && existing.anonymousId === owner.anonymousId);
  if (!owned) throw domainErrors.forbidden();
  if (isHoldExpired(existing, now)) throw domainErrors.holdExpired();
  if (existing.extensions >= booking.holdMaxExtensions) throw domainErrors.validationFailed('extensions');
  // Продление не может увести слот за maxAdvanceDays
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- type-only inside function scope intentional for hold expiry path
  const candidate: import('@/lib/time/interval').Interval = { start: existing.startsAt, end: existing.endsAt };
  const rental = isRentalHold(existing);
  assertWithinPolicy(candidate, { minLeadMinutes: booking.minLeadTimeMinutes, maxAdvanceDays: booking.maxAdvanceDays, allowedDurationsMinutes: rental ? [] : booking.durationsMinutes, granularityMinutes: booking.slotGranularityMinutes, timeZone: site.timeZone }, now);
  const nextExpiresAt = slotHoldExpiresAt(now, booking.holdTtlMinutes);
  const updated = await db.slotHold.update({ where: { id: holdId }, data: { expiresAt: nextExpiresAt, extensions: { increment: 1 } }, select: { id: true, startsAt: true, endsAt: true, expiresAt: true, extensions: true } });
  return updated;
}

export async function releaseSlotHold(holdId: string, owner: { userId?: string | null; anonymousId?: string | null }): Promise<void> {
  const existing = await db.slotHold.findUnique({ where: { id: holdId } });
  if (!existing) throw domainErrors.notFound();
  const owned = (owner.userId && existing.userId === owner.userId) || (owner.anonymousId && existing.anonymousId === owner.anonymousId);
  if (!owned) throw domainErrors.forbidden();
  await db.slotHold.delete({ where: { id: holdId } });
}

export async function purgeExpiredHolds(now: Date): Promise<{ purged: number }> {
  const result = await db.slotHold.deleteMany({ where: { expiresAt: { lte: now } } });
  return { purged: result.count };
}