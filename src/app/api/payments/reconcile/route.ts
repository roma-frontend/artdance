import { NextResponse } from 'next/server';

import { getCaller } from '@/lib/auth/guards';
import { reconcilePayment } from '@/server/payments/reconcile';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
  const id = (body as { paymentId?: string })?.paymentId;
  if (!id) return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });

  const result = await reconcilePayment({ paymentId: id });
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
