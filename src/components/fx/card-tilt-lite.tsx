'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

interface CardTiltLiteProps {
  children: ReactNode;
  className?: string;
}

/**
 * Лёгкая замена CardTilt без framer-motion для LCP/TBT.
 * Сохраняет тот же data-slot/data-cursor-depth API, но tilt делает чистым CSS+rAF.
 */
export function CardTilt({ children, className }: CardTiltLiteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const enabled = fine && !reduced;

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      // -0.5 … 0.5
      targetX = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
      targetY = Math.max(-0.5, Math.min(0.5, (e.clientY - rect.top) / rect.height - 0.5));
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const tick = () => {
      raf = 0;
      // lerp 0.18 ~ прежний cursorRing.follow
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      node.style.setProperty('--card-cursor-x', `${(currentX + 0.5) * node.offsetWidth}px`);
      node.style.setProperty('--card-cursor-y', `${(currentY + 0.5) * node.offsetHeight}px`);
      node.style.setProperty('--card-media-x', `${currentX * -14}px`);
      node.style.setProperty('--card-media-y', `${currentY * -14}px`);
      // лёгкий 3D tilt без framer-motion
      const rx = -currentY * 9;
      const ry = currentX * 9;
      const tx = currentX * 8;
      const ty = currentY * 8;
      node.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(${tx}px, ${ty}px, 0)`;
      if (Math.abs(targetX - currentX) > 0.001 || Math.abs(targetY - currentY) > 0.001) {
        raf = requestAnimationFrame(tick);
      }
    };

    node.addEventListener('pointermove', onMove as EventListener, { passive: true } as AddEventListenerOptions);
    node.addEventListener('pointerleave', onLeave as EventListener);
    return () => {
      node.removeEventListener('pointermove', onMove as EventListener);
      node.removeEventListener('pointerleave', onLeave as EventListener);
      if (raf) cancelAnimationFrame(raf);
      node.style.transform = '';
      node.style.removeProperty('--card-cursor-x');
      node.style.removeProperty('--card-cursor-y');
      node.style.removeProperty('--card-media-x');
      node.style.removeProperty('--card-media-y');
    };
  }, [enabled]);

  return (
    <div
      ref={ref}
      data-slot="card-tilt"
      data-animation-card=""
      data-cursor-depth={enabled ? '' : undefined}
      className={cn('relative h-full', className)}
    >
      {children}
    </div>
  );
}
