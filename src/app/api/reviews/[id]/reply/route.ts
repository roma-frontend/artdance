/**
 * API: POST /api/reviews/[id]/reply — ответ на отзыв; DELETE — удаление ответа.
 *
 * Права проверяет сервис ответов: инструктор отзыва, участник площадки
 * или администратор. Маршрут отвечает за лимит частоты, вход, разбор тела и
 * перевод ошибок в статусы HTTP.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { replyLengths } from '@/domain/review-reply';
import { requireCaller } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { deleteReply, replyToReview } from '@/server/reviews/reply';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  body: z.string().trim().min(replyLengths.min).max(replyLengths.max),
});

type RouteContext = { params: Promise<{ id: string }> };

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

/** Доменная ошибка отдаётся с кодом и ключом перевода; прочее — общим текстом, причина уходит в лог. */
function failure(error: unknown) {
  if (isDomainError(error)) {
    return json(
      { error: error.code, messageKey: error.messageKey, params: error.params, field: error.field },
      httpStatusFor(error.code),
    );
  }
  console.error('[reviews/reply]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const identifier = clientIdentifier(request.headers);
  try {
    const limit = await checkRateLimit('reviewReply', identifier);
    if (!limit.allowed) {
      return json(
        { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
        429,
        rateLimitHeaders(limit, 'reviewReply'),
      );
    }

    const caller = await requireCaller();

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ error: 'VALIDATION_FAILED', messageKey: 'errors.generic.description' }, 400);
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: 'VALIDATION_FAILED', messageKey: 'errors.generic.description', field: 'body' }, 400);
    }

    const reply = await replyToReview({ reviewId: id, actor: caller, body: parsed.data.body });
    await recordAudit({
      actor: caller,
      action: 'review.reply.create',
      entityType: 'Review',
      entityId: id,
      after: { replyId: reply.id },
      ipAddress: identifier,
    });
    return json({ reply }, 201);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const identifier = clientIdentifier(request.headers);
  try {
    const limit = await checkRateLimit('reviewReply', identifier);
    if (!limit.allowed) {
      return json(
        { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
        429,
        rateLimitHeaders(limit, 'reviewReply'),
      );
    }

    const caller = await requireCaller();
    await deleteReply({ reviewId: id, actor: caller });
    await recordAudit({
      actor: caller,
      action: 'review.reply.delete',
      entityType: 'Review',
      entityId: id,
      ipAddress: identifier,
    });
    return json({ ok: true }, 200);
  } catch (error) {
    return failure(error);
  }
}
