/**
 * API: GET и PUT /api/account/athlete — кабинет атлета (DS-04) для мобильного приложения.
 *
 * GET возвращает `{ athlete }`, где `athlete` — `null`, пока атлет не зарегистрировался ни на
 * одно соревнование: профиль создаёт регистрация. PUT сохраняет программы, клуб и разряд.
 *
 * Личность берётся только из серверной сессии, как и в остальных маршрутах кабинета.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { athleteProfileSchema } from '@/domain/athlete';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { recordAudit } from '@/lib/audit';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, rateLimitHeaders } from '@/lib/security/rate-limit';
import { athleteCabinetFor, updateAthleteProfile } from '@/server/athlete/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[account:athlete]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);

  try {
    const athlete = await athleteCabinetFor(caller.id);
    return json({ athlete });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);

  const limit = await checkRateLimit('dancerProfile', caller.id);
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'dancerProfile'),
    );
  }

  const parsed = athleteProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    const profile = await updateAthleteProfile(caller.id, parsed.data);
    await recordAudit({
      actor: caller,
      action: 'athlete.profile.update',
      entityType: 'AthleteProfile',
      entityId: caller.id,
      after: profile,
    });
    return json({ profile });
  } catch (error) {
    return failure(error);
  }
}
