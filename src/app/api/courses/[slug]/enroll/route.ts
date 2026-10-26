/**
 * API: POST /api/courses/[slug]/enroll — заказ на запись на курс для мобильного приложения.
 *
 * Создаёт заказ `COURSE_ENROLLMENT`; запись появится после подтверждения оплаты (`settle`).
 * Цена и доступность проверяются на сервере. Тумблер `courses` — внутри сервиса.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { createCourseEnrollmentOrder } from '@/server/courses/enroll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);

  const limit = await checkRateLimit('paymentIntent', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'paymentIntent'),
    );
  }

  const { slug } = await params;

  try {
    const course = await db.course.findFirst({
      where: { slug, isPublished: true, deletedAt: null },
      select: { id: true },
    });
    if (!course) return json({ error: 'NOT_FOUND', messageKey: 'common.states.unavailable' }, 404);

    const order = await createCourseEnrollmentOrder(caller, { id: course.id });
    return json({ order: { id: order.id, orderNumber: order.orderNumber, total: order.total } }, 201);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[courses:enroll]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}
