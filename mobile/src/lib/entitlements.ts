import { useEffect, useState } from 'react';

import { API_URL } from './config';

/** Снимок тумблеров модулей с сервера (`/api/entitlements`). */
export type Entitlements = Record<string, boolean>;

let cached: Entitlements | null = null;
let pending: Promise<Entitlements> | null = null;

/**
 * Один запрос на сессию. Сбой сети считаем «выключено»: раздел не показываем,
 * пока сервер не подтвердил, что он включён.
 */
export function loadEntitlements(): Promise<Entitlements> {
  if (cached) return Promise.resolve(cached);
  pending ??= fetch(`${API_URL}/api/entitlements`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<Entitlements>;
    })
    .then((data) => {
      cached = data;
      return data;
    })
    .catch(() => ({}))
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** `null`, пока снимок не загружен. */
export function useEntitlements(): Entitlements | null {
  const [state, setState] = useState<Entitlements | null>(cached);
  useEffect(() => {
    let alive = true;
    loadEntitlements().then((data) => alive && setState(data));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
