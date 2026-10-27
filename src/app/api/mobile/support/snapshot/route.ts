import { NextResponse } from 'next/server';

import { getMobileSupportSnapshot, operatorGate } from '@/server/admin/mobile-support';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' } as const;

export async function GET() {
  const gate = await operatorGate();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? 'unauthorized' : 'forbidden' }, { status: gate.status, headers: noStore });

  const snapshot = await getMobileSupportSnapshot(gate.canManageEntitlements);
  return NextResponse.json(snapshot, { headers: noStore });
}
