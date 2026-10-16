import { NextResponse } from 'next/server';

import { globalOperatorSearch } from '@/server/admin/operator';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
  try {
    const results = await globalOperatorSearch(q);
    return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
}
