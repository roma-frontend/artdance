'use client';

import { useEffect, useRef } from 'react';

import { animationConfig } from '@/lib/animations/parallax';

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
 * `aria-hidden` и пустой alt: печать ничего не сообщает — её текст «ARTDANCE»
 * дублирует имя бренда в шапке и подвале, скринридеру её читать не нужно.
 */
export function ScrollSeal({ text = 'ARTDANCE · YEREVAN · ' }: { text?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    let frame = 0;
    const paint = () => {
      frame = 0;
      const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = documentHeight > 0 ? window.scrollY / documentHeight : 0;
      const degrees = progress * animationConfig.sealRotation.maxDegrees;
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
  }, []);

  return (
    <span
      ref={ref}
      data-slot="scroll-seal"
      aria-hidden="true"
      className="scroll-seal pointer-events-none absolute -top-7 right-10 hidden select-none lg:block"
    >
      <svg width="128" height="128" viewBox="0 0 128 128" focusable="false">
        <defs>
          <path
            id="scroll-seal-circle"
            d="M 64 64 m -46 0 a 46 46 0 1 1 92 0 a 46 46 0 1 1 -92 0"
            fill="none"
          />
        </defs>
        <circle cx="64" cy="64" r="60" className="fill-none stroke-current opacity-25" strokeWidth="1" />
        <circle cx="64" cy="64" r="30" className="fill-none stroke-current opacity-25" strokeWidth="1" />
        <text className="fill-current text-caption uppercase" style={{ letterSpacing: '0.32em' }}>
          <textPath href="#scroll-seal-circle">{text}</textPath>
        </text>
      </svg>
    </span>
  );
}
