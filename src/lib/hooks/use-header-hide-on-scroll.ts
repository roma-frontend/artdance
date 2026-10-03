'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Умное скрытие шапки при скролле вниз, возврат при скролле вверх.
 *
 * Пауза: когда `paused` (открыто мега-меню), шапка не прячется — меню не
 * должно уезжать из-под курсора. Это единственная причина читать внешний флаг.
 */
export function useHeaderHideOnScroll(ref?: React.RefObject<HTMLElement | null>, paused = false): boolean {
  void ref;
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(false);
    }
  }, [paused]);

  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        if (pausedRef.current) return;
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (y < 80) setHidden(false);
        else if (delta > 8) setHidden(true);
        else if (delta < -8) setHidden(false);
        lastY.current = y;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return hidden;
}
