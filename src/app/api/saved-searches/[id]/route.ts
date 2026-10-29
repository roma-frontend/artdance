import { NextResponse } from 'next/server';

import { getCaller } from '@/lib/auth/guards';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { deleteSavedSearch } from '@/server/saved-search/service';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const { id } = await params;
  try {
    await deleteSavedSearch({ userId: caller.id, id });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (isDomainError(e)) return NextResponse.json({ error: e.code, messageKey: e.messageKey }, { status: httpStatusFor(e.code) });
    throw e;
  }
}
