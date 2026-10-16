import 'server-only';

import { z } from 'zod';

import { db } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { requireOperator } from '@/lib/auth/guards';

const id = z.string().trim().min(1).max(128);

export async function assignTicket(input: { ticketId: string; assigneeId: string | null }) {
  const caller = await requireOperator();
  const ticketId = id.parse(input.ticketId);
  const assigneeId = input.assigneeId ? id.parse(input.assigneeId) : null;

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, assigneeId: true } });
  if (!ticket) throw new Error('Ticket not found');

  if (assigneeId) {
    const user = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true, isActive: true } });
    if (!user || !user.isActive) throw new Error('Assignee not found or inactive');
  }

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { assigneeId } as never,
    select: { id: true, assigneeId: true },
  });

  await recordAudit({
    actor: caller,
    action: 'admin.support.ticketAssign',
    entityType: 'SupportTicket',
    entityId: ticketId,
    before: { assigneeId: ticket.assigneeId },
    after: { assigneeId },
  });

  return updated;
}

export async function setTicketPriority(input: { ticketId: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' }) {
  const caller = await requireOperator();
  const ticketId = id.parse(input.ticketId);
  const priority = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).parse(input.priority);

  const ticket = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, priority: true } });
  if (!ticket) throw new Error('Ticket not found');

  const updated = await db.supportTicket.update({
    where: { id: ticketId },
    data: { priority } as never,
    select: { id: true, priority: true },
  });

  await recordAudit({
    actor: caller,
    action: 'admin.support.ticketPriority',
    entityType: 'SupportTicket',
    entityId: ticketId,
    before: { priority: (ticket as { priority: string }).priority },
    after: { priority },
  });

  return updated;
}
