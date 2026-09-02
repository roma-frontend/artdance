/**
 * SCROLL PROGRESS — полоса прочитанного в верхней кромке окна.
 *
 * Отличия от прототипа, где полоса создаётся через `document.createElement` с
 * инлайновыми стилями и пересчитывается на каждое событие прокрутки:
 *
 * • ширина меняется через `transform: scaleX()`, а не `width`. Анимация ширины
 *   вызывает layout на каждом кадре, `transform` — только композитинг;
 * • чтение геометрии отложено в `requestAnimationFrame`: обработчик прокрутки,
 *   читающий `scrollHeight` синхронно, заставляет браузер пересчитывать layout
 *   посреди прокрутки;
 * • на короткой странице полоса скрыта. Индикатор, который не может дойти до
 *   конца, дезинформирует;
 * • `aria-hidden`: это декоративное отражение позиции прокрутки, а не индикатор
 *   выполнения задачи. `role="progressbar"` заставил бы скринридер зачитывать
 *   бессмысленные проценты при каждом движении.
 *
 * Обновление идёт мимо состояния React: 60 рендеров в секунду ради одного
 * `scaleX` не нужны никому.
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
        'pointer-events-none fixed inset-x-0 top-0 z-scroll-progress origin-left',
        'h-(--scroll-progress-height)',
        'bg-gradient-to-r from-accent to-metal',
        'transition-[transform,opacity] duration-(--scroll-progress-transition) ease-linear',
      )}
      /*
       * Начальное состояние задано тем же свойством, которым его меняет JS.
       * Через утилиту `scale-x-0` не получится: в Tailwind v4 она пишет в
       * отдельное CSS-свойство `scale`, а не в `transform`, — и полоса на каждой
       * загрузке страницы успевала мигнуть на всю ширину, прежде чем `transform`
       * из скрипта доезжал до нуля. Двух источников для одной величины быть не
       * должно даже когда оба «работают».
       */
      style={{ transform: 'scaleX(0)' }}
    />
  );
}
