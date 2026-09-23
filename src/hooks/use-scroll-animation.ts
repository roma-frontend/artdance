'use client';

import { useInView, useMotionValue, useScroll, useTransform } from 'framer-motion';
import { useEffect, type RefObject } from 'react';

import { scrollRotation } from '@/lib/animations/parallax';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function useScrollAnimation(ref: RefObject<HTMLElement | null>) {
  const reducedMotion = usePrefersReducedMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const nearby = useInView(ref, { margin: '200px 0px' });
  const enabled = wide && !reducedMotion && nearby;
  const { scrollY } = useScroll();
  const progress = useMotionValue(0.5);
  const rotate = useTransform(progress, scrollRotation);

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;
    let top = 0;
    let height = 0;
    const update = (position: number) => {
      progress.set((window.innerHeight + position - top) / (window.innerHeight + height));
    };
    const measure = () => {
      top = node.getBoundingClientRect().top + window.scrollY;
      height = node.offsetHeight;
      update(window.scrollY);
    };
    measure();
    const unsubscribe = scrollY.on('change', update);
    window.addEventListener('resize', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      unsubscribe();
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, progress, ref, scrollY]);

  return { progress, rotate, enabled, reducedMotion };
}
