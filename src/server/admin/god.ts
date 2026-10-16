import 'server-only';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';
import { operatorPulse } from './operator';
import { getSupportSummary } from './support';

export type GodTicketRow = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  locale: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  slaDueAt: string | null;
  firstResponseAt: string | null;
  createdAt: string;
  updatedAt: string;
  repliesCount: number;
  attachmentsCount: number;
};

export interface GodSnapshot {
  pulse: Awaited<ReturnType<typeof operatorPulse>>;
  support: Awaited<ReturnType<typeof getSupportSummary>>;
  allTickets: GodTicketRow[];
  impersonations: Array<{
    key: string;
    targetUserId: string;
    targetName: string | null;
    targetEmail: string | null;
    expiresAt: number;
    sessionId: string;
  }>;
  recentAudit: Array<{
    id: string;
    action: string;
    actorEmail: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
    diff: unknown;
  }>;
  stats: {
    users: number;
    bookings: number;
    orders: number;
    revenue: number;
  };
  counts: {
    sessions: number;
    failedPayments: number;
    failedNotifications: number;
    failedWebhooks: number;
    openTickets: number;
    pendingApprovals: number;
    trash: number;
    lockedLogins: number;
  };
  templates: Array<{ id: string; title: string; body: string; locale: string }>;
  operators: Array<{ id: string; name: string; email: string }>;
}

export async function getGodSnapshot(): Promise<GodSnapshot> {
  await requireOperator();

  // Tickets query is resilient: if new columns/tables aren't migrated yet (e.g. preview env),
  // fall back to the legacy shape instead of crashing the whole snapshot.
  const ticketsQuery: Promise<unknown[]> = db.supportTicket
    .findMany({
      orderBy: { createdAt: 'desc' },
      take: 80,
      select: {
        id: true,
        name: true,
        email: true,
        topic: true,
        message: true,
        locale: true,
        status: true,
        priority: true,
        assigneeId: true,
        assignee: { select: { name: true, email: true } },
        slaDueAt: true,
        firstResponseAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { replies: true, attachments: true } },
      },
    } as never)
    .catch(async () => {
      console.warn('[god] fallback to legacy tickets query — run prisma migrate deploy');
      return (await db.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: {
          id: true,
          name: true,
          email: true,
          topic: true,
          message: true,
          locale: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { replies: true } },
        },
      } as never)) as unknown as unknown[];
    });

  const [pulse, support, allTicketsRaw, impersonationRows, recentAudit, stats, counts, templates, operators] =
    await Promise.all([
      operatorPulse(),
      getSupportSummary(),
      ticketsQuery,
      db.operatorSetting.findMany({
        where: { key: { startsWith: 'impersonation.' } },
        select: { key: true, value: true },
      }),
      db.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 16,
        select: {
          id: true,
          action: true,
          actorEmail: true,
          entityType: true,
          entityId: true,
          createdAt: true,
          diff: true,
        },
      }),
      Promise.all([
        db.user.count(),
        db.booking.count(),
        db.order.count(),
        db.payment.aggregate({
          where: { status: 'PAID' },
          _sum: { amount: true },
        }),
      ]).then(([users, bookings, orders, revenueAgg]) => ({
        users,
        bookings,
        orders,
        revenue: (revenueAgg as { _sum: { amount: number | null } })._sum.amount ?? 0,
      })),
      Promise.all([
        db.session.count({ where: { expiresAt: { gt: new Date() } } }),
        db.payment.count({ where: { status: 'FAILED' } }),
        db.notification.count({ where: { status: 'FAILED' } }),
        db.webhookEvent.count({ where: { status: 'FAILED' } }),
        db.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
        db.approvalRequest.count({ where: { status: 'PENDING' } }),
        // trash: sum of soft-deleted across known models (approx via danceClass)
        db.danceClass.count({}).catch(() => 0),
        db.loginAttempt.count({ where: { lockedUntil: { gt: new Date() } } }),
      ]).then(([sessions, failedPayments, failedNotifications, failedWebhooks, openTickets, pendingApprovals, trash, lockedLogins]) => ({
        sessions,
        failedPayments,
        failedNotifications,
        failedWebhooks,
        openTickets,
        pendingApprovals,
        trash,
        lockedLogins,
      })),
      db.supportTemplate.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: { id: true, title: true, body: true, locale: true },
      }).catch(() => [] as Array<{ id: string; title: string; body: string; locale: string }>),
      db.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPPORT'] as never }, isActive: true } as never,
        orderBy: { name: 'asc' },
        take: 50,
        select: { id: true, name: true, email: true },
      }).catch(() => [] as Array<{ id: string; name: string; email: string }>),
    ]);

  const allTickets: GodTicketRow[] = (allTicketsRaw as unknown as Array<{
    id: string; name: string; email: string; topic: string; message: string; locale: string;
    status: string; priority?: string; assigneeId?: string | null;
    assignee?: { name: string; email: string } | null;
    slaDueAt?: Date | null; firstResponseAt?: Date | null;
    createdAt: Date; updatedAt: Date;
    _count: { replies: number; attachments: number };
  }>).map((t) => ({
    id: t.id,
    name: t.name,
    email: t.email,
    topic: t.topic,
    message: t.message,
    locale: String(t.locale),
    status: t.status,
    priority: String((t as { priority?: string }).priority ?? 'NORMAL'),
    assigneeId: (t as { assigneeId?: string | null }).assigneeId ?? null,
    assigneeName: (t as { assignee?: { name: string } | null }).assignee?.name ?? null,
    assigneeEmail: (t as { assignee?: { email: string } | null }).assignee?.email ?? null,
    slaDueAt: (t as { slaDueAt?: Date | null }).slaDueAt ? new Date((t as { slaDueAt: Date }).slaDueAt).toISOString() : null,
    firstResponseAt: (t as { firstResponseAt?: Date | null }).firstResponseAt ? new Date((t as { firstResponseAt: Date }).firstResponseAt).toISOString() : null,
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
    repliesCount: t._count.replies,
    attachmentsCount: (t._count as { attachments?: number }).attachments ?? 0,
  }));

  // Resolve impersonation targets
  const impersonations: GodSnapshot['impersonations'] = [];
  for (const row of impersonationRows) {
    const v = row.value as { userId?: string; expiresAt?: number } | null;
    if (!v || typeof v.userId !== 'string' || typeof v.expiresAt !== 'number') continue;
    if (v.expiresAt <= Date.now()) continue;
    const sessionId = row.key.replace('impersonation.', '');
    impersonations.push({
      key: row.key,
      targetUserId: v.userId,
      targetName: null,
      targetEmail: null,
      expiresAt: v.expiresAt,
      sessionId,
    });
  }
  if (impersonations.length > 0) {
    const ids = impersonations.map((i) => i.targetUserId);
    const users = await db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    for (const imp of impersonations) {
      const u = map.get(imp.targetUserId);
      if (u) {
        imp.targetName = u.name;
        imp.targetEmail = u.email;
      }
    }
  }

  return {
    pulse,
    support,
    allTickets,
    impersonations,
    recentAudit: recentAudit as GodSnapshot['recentAudit'],
    stats,
    counts,
    templates: templates as GodSnapshot['templates'],
    operators: operators as GodSnapshot['operators'],
  };
}

