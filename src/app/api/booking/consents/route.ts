/**
 * GET /api/booking/consents — правила согласий при брони (D-03).
 *
 * Нужен мобильному приложению: оно не читает конфиг web. Отдаёт, какие согласия требует
 * каждый предмет брони, с какого возраста участника нужно родительское и что ещё в черновике.
 *
 * Ответ не кешируется: правила меняются вместе с релизом, а клиент не должен держать старое.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { bookingConsentsSnapshot } from '@/config/consents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return NextResponse.json(bookingConsentsSnapshot(), {
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
