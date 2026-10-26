/**
 * GET/POST /api/venue/room-assignment — мобильный экран выбора зала.
 *
 * GET отдаёт только варианты для конкретного занятия. POST использует ту же
 * транзакционную мутацию и проверку конфликтов, что и веб-`assignSessionRoom`.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';
import { assignClassSessionRoom, getClassSessionRoomAssignment } from '@/server/venue/room-assignment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const sessionIdSchema = z.string().trim().min(1).max(64);
const inputSchema = z.object({
  sessionId: sessionIdSchema,
  roomId: z.string().trim().min(1).max(64).nullable(),
});

function json(body: object, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params, field: error.field }, httpStatusFor(error.code));
  console.error('[venue:room-assignment]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET(request: Request) {
  const sessionId = sessionIdSchema.safeParse(new URL(request.url).searchParams.get('sessionId'));
  if (!sessionId.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required', field: 'sessionId' }, 400);

  try {
    await assertEntitlementOrThrow('events');
    const result = await getClassSessionRoomAssignment(sessionId.data);
    return json({
      session: {
        ...result.session,
        startsAt: result.session.startsAt.toISOString(),
        endsAt: result.session.endsAt.toISOString(),
      },
      rooms: result.rooms,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  const limit = await checkRateLimit('adminMutation', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'adminMutation'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    await assertEntitlementOrThrow('events');
    await assignClassSessionRoom(parsed.data);
    return json({ status: 'success', messageKey: 'footer.venueDashboardRoomSaved' });
  } catch (error) {
    return failure(error);
  }
}
