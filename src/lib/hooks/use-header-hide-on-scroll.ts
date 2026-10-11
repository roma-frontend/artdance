'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Preserve the current shape while hiding; morph only on reveal or at the top. */
export function useHeaderHideOnScroll(
  ref: RefObject<HTMLElement | null>,
  paused = false,
  islandEnabled = false,
  resetKey = '',
  deferInitialIsland = false,
): { hidden: boolean; island: boolean } {
  const [state, setState] = useState({ hidden: false, island: false });
  // цель islands при смене маршрута — её видит второй эффект до ресета хука
  const targetIslandRef = useRef(false);
  const initialIslandDeferredRef = useRef(deferInitialIsland);

  // Навигация: сразу целимся в остров если вкладка уже прокручена — иначе
  // следующий эффект стартует с lastY=0 и не может выставить island до первого скролла
  useLayoutEffect(() => {
    const y = Math.max(0, window.scrollY);
    const nextIsland = y > 18 && islandEnabled && !initialIslandDeferredRef.current;
    targetIslandRef.current = nextIsland;
    const nextHidden = false;
    setState((previous) =>
      previous.hidden === nextHidden && previous.island === nextIsland
        ? previous
        : { hidden: nextHidden, island: nextIsland },
    );
  }, [resetKey, islandEnabled]);

  useEffect(() => {
    let frame = 0;
    let lastY = Math.max(0, window.scrollY);
    let down = 0;
    let up = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 1024px)');

    // Вернуть island после всплытия из следующей навигации: next-intl scrollTo(0) идёт
    // после коммита, поэтому первый read после ресета видит y=0 и сбрасывает island.
    // Если scrollY уже 0 и цель была островом — держим island до реального скролла.
    let pendingRestoreIsland = targetIslandRef.current && Math.max(0, window.scrollY) <= 18;

    const read = () => {
      frame = 0;
      const y = Math.max(0, Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight));
      const delta = y - lastY;
      lastY = y;

      /*
       * A page can be scrolled before hydration finishes (browser restoration,
       * Playwright, or a fast touch gesture). Do not turn a cinema hero into an
       * island from that initial snapshot; the next real scroll owns the mode.
       */
      if (initialIslandDeferredRef.current) {
        initialIslandDeferredRef.current = false;
        down = up = 0;
        return;
      }

      // Ожидаем реальную прокрутку после программного сброса в 0
      if (pendingRestoreIsland) {
        if (y <= 18) return;
        pendingRestoreIsland = false;
      }

      if (y <= 18 || !desktop.matches || reducedMotion.matches) {
        down = up = 0;
        pendingRestoreIsland = false;
        setState(previous => previous.hidden || previous.island ? { hidden: false, island: false } : previous);
      } else if (
        paused ||
        (() => {
          const active = document.activeElement as HTMLElement | null;
          if (!active || !ref.current?.contains(active)) return false;
          // Клик мышью оставляет :focus на кнопке, но :focus-visible — нет.
          // Блокируем скрытие только при клавиатурном фокусе или в полях ввода,
          // иначе смена темы (клик по тоглу) навсегда «залипает» header до blur/перезагрузки.
          if (active.matches(':focus-visible')) return true;
          const tag = active.tagName;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable) return true;
          return false;
        })() ||
        document.body.style.overflow === 'hidden'
      ) {
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
      } else if (targetIslandRef.current && !paused) {
        // нет дельты, но цель — остров (сохранён с прошлой страницы): догоняем без ожидания up>16
        setState(previous => previous.island ? previous : { hidden: false, island: islandEnabled });
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
