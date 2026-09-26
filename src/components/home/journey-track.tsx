'use client';

/**
 * JOURNEY TRACK (Линия пути в Journey)
 *
 * SVG-траектория с прогрессом отрисовки от скролла секции (strokeDashoffset).
 * На каждом шаге (1..4) при прохождении линии номер шага «загорается»
 * (акцентное свечение, смена цвета, легкая пульсация).
 */

import { useEffect, useRef, useState } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

interface JourneyTrackProps {
  totalSteps?: number;
  className?: string;
}

export function JourneyTrack({ totalSteps = 4, className }: JourneyTrackProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const [activeStep, setActiveStep] = useState<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;

    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      // Находим родительскую секцию Journey
      const section = container.closest('section') || container;
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      // Рассчитываем положение скролла относительно секции
      const topOffset = rect.top;
      const totalScrollable = Math.max(1, rect.height - viewportHeight * 0.4);
      const scrolled = -topOffset + viewportHeight * 0.3;
      const progress = Math.min(1, Math.max(0, scrolled / totalScrollable));

      // Рисуем линию со скроллом непрерывно (0% -> 100%)
      const linePercent = Math.min(100, Math.max(0, progress * 100));
      if (activeLineRef.current) {
        activeLineRef.current.style.height = `${linePercent}%`;
      }

      // Пороги активации для 4 карточек: шаг 0 активен всегда при входе в секцию
      const stepIndex = Math.min(totalSteps - 1, Math.floor(progress * totalSteps));
      setActiveStep(stepIndex);

      // Раздаём атрибуты на карточки стопки
      const cards = section.querySelectorAll<HTMLElement>('[data-journey-step]');
      cards.forEach((card, idx) => {
        if (idx <= stepIndex) {
          card.setAttribute('data-step-active', 'true');
        } else {
          card.removeAttribute('data-step-active');
        }
      });
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [reducedMotion, totalSteps]);

  if (reducedMotion) return null;

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
          className="absolute left-1/2 top-0 w-0.5 -translate-x-1/2 bg-gradient-to-b from-accent via-accent to-accent-hover shadow-[0_0_12px_var(--accent-glow)] transition-all duration-75"
          style={{ height: '0%' }}
        />

        {/* Контрольные круглые точки этапов с ярким неоновым свечением */}
        {Array.from({ length: totalSteps }).map((_, idx) => {
          const topPercent = (idx / (totalSteps - 1)) * 100;
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
