/**
 * ЧИСТКА КОРЗИНЫ ПО РАСПИСАНИЮ.
 *
 * Без этой задачи корзина растёт вечно, и «удалено» перестаёт что-либо значить: в
 * ней окажется весь когда-либо созданный контент, вместе со всеми файлами в
 * хранилище, за которые платят по объёму.
 *
 * **Эндпоинт защищён секретом, а не ролью.** Вызывает его планировщик, а не
 * человек: сессии у него нет. Сравнение секрета — постоянное по времени
 * (`timingSafeEqual`): обычное `===` на строках даёт разное время для разных
 * префиксов, а секрет из заголовка можно подбирать сколько угодно.
 *
 * **Без секрета в окружении эндпоинт закрыт.** Не «открыт для удобства разработки»:
 * забытая переменная на проде означала бы, что стереть контент платформы может
 * любой, кто знает адрес. Локально секрет задаётся в `.env.local` одной строкой.
 *
 * Задача идемпотентна и работает порциями (`trash.purgeBatchSize`): повторный
 * вызов ничего не ломает, а первый запуск после долгого простоя не превращается в
 * одну транзакцию на десять тысяч записей.
 */

import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { getServerEnv } from '@/config/env';
import { purgeExpiredTrash } from '@/server/admin/trash';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function noStore(body: object, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Сравнение секретов постоянным временем. Разная длина — сразу мимо. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Секрет из запроса.
 *
 * `Authorization: Bearer …` — как отправляет Vercel Cron; `x-cron-secret` — для
 * планировщиков, которые не умеют менять заголовок авторизации.
 */
function providedSecret(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);

  return request.headers.get('x-cron-secret');
}

export async function POST(request: Request): Promise<NextResponse> {
  const expected = getServerEnv().CRON_SECRET;

  if (!expected) return noStore({ error: 'CRON_DISABLED' }, 503);

  const provided = providedSecret(request);

  if (!provided || !secretMatches(provided, expected)) {
    return noStore({ error: 'UNAUTHORIZED' }, 401);
  }

  const report = await purgeExpiredTrash(new Date());

  return noStore({
    status: 'ok',
    purged: report.purged,
    total: report.total,
    filesRemoved: report.filesRemoved,
  });
}

/**
 * `GET` отвечает тем же, потому что часть планировщиков умеет только его.
 * Операция идемпотентна, поэтому это не нарушение семантики метода: повторный
 * вызов удаляет ровно то, что и так подлежало удалению.
 */
export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}
