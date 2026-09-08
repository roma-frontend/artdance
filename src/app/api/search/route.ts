/**
 * GET /api/search — подсказки поиска для оверлея.
 *
 * Эндпоинт публичный и без аутентификации: он отдаёт то же, что видно в
 * каталоге любому посетителю. Поэтому единственная защита здесь — ограничение
 * частоты (`rateLimits.search`), а не проверка личности: без него поле поиска
 * превращается в бесплатный способ нагружать сервер по одному запросу на каждое
 * нажатие клавиши.
 *
 * **Почему это route handler, а не server action.** Действие нельзя отменить:
 * при быстром вводе в полёте оказывается пять запросов, и ответ на «сал» приходит
 * после ответа на «сальса». `fetch` с `AbortSignal` отменяется на клиенте, и в
 * список попадает ответ только на последний запрос.
 *
 * **Почему выдача не кешируется.** Пространство запросов не ограничено, и
 * кешировать «q=с», «q=са», «q=сал» бессмысленно: каждый следующий символ — новый
 * ключ. Заголовок берётся из `cacheControl.none`, того же, что `next.config.ts`
 * ставит всему `/api`, — второй политики кеша в проекте быть не должно.
 *
 * **Ошибки — машинные коды, а не тексты.** Ответ читает клиент, а показать
 * человеку он обязан свою строку из каталога переводов: сервер не знает языка
 * страницы настолько, чтобы формулировать сообщения.
 */

import { NextResponse } from 'next/server';

import { limits } from '@/config/business';
import { cacheControl } from '@/config/cache';
import { parseSearchScope, type SearchResponse } from '@/domain/search';
import { defaultLocale, isLocale } from '@/i18n/config';
import {
  checkRateLimit,
  clientIdentifier,
  rateLimitHeaders,
} from '@/lib/security/rate-limit';
import { searchCatalog } from '@/server/content/catalog';

export const runtime = 'nodejs';
/** Ответ зависит от строки запроса и должен считаться на каждый вызов. */
export const dynamic = 'force-dynamic';

/** Код ошибки для клиента. Строки для человека — в `search.*` каталога переводов. */
type ErrorCode = 'query_too_short' | 'rate_limited';

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
  const url = new URL(request.url);

  /*
   * Лимит проверяется до разбора параметров: разбор дешёвый, но упорядочивание
   * важно — отклонённый по частоте запрос не должен выполнять никакой работы,
   * иначе лимитер защищает только от честных клиентов.
   */
  const limit = await checkRateLimit('search', clientIdentifier(request.headers));
  if (!limit.allowed) {
    return errorResponse(
      'rate_limited',
      429,
      { retryAfterSeconds: limit.retryAfterSeconds },
      rateLimitHeaders(limit, 'search'),
    );
  }

  /**
   * Длинный запрос обрезается, а не отклоняется: 200 символов в поле поиска —
   * это вставка из буфера, а не атака, и человек ждёт результата, а не ошибки.
   */
  const term = (url.searchParams.get('q') ?? '').trim().slice(0, limits.search.maxQueryLength);

  if (term.length < limits.search.minQueryLength) {
    /*
     * Слишком короткий запрос — ошибка клиента, а не пустая выдача. Ответ «ничего
     * не найдено» на один символ выглядел бы как правда о каталоге, и настоящая
     * причина (клиент не дождался минимальной длины) осталась бы незамеченной.
     */
    return errorResponse('query_too_short', 400, { minLength: limits.search.minQueryLength });
  }

  const scope = parseSearchScope(url.searchParams.get('scope') ?? undefined);
  const requested = Number(url.searchParams.get('limit'));
  const maxHits =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, limits.search.maxResults)
      : limits.search.maxResults;

  /**
   * Язык страницы влияет на выдачу только заголовком `Content-Language`: сейчас
   * названия занятий лежат в фикстурах в одном виде. С переходом на базу тот же
   * параметр выберет перевод в `select`, и контракт клиента не изменится —
   * поэтому он принимается и проверяется уже сейчас.
   */
  const rawLocale = url.searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const payload: SearchResponse = {
    term,
    scope,
    hits: searchCatalog(term, scope, maxHits),
  };

  return jsonResponse(payload, 200, {
    'Content-Language': locale,
    'X-RateLimit-Remaining': String(limit.remaining),
  });
}
