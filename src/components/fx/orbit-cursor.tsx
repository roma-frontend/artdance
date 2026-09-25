/**
 * ORBIT CURSOR — премиальный интерактивный курсор (в духе space-portal & Awwwards).
 *
 * Точка мгновенно следует за мышью (точный прицел), а вокруг неё плавно
 * летит орбитальное кольцо со сглаживанием lerp (0.18).
 * Над карточками с атрибутом `data-cursor-label="Explore"` или ссылками
 * кольцо плавно расширяется и проявляет светящуюся текстовую метку.
 *
 * Условия активности:
 *  - только `fine pointer` (мышь / трекпад десктопа)
 *  - отключено при `prefers-reduced-motion`
 *  - не отображается на сенсорных устройствах
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { cursorRing } from '@/design/motion';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function OrbitCursor() {
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const enabled = finePointer && !reducedMotion;

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [activeLabel, setActiveLabel] = useState<string>('');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let targetX = -100;
    let targetY = -100;
    let ringX = -100;
    let ringY = -100;
    let frame = 0;
    let visible = false;

    const tick = () => {
      frame = 0;
      // Lerp follow
      ringX += (targetX - ringX) * cursorRing.follow;
      ringY += (targetY - ringY) * cursorRing.follow;

      dot.style.transform = `translate3d(${targetX}px, ${targetY}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;

      // Подпись рендерится по условию: ref читается на каждом кадре, а не при монтировании.
      const label = labelRef.current;
      if (label) {
        label.style.transform = `translate3d(${ringX}px, ${ringY + 28}px, 0) translate(-50%, 0)`;
      }

      // Кольцо догнало точку — цикл засыпает до следующего движения мыши.
      const dist = Math.abs(targetX - ringX) + Math.abs(targetY - ringY);
      if (dist > 0.05) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(tick);
    };

    const onPointerMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;

      if (!visible) {
        visible = true;
        dot.style.opacity = '1';
        ring.style.opacity = '1';
        if (labelRef.current) labelRef.current.style.opacity = '1';
      }

      // Check context labels on hovered hierarchy
      const target = e.target as HTMLElement | null;
      const labelElement = target?.closest<HTMLElement>('[data-cursor-label]');
      const clickableElement = target?.closest('a, button, [role="button"], input, select');

      if (labelElement) {
        const text = labelElement.getAttribute('data-cursor-label') || '';
        setActiveLabel(text);
        setIsHovered(true);
      } else if (clickableElement) {
        setActiveLabel('');
        setIsHovered(true);
      } else {
        setActiveLabel('');
        setIsHovered(false);
      }

      schedule();
    };

    const onPointerLeave = () => {
      visible = false;
      dot.style.opacity = '0';
      ring.style.opacity = '0';
      if (labelRef.current) labelRef.current.style.opacity = '0';
      setIsHovered(false);
      setActiveLabel('');
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-popover overflow-hidden">
      {/* Central precise dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 size-2 rounded-full bg-accent opacity-0 shadow-[0_0_8px_var(--accent)] transition-opacity duration-150"
      />

      {/* Lagging trailing orbit ring */}
      <div
        ref={ringRef}
        data-hovered={isHovered ? '' : undefined}
        data-has-label={activeLabel ? '' : undefined}
        className="pointer-events-none fixed top-0 left-0 size-9 rounded-full border border-accent/40 bg-accent/5 backdrop-blur-hairline opacity-0 transition-[width,height,background-color,border-color,opacity] duration-300 ease-brand data-[hovered]:size-14 data-[hovered]:border-accent data-[hovered]:bg-accent/15 data-[has-label]:size-20 data-[has-label]:border-accent/80 data-[has-label]:bg-accent/20"
      />

      {/* Floating text label under the ring */}
      {activeLabel && (
        <span
          ref={labelRef}
          className="pointer-events-none fixed top-0 left-0 text-caption font-semibold tracking-wider uppercase text-content-on-cinema bg-surface-cinema/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-border-on-cinema/40 shadow-lg"
        >
          {activeLabel}
        </span>
      )}
    </div>
  );
}
