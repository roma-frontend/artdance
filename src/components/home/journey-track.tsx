'use client';

/**
 * JOURNEY TRACK (Линия пути в Journey)
 *
 * Декоративная линия с прогрессом от скролла секции (scaleY, без изменения layout).
 * На каждом шаге (1..4) при прохождении линии номер шага «загорается»
 * (акцентное свечение, смена цвета, легкая пульсация).
 */

import { useEffect, useRef, useState } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { registerScrollEffect } from '@/lib/animations/scroll-engine';
import { useIsLiteMode } from '@/lib/perf/lite-mode';
import { cn } from '@/lib/utils';

interface JourneyTrackProps {
  totalSteps?: number;
  className?: string;
}

export function JourneyTrack({ totalSteps = 4, className }: JourneyTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const lite = useIsLiteMode();
  const wide = useMediaQuery('(min-width: 1280px)');

  const [activeStep, setActiveStep] = useState<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion || lite || !wide) return;

    let lastStep = -1;
    let lastScale = '';
    let nextScale = '';
    let nextStep = 0;
    const section = container.closest('section') || container;
    const cards = section.querySelectorAll<HTMLElement>('[data-journey-step]');

    const read = () => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      const topOffset = rect.top;
      const totalScrollable = Math.max(1, rect.height - viewportHeight * 0.4);
      const scrolled = -topOffset + viewportHeight * 0.3;
      const progress = Math.min(1, Math.max(0, scrolled / totalScrollable));
      nextStep = Math.max(0, Math.min(totalSteps - 1, Math.floor(progress * totalSteps)));
      nextScale = `scaleY(${progress.toFixed(4)})`;
    };

    const write = () => {
      if (activeLineRef.current && nextScale !== lastScale) {
        lastScale = nextScale;
        activeLineRef.current.style.transform = nextScale;
      }

      // setState и DOM-атрибуты только при смене шага — избегаем лишних рендеров
      if (nextStep !== lastStep) {
        lastStep = nextStep;
        setActiveStep(nextStep);
        cards.forEach((card, idx) => {
          if (idx <= nextStep) {
            card.setAttribute('data-step-active', 'true');
          } else {
            card.removeAttribute('data-step-active');
          }
        });
      }
    };

    const unregister = registerScrollEffect({ element: section, read, write });

    return () => {
      unregister();
      cards.forEach((card) => card.removeAttribute('data-step-active'));
    };
  }, [reducedMotion, lite, wide, totalSteps]);

  if (reducedMotion || lite) return null;

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      data-slot="journey-track"
      className={cn(
        'journey-track-container pointer-events-none absolute -left-12 top-24 bottom-24 hidden w-8 xl:block',
        className,
      )}
    >
      <div className="relative size-full">
        {/* Базовая пунктирная линия по центру */}
        <div className="absolute left-1/2 top-0 bottom-0 w-0 -translate-x-1/2 border-l-2 border-dashed border-border-default opacity-40" />

        {/* Активная оживающая линия со скроллом */}
        <div
          ref={activeLineRef}
          data-journey-progress=""
          className="absolute left-1/2 top-0 h-full w-0.5 origin-top -translate-x-1/2 bg-gradient-to-b from-accent via-accent to-accent-hover shadow-[0_0_12px_var(--accent-glow)]"
          style={{ transform: 'scaleY(0)' }}
        />

        {/* Контрольные круглые точки этапов с ярким неоновым свечением */}
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const topPercent = totalSteps > 1 ? (idx / (totalSteps - 1)) * 100 : 0;
          const isActive = idx <= activeStep;
          return (
            <div
              key={idx}
              className={cn(
                'absolute left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all duration-300',
                isActive
                  ? 'border-accent bg-accent shadow-[0_0_16px_var(--accent),0_0_30px_var(--accent-glow)] scale-110 opacity-100 ring-2 ring-accent/40'
                  : 'border-border-default bg-surface-card scale-90 opacity-40',
              )}
              style={{ top: `${topPercent}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
