'use client';

import { useCallback, useSyncExternalStore, type RefObject } from 'react';

export function useMegaMenuTop(open: boolean, navRef: RefObject<HTMLElement | null>): number | null {
  const measure = useCallback(() => {
    if (!open || !navRef.current) return null;
    const anchor = navRef.current.closest('header') ?? navRef.current;
    return Math.round(anchor.getBoundingClientRect().bottom);
  }, [open, navRef]);

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!open || !navRef.current) return () => {};
    const anchor = navRef.current.closest('header') ?? navRef.current;
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        onStoreChange();
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    anchor.addEventListener('transitionend', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      anchor.removeEventListener('transitionend', update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [open, navRef]);

  return useSyncExternalStore(subscribe, measure, () => null);
}