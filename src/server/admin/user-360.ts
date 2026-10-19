import 'server-only';

import { db } from '@/lib/db';
import { requireOperator } from '@/lib/auth/guards';
import { getUserDetail } from './people';

export interface UserTimelineItem {
  id: string;
  type: 'user' | 'booking' | 'order' | 'ticket' | 'review' | 'audit';
  occurredAt: string;
  title: string;
  subtitle?: string;
  status?: string;
  entityId?: string;
  href?: string;
}

function iso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

export async function getUser360(id: string) {
  const caller = await requireOperator();
  void caller;
  const user = await getUserDetail(id);
  if (!user) return null;

  const [bookings, orders, tickets, reviews, sessions] = await Promise.all([
    db.booking.findMany({
      where: { customerId: id },
      orderBy: { startsAt: 'desc' },
      take: 30,
      select: { id: true, reference: true, subject: true, status: true, startsAt: true, totalPrice: true, currencyCode: true },
    }),
    db.order.findMany({
      where: { userId: id },
      orderBy: { placedAt: 'desc' },
      take: 30,
      select: { id: true, orderNumber: true, status: true, total: true, currencyCode: true, placedAt: true, paidAt: true },
    }),
    db.supportTicket.findMany({
      where: { email: user.email },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, topic: true, status: true, priority: true, createdAt: true, updatedAt: true },
    }),
    db.review.findMany({
      where: { authorId: id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, rating: true, moderation: true, createdAt: true, body: true },
    }),
    db.session.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, ipAddress: true, userAgent: true, expiresAt: true, createdAt: true },
    }),
  ]);

  const entityIds = [id, ...bookings.map((item) => item.id), ...orders.map((item) => item.id), ...tickets.map((item) => item.id), ...reviews.map((item) => item.id)];
  const audit = await db.auditLog.findMany({
    where: { entityId: { in: entityIds }, entityType: { in: ['User', 'Booking', 'Order', 'SupportTicket', 'Review'] } },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: { id: true, action: true, entityType: true, entityId: true, actorEmail: true, diff: true, createdAt: true },
  });

  const timeline: UserTimelineItem[] = [
    { id: `user:${user.id}`, type: 'user' as const, occurredAt: user.createdAt.toISOString(), title: 'User account created', subtitle: user.email, entityId: user.id },
    ...bookings.map((item) => ({ id: `booking:${item.id}`, type: 'booking' as const, occurredAt: item.startsAt.toISOString(), title: `Booking ${item.reference}`, subtitle: `${item.subject} · ${item.totalPrice} ${item.currencyCode}`, status: item.status, entityId: item.id })),
    ...orders.map((item) => ({ id: `order:${item.id}`, type: 'order' as const, occurredAt: item.placedAt.toISOString(), title: `Order ${item.orderNumber}`, subtitle: `${item.total} ${item.currencyCode}`, status: item.status, entityId: item.id })),
    ...tickets.map((item) => ({ id: `ticket:${item.id}`, type: 'ticket' as const, occurredAt: item.createdAt.toISOString(), title: `Support: ${item.topic}`, subtitle: 'Matched by email', status: `${item.status} · ${item.priority}`, entityId: item.id })),
    ...reviews.map((item) => ({ id: `review:${item.id}`, type: 'review' as const, occurredAt: item.createdAt.toISOString(), title: `Review · ${item.rating}/5`, subtitle: item.body.slice(0, 140), status: item.moderation, entityId: item.id })),
    ...audit.map((item): UserTimelineItem => ({ id: `audit:${item.id}`, type: 'audit', occurredAt: item.createdAt.toISOString(), title: item.action, subtitle: `${item.actorEmail} · ${item.entityType}`, entityId: item.entityId })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 100);

  return {
    user,
    bookings: bookings.map((item) => ({ ...item, startsAt: item.startsAt.toISOString() })),
    orders: orders.map((item) => ({ ...item, placedAt: item.placedAt.toISOString(), paidAt: iso(item.paidAt) })),
    tickets: tickets.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
    reviews: reviews.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    sessions: sessions.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), expiresAt: item.expiresAt.toISOString() })),
    audit: audit.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    timeline,
  };
}
