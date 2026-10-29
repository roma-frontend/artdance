/**
 * REVIEW REPLY (D-06) — ответ владельца на отзыв.
 *
 * Правила, которые можно проверить без базы:
 *  - длина ответа от 10 до 2000 символов после обрезки пробелов;
 *  - отвечать можно только под опубликованным отзывом: черновик и отклонённый
 *    текст публике не показаны, и ответ под ними раскрыл бы их существование.
 *
 * Кто может ответить, решает сервис: он знает владельца сущности отзыва.
 */

import type { moderationStatuses } from '@/domain/enums';

/** Границы ответа. Совпадают с подсказкой в форме. */
export const replyLengths = { min: 10, max: 2000 } as const;

export function replyValid(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length >= replyLengths.min && trimmed.length <= replyLengths.max;
}

/** Ответ виден публике только под одобренным отзывом. */
export function replyAllowedFor(moderation: (typeof moderationStatuses)[number]): boolean {
  return moderation === 'APPROVED';
}
