import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { API_URL } from './config';

/** Снимок тумблеров модулей с сервера (`/api/entitlements`). */
export type Entitlements = Record<string, boolean>;

const STORE_KEY = 'artdance.entitlements';

let cached: Entitlements | null = null;
let fetched = false;
let pending: Promise<Entitlements> | null = null;
const listeners = new Set<(data: Entitlements) => void>();

async function readPersistedEntitlements(): Promise<Entitlements | null> {
  const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(STORE_KEY) : await SecureStore.getItemAsync(STORE_KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Entitlements;
  } catch {
    return null;
  }
}

function persistEntitlements(data: Entitlements): void {
  const raw = JSON.stringify(data);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(STORE_KEY, raw);
  else SecureStore.setItemAsync(STORE_KEY, raw).catch(() => undefined);
}

/**
 * Один запрос на сессию. Сбой сети отдаёт последний сохранённый снимок, а без него — «выключено».
 */
export function loadEntitlements(): Promise<Entitlements> {
  if (cached && fetched) return Promise.resolve(cached);
  pending ??= fetch(`${API_URL}/api/entitlements`)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<Entitlements>;
    })
    .then((data) => {
      cached = data;
      fetched = true;
      persistEntitlements(data);
      return data;
    })
    .catch(() => cached ?? {})
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
    const listener = (data: Entitlements) => alive && setState(data);
    listeners.add(listener);
    readPersistedEntitlements().then((data) => {
      if (alive && data && !cached) {
        cached = data;
        setState(data);
      }
    });
    loadEntitlements().then((data) => alive && setState(data));
    return () => {
      alive = false;
      listeners.delete(listener);
    };
  }, []);
  return state;
}

/** Сбрасывает кэш и рассылает свежий снимок всем подписанным экранам. */
export function refreshEntitlements(): void {
  cached = null;
  loadEntitlements().then((data) => listeners.forEach((listener) => listener(data)));
}
