/**
 * Прокручена ли страница ниже порога.
 *
 * Реализовано через `useSyncExternalStore`, как и `use-motion-preferences`:
 * положение скролла — внешнее состояние браузера, и `setState` в эффекте здесь
 * запрещён правилом линтера (`react-hooks/set-state-in-effect`).
 *
 * Две детали, из-за которых это не однострочник:
 *
 * 1. Подписка отдаёт `onStoreChange` только при СМЕНЕ логического значения, а не
 *    на каждое событие скролла. Иначе React получал бы десятки уведомлений в
 *    секунду ради одного и того же `true`.
 * 2. Чтение `scrollY` отложено в `requestAnimationFrame`: обработчик скролла,
 *    читающий геометрию синхронно, вызывает layout thrashing.
 *
 * Серверное значение — `false`: до гидратации мы считаем страницу непрокрученной.
 * Если пользователь перезагрузил её в середине, `useSyncExternalStore` сам
 * применит верное значение сразу после гидратации, без предупреждения о
 * несовпадении разметки.
 */

'use client';

import { useCallback, useSyncExternalStore } from 'react';

export function useScrolledPast(thresholdPx: number): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      let current = window.scrollY > thresholdPx;
      let frame = 0;

      const read = () => {
        frame = 0;
        const next = window.scrollY > thresholdPx;
        if (next === current) return;
        current = next;
        onStoreChange();
      };

      const schedule = () => {
        if (frame !== 0) return;
        frame = window.requestAnimationFrame(read);
      };

      window.addEventListener('scroll', schedule, { passive: true });
      /** Смена ориентации меняет высоту страницы, а с ней и положение скролла. */
      window.addEventListener('resize', schedule, { passive: true });

      return () => {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
        if (frame !== 0) window.cancelAnimationFrame(frame);
      };
    },
    [thresholdPx],
  );

  const getSnapshot = useCallback(() => window.scrollY > thresholdPx, [thresholdPx]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
