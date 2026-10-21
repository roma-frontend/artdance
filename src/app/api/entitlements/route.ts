import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

/**
 * Снимок тумблеров для клиентской навигации.
 *
 * Не кешируется: это единственный запрос, которым шапка и подвал узнают о
 * смене тарифа, и задержка в 30 секунд здесь равна 30 секундам неверной
 * навигации. Объект небольшой и уже не попадает в HTML-рендер.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const effective = await getEffectiveEntitlementsSafe();
  return NextResponse.json(effective, { headers: { 'Cache-Control': cacheControl.none } });
}
