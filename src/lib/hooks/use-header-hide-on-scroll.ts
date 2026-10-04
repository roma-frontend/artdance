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
    // next-intl делает scroll-to-top на новой странице асинхронно в том же тике —
    // если читать window.scrollY синхронно, он ещё старый (например 400) и island
    // успевает закоммититься на один кадр, а потом сбрасывается вторым ререндером.
    // Поэтому читаем на следующий кадр + ищем BFCache/restoration tick.
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const y = Math.max(0, window.scrollY);
      const locked =
        document.body.style.overflow === 'hidden' ||
        document.documentElement.contains(document.activeElement) === false;
      void locked;
      const shouldBeIsland = y > 18 && y > 8 && islandEnabled;
      // на главной: island только если действительно прокручено; иначе full до скролла
      // на остальных страницах: heroBehind=false, но island всё равно по y (см. SiteHeader solid=island||!heroBehind)
      let nextHidden = false;
      let nextIsland = shouldBeIsland;
      // на вершине страницы island всегда выключен — иначе compact появляется на 0px
      if (y <= 18) {
        nextHidden = false;
        nextIsland = false;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронный апдейт при смене маршрута
      setState((previous) =>
        previous.hidden === nextHidden && previous.island === nextIsland
          ? previous
          : { hidden: nextHidden, island: nextIsland },
      );
    };
    // два rAF — дожидаемся scroll-restoration от next-intl/next
    let id1 = requestAnimationFrame(() => {
      id1 = requestAnimationFrame(apply);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id1);
    };
  }, [resetKey, islandEnabled]);

  useEffect(() => {
    let frame = 0;
    // после навигации scrollY может асинхронно сброситься в 0 — синхронизируем на след. кадре
    let lastY = Math.max(0, window.scrollY);
    queueMicrotask(() => {
      lastY = Math.max(0, window.scrollY);
    });
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
