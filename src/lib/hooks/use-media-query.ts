/**
 * Подписка на медиа-запрос.
 *
 * Через `useSyncExternalStore`, а не `useEffect` + `setState`: см. подробное
 * обоснование в `use-motion-preferences.ts`. Коротко — `matchMedia` это внешнее
 * состояние, и оно меняется на ходу (поворот устройства, подключение мыши к
 * планшету, системная настройка движения).
 *
 * Серверное значение — `false`: на сервере окна нет, и любой ответ был бы
 * выдумкой. Компоненты обязаны переносить «сначала выключено, после гидратации
 * включено» — а не наоборот, иначе первый кадр показывает то, чего быть не должно.
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () => list.removeEventListener('change', onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * Устройство с точным указателем, умеющим наводиться: мышь или трекпад.
 *
 * `hover: hover` без `pointer: fine` даёт ложное срабатывание на стилусе,
 * `pointer: fine` без `hover` — на устройствах, где курсор есть, но наведения
 * нет. Эффекты наведения имеют смысл только при обоих условиях.
 */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

export function useFinePointer(): boolean {
  return useMediaQuery(FINE_POINTER_QUERY);
}
