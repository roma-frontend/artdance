import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireOperator();
  } catch {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id')?.trim() ?? '';
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    select: {
      id: true,
      replies: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, body: true, internal: true, delivered: true, createdAt: true },
      },
    },
  });
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(
    { replies: ticket.replies },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
