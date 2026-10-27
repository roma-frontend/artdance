/**
 * PAYMENT RETURN — возврат клиента из платёжной страницы в приложение.
 *
 * Провайдер (банк, Stripe) возвращает клиента на https-адрес этого маршрута. Отсюда
 * редирект уходит в диплинк приложения, который открыл оплату во внутреннем браузере.
 *
 * Здесь оплата не подтверждается: redirect не является доказательством оплаты.
 * Приложение сверяет статус через `/api/payments/reconcile`.
 */

import { NextResponse } from 'next/server';

import { getServerEnv } from '@/config/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = { 'Cache-Control': 'no-store' };

/** Разрешены только диплинки нашего приложения. В dev дополнительно — адрес Expo Go. */
function isAllowedAppReturn(target: string): boolean {
  if (target === 'artdance://payment/return') return true;
  return getServerEnv().NODE_ENV !== 'production' && /^exps?:\/\/[^/]+\/--\/payment\/return$/.test(target);
}

export function GET(request: Request) {
  const incoming = new URL(request.url);
  const to = incoming.searchParams.get('to') ?? '';
  if (!isAllowedAppReturn(to)) {
    return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers });
  }

  const target = new URL(to);
  incoming.searchParams.forEach((value, key) => {
    if (key !== 'to') target.searchParams.append(key, value);
  });
  return NextResponse.redirect(target.toString(), { status: 302, headers });
}
