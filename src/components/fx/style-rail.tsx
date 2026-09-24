'use client';

import { useEffect, useRef, type ReactNode } from 'react';

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
 * Сдвиг пишется в CSS-переменную мимо состояния React: событий скролла
 * десятки в секунду, рендер дерева на каждый не нужен. Счёт считается от
 * собственной прокрутки секции, а не от `scrollY` страницы — вставка секций
 * выше не сдвигает фазу эффекта.
 */

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
    let currentProgress = 0;
    let targetProgress = 0;
    const track = root.querySelector<HTMLElement>('[data-rail-track]');
    const list = track?.querySelector<HTMLElement>('ul');
    if (!track || !list) return;

    const read = (time = performance.now()) => {
      frame = 0;

      /*
       * Лента занимает всю ширину окна, а у списка есть симметричные поля,
       * рассчитанные так, чтобы первая/последняя плитка стояла по центру.
       * Поэтому полный горизонтальный ход — scrollWidth списка минус видимое
       * окно. Именно этот ход задаёт и запас pinned-прокрутки.
       */
      const overflow = Math.max(0, list.scrollWidth - track.clientWidth);
      root.style.setProperty('--rail-overflow', `${overflow}px`);

      const rect = root.getBoundingClientRect();
      const viewport = window.innerHeight;
      const travel = rect.height - viewport;
      targetProgress = travel > 0 ? Math.min(1, Math.max(0, -rect.top / travel)) : 0;

      /* Не анимируем первый замер: в том числе корректно восстанавливаем scroll position. */
      if (!initialized) {
        currentProgress = targetProgress;
        initialized = true;
      } else {
        /* Лёгкая инерция убирает ступеньки wheel/trackpad, не превращая rail в таймер. */
        const elapsed = previousTime ? Math.min(50, time - previousTime) : 16;
        const blend = 1 - Math.exp(-elapsed / 75);
        currentProgress += (targetProgress - currentProgress) * blend;
        if (Math.abs(targetProgress - currentProgress) < 0.0005) {
          currentProgress = targetProgress;
        }
      }
      previousTime = time;
      root.style.setProperty('--rail-progress', currentProgress.toFixed(5));

      if (currentProgress !== targetProgress) {
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
