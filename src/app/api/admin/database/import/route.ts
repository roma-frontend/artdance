import { NextResponse } from 'next/server';

import { recordAudit } from '@/lib/audit';
import { requireOperator } from '@/lib/auth/guards';
import { operatorDelegate } from '@/server/admin/operator';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let caller: Awaited<ReturnType<typeof requireOperator>>;
  try {
    caller = await requireOperator();
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { model?: string; docs?: unknown[] } | null;
  if (!body?.model || !Array.isArray(body.docs)) return NextResponse.json({ error: 'model and docs[] required' }, { status: 400 });

  const model = body.model;
  let delegate: ReturnType<typeof operatorDelegate>;
  try {
    delegate = operatorDelegate(model);
  } catch {
    return NextResponse.json({ error: 'Unknown model' }, { status: 400 });
  }

  let inserted = 0;
  let failed = 0;
  for (const doc of body.docs) {
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
      failed += 1;
      continue;
    }
    try {
      const row = (await (delegate as unknown as { create: (a: { data: Record<string, unknown> }) => Promise<{ id: string }> }).create({
        data: doc as Record<string, unknown>,
      })) as { id: string };
      inserted += 1;
      await recordAudit({ actor: caller, action: 'admin.database.import', entityType: model, entityId: row.id, after: doc, ipAddress: request.headers.get('x-forwarded-for') ?? undefined }).catch(() => {});
    } catch {
      failed += 1;
    }
  }

  // Invalidate any data cache that might hold stale lists
  const { revalidateTag } = await import('next/cache');
  try {
    revalidateTag(model, 'max');
  } catch {}

  return NextResponse.json({ inserted, failed });
}
