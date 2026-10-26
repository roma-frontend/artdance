/**
 * API: POST /api/class-passes/purchase — заказ на пакет занятий для мобильного приложения.
 *
 * Та же логика, что у `purchaseClassPassAction`: создаётся заказ `CLASS_PASS`,
 * а пакет выдаёт `settle` после подтверждения оплаты. Личность — только из
 * серверной сессии; цена считается на сервере по `passId`.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { classPassIds, createClassPassOrder } from '@/server/class-pass/order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const purchaseSchema = z.object({ passId: z.enum(classPassIds) });

function json(body: object, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, ...extra } });
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) {
    return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);
  }

  const limit = await checkRateLimit('paymentIntent', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return json(
      { error: 'RATE_LIMITED', messageKey: 'errors.rateLimited.description', params: { seconds: limit.retryAfterSeconds } },
      429,
      rateLimitHeaders(limit, 'paymentIntent'),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, 400);

  try {
    const order = await createClassPassOrder(caller, parsed.data.passId);
    return json({ order: { id: order.id, orderNumber: order.orderNumber, total: order.total } }, 201);
  } catch (error) {
    if (isDomainError(error)) {
      return json({ error: error.code, messageKey: error.messageKey }, httpStatusFor(error.code));
    }
    console.error('[class-passes:purchase]', error);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.title' }, 500);
  }
}
