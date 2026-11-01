import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

/**
 * Ошибка ответа веб-API. `serverMessage` — текст из словаря приложения, если сервер прислал
 * `messageKey`; иначе `null`, и экран показывает свой общий текст.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Запрос к веб-API с сессией из `expo-secure-store` (Bearer). Пустой ответ (204) даёт `undefined`.
 * Личность сервер берёт из токена, поэтому идентификаторы пользователя сюда не передаются.
 */
export async function apiRequest<T = unknown>(path: string, init: { method?: Method; body?: unknown } = {}): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new ApiError('UNAUTHORIZED', 401);

  const hasBody = init.body !== undefined;
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });

  if (!response.ok) {
    const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
    throw new ApiError(`HTTP ${response.status}`, response.status, serverMessage);
  }
  return (await response.json().catch(() => undefined)) as T;
}
