/**
 * Контракт `/api/availability`.
 *
 * Проверяется то, на что полагается клиент и чего не видно ни в типах, ни в
 * сборке: коды ошибок, различие «инструктора нет» и «времени нет», предел
 * количества, запрет кеширования и заголовки лимита частоты.
 *
 * Запрет кеширования здесь не формальность: закешированная доступность означает
 * предложение занятого времени, то есть двойную бронь.
 *
 * Обработчик вызывается напрямую, без поднятия сервера: маршрут — это функция от
 * `Request`, и проверять её через сеть значит проверять ещё и Next.
 */

import { describe, expect, it } from 'vitest';

import { GET, type AvailabilityResponse } from './route';
import { limits, rateLimits } from '@/config/business';
import { cacheControl } from '@/config/cache';
import { demoInstructors } from '../../../../prisma/fixtures/demo';

/**
 * Каждый запрос идёт с собственного адреса: лимит частоты считается по
 * идентификатору клиента, и без этого тесты влияли бы друг на друга.
 */
let requestCounter = 0;

function call(query: string): Promise<Response> {
  requestCounter += 1;
  return GET(
    new Request(`https://artdance.test/api/availability${query}`, {
      headers: { 'x-forwarded-for': `198.51.100.${requestCounter % 250}` },
    }),
  );
}

async function payloadOf(response: Response): Promise<AvailabilityResponse> {
  return (await response.json()) as AvailabilityResponse;
}

const knownSlug = demoInstructors[0]!.slug;

describe('GET /api/availability — успешный ответ', () => {
  it('возвращает ближайшие свободные времена', async () => {
    const response = await call(`?instructor=${knownSlug}`);
    expect(response.status).toBe(200);

    const payload = await payloadOf(response);
    expect(payload.instructorSlug).toBe(knownSlug);
    expect(payload.slots.length).toBeGreaterThan(0);
  });

  it('времена отдаются моментом в ISO: формат даты выбирает локаль клиента', async () => {
    const payload = await payloadOf(await call(`?instructor=${knownSlug}`));

    for (const slot of payload.slots) {
      expect(new Date(slot.startIso).toISOString()).toBe(slot.startIso);
      expect(slot.startTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(slot.endTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });

  it('времена идут по возрастанию: «ближайшее» обязано быть первым', async () => {
    const payload = await payloadOf(await call(`?instructor=${knownSlug}&count=3`));
    const moments = payload.slots.map((slot) => new Date(slot.startIso).getTime());

    expect([...moments].sort((a, b) => a - b)).toEqual(moments);
  });

  it('все времена в будущем: прошлое не альтернатива', async () => {
    const payload = await payloadOf(await call(`?instructor=${knownSlug}`));

    for (const slot of payload.slots) {
      expect(new Date(slot.startIso).getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('по умолчанию отдаёт не больше предела из бизнес-правил', async () => {
    const payload = await payloadOf(await call(`?instructor=${knownSlug}`));

    expect(payload.slots.length).toBeLessThanOrEqual(limits.alternativeSlots);
  });

  it('количество ограничивается сверху, а не берётся из запроса', async () => {
    const payload = await payloadOf(await call(`?instructor=${knownSlug}&count=10000`));

    expect(payload.slots.length).toBeLessThanOrEqual(limits.alternativeSlots);
  });

  it('меньшее количество уважается', async () => {
    const payload = await payloadOf(await call(`?instructor=${knownSlug}&count=1`));

    expect(payload.slots).toHaveLength(1);
  });

  it('мусор в count не ломает ответ', async () => {
    const response = await call(`?instructor=${knownSlug}&count=abc`);

    expect(response.status).toBe(200);
    expect((await payloadOf(response)).slots.length).toBeGreaterThan(0);
  });
});

describe('GET /api/availability — отказы', () => {
  it('без параметра инструктора — 400 с машинным кодом', async () => {
    const response = await call('');
    expect(response.status).toBe(400);

    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('instructor_required');
  });

  it('неизвестный инструктор — 404, а не пустой список', async () => {
    const response = await call('?instructor=нет-такого');
    expect(response.status).toBe(404);

    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('not_found');
  });

  it('превышение частоты отвечает 429 и говорит, когда повторить', async () => {
    /* Один и тот же адрес: лимит считается по идентификатору клиента. */
    const headers = { 'x-forwarded-for': '198.51.100.254' };
    const request = () =>
      GET(new Request(`https://artdance.test/api/availability?instructor=${knownSlug}`, { headers }));

    /*
     * Попыток заметно больше, чем сам лимит, и это не перестраховка. Окно
     * начинается с первого запроса и живёт `windowSeconds`; если набор тестов
     * идёт под полной параллельной нагрузкой, цикл может пересечь границу окна, и
     * счётчик начнётся заново. Ровно `limit + 1` попытка делала бы тест
     * мигающим — он падал бы в CI и проходил локально.
     */
    const attempts = rateLimits.availability.requests * 3;

    let limited: Response | null = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = await request();
      if (response.status === 429) {
        limited = response;
        break;
      }
    }

    expect(limited, 'лимит обязан срабатывать').not.toBeNull();

    const body = (await limited!.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toBe('rate_limited');
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(limited!.headers.get('Retry-After')).not.toBeNull();
  });
});

describe('GET /api/availability — заголовки', () => {
  it('ответ никогда не кешируется: устаревшая доступность — двойная бронь', async () => {
    const response = await call(`?instructor=${knownSlug}`);

    expect(response.headers.get('Cache-Control')).toBe(cacheControl.none);
  });

  it('ошибка тоже не кешируется', async () => {
    const response = await call('');

    expect(response.headers.get('Cache-Control')).toBe(cacheControl.none);
  });

  it('тип содержимого не угадывается браузером', async () => {
    const response = await call(`?instructor=${knownSlug}`);

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
