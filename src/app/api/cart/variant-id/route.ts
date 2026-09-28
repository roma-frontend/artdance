import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sku = url.searchParams.get('sku') ?? '';
  if (!sku) return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': cacheControl.none } });
  const v = await db.productVariant.findFirst({ where: { sku }, select: { id: true } });
  if (!v) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': cacheControl.none } });
  return NextResponse.json({ id: v.id }, { headers: { 'Cache-Control': cacheControl.none } });
}
