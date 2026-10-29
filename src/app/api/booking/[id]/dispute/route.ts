/**
 * API: POST /api/booking/[id]/dispute — открыть спор по брони.
 *
 * Участие, окно после занятия и однократность проверяет сервис споров.
 * Маршрут отвечает за лимит частоты, вход и перевод ошибок в статусы HTTP.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { disputeLengths } from '@/domain/dispute';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireCaller } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { openDispute } from '@/server/disputes/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reason: z.string().trim().min(disputeLengths.min).max(disputeLengths.max),
});

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
  console.error('[booking/dispute]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const identifier = clientIdentifier(request.headers);
  try {
    const limit = await checkRateLimit('disputeOpen', identifier);
    if (!limit.allowed) {
      return json(
        { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
        429,
        rateLimitHeaders(limit, 'disputeOpen'),
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
      return json({ error: 'VALIDATION_FAILED', messageKey: 'errors.generic.description', field: 'reason' }, 400);
    }

    const dispute = await openDispute({ bookingId: id, reason: parsed.data.reason, openedBy: caller.id });
    await recordAudit({
      actor: caller,
      action: 'dispute.open',
      entityType: 'Dispute',
      entityId: dispute.id,
      after: { bookingId: id },
      ipAddress: identifier,
    });
    return json({ dispute: { id: dispute.id } }, 201);
  } catch (error) {
    return failure(error);
  }
}
