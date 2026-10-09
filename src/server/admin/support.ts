import 'server-only';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';

export async function getSupportSummary() {
  await requireOperator();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [open, pending, resolvedToday, tickets] = await Promise.all([
    db.supportTicket.count({ where: { status: 'OPEN' } }),
    db.supportTicket.count({ where: { status: 'PENDING' } }),
    db.supportTicket.count({ where: { status: 'RESOLVED', resolvedAt: { gte: startOfToday } } }),
    db.supportTicket.findMany({
      where: { status: { in: ['OPEN', 'PENDING'] } },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: { id: true, name: true, email: true, topic: true, message: true, locale: true, status: true, createdAt: true },
    }),
  ]);

  return { open, pending, resolvedToday, tickets };
}
