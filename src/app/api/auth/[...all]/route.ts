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
 * Нативное приложение (Expo) шлёт POST без `Origin`, а Better Auth отклоняет такой
 * запрос, если в нём есть cookie. Шаг кода 2FA идёт именно с challenge-cookie.
 * Bearer-запросы с `exp://` Origin тоже переписываем: их Origin не в `trustedOrigins`.
 *
 * Подставляем origin приложения (он уже в `trustedOrigins`). Браузер всегда шлёт
 * `Origin` на POST, поэтому POST без него не может быть CSRF из браузера.
 */
async function withNativeOrigin(request: Request): Promise<Request> {
  if (request.headers.get('origin') && !isBearerRequest(request)) return request;

  const headers = new Headers(request.headers);
  headers.set('origin', new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin);
  // Тело читаем заранее: клон запроса с потоковым телом в Node требует `duplex`.
  const body = await request.arrayBuffer();
  return new Request(request.url, { method: request.method, headers, body });
}

export const GET = handlers.GET;

export async function POST(request: Request): Promise<Response> {
  return handlers.POST(await withNativeOrigin(request));
}
