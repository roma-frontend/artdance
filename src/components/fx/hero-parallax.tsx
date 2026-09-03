/**
 * HERO PARALLAX — уход первого экрана при прокрутке.
 *
 * Эффект из прототипа, перенесённый один в один: при прокрутке фон уезжает
 * медленнее содержимого и слегка приближается, содержимое уходит быстрее и
 * гаснет, затемняющий слой растворяется. Ощущение — экран «проваливается» вглубь,
 * а не просто уползает вверх.
 *
 * Все коэффициенты — из `motion.heroParallax`, то есть те же числа, что в макете:
 * фон 0.3, содержимое −0.6, гашение содержимого ×1.8, затемнения ×2, зум
 * 1.04 + 0.0003 на пиксель, конец эффекта на 0.85 высоты экрана.
 *
 * Роли назначаются атрибутом `data-parallax` на самих элементах, а не селекторами
 * по классам: разметка первого экрана живёт в серверном компоненте страницы, и
 * связывать её с эффектом именами классов означало бы, что переименование класса
 * молча ломает анимацию.
 *
 * Стили пишутся прямо в узлы, минуя состояние React: прокрутка даёт десятки
 * событий в секунду. При `prefers-reduced-motion` эффект не запускается вовсе.
 */

'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

/** Роли элементов первого экрана. Значение атрибута `data-parallax`. */
export type HeroParallaxRole = 'background' | 'content' | 'overlay';

export function HeroParallax({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;

    const { exitAtViewportFraction, backgroundFactor, contentFactor, contentFadeFactor, overlayFadeFactor, zoom } =
      motion.heroParallax;

    const pick = (role: HeroParallaxRole) =>
      Array.from(root.querySelectorAll<HTMLElement>(`[data-parallax="${role}"]`));

    const backgrounds = pick('background');
    const contents = pick('content');
    const overlays = pick('overlay');

    let frame = 0;

    const read = () => {
      frame = 0;
      const scrolled = window.scrollY;
      const viewport = window.innerHeight;

      /* Ниже первого экрана считать нечего: элементы уже вне вида. */
      if (scrolled > viewport) return;

      /** Доля пройденного пути до «ухода» экрана. */
      const progress = Math.min(scrolled / (viewport * exitAtViewportFraction), 1);

      for (const element of backgrounds) {
        element.style.transform =
          `scale(${zoom.base + scrolled * zoom.perPixel}) translateY(${scrolled * backgroundFactor}px)`;
      }

      for (const element of contents) {
        element.style.transform = `translateY(${scrolled * contentFactor}px)`;
        element.style.opacity = String(Math.max(0, 1 - progress * contentFadeFactor));
      }

      for (const element of overlays) {
        element.style.opacity = String(Math.max(0, 1 - progress * overlayFadeFactor));
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
      for (const element of [...backgrounds, ...contents, ...overlays]) {
        element.style.transform = '';
        element.style.opacity = '';
      }
    };
  }, [reducedMotion]);

  return <div ref={rootRef}>{children}</div>;
}