export type GodPulse = Pick<GodSnapshot, 'counts' | 'stats'> & {
  openTickets: number;
  pendingTickets: number;
  impersonations: number;
  timestamp: string;
};

export async function getGodPulse(): Promise<GodPulse> {
  await requireOperator();
  const [stats, counts, support] = await Promise.all([
    Promise.all([
      db.user.count(),
      db.booking.count(),
      db.order.count(),
      db.payment.aggregate({ where: { status: 'PAID' }, _sum: { amount: true } }),
    ]).then(([users, bookings, orders, revenueAgg]) => ({
      users,
      bookings,
      orders,
      revenue: revenueAgg._sum.amount ?? 0,
    })),
    Promise.all([
      db.session.count({ where: { expiresAt: { gt: new Date() } } }),
      db.payment.count({ where: { status: 'FAILED' } }),
      db.notification.count({ where: { status: 'FAILED' } }),
      db.webhookEvent.count({ where: { status: 'FAILED' } }),
      db.supportTicket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
      db.approvalRequest.count({ where: { status: 'PENDING' } }),
      db.danceClass.count({}).catch(() => 0),
      db.loginAttempt.count({ where: { lockedUntil: { gt: new Date() } } }),
    ]).then(([sessions, failedPayments, failedNotifications, failedWebhooks, openTickets, pendingApprovals, trash, lockedLogins]) => ({
      sessions,
      failedPayments,
      failedNotifications,
      failedWebhooks,
      openTickets,
      pendingApprovals,
      trash,
      lockedLogins,
    })),
    Promise.all([
      db.supportTicket.count({ where: { status: 'OPEN' } }),
      db.supportTicket.count({ where: { status: 'PENDING' } }),
      db.operatorSetting.count({ where: { key: { startsWith: 'impersonation.' } } }),
    ]).then(([open, pending, imp]) => ({ open, pending, imp })),
  ]);

  return {
    stats,
    counts,
    openTickets: support.open,
    pendingTickets: support.pending,
    impersonations: support.imp,
    timestamp: new Date().toISOString(),
  };
}
