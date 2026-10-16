import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET() {
  try { await requireOperator(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const rows = await db.supportTemplate.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
    select: { id: true, title: true, body: true, locale: true, createdAt: true },
  }).catch(() => []);
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try { await requireOperator(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const { title, body, locale } = (await request.json().catch(() => ({}))) as { title?: string; body?: string; locale?: string };
  if (!title?.trim() || !body?.trim()) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  const caller = await requireOperator();
  const row = await db.supportTemplate.create({
    data: {
      title: title.trim().slice(0, 120),
      body: body.trim().slice(0, 8000),
      locale: (locale as never) ?? 'ru',
      createdById: caller.id,
    } as never,
    select: { id: true, title: true, body: true, locale: true },
  });
  return NextResponse.json(row);
}

export async function DELETE(request: Request) {
  try { await requireOperator(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim() ?? '';
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 });
  await db.supportTemplate.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ deleted: true });
}
