/**
 * Значение с задержкой.
 *
 * Нужен там, где на каждый символ ввода следует работа: запрос к `/api/search`,
 * пересчёт фильтров, проверка промокода. Задержка берётся из
 * `limits.search.debounceMs`, а не пишется числом у места вызова: «поиск
 * дёргается» — это правка одной строки конфигурации.
 *
 * Возвращается предыдущее значение, пока пауза не истекла, поэтому поле ввода
 * остаётся отзывчивым (оно управляется своим состоянием), а тяжёлая работа
 * запускается один раз после того, как человек закончил печатать.
 */

'use client';

import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    /*
     * Значение всегда обновляется в колбэке таймера, даже при нулевой задержке:
     * синхронный `setState` в теле эффекта — лишний рендер и нарушение правила
     * `react-hooks/set-state-in-effect`. Ноль означает «на следующем тике», что
     * визуально мгновенно.
     */
    const id = window.setTimeout(() => setDebounced(value), Math.max(0, delayMs));
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
