'use client';

import { useEffect, useId, useRef } from 'react';

import { motion } from '@/design/motion';
import { animationConfig } from '@/lib/animations/parallax';
import { cn } from '@/lib/utils';

/**
 * SCROLL SEAL — декоративная печать, вращающаяся от прокрутки.
 *
 * Дом scroll-driven rotation переехал сюда с карточек (решение заказчика:
 * вращающийся текст мешал читать карточки). Печать — та же техника из референсов,
 * на котором она работает: вращается декорация, а не содержание.
 *
 * Угол — функция положения страницы, а не таймера: прокрутка вперёд крутит
 * в одну сторону, назад — в другую, и на кадре печать всегда стоит там, где ей
 * положено быть при этой высоте прокрутки. Значение пишется в стиль минуя
 * состояние React: событий скролла десятки в секунду.
 *
 * `scope="section"` — угол от прохода родительской секции через окно, а не от
 * всей страницы: печать в середине длинной страницы делает заметные обороты,
 * пока видна, а не 5°. Финальный CTA остаётся на `page` — его поведение
 * закреплено e2e-тестом.
 *
 * `aria-hidden` и пустой alt: печать ничего не сообщает — её текст «ARTDANCE»
 * дублирует имя бренда в шапке и подвале, скринридеру её читать не нужно.
 */
interface ScrollSealProps {
  text?: string;
  scope?: 'page' | 'section';
  /** Положение печати в секции; по умолчанию — правый верхний угол финального CTA. */
  className?: string;
}

export function ScrollSeal({ text = 'ARTDANCE · YEREVAN · ', scope = 'page', className }: ScrollSealProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Печатей на странице несколько: у каждой свой путь, иначе textPath возьмёт первый.
  const pathId = `scroll-seal-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    const section = scope === 'section' ? node.parentElement : null;
    let frame = 0;
    const paint = () => {
      frame = 0;
      let degrees: number;
      if (section) {
        // 0 — секция показалась снизу, 1 — ушла за верх окна.
        const rect = section.getBoundingClientRect();
        const pass = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
        degrees = Math.min(1, Math.max(0, pass)) * motion.scrollRotation.degreesPerPass;
      } else {
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = documentHeight > 0 ? window.scrollY / documentHeight : 0;
        degrees = progress * animationConfig.sealRotation.maxDegrees;
      }
      node.style.transform = `rotate(${degrees}deg)`;
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paint);
    };

    paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    // Ленивые секции меняют высоту страницы без скролла — угол обязан пересчитаться.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      node.style.transform = '';
    };
  }, [scope]);

  return (
    <span
      ref={ref}
      // Отдельный slot: e2e ищет единственную печать финального CTA.
      data-slot={scope === 'page' ? 'scroll-seal' : 'section-seal'}
      aria-hidden="true"
      className={cn('scroll-seal pointer-events-none absolute select-none', className ?? '-top-7 right-10 hidden lg:block')}
    >
      <svg width="128" height="128" viewBox="0 0 128 128" focusable="false">
        <defs>
          <path id={pathId} d="M 64 64 m -46 0 a 46 46 0 1 1 92 0 a 46 46 0 1 1 -92 0" fill="none" />
        </defs>
        <circle cx="64" cy="64" r="60" className="fill-none stroke-current opacity-25" strokeWidth="1" />
        <circle cx="64" cy="64" r="30" className="fill-none stroke-current opacity-25" strokeWidth="1" />
        <text className="fill-current text-caption uppercase" style={{ letterSpacing: '0.32em' }}>
          <textPath href={`#${pathId}`}>{text}</textPath>
        </text>
      </svg>
    </span>
  );
}
