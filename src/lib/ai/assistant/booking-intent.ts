/**
 * Разбор предложений записи в ответе ассистента.
 *
 * Модель не бронирует сама: она может поставить токен `[[book:ID]]` рядом с
 * занятием из расписания. Сервер вырезает токен из текста и передаёт клиенту
 * действие. Запись подтверждает клиент отдельной кнопкой, оплата в этом потоке
 * не участвует.
 *
 * Функция чистая: без базы и без сети, поэтому её легко проверять отдельно.
 */

/** Идентификатор сессии: cuid или близкий к нему набор символов. */
const BOOK_TOKEN = /\[\[book:([A-Za-z0-9_-]{4,64})\]\]/g;

/** Больше двух предложений в одном ответе клиенту не нужно и опасно для UX. */
export const MAX_BOOKING_INTENTS = 2;

export interface BookingIntentParse {
  /** Текст без токенов и без лишних пустых строк. */
  text: string;
  /** Уникальные ID сессий в порядке появления, не больше MAX_BOOKING_INTENTS. */
  sessionIds: string[];
}

export function extractBookingIntents(raw: string): BookingIntentParse {
  const sessionIds: string[] = [];

  const withoutTokens = raw.replace(BOOK_TOKEN, (_token, id: string) => {
    if (!sessionIds.includes(id) && sessionIds.length < MAX_BOOKING_INTENTS) {
      sessionIds.push(id);
    }
    return '';
  });

  const text = withoutTokens
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { text, sessionIds };
}
