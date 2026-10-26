/**
 * GET /api/venue — площадки, залы, ближайшие брони и занятия для мобильного кабинета.
 *
 * Ответ собирается из тех же server-query, что и веб `/venue`. Персональные данные
 * клиентов в него намеренно не попадают.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { getVenueDashboard } from '@/server/venue/dashboard';
import { getVenueUpcomingSessions } from '@/server/venue/room-assignment';

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
  console.error('[venue:dashboard]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  try {
    await assertEntitlementOrThrow('events');
    const caller = await requireCaller();
    const dashboard = await getVenueDashboard(caller.id);
    const sessionsByVenue = await Promise.all(dashboard.venues.map((venue) => getVenueUpcomingSessions(venue.id)));

    return json({
      venues: dashboard.venues,
      bookings: dashboard.bookings.map((booking) => ({
        id: booking.id,
        reference: booking.reference,
        subject: booking.subject,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        venueId: booking.venueId,
        room: booking.room,
      })),
      sessions: sessionsByVenue.flatMap((sessions, index) => {
        const venue = dashboard.venues[index];
        if (!venue) return [];
        return sessions.map((session) => ({
          id: session.id,
          title: session.danceClass.title,
          startsAt: session.startsAt.toISOString(),
          endsAt: session.endsAt.toISOString(),
          roomId: session.roomId,
          venue: { id: venue.id, name: venue.name },
        }));
      }),
    });
  } catch (error) {
    return failure(error);
  }
}
