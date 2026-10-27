import { NextResponse } from 'next/server';
import { z } from 'zod';

import { releasePayout } from '@/server/actions/admin/operations';
import { operatorGate } from '@/server/admin/mobile-support';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const noStore = { 'Cache-Control': 'no-store' } as const;

const bodySchema = z.object({ id: z.string().min(1), hold: z.boolean() });

export async function POST(request: Request) {
  const gate = await operatorGate();
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? 'unauthorized' : 'forbidden' }, { status: gate.status, headers: noStore });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_input' }, { status: 400, headers: noStore });

  const result = await releasePayout(parsed.data);
  if (result.serverError || result.validationErrors) {
    return NextResponse.json({ error: result.serverError ?? 'invalid_input' }, { status: 400, headers: noStore });
  }
  return NextResponse.json({ ok: true, data: result.data ?? null }, { headers: noStore });
}
