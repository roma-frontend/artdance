/**
 * SECTION PARALLAX — расслоение секции-заявления при проходе через экран.
 *
 * Перенос эффекта из макета (обработчик `--- EDITORIAL PARALLAX ---`) один в
 * один, включая то, что в нём главное: слоёв ТРИ, и у каждого своя скорость.
 * Кадр проходит 200px, блок содержимого 60px, заголовок 40px и попутно меняет
 * масштаб. Если оставить только фон — а именно так и выглядит «параллакс,
 * сделанный на глаз» — эффекта не будет: глубину создаёт разница скоростей, а
 * не движение само по себе.
 *
 * Ход отсчитывается от положения секции в окне, а не от `scrollY`: иначе эффект
 * зависел бы от того, сколько секций стоит выше, и любая вставка выше по
 * странице его бы сдвигала. В середине прохода смещение нулевое.
 *
 * Роли назначаются атрибутом `data-parallax`, а не селекторами по классам:
 * разметка секции живёт в серверном компоненте, и переименование класса не
 * должно молча ломать анимацию.
 *
 * Отключается на узких экранах (`sectionParallax.minViewportWidth`) и при
 * `prefers-reduced-motion`: там он не читается как глубина, но стоит кадров.
 */

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { cn } from '@/lib/utils';

/** Слои секции. Значение атрибута `data-parallax`. */
export type SectionParallaxRole = 'background' | 'content' | 'heading';

interface SectionParallaxProps {
  children: ReactNode;
  className?: string;
}

export function SectionParallax({ children, className }: SectionParallaxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const wideEnough = useMediaQuery(`(min-width: ${motion.sectionParallax.minViewportWidth}px)`);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion || !wideEnough) return;

    const {
      backgroundTravelPx,
      backgroundZoom,
      contentTravelPx,
      headingTravelPx,
      headingScaleRange,
    } = motion.sectionParallax;

    const pick = (role: SectionParallaxRole) =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-parallax="${role}"]`));

    const backgrounds = pick('background');
    const contents = pick('content');
    const headings = pick('heading');
    const all = [...backgrounds, ...contents, ...headings];

    let frame = 0;

    const read = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const viewport = window.innerHeight;

      /* Секция вне экрана — считать нечего. */
      if (rect.bottom < 0 || rect.top > viewport) return;

      /**
       * −0.5 — секция только входит снизу, 0 — по центру прохода, +0.5 — уходит
       * вверх. Знак хода отрицательный: слои движутся навстречу прокрутке.
       */
      const phase = (viewport - rect.top) / (viewport + rect.height) - 0.5;

      for (const element of backgrounds) {
        element.style.transform =
          `translateY(${phase * -backgroundTravelPx}px) scale(${backgroundZoom})`;
      }

      for (const element of contents) {
        element.style.transform = `translateY(${phase * -contentTravelPx}px)`;
      }

      for (const element of headings) {
        element.style.transform =
          `translateY(${phase * -headingTravelPx}px) scale(${1 + phase * headingScaleRange})`;
      }
    };

    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);

      /* Возврат в исходное: следующий монтаж начинает с чистого состояния. */
      for (const element of all) element.style.transform = '';
    };
  }, [reducedMotion, wideEnough]);

  return (
    <div ref={rootRef} data-slot="section-parallax" className={cn(className)}>
      {children}
    </div>
  );
}
