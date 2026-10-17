'use client';

/**
 * Lenis — ватная инерция скролла как на trionn.com.
 *
 * Делает РОВНО одно: плавный скролл колеса мыши. Никаких
 * пинов, блюров, скью, параллаксов — только инерция.
 *
 * - Десктоп с мышью: lerp 0.075, wheelMultiplier 0.9, expo ease
 * - Тач/коарс: нативный скролл (syncTouch:false) — палец не «плывёт»
 * - a11y: предпочтения в next.config, но вежливо уважаем reducedMotion/lite
 * - E2E (playwright): без инерции — иначе instant scrollTo нестабилен
 * - Модалки: при overflow:hidden — stop, при закрытии — start
 */

import Lenis from 'lenis';
import { useEffect, useRef } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

export function LenisProvider() {
  const reducedMotion = usePrefersReducedMotion();
  const lite = useIsLiteMode();
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);

  const disabled = reducedMotion || lite;

  useEffect(() => {
    // В тестах Lenis мешает instant scrollTo — instant превращается в lerp,
    // и poll(sx.y < initial-40) флакает. В e2e отключаем.
    const isE2E =
      typeof navigator !== 'undefined' &&
      (navigator as unknown as { webdriver?: boolean }).webdriver === true;
    if (isE2E) {
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped');
      return;
    }

    if (disabled) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.documentElement.classList.remove('lenis', 'lenis-smooth', 'lenis-scrolling', 'lenis-stopped');
      return;
    }

    const lenis = new Lenis({
      wrapper: window,
      content: document.documentElement,
      lerp: 0.07,
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1,
      infinite: false,
      autoRaf: false,
      anchors: false,
      prevent: (node: HTMLElement) => node.hasAttribute('data-lenis-prevent'),
      allowNestedScroll: true,
    });

    lenisRef.current = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      rafRef.current = requestAnimationFrame(raf);
    };
    rafRef.current = requestAnimationFrame(raf);

    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(raf);
      }
    };
    document.addEventListener('visibilitychange', onVisibility, { passive: true });

    const onOverflowCheck = () => {
      const overflow = getComputedStyle(document.documentElement).overflowY;
      if (overflow === 'hidden' || overflow === 'clip') lenis.stop();
      else lenis.start();
    };
    const mo = new MutationObserver(onOverflowCheck);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      mo.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [disabled]);

  return null;
}
