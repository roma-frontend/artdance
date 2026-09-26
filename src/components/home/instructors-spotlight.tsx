'use client';

/**
 * INSTRUCTORS SPOTLIGHT (Прожектор над секцией инструкторов)
 *
 * Создаёт драматичный сценический луч света, следующий за курсором мыши над всей
 * сеткой инструкторов.
 * Внутри светового пятна (луча) карточки и фото полноцветные, контрастные и со свечением.
 * Вне луча прожектора накладывается стилизованный монохромный фильтр (grayscale).
 */

import { useEffect, useRef } from 'react';

import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

interface InstructorsSpotlightProps {
  className?: string;
}

export function InstructorsSpotlight({ className }: InstructorsSpotlightProps) {
  const spotlightRef = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const spotlight = spotlightRef.current;
    if (!spotlight || !finePointer || reducedMotion) return;

    const parent = spotlight.parentElement;
    if (!parent) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let isHovered = false;
    let rafId = 0;

    const lerp = (start: number, end: number, factor: number) =>
      start + (end - start) * factor;

    const updatePosition = () => {
      currentX = lerp(currentX, targetX, 0.15);
      currentY = lerp(currentY, targetY, 0.15);

      parent.style.setProperty('--spotlight-x', `${currentX}px`);
      parent.style.setProperty('--spotlight-y', `${currentY}px`);

      if (Math.abs(targetX - currentX) > 0.1 || Math.abs(targetY - currentY) > 0.1) {
        rafId = requestAnimationFrame(updatePosition);
      } else {
        rafId = 0;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;

      if (!isHovered) {
        isHovered = true;
        parent.setAttribute('data-spotlight-active', 'true');
      }

      if (!rafId) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    const handlePointerLeave = () => {
      isHovered = false;
      parent.removeAttribute('data-spotlight-active');
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    parent.addEventListener('pointermove', handlePointerMove, { passive: true });
    parent.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      parent.removeEventListener('pointermove', handlePointerMove);
      parent.removeEventListener('pointerleave', handlePointerLeave);
      if (rafId) cancelAnimationFrame(rafId);
      parent.removeAttribute('data-spotlight-active');
      parent.style.removeProperty('--spotlight-x');
      parent.style.removeProperty('--spotlight-y');
    };
  }, [finePointer, reducedMotion]);

  if (!finePointer || reducedMotion) return null;

  return (
    <div
      ref={spotlightRef}
      aria-hidden="true"
      data-slot="instructors-spotlight"
      className={cn('instructors-spotlight-layer pointer-events-none absolute inset-0 z-0 overflow-hidden', className)}
    >
      {/* Сценический конус света */}
      <div className="instructors-spotlight-cone" />
      {/* Мягкое акцентное свечение в точке луча */}
      <div className="instructors-spotlight-beam" />
    </div>
  );
}
