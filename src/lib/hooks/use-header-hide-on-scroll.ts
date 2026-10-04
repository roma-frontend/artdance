'use client';

import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Preserve the current shape while hiding; morph only on reveal or at the top. */
export function useHeaderHideOnScroll(
  ref: RefObject<HTMLElement | null>,
  paused = false,
  islandEnabled = false,
  resetKey = '',
): { hidden: boolean; island: boolean } {
  const [state, setState] = useState({ hidden: false, island: false });

  // При клиентской навигации сохраняем компактность, если на новой странице
  // уже прокручено (scroll-restoration). Иначе "остров" сбрасывается в full
  // и появляется только после первого скролла — эффект "после перезагрузки нормализуется".
  useLayoutEffect(() => {
    const y = Math.max(0, window.scrollY);
    const shouldBeIsland = y > 120 && islandEnabled;
    const nextHidden = false;
    const nextIsland = shouldBeIsland;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронный апдейт при смене маршрута
    setState((previous) =>
      previous.hidden === nextHidden && previous.island === nextIsland
        ? previous
        : { hidden: nextHidden, island: nextIsland },
    );
  }, [resetKey, islandEnabled]);

  useEffect(() => {
    let frame = 0;
    // Синхронизируем lastY с текущим scrollY после возможного ресета выше
    let lastY = Math.max(0, window.scrollY);
    let down = 0;
    let up = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px)');

    const read = () => {
      frame = 0;
      const y = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
      const delta = y - lastY;
      lastY = y;
      if (y <= 18 || !desktop.matches || reducedMotion.matches) {
        down = up = 0;
        setState(previous => previous.hidden || previous.island ? { hidden: false, island: false } : previous);
      } else if (paused || ref.current?.contains(document.activeElement) || document.body.style.overflow === 'hidden') {
        down = up = 0;
        setState(previous => previous.hidden ? { ...previous, hidden: false } : previous);
      } else if (delta >= 1) {
        up = 0;
        down += delta;
        if (y > 120 && down > 40) {
          setState(previous => previous.hidden ? previous : { ...previous, hidden: true });
          down = 0;
        }
      } else if (delta <= -1) {
        down = 0;
        up -= delta;
        if (up > 16) {
          setState(previous => !previous.hidden && previous.island === islandEnabled
            ? previous : { hidden: false, island: islandEnabled });
          up = 0;
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reducedMotion.removeEventListener('change', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ref, paused, islandEnabled, resetKey]);

  return state;
}
