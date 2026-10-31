import 'server-only';

import { summarizeInstructorBookings, type InstructorBookingSummary } from '@/domain/instructor-analytics';
import { db } from '@/lib/db';

const WINDOW_DAYS = 30;

export interface InstructorAnalytics extends InstructorBookingSummary {
  /** Средняя оценка по одобренным отзывам за всё время; average = null, пока отзывов нет. */
  rating: { average: number | null; count: number };
}

/**
 * Показатели кабинета инструктора: брони за последние 30 дней и средняя оценка
 * по одобренным отзывам. Данные персональные, поэтому страница не кешируется.
 */
export async function getInstructorAnalytics(instructorId: string, now = new Date()): Promise<InstructorAnalytics> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [rows, rating] = await Promise.all([
    db.booking.findMany({
      where: { instructorId, startsAt: { gte: since, lt: now } },
      select: { status: true, customerId: true, totalPrice: true, startsAt: true },
    }),
    db.review.aggregate({
      where: { instructorId, moderation: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);

  return {
    ...summarizeInstructorBookings(rows, now, WINDOW_DAYS),
    rating: { average: rating._avg.rating, count: rating._count._all },
  };
}
