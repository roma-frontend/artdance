import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { createSavedSearch, listSavedSearches } from '@/server/saved-search/service';

const schema = z.object({ query: z.string().min(2).max(80), scope: z.string().max(30).optional() });

export async function GET() {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const items = await listSavedSearches(caller.id);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_FAILED' }, { status: 400 });
  const created = await createSavedSearch({ userId: caller.id, query: parsed.data.query, scope: parsed.data.scope });
  return NextResponse.json(created, { status: 201 });
}
