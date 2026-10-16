import { NextResponse } from 'next/server';

import { assignTicket, setTicketPriority } from '@/server/support/assignments';
import { requireOperator } from '@/lib/auth/guards';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH /api/admin/god/tickets/:id  { assigneeId, priority, status }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireOperator(); } catch { return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }); }
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { assigneeId?: string | null; priority?: string; status?: string };

  try {
    if (body.assigneeId !== undefined) {
      await assignTicket({ ticketId: id, assigneeId: body.assigneeId });
    }
    if (body.priority) {
      await setTicketPriority({ ticketId: id, priority: body.priority as never });
    }
    if (body.status) {
      const { setSupportTicketStatus } = await import('@/server/actions/admin/support');
      // direct update for PATCH path
      await db.supportTicket.update({
        where: { id },
        data: { status: body.status, ...(body.status === 'RESOLVED' ? { resolvedAt: new Date() } : { resolvedAt: null }) } as never,
      });
      void setSupportTicketStatus;
    }
    const updated = await db.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true, priority: true, assigneeId: true, assignee: { select: { name: true, email: true } } },
    } as never);
    return NextResponse.json(updated, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'FAILED' }, { status: 400 });
  }
}
