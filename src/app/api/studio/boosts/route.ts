/**
 * API: GET и POST /api/studio/boosts — промо-размещение инструктора (B-07) для мобильного кабинета.
 *
 * GET возвращает `{ enabled, campaigns }`: `enabled` — включён ли пакет с бустами. POST создаёт
 * заявку на буст; правила ставки и периода проверяет `createBoost`, как и веб-форма.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { createBoost, instructorBoosts } from '@/server/boost/service';
import { loadEntitlementSnapshot } from '@/server/entitlements/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bidAmount: z.number().int(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

function json(body: object, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...extra } });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[studio:boosts]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  try {
    const { instructorId } = await requireInstructorProfile();
    const [snapshot, campaigns] = await Promise.all([loadEntitlementSnapshot(), instructorBoosts(instructorId)]);
    return json({ enabled: snapshot.boost === true, campaigns });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { caller, instructorId } = await requireInstructorProfile();

    const limit = await checkRateLimit('adminMutation', caller.id);
    if (!limit.allowed) {
      return json(
        { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
        429,
        rateLimitHeaders(limit, 'adminMutation'),
      );
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

    const campaign = await createBoost({ instructorId, ...parsed.data });
    await recordAudit({
      actor: caller,
      action: 'instructor.boost.request',
      entityType: 'BoostCampaign',
      entityId: campaign.id,
      after: { bidAmount: parsed.data.bidAmount, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt },
    });
    return json({ id: campaign.id }, 201);
  } catch (error) {
    return failure(error);
  }
}
