'use server';

/**
 * REVIEWS — создание отзыва по брони (A-08).
 */

import { z } from 'zod';

import { reviews } from '@/config/business';
import { db } from '@/lib/db';
import { publicAction } from '@/server/safe-action';
import { getCaller } from '@/lib/auth/guards';

const createSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(reviews.minRating).max(reviews.maxRating),
  body: z.string().trim().min(reviews.minLength).max(reviews.maxLength),
  token: z.string().optional(),
});

export const createReviewAction = publicAction
  .metadata({ rateLimit: 'reviewSubmit' })
  .inputSchema(createSchema)
  .action(async ({ parsedInput }) => {
    const caller = await getCaller().catch(() => null);
    const booking = await db.booking.findUnique({
      where: { id: parsedInput.bookingId },
      select: { id: true, customerId: true, instructorId: true, venueId: true, sessionId: true, status: true, endsAt: true },
    });
    if (!booking) throw new Error('BOOKING_NOT_FOUND');
    // Токен в query — если передан, проверяем VerificationToken
    if (parsedInput.token) {
      const vt = await db.verificationToken.findFirst({ where: { identifier: `review:${booking.id}`, value: parsedInput.token } });
      if (!vt || new Date(vt.expiresAt) < new Date()) throw new Error('INVALID_TOKEN');
    } else if (caller) {
      if (booking.customerId !== caller.id) throw new Error('FORBIDDEN');
    } else {
      throw new Error('UNAUTHORIZED');
    }
    if (reviews.requireVerifiedPurchase && booking.status !== 'COMPLETED' && new Date(booking.endsAt) > new Date()) {
      throw new Error('NOT_COMPLETED');
    }
    const authorId = caller?.id ?? booking.customerId;
    const review = await db.review.create({
      data: {
        authorId,
        bookingId: booking.id,
        instructorId: booking.instructorId ?? undefined,
        venueId: booking.venueId ?? undefined,
        rating: parsedInput.rating,
        body: parsedInput.body,
        authorRole: null,
        isVerifiedPurchase: true,
        moderation: reviews.requireModeration ? 'PENDING' : 'APPROVED',
        editableUntil: new Date(Date.now() + reviews.allowEditWithinHours * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    return { ok: true as const, id: review.id };
  });
