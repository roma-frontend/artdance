import 'server-only';

/**
 * СВОДКА АДМИНКИ.
 *
 * Считается по правам: показатель, который сотрудник не имеет права видеть, не
 * запрашивается вообще и приходит как `null` — на экране это «—», а не ноль.
 * Разница существенная: «ноль заказов» — факт, «нет данных» — отсутствие доступа,
 * и путать их в отчётности нельзя.
 *
 * Запросы не кешируются: `defineQuery` здесь неприменим (кеш общий для всех, а
 * выдача зависит от прав вызывающего), а цифры сводки должны быть текущими —
 * администратор смотрит на них, принимая решение прямо сейчас.
 *
 * Окно — 30 дней. Число живёт в этом модуле, потому что это единственное место,
 * где оно означает «недавно» для сводки; отчёты берут свой диапазон из URL.
 */

import type { Capability } from '@/config/capabilities';
import { db } from '@/lib/db';

/** Дней в окне сводки. */
const WINDOW_DAYS = 30;

export interface DashboardStats {
  classes: number | null;
  instructors: number | null;
  venues: number | null;
  products: number | null;
  bookings: number | null;
  orders: number | null;
  revenue: number | null;
  moderation: number | null;
  approvals: number | null;
  users: number | null;
}

/** Статусы заказа, которые считаются оборотом: деньги получены. */
const PAID_ORDER_STATUSES = ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] as const;

export async function getDashboardStats(capabilities: Set<Capability>): Promise<DashboardStats> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();

  const canCatalog = capabilities.has('catalog.view');
  const canBookings = capabilities.has('bookings.view');
  const canOrders = capabilities.has('orders.view');
  const canRevenue = capabilities.has('reports.revenue');
  const canModerate = capabilities.has('reviews.moderate');
  const canSettings = capabilities.has('settings.edit');
  const canUsers = capabilities.has('users.view');

  const [
    classes,
    instructors,
    venues,
    products,
    bookings,
    orders,
    revenue,
    pendingReviews,
    pendingInstructors,
    pendingVenues,
    approvals,
    users,
  ] = await Promise.all([
    canCatalog ? db.danceClass.count({ where: { isActive: true } }) : null,
    canCatalog
      ? db.instructorProfile.count({ where: { moderation: 'APPROVED', publishedAt: { not: null } } })
      : null,
    canCatalog ? db.venue.count({ where: { moderation: 'APPROVED', publishedAt: { not: null } } }) : null,
    canCatalog ? db.product.count({ where: { isActive: true } }) : null,
    canBookings ? db.booking.count({ where: { createdAt: { gte: since } } }) : null,
    canOrders ? db.order.count({ where: { placedAt: { gte: since } } }) : null,
    canRevenue
      ? db.order.aggregate({
          _sum: { total: true },
          where: { placedAt: { gte: since }, status: { in: [...PAID_ORDER_STATUSES] } },
        })
      : null,
    canModerate ? db.review.count({ where: { moderation: 'PENDING' } }) : null,
    canModerate ? db.instructorProfile.count({ where: { moderation: 'PENDING' } }) : null,
    canModerate ? db.venue.count({ where: { moderation: 'PENDING' } }) : null,
    canSettings
      ? db.approvalRequest.count({ where: { status: 'PENDING', expiresAt: { gt: now } } })
      : null,
    canUsers ? db.user.count({ where: { isActive: true } }) : null,
  ]);

  const moderation =
    pendingReviews === null || pendingInstructors === null || pendingVenues === null
      ? null
      : pendingReviews + pendingInstructors + pendingVenues;

  return {
    classes,
    instructors,
    venues,
    products,
    bookings,
    orders,
    revenue: revenue === null ? null : (revenue._sum.total ?? 0),
    moderation,
    approvals,
    users,
  };
}
