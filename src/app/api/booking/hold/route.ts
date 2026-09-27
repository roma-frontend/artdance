import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { createSlotHold, extendSlotHold, releaseSlotHold } from '@/server/hold/service';
import { booking } from '@/config/business';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const holdSchema = z.object({
  instructorId: z.string().min(1).optional().nullable(),
  roomId: z.string().min(1).optional().nullable(),
  sessionId: z.string().min(1).optional().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  durationMinutes: z.number().int().positive().optional(),
  anonymousId: z.string().min(1).optional().nullable(),
});

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...extra } });
}

function errorFromDomain(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params, field: error.field }, httpStatusFor(error.code));
  console.error('[booking/hold]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

async function loadAvailabilityForInstructor(instructorId: string) {
  let profile = await db.instructorProfile.findUnique({ where: { id: instructorId }, select: { id: true } });
  if (!profile) {
    profile = await db.instructorProfile.findUnique({ where: { slug: instructorId }, select: { id: true } });
  }
  if (!profile) {
    // Fixture preview: no DB row yet — fall back to demo rules so booking
    // screen can still hold while migrating from fixtures to DB.
    const { demoInstructorAvailability } = await import('../../../../../prisma/fixtures/demo');
    const demo = (demoInstructorAvailability as Record<string, readonly { weekday: number; startTime: string; endTime: string }[]>)[instructorId];
    if (!demo) return null;
    return { rules: demo.map((w) => ({ weekday: w.weekday, startTime: w.startTime, endTime: w.endTime, validFrom: null, validUntil: null, isActive: true })), exceptions: [] };
  }
  const resolvedId = profile.id;
  const rules = await db.availabilityRule.findMany({ where: { instructorId: resolvedId, isActive: true }, select: { weekday: true, startTime: true, endTime: true, validFrom: true, validUntil: true, isActive: true } });
  const exceptions = await db.availabilityException.findMany({ where: { instructorId: resolvedId }, select: { startsAt: true, endsAt: true, isAvailable: true } });
  return { rules, exceptions: exceptions.map((e) => ({ start: e.startsAt, end: e.endsAt, isAvailable: e.isAvailable })) };
}

async function loadAvailabilityForRoom(roomId: string) {
  const room = await db.room.findUnique({ where: { id: roomId }, select: { id: true } });
  if (!room) return null;
  const rules = await db.availabilityRule.findMany({ where: { roomId, isActive: true }, select: { weekday: true, startTime: true, endTime: true, validFrom: true, validUntil: true, isActive: true } });
  const exceptions = await db.availabilityException.findMany({ where: { roomId }, select: { startsAt: true, endsAt: true, isAvailable: true } });
  return { rules, exceptions: exceptions.map((e) => ({ start: e.startsAt, end: e.endsAt, isAvailable: e.isAvailable })) };
}

async function loadBusy(instructorId: string | null | undefined, roomId: string | null | undefined, startsAt: Date, endsAt: Date) {
  const now = new Date();
  const bookingWhere: Record<string, unknown> = { status: { in: ['PENDING', 'CONFIRMED'] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } };
  if (instructorId) (bookingWhere as Record<string, unknown>).instructorId = instructorId;
  if (roomId) (bookingWhere as Record<string, unknown>).roomId = roomId;
  const bookings = await db.booking.findMany({ where: bookingWhere as never, select: { startsAt: true, endsAt: true } });
  const holdWhere: Record<string, unknown> = { expiresAt: { gt: now }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } };
  if (instructorId) (holdWhere as Record<string, unknown>).instructorId = instructorId;
  if (roomId) (holdWhere as Record<string, unknown>).roomId = roomId;
  const holds = await db.slotHold.findMany({ where: holdWhere as never, select: { startsAt: true, endsAt: true } });
  return [...bookings, ...holds].map((r) => ({ start: r.startsAt, end: r.endsAt }));
}

