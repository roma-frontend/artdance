/**
 * GET /api/studio/classes — ближайшие занятия инструктора для мобильного кабинета.
 *
 * Данные и права совпадают с веб-страницей `/studio/classes`: занятия берутся из
 * общего запроса, а список залов ограничен площадками этих занятий.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { getActiveVenueRooms, getInstructorUpcomingSessions } from '@/server/venue/room-assignment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff' },
  });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[studio:classes]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  try {
    await assertEntitlementOrThrow('events');
    const { instructorId } = await requireInstructorProfile();
    const sessions = await getInstructorUpcomingSessions(instructorId);
    const rooms = await getActiveVenueRooms([...new Set(sessions.map((session) => session.venue.id))]);

    return json({
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        startsAt: session.startsAt.toISOString(),
        endsAt: session.endsAt.toISOString(),
        roomId: session.roomId,
        venue: session.venue,
      })),
      rooms,
    });
  } catch (error) {
    return failure(error);
  }
}
