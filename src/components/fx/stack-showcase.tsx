'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function StackShowcase({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 768px)');
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root || !wide || reduced) return;
    const panels = Array.from(root.children) as HTMLElement[];
    const measure = () => {
      for (const panel of panels) {
        const top = Number.parseFloat(getComputedStyle(root).scrollMarginTop) || 0;
        panel.toggleAttribute('data-stack-ready', panel.offsetHeight + top < window.innerHeight);
      }
    };
    const focus = () => root.setAttribute('data-stack-focus', '');
    const blur = (event: FocusEvent) => {
      if (!root.contains(event.relatedTarget as Node | null)) root.removeAttribute('data-stack-focus');
    };
    const observer = new ResizeObserver(measure);
    panels.forEach((panel) => observer.observe(panel));
    window.addEventListener('resize', measure);
    root.addEventListener('focusin', focus);
    root.addEventListener('focusout', blur);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('focusout', blur);
      root.removeAttribute('data-stack-focus');
      panels.forEach((panel) => panel.removeAttribute('data-stack-ready'));
    };
  }, [wide, reduced]);

  return <div ref={ref} data-stack-showcase="">{children}</div>;
}
