import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

import { recordAudit } from '@/lib/audit';
import { requireOperator } from '@/lib/auth/guards';
import { operatorDelegate } from '@/server/admin/operator';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let caller: Awaited<ReturnType<typeof requireOperator>>;
  try {
    caller = await requireOperator();
  } catch {
    return jsonError('FORBIDDEN', 403);
  }
  const body = (await request.json().catch(() => null)) as { model?: string; doc?: Record<string, unknown> } | null;
  if (!body?.model || !body.doc || typeof body.doc !== 'object') return jsonError('model and doc required', 400);
  let delegate: ReturnType<typeof operatorDelegate>;
  try {
    delegate = operatorDelegate(body.model);
  } catch {
    return jsonError('Unknown model', 400);
  }
  try {
    const row = (await (delegate as unknown as { create: (a: { data: Record<string, unknown>; select: { id: boolean } }) => Promise<{ id: string }> }).create({
      data: body.doc,
      select: { id: true },
    })) as { id: string };
    await recordAudit({ actor: caller, action: 'admin.database.create', entityType: body.model, entityId: row.id, after: body.doc, ipAddress: request.headers.get('x-forwarded-for') ?? undefined }).catch(() => {});
    revalidateTag(body.model, 'max');
    return NextResponse.json({ id: row.id });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Create failed', 400);
  }
}

export async function PATCH(request: Request) {
  let caller: Awaited<ReturnType<typeof requireOperator>>;
  try {
    caller = await requireOperator();
  } catch {
    return jsonError('FORBIDDEN', 403);
  }
  const body = (await request.json().catch(() => null)) as { model?: string; id?: string; patch?: Record<string, unknown> } | null;
  if (!body?.model || !body.id || !body.patch) return jsonError('model, id and patch required', 400);
  let delegate: ReturnType<typeof operatorDelegate>;
  try {
    delegate = operatorDelegate(body.model);
  } catch {
    return jsonError('Unknown model', 400);
  }
  try {
    await (delegate as unknown as { update: (a: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown> }).update({
      where: { id: body.id },
      data: body.patch,
    });
    await recordAudit({ actor: caller, action: 'admin.database.patch', entityType: body.model, entityId: body.id, after: body.patch, ipAddress: request.headers.get('x-forwarded-for') ?? undefined }).catch(() => {});
    revalidateTag(body.model, 'max');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Update failed', 400);
  }
}

export async function DELETE(request: Request) {
  let caller: Awaited<ReturnType<typeof requireOperator>>;
  try {
    caller = await requireOperator();
  } catch {
    return jsonError('FORBIDDEN', 403);
  }
  const url = new URL(request.url);
  const model = url.searchParams.get('model');
  const id = url.searchParams.get('id');
  if (!model || !id) return jsonError('model and id required', 400);
  let delegate: ReturnType<typeof operatorDelegate>;
  try {
    delegate = operatorDelegate(model);
  } catch {
    return jsonError('Unknown model', 400);
  }
  try {
    await (delegate as unknown as { delete: (a: { where: { id: string } }) => Promise<unknown> }).delete({ where: { id } });
    await recordAudit({ actor: caller, action: 'admin.database.delete', entityType: model, entityId: id, ipAddress: request.headers.get('x-forwarded-for') ?? undefined }).catch(() => {});
    revalidateTag(model, 'max');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : 'Delete failed', 400);
  }
}
