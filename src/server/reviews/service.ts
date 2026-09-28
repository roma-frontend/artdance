/**
 * REVIEWS SERVICE — 4.10 (отзывы).
 *
 * - Только после покупки/брони (isVerifiedPurchase): проверяет Order с PAID/завершённой бронью у автора.
 * - Модерация: PENDING, видимы только APPROVED (queries/reviews.ts).
 * - Один отзыв на бронь (@@unique authorId+bookingId).
 */

import 'server-only';

import { reviews as reviewRules } from '@/config/business';
import { domainErrors } from '@/domain/errors';
import { db } from '@/lib/db';

export interface CreateReviewInput {
  authorId: string;
  bookingId?: string | null;
  classId?: string | null;
  instructorId?: string | null;
  venueId?: string | null;
  productId?: string | null;
  rating: number;
  body: string;
  authorRole?: string | null;
}

export async function createReview(input: CreateReviewInput) {
  const rating = Math.floor(input.rating);
  if (rating < reviews.minRating || rating > reviews.maxRating) throw domainErrors.validationFailed('rating');
  const body = input.body.trim();
  if (body.length < reviews.minLength || body.length > reviews.maxLength) throw domainErrors.validationFailed('body');

  // Доказательство покупки: бронь у автора в статусе, допускающем отзыв, или заказ с этим товаром
  let verified = false;
  if (input.bookingId) {
    const b = await db.booking.findUnique({ where: { id: input.bookingId }, select: { customerId: true, status: true, instructorId: true, sessionId: true } });
    if (!b || b.customerId !== input.authorId) throw domainErrors.forbidden();
    if (['CONFIRMED', 'COMPLETED'].includes(b.status as string)) verified = true;
    // целевая сущность должна совпадать с бронью
    if (input.instructorId && b.instructorId !== input.instructorId) throw domainErrors.validationFailed('instructorId');
  }
  if (!verified && input.productId) {
    const order = await db.order.findFirst({
      where: { userId: input.authorId, status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] as unknown as never } as never },
      select: { id: true },
    });
    if (order) {
      const item = await db.orderItem.findFirst({ where: { orderId: order.id, variant: { productId: input.productId } } });
      if (item) verified = true;
    }
  }
  if (reviewRules.requireVerifiedPurchase && !verified) throw domainErrors.forbidden();

  // Бронь уже имеет отзыв — уникальность
  if (input.bookingId) {
    const dup = await db.review.findUnique({ where: { authorId_bookingId: { authorId: input.authorId, bookingId: input.bookingId } } as unknown as never });
    if (dup) throw domainErrors.validationFailed('bookingId');
  }

  const review = await db.review.create({
    data: {
      authorId: input.authorId,
      bookingId: input.bookingId ?? null,
      classId: input.classId ?? null,
      instructorId: input.instructorId ?? null,
      venueId: input.venueId ?? null,
      productId: input.productId ?? null,
      rating,
      body,
      authorRole: input.authorRole ?? null,
      isVerifiedPurchase: verified,
      moderation: reviews.requireModeration ? 'PENDING' : 'APPROVED',
      editableUntil: new Date(Date.now() + reviews.allowEditWithinHours * 3600000),
    },
    select: { id: true, moderation: true },
  });
  return review;
}

const reviews = reviewRules;
