import { NextResponse } from 'next/server';

import { listTicketAttachments, uploadTicketAttachment } from '@/server/support/attachments';
import { requireOperator } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try { await requireOperator(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const ticketId = new URL(request.url).searchParams.get('ticketId')?.trim() ?? '';
  if (!ticketId) return NextResponse.json({ error: 'MISSING_TICKET' }, { status: 400 });
  const rows = await listTicketAttachments(ticketId).catch(() => []);
  return NextResponse.json(rows, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try { await requireOperator(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const form = await request.formData();
  const ticketId = String(form.get('ticketId') ?? '').trim();
  const replyId = String(form.get('replyId') ?? '').trim() || null;
  const file = form.get('file');
  if (!ticketId || !(file instanceof File)) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  try {
    const row = await uploadTicketAttachment({ ticketId, replyId, file });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'UPLOAD_FAILED' }, { status: 400 });
  }
}
