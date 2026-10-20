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
import { usePathname } from '@/i18n/routing';
import { useEffect, useRef } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

export function LenisProvider() {
  const reducedMotion = usePrefersReducedMotion();
  const lite = useIsLiteMode();
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef<number | null>(null);

  // Админка живёт на общем документе, но ей не нужна вата от Lenis:
  // инерция ломает мгновенный scrollTo и конфликтует с Radix скролл-локом.
  const isAdminRoute = typeof pathname === 'string' && pathname.includes('/admin');
  const disabled = reducedMotion || lite || isAdminRoute;

  useEffect(() => {
    // На админ-маршрутах гарантированно снимаем классы Lenis — даже если
    // предыдущая навигация оставила их на <html>.
    if (isAdminRoute) {
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
      const htmlOverflow = getComputedStyle(document.documentElement).overflowY;
      const bodyLocked = document.body.hasAttribute('data-scroll-locked') || getComputedStyle(document.body).overflowY === 'hidden';
      if (htmlOverflow === 'hidden' || htmlOverflow === 'clip' || bodyLocked) lenis.stop();
      else lenis.start();
    };
    const mo = new MutationObserver(onOverflowCheck);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
    mo.observe(document.body, { attributes: true, attributeFilter: ['style', 'class', 'data-scroll-locked'] });
    // первичная синхронизация (диалог мог быть открыт до монтирования)
    onOverflowCheck();

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      mo.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [disabled, isAdminRoute]);

  return null;
}
