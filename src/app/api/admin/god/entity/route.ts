import { NextResponse } from 'next/server';

import { formatEntityPreview, inspectOperatorRecord } from '@/server/admin/inspect';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const model = url.searchParams.get('model')?.trim() ?? '';
  const key = url.searchParams.get('key')?.trim() ?? '';
  if (!model || !key) return NextResponse.json({ error: 'INVALID' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const record = await inspectOperatorRecord(model, key);
    if (!record) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return NextResponse.json(formatEntityPreview(record), { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
}
