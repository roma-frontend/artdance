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

import { auth } from '@/lib/auth/auth';

export const runtime = 'nodejs';

export const { GET, POST } = toNextJsHandler(auth.handler);
