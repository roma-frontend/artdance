/**
 * GET /api/availability — ближайшие свободные времена у инструктора.
 *
 * **Зачем эндпоинт, а не серверный расчёт на странице.** Страница занятия
 * статическая: она собирается на сборке и отдаётся из CDN, потому что не содержит
 * ничего персонального. Доступность в неё встроить нельзя — она замёрзнет на
 * момент сборки и будет предлагать время, занятое неделю назад. Поэтому времена
 * приходят отдельным запросом: HTML остаётся кешируемым, а слоты — свежими.
 *
 * Это тот же шов, который нужен экрану бронирования при переходе по месяцам, и
 * контракт у него один: спрашиваем инструктора — получаем свободные интервалы.
 *
 * **Ответ не кешируется никогда.** `dataRevalidate.availability = 0`: устаревшая
 * доступность означает двойную бронь. Заголовок берётся из `cacheControl.none` —
 * той же политики, что `next.config.ts` ставит всему `/api`.
 *
 * **Аутентификации нет, и это осознанно.** Эндпоинт отдаёт ровно то, что видно на
 * экране бронирования любому посетителю: когда инструктор свободен. Персональных
 * данных в ответе нет — ни кто занял слот, ни чем. Единственная защита —
 * ограничение частоты (`rateLimits.availability`): расчёт разворачивает
 * расписание на горизонт бронирования, и без лимита это способ нагружать сервер
 * одним GET. Как только появится удержание слота (`/api/booking/hold`), у него
 * будет свой гвард — там уже создаётся запись от имени человека.
 *
 * **Ошибки — машинные коды.** Строку для человека выбирает клиент по своей
 * локали: сервер не знает языка страницы настолько, чтобы формулировать текст.
 */

import { NextResponse } from 'next/server';

import { limits } from '@/config/business';
import { cacheControl } from '@/config/cache';
import { checkRateLimit, clientIdentifier, rateLimitHeaders } from '@/lib/security/rate-limit';
import { getAlternativeSlots, type AlternativeSlot } from '@/server/content/booking';

export const runtime = 'nodejs';
/** Доступность считается на каждый вызов: кешировать её нельзя по определению. */
export const dynamic = 'force-dynamic';

type ErrorCode = 'instructor_required' | 'not_found' | 'rate_limited';

export interface AvailabilityResponse {
  instructorSlug: string;
  slots: readonly AlternativeSlot[];
}

function jsonResponse(body: object, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

function errorResponse(code: ErrorCode, status: number, extra: object = {}, headers = {}) {
  return jsonResponse({ error: code, ...extra }, status, headers);
}

export async function GET(request: Request): Promise<NextResponse> {
  /*
   * Лимит проверяется до любой работы: отклонённый запрос не должен разворачивать
   * расписание, иначе лимитер защищает только честных клиентов.
   */
  const limit = await checkRateLimit('availability', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return errorResponse(
      'rate_limited',
      429,
      { retryAfterSeconds: limit.retryAfterSeconds },
      rateLimitHeaders(limit, 'availability'),
    );
  }

  const url = new URL(request.url);
  const instructorSlug = (url.searchParams.get('instructor') ?? '').trim();

  if (instructorSlug.length === 0) {
    return errorResponse('instructor_required', 400);
  }

  /**
   * Количество ограничено сверху конфигурацией: `?count=10000` не должен
   * превращаться в способ заставить сервер посчитать всё расписание в ответ.
   */
  const requested = Number(url.searchParams.get('count'));
  const count =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, limits.alternativeSlots)
      : limits.alternativeSlots;

  const slots = getAlternativeSlots(instructorSlug, count);

  /*
   * Неизвестный инструктор — 404, а не пустой список: пустой список означает «нет
   * свободного времени», и подменять им «такого инструктора нет» значит скрыть
   * ошибку в ссылке от того, кто её поставил.
   */
  if (slots === null) return errorResponse('not_found', 404);

  const payload: AvailabilityResponse = { instructorSlug, slots };

  return jsonResponse(payload, 200, { 'X-RateLimit-Remaining': String(limit.remaining) });
}
