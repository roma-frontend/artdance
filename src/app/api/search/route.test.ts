/**
 * Контракт `/api/search`.
 *
 * Проверяется то, на что полагается клиент и чего не видно ни в типах, ни в
 * сборке: коды ошибок, обрезка слишком длинного запроса, отбрасывание мусора в
 * параметре раздела, запрет кеширования и заголовки лимита частоты. Ошибка в
 * любом из этих мест выглядит как «поиск иногда не работает».
 *
 * Тесты обращаются к обработчику напрямую, без поднятия сервера: маршрут — это
 * функция от `Request`, и проверять её через сеть значит проверять ещё и Next.
 */

import { describe, expect, it } from 'vitest';

import { GET } from './route';
import { limits, rateLimits } from '@/config/business';
import { cacheControl } from '@/config/cache';
import type { SearchResponse } from '@/domain/search';

/**
 * Каждый запрос идёт с собственного адреса.
 *
 * Лимит частоты (`rateLimits.search`) считается по идентификатору клиента, и без
 * этого тесты начали бы влиять друг на друга: сотый вызов в наборе получал бы 429
 * из-за девяноста девяти предыдущих.
 */
let requestCounter = 0;

function call(query: string): Promise<Response> {
  requestCounter += 1;
  return GET(
    new Request(`https://artdance.test/api/search${query}`, {
      headers: { 'x-forwarded-for': `203.0.113.${requestCounter % 250}` },
    }),
  );
}

async function payloadOf(response: Response): Promise<SearchResponse> {
  return (await response.json()) as SearchResponse;
}

describe('GET /api/search — успешный ответ', () => {
  it('возвращает находки, запрос и раздел', async () => {
    const response = await call('?q=salsa');
    expect(response.status).toBe(200);

    const payload = await payloadOf(response);
    expect(payload.term).toBe('salsa');
    expect(payload.scope).toBe('all');
    expect(payload.hits.length).toBeGreaterThan(0);
  });

  it('возвращает запрос обратно, чтобы клиент отбросил устаревший ответ', async () => {
    /* При быстром вводе ответы приходят не в том порядке, в котором ушли. */
    const payload = await payloadOf(await call('?q=%D1%81%D0%B0%D0%BB%D1%8C%D1%81%D0%B0'));
    expect(payload.term).toBe('сальса');
  });

  it('ограничивает выдачу параметром limit', async () => {
    const payload = await payloadOf(await call('?q=dance&limit=2'));
    expect(payload.hits).toHaveLength(2);
  });

  it('не даёт запросить больше, чем разрешено настройками', async () => {
    const payload = await payloadOf(await call('?q=dance&limit=100000'));
    expect(payload.hits.length).toBeLessThanOrEqual(limits.search.maxResults);
  });

  it('сужает выдачу до указанного раздела', async () => {
    const payload = await payloadOf(await call('?q=dance&scope=instructors'));
    expect(payload.scope).toBe('instructors');
    for (const hit of payload.hits) {
      expect(hit.scope).toBe('instructors');
    }
  });

  it('неизвестный раздел трактуется как «везде», а не как ошибка', async () => {
    /* Мусор в адресной строке не должен ломать поиск — как и в фильтрах каталога. */
    const payload = await payloadOf(await call('?q=dance&scope=DROP%20TABLE'));
    expect(payload.scope).toBe('all');
  });

  it('обрезает слишком длинный запрос вместо отказа', async () => {
    const long = 'a'.repeat(limits.search.maxQueryLength + 50);
    const payload = await payloadOf(await call(`?q=${long}`));
    expect(payload.term).toHaveLength(limits.search.maxQueryLength);
  });

  it('никогда не кешируется', async () => {
    const response = await call('?q=salsa');
    expect(response.headers.get('Cache-Control')).toBe(cacheControl.none);
  });

  it('объявляет язык тела ответа', async () => {
    const response = await call('?q=salsa&locale=ru');
    expect(response.headers.get('Content-Language')).toBe('ru');
  });

  it('подменяет неизвестную локаль на язык по умолчанию', async () => {
    const response = await call('?q=salsa&locale=xx');
    expect(response.headers.get('Content-Language')).toBe('hy');
  });
});

describe('GET /api/search — отказы', () => {
  it('слишком короткий запрос — ошибка клиента с машинным кодом', async () => {
    const response = await call('?q=s');
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string; minLength: number };
    expect(body.error).toBe('query_too_short');
    expect(body.minLength).toBe(limits.search.minQueryLength);
  });

  it('отсутствующий запрос обрабатывается так же, а не падением', async () => {
    const response = await call('');
    expect(response.status).toBe(400);
  });

  it('пробелы запросом не считаются', async () => {
    const response = await call('?q=%20%20%20');
    expect(response.status).toBe(400);
  });

  it('превышение частоты отвечает 429 и говорит, когда повторить', async () => {
    const identifier = { 'x-forwarded-for': '198.51.100.7' };
    let limited: Response | undefined;

    /*
     * Лимит бьётся с одного адреса подряд: он считается по идентификатору
     * клиента, и превысить его нужно именно с одного — иначе тест проверял бы,
     * что лимитер не работает.
     *
     * Попыток втрое больше самого лимита, а не «плюс одна». Окно живёт
     * `windowSeconds` от первого запроса, и под полной параллельной нагрузкой цикл
     * успевает пересечь его границу — счётчик начинается заново, 429 не приходит,
     * тест мигает. Такое падение уже случалось при прогоне всего набора.
     */
    for (let index = 0; index < rateLimits.search.requests * 3; index += 1) {
      const response = await GET(
        new Request('https://artdance.test/api/search?q=salsa', { headers: identifier }),
      );
      if (response.status === 429) {
        limited = response;
        break;
      }
    }

    expect(limited).toBeDefined();
    expect(limited!.headers.get('Retry-After')).toBeTruthy();
    expect(limited!.headers.get('X-RateLimit-Limit')).toBe(String(rateLimits.search.requests));

    const body = (await limited!.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
  });
});
