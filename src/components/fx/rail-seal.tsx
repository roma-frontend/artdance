'use client';

import { useEffect, useRef } from 'react';

import { motion } from '@/design/motion';
import { registerScrollEffect } from '@/lib/animations/scroll-engine';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';
import { cn } from '@/lib/utils';

interface RailSealProps {
  className?: string;
  text?: string;
}

export function RailSeal({
  className,
  text = 'ARTDANCE · DISCOVER · ALL STYLES · ',
}: RailSealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const lite = useIsLiteMode();

  /**
   * Вращение печати от прокрутки.
   *
   * Раньше угол считал CSS ленты направлений (`StyleRail`): печать стояла
   * внутри барабана и поворачивалась на `--rail-progress`. Лента удалена
   * 21.10.2026 как мёртвый код, и печать осталась статичной — но задумана
   * она вращающейся: это тот же приём, что у печати финального призыва
   * (`ScrollSeal`), и он здесь уместен ровно так же.
   *
   * Угол считается от прохода секции через окно, а не от всей страницы:
   * в середине длинной страницы оборот «на всё» не заметен, а на проходе
   * своей секции печать делает почти полный оборот, пока видна.
   */
  useEffect(() => {
    const node = ref.current;
    if (!node || reduced || lite) return;

    let lastTransform = '';
    let nextTransform = '';

    const unregister = registerScrollEffect({
      element: node,
      read: () => {
        const section = node.closest('section') ?? node;
        const rect = section.getBoundingClientRect();
        const pass = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        const clamped = Math.min(1, Math.max(0, pass));
        nextTransform = `rotate(${(clamped * motion.scrollRotation.degreesPerPass).toFixed(3)}deg)`;
      },
      write: () => {
        if (nextTransform !== lastTransform) {
          lastTransform = nextTransform;
          node.style.transform = nextTransform;
        }
      },
    });

    return () => {
      unregister();
      node.style.transform = '';
    };
  }, [reduced, lite]);

  return (
    <span
      ref={ref}
      data-slot="rail-seal"
      aria-hidden="true"
      className={cn('pointer-events-none select-none inline-block text-content-metal', className)}
    >
      <svg width="88" height="88" viewBox="0 0 100 100" focusable="false" className="size-20">
        <defs>
          <path
            id="rail-seal-circle"
            d="M 50 50 m -36 0 a 36 36 0 1 1 72 0 a 36 36 0 1 1 -72 0"
            fill="none"
          />
        </defs>
        <circle cx="50" cy="50" r="48" className="fill-none stroke-current opacity-25" strokeWidth="1" />
        <circle cx="50" cy="50" r="26" className="fill-none stroke-accent opacity-40" strokeWidth="1" />
        <polygon points="50,38 53,47 62,50 53,53 50,62 47,53 38,50 47,47" className="fill-accent opacity-75" />
        <text className="fill-current text-caption font-semibold uppercase tracking-widest" style={{ letterSpacing: '0.28em' }}>
          <textPath href="#rail-seal-circle">{text}</textPath>
        </text>
      </svg>
    </span>
  );
}
