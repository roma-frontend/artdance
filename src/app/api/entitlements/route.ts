import { NextResponse } from 'next/server';

import { getEffectiveEntitlements } from '@/server/entitlements/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const effective = await getEffectiveEntitlements().catch(() => null);
  if (!effective) return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json(effective, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } });
}
