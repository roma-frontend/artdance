import { useCallback, useRef } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { hapticSelection } from './haptics';

/**
 * Щелчок, когда рельс со снапом встаёт на следующую карточку, как у колеса выбора iOS.
 * Шаг — ширина карточки с отступом, тот же, что в `snapToInterval`.
 */
export function useSnapTick(step: number) {
  const index = useRef(0);
  return useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (step <= 0) return;
      const next = Math.round(event.nativeEvent.contentOffset.x / step);
      if (next === index.current) return;
      index.current = next;
      hapticSelection();
    },
    [step],
  );
}
