/**
 * POINTER GLOW — мягкое акцентное свечение, следующее за курсором.
 *
 * Условия существования, а не просто скрытия:
 *   • только `(hover: hover) and (pointer: fine)` — на телефоне курсора нет, и
 *     элемент не должен даже попадать в DOM;
 *   • не при `prefers-reduced-motion: reduce` — движущееся за взглядом пятно
 *     первым мешает тем, кто просил убрать движение.
 *
 * До гидратации компонент возвращает `null`, поэтому в статическом HTML пятна
 * нет: на телефоне оно не появится вообще, а на десктопе возникнет после
 * гидратации. `useSyncExternalStore` внутри хуков делает такой переход законным —
 * серверный снимок объявлен, и React не считает его рассинхроном разметки.
 *
 * Позиция обновляется мимо состояния React: движение мыши генерирует десятки
 * событий в секунду, и рендер дерева на каждое из них не оправдан ничем.
 */

'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils';
import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function PointerGlow() {
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const enabled = finePointer && !reducedMotion;

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    };

    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      node.style.opacity = '1';
      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };

    /** Курсор ушёл за пределы окна — пятно гаснет, а не замирает в углу. */
    const onLeave = () => {
      node.style.opacity = '0';
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="pointer-glow"
      className={cn(
        'pointer-events-none fixed top-0 left-0 z-sticky rounded-full opacity-0',
        'size-(--pointer-glow-size)',
        'transition-opacity duration-(--pointer-glow-fade) ease-standard',
      )}
      style={{
        /** `accent-soft` — тот же акцент под 8%, что и в макете. */
        background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
      }}
    />
  );
}
