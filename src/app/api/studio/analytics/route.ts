/**
 * API: GET /api/studio/analytics — показатели инструктора за 30 дней для мобильного кабинета.
 *
 * Данные совпадают с веб-страницей `/studio/analytics`. Без пакета с аналитикой отвечает
 * `FEATURE_DISABLED`, как и остальные маршруты, закрытые тумблером entitlements.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { requireInstructorProfile } from '@/lib/auth/guards';
import { getInstructorAnalytics } from '@/server/analytics/instructor';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none, 'X-Content-Type-Options': 'nosniff' } });
}

function failure(error: unknown) {
  if (isDomainError(error)) return json({ error: error.code, messageKey: error.messageKey, params: error.params }, httpStatusFor(error.code));
  console.error('[studio:analytics]', error);
  return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
}

export async function GET() {
  try {
    await assertEntitlementOrThrow('instructorAnalytics');
    const { instructorId } = await requireInstructorProfile();
    const analytics = await getInstructorAnalytics(instructorId, new Date());
    return json({ analytics });
  } catch (error) {
    return failure(error);
  }
}
