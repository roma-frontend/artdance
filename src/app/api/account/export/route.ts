/**
 * API: GET /api/account/export — JSON дамп данных пользователя (A-10, GDPR).
 *
 * Возвращает персональные данные и связанную историю: профиль, брони, заказы,
 * отзывы, избранное, согласия и настройки уведомлений. Данные принадлежат
 * пользователю и не содержат чужой PII: в бронях и заказах только собственные
 * записи, в отзывах — только свои, в избранном — свои ссылки.
 */

import { db } from '@/lib/db';
import { getCaller } from '@/lib/auth/guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const caller = await getCaller();
  if (!caller) return new Response('Unauthorized', { status: 401 });

  const [user, bookings, orders, reviews, favorites, consents, preferences, enrollments, newsletter] =
    await Promise.all([
      db.user.findUnique({
        where: { id: caller.id },
        select: {
          id: true,
          email: true,
          name: true,
          locale: true,
          timeZone: true,
          role: true,
          createdAt: true,
          deletionRequestedAt: true,
        },
      }),
      db.booking.findMany({
        where: { customerId: caller.id },
        select: {
          id: true,
          reference: true,
          status: true,
          subject: true,
          startsAt: true,
          endsAt: true,
          totalPrice: true,
          currencyCode: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.order.findMany({
        where: { userId: caller.id },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          currencyCode: true,
          placedAt: true,
        },
        orderBy: { placedAt: 'desc' },
        take: 500,
      }),
      db.review.findMany({
        where: { authorId: caller.id },
        select: { id: true, rating: true, body: true, moderation: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      db.favorite.findMany({
        where: { userId: caller.id },
        select: { id: true, classId: true, productId: true, instructorId: true, venueId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      db.consentRecord.findMany({
        where: { email: caller.email },
        select: { documentId: true, version: true, createdAt: true, ipAddress: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.notificationPreference.findMany({
        where: { userId: caller.id },
        select: { channel: true, type: true, enabled: true },
      }),
      db.courseEnrollment.findMany({
        where: { userId: caller.id },
        select: { id: true, courseId: true, startedAt: true, completedAt: true },
        orderBy: { startedAt: 'desc' },
        take: 200,
      }),
      db.newsletterSubscriber.findUnique({
        where: { email: caller.email },
        select: { email: true, confirmedAt: true, unsubscribedAt: true, locale: true, source: true },
      }),
    ]);

  const payload = {
    user,
    bookings,
    orders,
    reviews,
    favorites,
    consents,
    preferences,
    enrollments,
    newsletter,
    exportedAt: new Date().toISOString(),
  };
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename=\"artdance-export.json\"',
      'Cache-Control': 'no-store',
    },
  });
}
