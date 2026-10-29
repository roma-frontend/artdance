import 'server-only';

import type { Caller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { domainErrors } from '@/domain/errors';
import { replyAllowedFor, replyValid } from '@/domain/review-reply';

/** Кто пишет или удаляет ответ: сессионный caller из действия или маршрута, а не поле запроса. */
export type ReplyActor = Pick<Caller, 'id' | 'role'>;

/**
 * Право управлять ответом под отзывом: администратор, инструктор, которому принадлежит
 * отзыв, или участник площадки. Проверка в сервисе, а не только в действии: второй вход
 * (маршрут API, будущий скрипт) не должен её обходить.
 */
async function assertCanManageReply(actor: ReplyActor, reviewId: string) {
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      moderation: true,
      venueId: true,
      instructor: { select: { userId: true } },
    },
  });
  if (!review) throw domainErrors.notFound();
  if (actor.role === 'ADMIN') return review;
  if (review.instructor?.userId === actor.id) return review;
  if (review.venueId) {
    const membership = await db.venueMember.findUnique({
      where: { venueId_userId: { venueId: review.venueId, userId: actor.id } },
      select: { id: true },
    });
    if (membership) return review;
  }
  throw domainErrors.forbidden();
}

/**
 * Ответ под отзывом. Один ответ на отзыв: повтор отвечает ошибкой, а не перезаписью,
 * иначе второй владелец молча заменил бы ответ первого.
 */
export async function replyToReview(input: { reviewId: string; actor: ReplyActor; body: string }) {
  const body = input.body.trim();
  if (!replyValid(body)) throw domainErrors.validationFailed('body');
  const review = await assertCanManageReply(input.actor, input.reviewId);
  if (!replyAllowedFor(review.moderation)) throw domainErrors.notFound();
  try {
    return await db.reviewResponse.create({
      data: { reviewId: input.reviewId, authorId: input.actor.id, body },
      select: { id: true, body: true, createdAt: true },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw domainErrors.validationFailed('reviewId');
    throw e;
  }
}

/**
 * Удаление ответа. Права те же, что на запись, но модерация отзыва не важна: убрать
 * свой текст можно всегда.
 */
export async function deleteReply(input: { reviewId: string; actor: ReplyActor }) {
  await assertCanManageReply(input.actor, input.reviewId);
  const { count } = await db.reviewResponse.deleteMany({ where: { reviewId: input.reviewId } });
  if (count === 0) throw domainErrors.notFound();
}
