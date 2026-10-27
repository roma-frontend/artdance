import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { readCache, writeCache, type CacheScope } from './offline-cache';

type Entry<T> = { key: string; value: T };

/**
 * Состояние данных: на старте показывает последнее сохранённое значение,
 * а свежий ответ сервера заменяет его, когда придёт.
 */
export function useCachedState<T>(key: string, scope: CacheScope): [T | null, Dispatch<SetStateAction<T | null>>] {
  const [entry, setEntry] = useState<Entry<T> | null>(null);
  const value = entry?.key === key ? entry.value : null;

  useEffect(() => {
    let alive = true;
    readCache<T>(key).then((cached) => {
      if (!alive || cached === null) return;
      setEntry((prev) => (prev?.key === key ? prev : { key, value: cached }));
    });
    return () => {
      alive = false;
    };
  }, [key]);

  useEffect(() => {
    if (value !== null) void writeCache(key, value, scope);
  }, [key, scope, value]);

  const setValue = useCallback<Dispatch<SetStateAction<T | null>>>(
    (action) => {
      setEntry((prev) => {
        const current = prev?.key === key ? prev.value : null;
        const next = typeof action === 'function' ? (action as (p: T | null) => T | null)(current) : action;
        return next === null ? null : { key, value: next };
      });
    },
    [key],
  );

  return [value, setValue];
}
