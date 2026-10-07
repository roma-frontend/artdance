/**
 * SCROLL PROGRESS — полоса прочитанного вдоль нижней кромки компактного header.
 *
 * Как в Desktop/office (landing/Navbar.tsx):
 * • внешний декоративный слой — `absolute inset-0 overflow-hidden [border-radius:inherit]`
 *   клипает полосу по скруглению острова на ПОЛНОЙ высоте карточки (не узкой
 *   2px-полосой — иначе браузер схлопывает углы к 1px и старт выглядит прямым);
 *   только этот слоисто-clipped слой — dropdown-ы Locale/Lite остаются visible;
 * • внутренняя полка `scroll-progress-inner` — `inset-x-0 bottom-0 h-2/3px` с
 *   margin-inline как у page-container;
 * • сам бар — `rounded-full` (pill), чтобы ведущий и ведомый край были скруглены
 *   даже до достижения угла острова; scaleX(progress) — compositing, rAF, hidden на короткой странице.
 */

'use client';

import { useEffect, useRef } from 'react';

import { motion } from '@/design/motion';
import { cn } from '@/lib/utils';

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;

    const read = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const shortPage =
        document.documentElement.scrollHeight <
        window.innerHeight * motion.scrollProgress.minPageHeightFactor;

      node.style.opacity = shortPage ? '0' : '1';
      if (scrollable <= 0) {
        node.style.transform = 'scaleX(0)';
        return;
      }

      /** Ограничение снизу и сверху: инерционная прокрутка даёт значения вне [0,1]. */
      const progress = Math.min(1, Math.max(0, window.scrollY / scrollable));
      node.style.transform = `scaleX(${progress})`;
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    /** Высота страницы меняется от подгрузки изображений и раскрытия блоков. */
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      data-slot="scroll-progress"
      className={cn(
        'pointer-events-none absolute inset-0 origin-left will-change-transform',
        'bg-gradient-to-r from-accent to-metal',
        'transition-[transform,opacity] duration-(--scroll-progress-transition) ease-linear',
        'rounded-full',
      )}
      /*
       * Начальное состояние задано тем же свойством, которым его меняет JS.
       * Через утилиту `scale-x-0` не получится: в Tailwind v4 она пишет в
       * отдельное CSS-свойство `scale`, а не в `transform`, — и полоса на каждой
       * загрузке страницы успевала мигнуть на всю ширину, прежде чем `transform`
       * из скрипта доезжал до нуля.
       * rounded-full — pill-скругление ведущего/ведомого края; полный clip
       * у родителя (inset-0) дополнительно подгоняет нижние углы к острову.
       */
      style={{ transform: 'scaleX(0)' }}
    />
  );
}