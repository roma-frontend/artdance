import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type FavoriteKind = 'class' | 'instructor' | 'venue' | 'product';

export type FavoriteItem = {
  kind: FavoriteKind;
  slug: string;
  title: string;
};

export class FavoritesError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<FavoritesError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new FavoritesError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Избранное текущего клиента. Личность определяет сервер по bearer-токену. */
export async function listMyFavorites(): Promise<FavoriteItem[]> {
  const token = await getSessionToken();
  if (!token) throw new FavoritesError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/favorites`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { items: FavoriteItem[] };
  return body.items;
}

/** Переключает избранное на сервере. Возвращает итоговое состояние: `true` — сохранено. */
export async function toggleMyFavorite(kind: FavoriteKind, slug: string): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) throw new FavoritesError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/favorites`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ target: kind, slug }),
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json().catch(() => ({}))) as { isFavorite?: boolean };
  if (typeof body.isFavorite !== 'boolean') {
    throw new FavoritesError(`HTTP ${response.status}`, response.status);
  }
  return body.isFavorite;
}
