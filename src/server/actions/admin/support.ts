'use server';

import { z } from 'zod';

import { db } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { requireCapability } from '@/lib/auth/guards';
import { authedAction } from '@/server/safe-action';

const input = z.object({
  id: z.string().trim().min(1).max(64),
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED']),
});

export const setSupportTicketStatus = authedAction
  .metadata({ rateLimit: 'adminMutation', audit: 'admin.support.ticketStatus' })
  .inputSchema(input)
  .action(async ({ parsedInput, ctx }) => {
    const caller = await requireCapability('support.manage');
    const before = await db.supportTicket.findUnique({ where: { id: parsedInput.id } });
    if (!before) throw new Error('Ticket not found');

    const after = await db.supportTicket.update({
      where: { id: parsedInput.id },
      data: {
        status: parsedInput.status,
        resolvedAt: parsedInput.status === 'RESOLVED' ? new Date() : null,
        resolvedById: parsedInput.status === 'RESOLVED' ? caller.id : null,
      },
      select: { id: true, status: true, resolvedAt: true },
    });

    await recordAudit({
      actor: caller,
      action: 'admin.support.ticketStatus',
      entityType: 'SupportTicket',
      entityId: parsedInput.id,
      before: { status: before.status },
      after,
      ipAddress: ctx.identifier,
    });

    return { status: after.status };
  });
