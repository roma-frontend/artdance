/**
 * API: POST /api/studio/bookings/{id}/respond — ответ инструктора на заявку на бронь (D-04).
 *
 * Тело: `{ decision: 'ACCEPT' | 'DECLINE', reason?: string }`. Решение применяет
 * `respondToBookingRequest`: он проверяет владельца брони, срок и статус заявки.
 * Личность берётся только из серверной сессии.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { respondToBookingRequest } from '@/server/booking/requests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  decision: z.enum(['ACCEPT', 'DECLINE']),
  reason: z.string().trim().max(500).optional(),
});

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

function failure(error: unknown) {
  if (isDomainError(error)) {
    return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
  }
  console.error('[studio:booking-respond]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    /* Сначала личность: неавторизованный не должен получать ответы валидатора. */
    const { instructorId } = await requireInstructorProfile();
    const { id } = await params;

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

    const result = await respondToBookingRequest({
      bookingId: id,
      instructorId,
      decision: parsed.data.decision,
      reason: parsed.data.reason || undefined,
      now: new Date(),
    });
    return json({ status: result.status }, 200);
  } catch (error) {
    return failure(error);
  }
}
