'use server';

import { z } from 'zod';

import { reviews } from '@/config/business';
import { authedAction } from '@/server/safe-action';
import { createReview } from '@/server/reviews/service';

export const createReviewAction = authedAction
  .metadata({ rateLimit: 'reviewSubmit' })
  .inputSchema(
    z.object({
      bookingId: z.string().optional().nullable(),
      classId: z.string().optional().nullable(),
      instructorId: z.string().optional().nullable(),
      venueId: z.string().optional().nullable(),
      productId: z.string().optional().nullable(),
      rating: z.number().int().min(reviews.minRating).max(reviews.maxRating),
      body: z.string().min(reviews.minLength).max(reviews.maxLength),
      authorRole: z.string().max(120).optional().nullable(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    return createReview({ authorId: ctx.caller.id, ...parsedInput });
  });
