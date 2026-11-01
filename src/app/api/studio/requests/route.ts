/**
 * API: GET /api/studio/requests — открытые заявки на бронь инструктора (D-04) для мобильного кабинета.
 *
 * Данные и права совпадают с веб-страницей `/studio/requests`: тот же запрос к базе.
 * Ответ на заявку идёт через `POST /api/studio/bookings/{id}/respond`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { listOpenBookingRequests } from '@/server/booking/requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff' } });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[studio:requests]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  try {
    const { instructorId } = await requireInstructorProfile();
    const rows = await listOpenBookingRequests(instructorId, new Date());

    return json({
      requests: rows.map((row) => ({
        id: row.id,
        subject: row.subject,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        participants: row.participants,
        requestExpiresAt: row.requestExpiresAt,
        customerName: row.customer.name,
        className: row.session?.danceClass.title ?? null,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
