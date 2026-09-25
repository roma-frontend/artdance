/**
 * STACK CARDS — «наезжающие» карточки: каждая следующая при прокрутке
 * прилипает чуть ниже предыдущей и накрывает её, а накрытая уходит вглубь —
 * уменьшается и темнеет.
 *
 * Сама стопка — чистый CSS (`position: sticky` со ступенью `--stack-index`), и
 * без JS она работает: карточки накрывают друг друга, только без ухода вглубь.
 * Компонент добавляет одно число на карточку — `--stack-cover`, долю накрытия,
 * из которой CSS строит `scale` и затемнение. Число пишется в стиль мимо
 * состояния React: событий прокрутки десятки в секунду.
 *
 * При `prefers-reduced-motion` стопки нет вовсе — обычный список (см.
 * `[data-stack-cards]` в `globals.css`), и компонент ничего не считает.
 */

'use client';

import { useScroll } from 'framer-motion';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { paintStackCover } from '@/lib/animations/stack';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

interface StackCardsProps {
  /** Элементы `<li>`: ступень прилипания каждому раздаёт CSS по `--stack-index`. */
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function StackCards({ children, className, ...rest }: StackCardsProps) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollY } = useScroll();

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced) return;
    const items = Array.from(root.children) as HTMLElement[];
    items.forEach((item, index) => item.style.setProperty('--stack-index', String(index)));

    let frame = 0;
    const paint = () => {
      frame = 0;
      paintStackCover(items, motion.stackCards.stepPx);
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };

    paint();
    const unsubscribe = scrollY.on('change', schedule);
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      unsubscribe();
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      items.forEach((item) => item.style.removeProperty('--stack-cover'));
    };
  }, [reduced, scrollY]);

  return (
    <ol
      ref={ref}
      data-stack-cards=""
      className={cn('grid gap-8', className)}
      style={
        {
          '--stack-step': `${motion.stackCards.stepPx}px`,
          '--stack-scale-depth': motion.stackCards.scaleDepth,
          '--stack-dim-depth': motion.stackCards.dimDepth,
        } as CSSProperties
      }
      {...rest}
    >
      {children}
    </ol>
  );
}
