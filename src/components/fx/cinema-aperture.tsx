'use client';

/**
 * CINEMA APERTURE — кино-секции раскрываются «экраном» при входе в окно.
 *
 * Компонент только считает `--aperture-open` (0…1), `--aperture-flare` и
 * `--aperture-exit` (уход сцены вверх, 0…1) каждой панели по её положению в окне;
 * у панели может быть своя «сцена» (`data-scene`), которая читает те же числа; вся живопись — маска экрана, отъезд кадра,
 * лучи, блик, фокус и разворот карточек — в `globals.css` (`[data-aperture]`).
 * Ничего не прилипает и не держит прокрутку: панели идут обычным потоком.
 *
 * Без JS, на узком экране и при `prefers-reduced-motion` атрибута `on` нет —
 * секции стоят как есть. Фокус внутри панели раскрывает её целиком (CSS).
 */

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { apertureExit, apertureFlare, apertureOpen } from '@/lib/animations/aperture';
import { registerScrollEffect } from '@/lib/animations/scroll-engine';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

const config = motion.cinemaAperture;

export function CinemaAperture({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery(`(min-width: ${config.minViewportWidth}px)`);
  const reduced = usePrefersReducedMotion();
  const lite = useIsLiteMode();

  useEffect(() => {
    const root = ref.current;
    if (!root || !wide || reduced || lite) return;
    const panels = Array.from(root.children) as HTMLElement[];

    const setProp = (el: HTMLElement, name: string, value: string) => {
      if (el.style.getPropertyValue(name) !== value) {
        el.style.setProperty(name, value);
      }
    };

    root.setAttribute('data-aperture', 'on');

    // Видимость каждой сцены независима: длинный общий root не будит все панели.
    const unsubscribers = panels.map((panel) => {
      let open = '1';
      let flare = '0';
      let exit = '0';
      return registerScrollEffect({
        element: panel,
        read: () => {
          const viewport = window.innerHeight;
          const rect = panel.getBoundingClientRect();
          const value = apertureOpen(rect.top, viewport, config.openSpan);
          open = value.toFixed(3);
          flare = apertureFlare(value).toFixed(3);
          exit = apertureExit(rect.bottom, viewport).toFixed(3);
        },
        write: () => {
          setProp(panel, '--aperture-open', open);
          setProp(panel, '--aperture-flare', flare);
          setProp(panel, '--aperture-exit', exit);
        },
      });
    });

    return () => {
      for (const unsubscribe of unsubscribers) unsubscribe();
      root.setAttribute('data-aperture', 'off');
      for (const panel of panels) {
        panel.style.removeProperty('--aperture-open');
        panel.style.removeProperty('--aperture-flare');
        panel.style.removeProperty('--aperture-exit');
      }
    };
  }, [wide, reduced, lite]);

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
