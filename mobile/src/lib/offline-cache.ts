import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PREFIX = 'artdance.cache.';
const USER_INDEX_KEY = 'artdance.cache.user_index';
const isWeb = Platform.OS === 'web';

export type CacheScope = 'public' | 'user';

async function read(key: string): Promise<string | null> {
  if (isWeb) return globalThis.localStorage?.getItem(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function write(key: string, value: string | null): Promise<void> {
  if (isWeb) {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

// Чтение и запись идут по очереди, чтобы не потерять ключ из индекса пользовательских данных.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

async function readUserIndex(): Promise<string[]> {
  const raw = await read(USER_INDEX_KEY).catch(() => null);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function readCache<T>(key: string): Promise<T | null> {
  return serial(async () => {
    const raw = await read(PREFIX + key).catch(() => null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  });
}

export function writeCache(key: string, value: unknown, scope: CacheScope): Promise<void> {
  return serial(async () => {
    await write(PREFIX + key, JSON.stringify(value)).catch(() => undefined);
    if (scope !== 'user') return;
    const index = await readUserIndex();
    if (index.includes(key)) return;
    await write(USER_INDEX_KEY, JSON.stringify([...index, key])).catch(() => undefined);
  });
}

/** Удаляет данные клиента при выходе, чтобы следующий пользователь их не увидел. */
export function clearUserCache(): Promise<void> {
  return serial(async () => {
    const index = await readUserIndex();
    await Promise.all(index.map((key) => write(PREFIX + key, null).catch(() => undefined)));
    await write(USER_INDEX_KEY, null).catch(() => undefined);
  });
}
