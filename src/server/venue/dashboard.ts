import 'server-only';

import { db } from '@/lib/db';

const UPCOMING_LIMIT = 50;

/**
 * Площадки пользователя по членству, их залы и ближайшие подтверждённые брони.
 * Персональные данные клиентов не выбираются: площадке нужны только слот и зал.
 */
export async function getVenueDashboard(userId: string, now: Date = new Date()) {
  const memberships = await db.venueMember.findMany({
    where: { userId, venue: { deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    select: {
      venue: {
        select: {
          id: true,
          slug: true,
          name: true,
          district: true,
          rooms: {
            where: { deletedAt: null },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, capacity: true, pricePerHour: true, isActive: true },
          },
        },
      },
    },
  });

  const venues = memberships.map((membership) => membership.venue);
  if (venues.length === 0) return { venues, bookings: [] };

  const bookings = await db.booking.findMany({
    where: {
      venueId: { in: venues.map((venue) => venue.id) },
      status: 'CONFIRMED',
      startsAt: { gte: now },
    },
    orderBy: { startsAt: 'asc' },
    take: UPCOMING_LIMIT,
    select: {
      id: true,
      reference: true,
      subject: true,
      startsAt: true,
      endsAt: true,
      venueId: true,
      room: { select: { name: true } },
    },
  });

  return { venues, bookings };
}
