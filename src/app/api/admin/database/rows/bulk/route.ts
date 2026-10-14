import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

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
  const body = (await request.json().catch(() => null)) as { model?: string; ids?: string[] } | null;
  if (!body?.model || !Array.isArray(body.ids) || body.ids.length === 0) return NextResponse.json({ error: 'model and ids[] required' }, { status: 400 });
  let delegate: ReturnType<typeof operatorDelegate>;
  try {
    delegate = operatorDelegate(body.model);
  } catch {
    return NextResponse.json({ error: 'Unknown model' }, { status: 400 });
  }
  let deleted = 0;
  for (const id of body.ids) {
    try {
      await (delegate as unknown as { delete: (a: { where: { id: string } }) => Promise<unknown> }).delete({ where: { id } });
      deleted += 1;
      await recordAudit({ actor: caller, action: 'admin.database.bulkDelete', entityType: body.model, entityId: id, ipAddress: request.headers.get('x-forwarded-for') ?? undefined }).catch(() => {});
    } catch {}
  }
  revalidateTag(body.model, 'max');
  return NextResponse.json({ deleted });
}
