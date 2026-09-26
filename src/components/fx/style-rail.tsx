'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

/**
 * STYLE RAIL — приколотая секция, чья лента едет вбок при вертикальном скролле.
 *
 * Горизонтальный rail из референсов (pinned section + horizontal rail). На
 * широком экране секция занимает `(1 + track-overflow)` высоты окна: первый
 * экран — сама лента, дальше секция стоит на месте (`position: sticky`), пока
 * прокрутка съедает запас, и лента за это время проезжает свой горизонтальный
 * ход. Вертикальный скролл читается как горизонтальное движение.
 *
 * Три условия, при которых эффекта нет и секция остаётся обычной сеткой:
 *   • экран уже `minViewportWidth` — плитки стоят в две колонки, и прикол
 *     на телефоне ломал бы чтение (у плиток aspect-portrait, лента съехала
 *     бы за экран без способа долистать);
 *   • `prefers-reduced-motion` — движение по скроллу заменяется статикой;
 *   • нет JavaScript — высота-запас не ставится, sticky не включается.
 *
 * 3D-барабан (25.09.2026): плитки стоят по дуге цилиндра, прокрутка вращает
 * его. Плитка напротив зрителя — ровная, крупная и яркая; соседние развёрнуты
 * внутрь, уходят в глубину и темнеют, фото в них смещено навстречу повороту.
 * JS пишет только `--rail-progress` (0…1); позиция каждой плитки на барабане
 * и вся геометрия — в globals.css.
 *
 * Сдвиг пишется в CSS-переменную мимо состояния React: событий скролла
 * десятки в секунду, рендер дерева на каждый не нужен. Счёт считается от
 * собственной прокрутки секции, а не от `scrollY` страницы — вставка секций
 * выше не сдвигает фазу эффекта.
 */

const styleRail = motion.styleRail;

interface StyleRailProps {
  children: ReactNode;
  className?: string;
}

export function StyleRail({ children, className }: StyleRailProps) {
  const ref = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery('(min-width: 1024px)');
  const reduced = usePrefersReducedMotion();
  const enabled = wide && !reduced;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    /* Без эффекта — гарантированно чистое состояние (после смены темы/ширины). */
    if (!enabled) {
      root.style.removeProperty('--rail-progress');
      root.style.removeProperty('--rail-overflow');
      root.removeAttribute('data-rail-ready');
      return;
    }

    let frame = 0;
    let initialized = false;
    let previousTime = 0;
    let current = 0;
    let target = 0;
    const track = root.querySelector<HTMLElement>('[data-rail-track]');
    const list = track?.querySelector<HTMLElement>('ul');
    if (!track || !list) return;

    const read = (time = performance.now()) => {
      frame = 0;

      /*
       * Лента занимает всю ширину окна, а у списка есть симметричные поля,
       * рассчитанные так, чтобы первая/последняя плитка стояла по центру.
       * Поэтому полный горизонтальный ход — scrollWidth списка минус видимое
       * окно. Складка к layout-ширине не относится (она в `translate`/`rotate`),
       * поэтому замер не зависит от её фазы.
       */
      const count = list.children.length;
      /*
       * Запас прокрутки барабана: по `stepViewports` высоты окна на каждый
       * поворот к следующей плитке. От ширины ленты он больше не зависит —
       * плитки стоят на цилиндре, а не едут строкой.
       */
      const overflow = Math.round(Math.max(0, count - 1) * window.innerHeight * styleRail.stepViewports);
      root.style.setProperty('--rail-overflow', `${overflow}px`);

      const rect = root.getBoundingClientRect();
      target = Math.min(overflow, Math.max(0, -rect.top));

      /* Не анимируем первый замер: в том числе корректно восстанавливаем scroll position. */
      if (!initialized) {
        current = target;
        initialized = true;
      } else {
        /* Лёгкая инерция убирает ступеньки wheel/trackpad, не превращая rail в таймер. */
        const elapsed = previousTime ? Math.min(50, time - previousTime) : 16;
        const blend = 1 - Math.exp(-elapsed / 90);
        current += (target - current) * blend;
        if (Math.abs(target - current) < 0.5) current = target;
      }
      previousTime = time;

      const progress = overflow > 0 ? current / overflow : 0;
      root.style.setProperty('--rail-progress', progress.toFixed(5));

      if (current !== target) {
        frame = window.requestAnimationFrame(read);
      }
    };

    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    observer.observe(track);
    observer.observe(list);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
      root.style.removeProperty('--rail-progress');
      root.style.removeProperty('--rail-overflow');
    };
  }, [enabled]);

  return (
    <div
      ref={ref}
      data-slot="style-rail"
      data-rail={enabled ? 'on' : 'off'}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
