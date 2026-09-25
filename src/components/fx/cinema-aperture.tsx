'use client';

/**
 * CINEMA APERTURE — кино-секции раскрываются «экраном» при входе в окно.
 *
 * Компонент только считает `--aperture-open` (0…1) и `--aperture-flare` каждой
 * панели по её положению в окне; вся живопись — маска экрана, отъезд кадра,
 * лучи, блик, фокус и разворот карточек — в `globals.css` (`[data-aperture]`).
 * Ничего не прилипает и не держит прокрутку: панели идут обычным потоком.
 *
 * Без JS, на узком экране и при `prefers-reduced-motion` атрибута `on` нет —
 * секции стоят как есть. Фокус внутри панели раскрывает её целиком (CSS).
 */

import { useScroll } from 'framer-motion';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { apertureFlare, apertureOpen } from '@/lib/animations/aperture';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

const config = motion.cinemaAperture;

export function CinemaAperture({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery(`(min-width: ${config.minViewportWidth}px)`);
  const reduced = usePrefersReducedMotion();
  const { scrollY } = useScroll();

  useEffect(() => {
    const root = ref.current;
    if (!root || !wide || reduced) return;
    const panels = Array.from(root.children) as HTMLElement[];

    let frame = 0;
    const paint = () => {
      frame = 0;
      const viewport = window.innerHeight;
      for (const panel of panels) {
        const open = apertureOpen(panel.getBoundingClientRect().top, viewport, config.openSpan);
        panel.style.setProperty('--aperture-open', open.toFixed(3));
        panel.style.setProperty('--aperture-flare', apertureFlare(open).toFixed(3));
      }
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };

    root.setAttribute('data-aperture', 'on');
    paint();
    const unsubscribe = scrollY.on('change', schedule);
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      unsubscribe();
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      root.setAttribute('data-aperture', 'off');
      for (const panel of panels) {
        panel.style.removeProperty('--aperture-open');
        panel.style.removeProperty('--aperture-flare');
      }
    };
  }, [wide, reduced, scrollY]);

  return (
    <div
      ref={ref}
      data-aperture="off"
      style={
        {
          '--aperture-inset-x': `${config.insetXPercent}%`,
          '--aperture-inset-y': `${config.insetYPercent}%`,
          '--aperture-radius': `${config.radiusPx}px`,
          '--aperture-zoom': config.backgroundZoom,
          '--aperture-blur': `${config.blurPx}px`,
          '--aperture-tilt': `${config.stageTiltDeg}deg`,
          '--aperture-rise': `${config.stageRisePx}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
