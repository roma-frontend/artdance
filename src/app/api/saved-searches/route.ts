import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCaller } from '@/lib/auth/guards';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { createSavedSearch, listSavedSearches } from '@/server/saved-search/service';

const schema = z.object({ query: z.string().max(200), scope: z.string().max(30).optional() });

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
  if (!parsed.success) return NextResponse.json({ error: 'VALIDATION_FAILED', messageKey: 'validation.required' }, { status: 400 });
  try {
    const { created, ...item } = await createSavedSearch({ userId: caller.id, query: parsed.data.query, scope: parsed.data.scope });
    return NextResponse.json({ item, created }, { status: created ? 201 : 200 });
  } catch (e) {
    if (isDomainError(e)) return NextResponse.json({ error: e.code, messageKey: e.messageKey }, { status: httpStatusFor(e.code) });
    throw e;
  }
}
