'use client';

import { useMotionValue } from 'framer-motion';
import { useEffect, type RefObject } from 'react';

import { cursorOffset, lerp } from '@/lib/animations/cursor-tracking';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function useCursorFollow(ref: RefObject<HTMLElement | null>, selector?: string) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = fine && !reduced;

  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let target: HTMLElement | null = null;
    let original = '';
    let point: { x: number; y: number } | null = null;
    let frame = 0;
    let previous = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      point = null;
      x.set(0);
      y.set(0);
      if (target && selector) target.style.transform = original;
      target?.removeAttribute('data-tilting');
      target = null;
    };
    const paint = (time: number) => {
      frame = 0;
      if (!target || !point) return;
      const rect = target.getBoundingClientRect();
      const dx = cursorOffset(point.x, rect.left, rect.width);
      const dy = cursorOffset(point.y, rect.top, rect.height);
      const elapsed = previous ? time - previous : 1000 / 60;
      previous = time;
      x.set(lerp(x.get(), dx, elapsed));
      y.set(lerp(y.get(), dy, elapsed));
      if (selector) target.style.transform = `translate3d(${x.get() * 12}px, ${y.get() * 12}px, 0) ${original}`;
      if (x.get() !== dx || y.get() !== dy) frame = requestAnimationFrame(paint);
      else previous = 0;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const next = selector
        ? (event.target instanceof Element ? event.target.closest<HTMLElement>(selector) : null)
        : root;
      if (!next || !root.contains(next) || next.matches(':focus-visible') || next.querySelector(':focus-visible')) {
        reset();
        return;
      }
      if (next !== target) {
        reset();
        target = next;
        original = next.style.transform;
        next.setAttribute('data-tilting', '');
      }
      point = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', reset);
    root.addEventListener('pointercancel', reset);
    root.addEventListener('focusin', reset);
    window.addEventListener('blur', reset);
    window.addEventListener('scroll', reset, { passive: true });
    return () => {
      reset();
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', reset);
      root.removeEventListener('pointercancel', reset);
      root.removeEventListener('focusin', reset);
      window.removeEventListener('blur', reset);
      window.removeEventListener('scroll', reset);
    };
  }, [enabled, ref, selector, x, y]);

  return { x, y, enabled };
}
