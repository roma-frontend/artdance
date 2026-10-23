import { useEffect } from 'react';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { tabBarHidden } from './tab-bar';

/**
 * Позиция прокрутки на UI-потоке + автопрятание таб-бара:
 * вниз — бар уезжает, вверх или у самого верха — возвращается (как в Instagram и X).
 */
export function useScrollChrome() {
  const scrollY = useSharedValue(0);
  const lastY = useSharedValue(0);

  useEffect(
    () => () => {
      tabBarHidden.value = 0;
    },
    [],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const dy = y - lastY.value;
    lastY.value = y;
    scrollY.value = y;
    if (y <= 8) tabBarHidden.value = 0;
    else if (dy > 6) tabBarHidden.value = 1;
    else if (dy < -6) tabBarHidden.value = 0;
  });

  return { scrollY, onScroll };
}
