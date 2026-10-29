'use server';

/**
 * REVIEWS — создание отзыва по брони (A-08).
 *
 * Правила:
 * • Один отзыв на бронь (bookingId уникален в Review).
 * • Окно reviews.windowDays после endsAt — дальше отзыв закрыт.
 * • Только COMPLETED или endsAt в прошлом при requireVerifiedPurchase.
 * • Доступ: либо владелец брони (getCaller), либо одноразовый токен
 *   review:<bookingId> в VerificationToken (письмо после завершения).
 */

import { z } from 'zod';

import { reviews } from '@/config/business';
import { replyLengths } from '@/domain/review-reply';
import { getCaller } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { deleteReply, replyToReview } from '@/server/reviews/reply';
import { authedAction, publicAction } from '@/server/safe-action';

const createSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(reviews.minRating).max(reviews.maxRating),
  body: z.string().trim().min(reviews.minLength).max(reviews.maxLength),
  token: z.string().optional(),
});

export const createReviewAction = publicAction
  .metadata({ rateLimit: 'reviewSubmit' })
  .inputSchema(createSchema)
  .action(async ({ parsedInput, ctx }) => {
    const caller = await getCaller().catch(() => null);
    const booking = await db.booking.findUnique({
      where: { id: parsedInput.bookingId },
      select: {
        id: true,
        customerId: true,
        instructorId: true,
        venueId: true,
        session: { select: { classId: true } },
        status: true,
        endsAt: true,
        startsAt: true,
      },
    });
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    // Гвард доступа.
    if (parsedInput.token) {
      const vt = await db.verificationToken.findFirst({
        where: { identifier: `review:${booking.id}`, value: parsedInput.token },
        select: { expiresAt: true },
      });
      if (!vt || new Date(vt.expiresAt) < new Date()) throw new Error('INVALID_TOKEN');
    } else if (caller) {
      if (booking.customerId !== caller.id) throw new Error('FORBIDDEN');
    } else {
      throw new Error('UNAUTHORIZED');
    }

    if (reviews.requireVerifiedPurchase && booking.status !== 'COMPLETED' && new Date(booking.endsAt) > new Date()) {
      throw new Error('NOT_COMPLETED');
    }

    // Окно на отзыв: windowDays после endsAt.
    const windowMs = reviews.windowDays * 24 * 60 * 60 * 1_000;
    if (Date.now() - new Date(booking.endsAt).getTime() > windowMs) throw new Error('WINDOW_CLOSED');

    // Идемпотентность: одна бронь — один отзыв (@@unique [authorId, bookingId]).
    const authorId = caller?.id ?? booking.customerId;
    const existing = await db.review.findUnique({
      where: { authorId_bookingId: { authorId, bookingId: booking.id } },
      select: { id: true },
    });
    if (existing) return { ok: true as const, id: existing.id };

    const review = await db.review.create({
      data: {
        authorId,
        bookingId: booking.id,
        instructorId: booking.instructorId ?? undefined,
        venueId: booking.venueId ?? undefined,
        classId: booking.session?.classId ?? undefined,
        rating: parsedInput.rating,
        body: parsedInput.body,
        authorRole: null,
        isVerifiedPurchase: true,
        moderation: reviews.requireModeration ? 'PENDING' : 'APPROVED',
        editableUntil: new Date(Date.now() + reviews.allowEditWithinHours * 60 * 60 * 1_000),
      },
      select: { id: true },
    });

    await recordAudit({
      actor: caller,
      action: 'public.review.create',
      entityType: 'Review',
      entityId: review.id,
      after: { bookingId: booking.id, rating: parsedInput.rating },
      ipAddress: ctx.identifier,
    }).catch(() => {});

    return { ok: true as const, id: review.id };
  });

const replySchema = z.object({
  reviewId: z.string().min(1).max(64),
  body: z.string().trim().min(replyLengths.min).max(replyLengths.max),
});

/**
 * Ответ на отзыв (D-06). Право проверяет сервис: инструктор отзыва, участник площадки или администратор.
 */
export const replyToReviewAction = authedAction
  .metadata({ rateLimit: 'reviewReply', audit: 'review.reply.create' })
  .inputSchema(replySchema)
  .action(async ({ parsedInput, ctx }) => {
    const reply = await replyToReview({ reviewId: parsedInput.reviewId, actor: ctx.caller, body: parsedInput.body });
    await recordAudit({
      actor: ctx.caller,
      action: 'review.reply.create',
      entityType: 'Review',
      entityId: parsedInput.reviewId,
      after: { replyId: reply.id },
      ipAddress: ctx.identifier,
    });
    return { ok: true as const, id: reply.id };
  });

/** Удаление ответа: то же право, что и на запись. */
export const deleteReviewReplyAction = authedAction
  .metadata({ rateLimit: 'reviewReply', audit: 'review.reply.delete' })
  .inputSchema(z.object({ reviewId: z.string().min(1).max(64) }))
  .action(async ({ parsedInput, ctx }) => {
    await deleteReply({ reviewId: parsedInput.reviewId, actor: ctx.caller });
    await recordAudit({
      actor: ctx.caller,
      action: 'review.reply.delete',
      entityType: 'Review',
      entityId: parsedInput.reviewId,
      ipAddress: ctx.identifier,
    });
    return { ok: true as const };
  });
