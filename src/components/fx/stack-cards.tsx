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

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { readStackCover, writeStackCover } from '@/lib/animations/stack';
import { registerScrollEffect } from '@/lib/animations/scroll-engine';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

interface StackCardsProps {
  /** Элементы `<li>`: ступень прилипания каждому раздаёт CSS по `--stack-index`. */
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

export function StackCards({ children, className, ...rest }: StackCardsProps) {
  const ref = useRef<HTMLOListElement>(null);
  const reduced = usePrefersReducedMotion();
  const lite = useIsLiteMode();

  useEffect(() => {
    const root = ref.current;
    if (!root || reduced || lite) return;
    const items = Array.from(root.children) as HTMLElement[];
    items.forEach((item, index) => item.style.setProperty('--stack-index', String(index)));

    // Разделяем фазы всей страницы, а не только карточек внутри этой стопки.
    let covers: string[] = [];
    const unregister = registerScrollEffect({
      element: root,
      read: () => { covers = readStackCover(items, motion.stackCards.stepPx); },
      write: () => writeStackCover(items, covers),
    });

    return () => {
      unregister();
      items.forEach((item) => item.style.removeProperty('--stack-cover'));
    };
  }, [reduced, lite]);

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