export async function POST(request: Request) {
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } }, 429, rateLimitHeaders(limit, 'bookingHold'));
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400); }
  const parsed = holdSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  const { instructorId, roomId, sessionId, anonymousId } = parsed.data;
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required', field: 'startsAt' }, 400);
  const durationMinutes = parsed.data.durationMinutes ?? Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const caller = await getCaller();
  const userId = caller?.id ?? null;
  const anonId = anonymousId ?? null;
  if (!userId && !anonId) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  let resolvedInstructorId = instructorId ?? null;
  let resolvedRoomId = roomId ?? null;
  if (sessionId && !resolvedInstructorId && !resolvedRoomId) {
    const session = await db.classSession.findUnique({ where: { id: sessionId }, select: { roomId: true, danceClass: { select: { instructorId: true } } } });
    if (!session) return json({ error: 'NOT_FOUND', messageKey: 'errors.notFound.description' }, 404);
    resolvedInstructorId = session.danceClass.instructorId;
    resolvedRoomId = session.roomId ?? null;
  }
  if (!resolvedInstructorId && !resolvedRoomId) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required', field: 'instructorId' }, 400);
  const availability = resolvedInstructorId ? await loadAvailabilityForInstructor(resolvedInstructorId) : await loadAvailabilityForRoom(resolvedRoomId!);
  if (!availability) return json({ error: 'NOT_FOUND', messageKey: 'errors.notFound.description' }, 404);
  const busy = await loadBusy(resolvedInstructorId, resolvedRoomId, startsAt, endsAt);
  let capacity: { booked: number; requested: number; total: number } | undefined;
  if (sessionId) {
    const session = await db.classSession.findUnique({ where: { id: sessionId }, select: { capacity: true, bookedCount: true } });
    if (session) capacity = { booked: session.bookedCount, requested: 1, total: session.capacity };
  }
  try {
    const result = await createSlotHold({ instructorId: resolvedInstructorId, roomId: resolvedRoomId, sessionId: sessionId ?? null, startsAt, endsAt, durationMinutes, userId, anonymousId: anonId, rules: availability.rules, exceptions: availability.exceptions, busy, capacity, now: new Date() });
    return json({ hold: { id: result.id, startsAt: result.startsAt.toISOString(), endsAt: result.endsAt.toISOString(), expiresAt: result.expiresAt.toISOString(), extensions: result.extensions, ttlMinutes: booking.holdTtlMinutes } }, 201);
  } catch (error) { return errorFromDomain(error); }
}

export async function PATCH(request: Request) {
  const limit = await checkRateLimit('bookingHold', clientIdentifier(request.headers));
  if (!limit.allowed) return json({ error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } }, 429, rateLimitHeaders(limit, 'bookingHold'));
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400); }
  const parsed = z.object({ holdId: z.string().min(1), anonymousId: z.string().min(1).optional().nullable() }).safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  const caller = await getCaller();
  const owner = { userId: caller?.id ?? null, anonymousId: parsed.data.anonymousId ?? null };
  if (!owner.userId && !owner.anonymousId) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  try { const result = await extendSlotHold(parsed.data.holdId, owner, new Date()); return json({ hold: { id: result.id, startsAt: result.startsAt.toISOString(), endsAt: result.endsAt.toISOString(), expiresAt: result.expiresAt.toISOString(), extensions: result.extensions } }, 200); } catch (error) { return errorFromDomain(error); }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const holdId = url.searchParams.get('holdId') ?? '';
  const anonymousId = url.searchParams.get('anonymousId');
  if (!holdId) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required', field: 'holdId' }, 400);
  const caller = await getCaller();
  const owner = { userId: caller?.id ?? null, anonymousId };
  if (!owner.userId && !owner.anonymousId) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  try { await releaseSlotHold(holdId, owner); return json({ ok: true }, 200); } catch (error) { return errorFromDomain(error); }
}
