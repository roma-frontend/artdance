/**
 * API: GET /api/studio/reviews — отзывы на занятия инструктора для мобильного кабинета.
 *
 * Показываются только одобренные отзывы, как на веб-странице `/studio/reviews`. Ответ
 * инструктора сохраняется через `POST` и `DELETE /api/reviews/{id}/reply`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff' } });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[studio:reviews]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  try {
    const { instructorId } = await requireInstructorProfile();
    const rows = await db.review.findMany({
      where: { instructorId, moderation: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        rating: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
        response: { select: { body: true } },
      },
    });

    return json({
      reviews: rows.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        createdAt: row.createdAt,
        authorName: row.author.name,
        reply: row.response?.body ?? null,
      })),
    });
  } catch (error) {
    return failure(error);
  }
}
