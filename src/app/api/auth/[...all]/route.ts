/**
 * /api/auth/* — эндпоинты Better Auth.
 *
 * Один catch-all вместо десятка маршрутов: вход, выход, регистрация, сброс
 * пароля, OAuth-обмен и обновление сессии живут внутри библиотеки. Наш код здесь
 * только отдаёт ей запрос — любая логика в этом файле означала бы, что часть
 * аутентификации выполняется до её проверок.
 *
 * **Проверка `Origin` уже сделана.** `proxy.ts` отклоняет мутирующие запросы с
 * чужим origin до попадания сюда (`originExemptPathPrefixes` содержит только
 * webhooks), а Better Auth сверяет origin со своим `trustedOrigins` ещё раз.
 * Двойная проверка здесь уместна: цена — сравнение строк, а цена ошибки —
 * чужая сессия.
 *
 * **Кеширования нет.** `next.config.ts` ставит `no-store` всему `/api`, и это
 * ровно то, что нужно: ответ содержит состояние сессии конкретного человека.
 */

import { toNextJsHandler } from 'better-auth/next-js';

import { clientEnv } from '@/config/env';
import { auth } from '@/lib/auth/auth';
import { isBearerRequest } from '@/lib/auth/bearer';

export const runtime = 'nodejs';

const handlers = toNextJsHandler(auth.handler);

/**
 * Нативное приложение (Expo) ходит с `Authorization: Bearer`, а `Origin` у него
 * либо отсутствует, либо `exp://...` / адрес Metro. Плагин bearer внутри библиотеки
 * превращает токен в cookie, и проверка origin для мутирующих вызовов (смена имени,
 * пароля, выход) отвечает 403.
 *
 * Для bearer-запроса подставляем origin приложения (он уже в `trustedOrigins`).
 * CSRF здесь не грозит: браузер не добавляет `Authorization` к cross-site запросу.
 * Запросы без Bearer (веб с cookie) не меняются.
 */
async function withBearerOrigin(request: Request): Promise<Request> {
  if (!isBearerRequest(request)) return request;

  const headers = new Headers(request.headers);
  headers.set('origin', new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin);
  // Тело читаем заранее: клон запроса с потоковым телом в Node требует `duplex`.
  const body = await request.arrayBuffer();
  return new Request(request.url, { method: request.method, headers, body });
}

export const GET = handlers.GET;

export async function POST(request: Request): Promise<Response> {
  return handlers.POST(await withBearerOrigin(request));
}
