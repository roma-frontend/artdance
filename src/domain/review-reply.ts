/**
 * REVIEW REPLY (D-06) — ответ владельца на отзыв.
 * Один ответ на отзыв, только владелец сущности (инструктор/студия) может ответить.
 */

export function replyValid(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.length >= 10 && trimmed.length <= 2000;
}
