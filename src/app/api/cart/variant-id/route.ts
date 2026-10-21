import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { db } from '@/lib/db';
import { assertEntitlementOrThrow } from '@/server/entitlements/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await assertEntitlementOrThrow('shop');
  } catch (error) {
    /*
     * Выключенный модуль — 403 с тем же телом, что и раньше; прочие отказы
     * не проглатываем (раньше `catch {}` превращал сбой в обычный поиск по SKU).
     */
    if (isDomainError(error)) {
      return NextResponse.json(
        { error: error.code, messageKey: error.messageKey },
        { status: httpStatusFor(error.code), headers: { 'Cache-Control': cacheControl.none } },
      );
    }
    throw error;
  }
  const url = new URL(request.url);
  const sku = url.searchParams.get('sku') ?? '';
  if (!sku) return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': cacheControl.none } });
  const v = await db.productVariant.findFirst({ where: { sku }, select: { id: true } });
  if (!v) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': cacheControl.none } });
  return NextResponse.json({ id: v.id }, { headers: { 'Cache-Control': cacheControl.none } });
}
