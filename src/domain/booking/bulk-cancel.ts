/**
 * МАССОВАЯ ОТМЕНА БРОНЕЙ — разбор заявки на согласование (E-01).
 *
 * Заявка хранит то, что подтвердит второй администратор: список броней, причину и
 * того, кто отменяет. Исполнитель читает её из JSON, поэтому разбор и предел — здесь,
 * в одном месте. Иначе две копии проверки могли бы разойтись, и одобренная заявка
 * отменила бы брони, которых в ней не было.
 *
 * Невалидная заявка не исполняется. Она не падает с ошибкой: возвращается `null`, и
 * вызывающий код решает, что записать в журнал.
 */

export interface BulkCancelPayload {
  bookingIds: string[];
  reason: string;
  byProvider: boolean;
}

const MIN_REASON_LENGTH = 3;

export function parseBulkCancelPayload(payload: unknown, maxItems: number): BulkCancelPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const { bookingIds, reason, byProvider } = payload as Record<string, unknown>;

  if (!Array.isArray(bookingIds)) return null;
  if (!bookingIds.every((id): id is string => typeof id === 'string' && id.length > 0)) return null;

  const unique = [...new Set(bookingIds)];
  if (unique.length === 0 || unique.length > maxItems) return null;

  if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) return null;
  if (typeof byProvider !== 'boolean') return null;

  return { bookingIds: unique, reason, byProvider };
}
