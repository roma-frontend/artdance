import 'server-only';

import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { replyValid } from '@/domain/review-reply';

export async function replyToReview(input: { reviewId: string; authorId: string; body: string }) {
  const normalized = input.body.trim();
  if (!replyValid(normalized)) throw domainErrors.validationFailed('body');
  const review = await db.review.findUnique({ where: { id: input.reviewId } });
  if (!review) throw domainErrors.notFound();
  // guard: ReviewResponse @unique(reviewId) — second reply is P2002
  try {
    return await db.reviewResponse.create({ data: { reviewId: input.reviewId, authorId: input.authorId, body: normalized } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw domainErrors.validationFailed('reviewId');
    throw e;
  }
}

export async function deleteReply(reviewId: string, requesterId: string) {
  void requesterId;
  const response = await db.reviewResponse.findUnique({ where: { reviewId } });
  if (!response) throw domainErrors.notFound();
  await db.reviewResponse.delete({ where: { reviewId } });
}
