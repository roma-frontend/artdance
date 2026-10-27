import { NextResponse } from 'next/server';

import { operatorGate } from '@/server/admin/mobile-support';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' } as const;

/** Лёгкая проверка доступа без запросов к БД: только для показа пункта меню. */
export async function GET() {
  const gate = await operatorGate();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? 'unauthorized' : 'forbidden' }, { status: gate.status, headers: noStore });

  return NextResponse.json({ canAccess: true, canManageEntitlements: gate.canManageEntitlements }, { headers: noStore });
}
