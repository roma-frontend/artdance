/**
 * API: GET /api/account/company — кабинет компании (B-06) для мобильного приложения.
 *
 * Данные совпадают с веб-страницей `/account/company`: баланс и счета компании, только чтение.
 * `account` — `null`, если пользователь не привязан к компании. Без пакета PREMIUM маршрут
 * отвечает `FEATURE_DISABLED`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { getCaller } from '@/lib/auth/guards';
import { corporateCabinetFor } from '@/server/corporate/service';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[account:company]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  const caller = await getCaller();
  if (!caller) return json({ error: 'UNAUTHORIZED', messageKey: 'errors.unauthorized.description' }, 401);

  try {
    await assertEntitlementOrThrow('corporateCabinet');
    const account = await corporateCabinetFor(caller.id);
    return json({ account });
  } catch (error) {
    return failure(error);
  }
}
