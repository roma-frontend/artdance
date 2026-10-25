import { useEffect } from 'react';
import { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';

import { tabBarCompact, tabBarHidden } from './tab-bar';

/**
 * Позиция прокрутки на UI-потоке + сжатие таб-бара в капсулу:
 * вниз — бар сужается до активной вкладки, вверх или у самого верха — раскрывается.
 */
export function useScrollChrome() {
  const scrollY = useSharedValue(0);
  const lastY = useSharedValue(0);

  useEffect(
    () => () => {
      tabBarHidden.value = 0;
      tabBarCompact.value = 0;
    },
    [],
  );

  const onScroll = useAnimatedScrollHandler((event) => {
    const y = event.contentOffset.y;
    const dy = y - lastY.value;
    lastY.value = y;
    scrollY.value = y;
    if (y <= 8) tabBarCompact.value = 0;
    else if (dy > 6 && y > 80) tabBarCompact.value = 1;
    else if (dy < -6) tabBarCompact.value = 0;
  });

  return { scrollY, onScroll };
}
