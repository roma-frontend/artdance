/**
 * HeroParallaxFX — движок глубины первого экрана, невидимый компонент.
 *
 * Два эффекта, и оба не стоят ни одного рендера React:
 *
 * **1. Параллакс за курсором** (только `fine pointer`): видео уходит от курсора
 * до 18px, текстовая колонка следует за ним до 10px — разница векторов создаёт
 * слой глубины между кадром и контентом. Величины пишутся в CSS-переменные
 * `--hero-parallax-x/y` на секции, значения сглаживаются lerp-ом в rAF-цикле:
 * прямое присваивание «за палец» дрожит, ступенчатое — читается как задержка.
 *
 * **2. Scroll-exit глубина** (все устройства): при прокрутке первого экрана
 * кадр медленно растёт (до +8%), контент поднимается и гаснет. Страница не
 * «обрывается» швом секций, а уходит в глубину, как отъезд камеры. Величина —
 * `--hero-exit-progress` (0…1) на той же секции.
 *
 * Оба эффекта отключаются при `prefers-reduced-motion: reduce` — здесь и в CSS:
 * два источника истины защищают от гонки «стили применились, JS ещё нет».
 * Значения по умолчанию у переменных — 0, поэтому до первого события и после
 * размонтирования компонента кадр стоит в базовой геометрии.
 *
 * DOM-якорь — `display: contents`: компонент не должен участвовать в раскладке,
 * только держать ref, по которому находится секция.
 */

'use client';

import { useEffect, useRef } from 'react';

import { useFinePointer } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function HeroParallaxFX() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || reducedMotion) return;

    const root = anchor.parentElement;
    if (!root) return;

    let frame = 0;
    let raf = 0;

    /* --- Параллакс за курсором -------------------------------------------- */

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const paintPointer = () => {
      /*
       * lerp 0.12: движение доезжает за ~150ms и не дрожит. Цикл живёт, пока
       * есть ненулевая разница — в покое ни кадра работы.
       */
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      root.style.setProperty('--hero-parallax-x', currentX.toFixed(4));
      root.style.setProperty('--hero-parallax-y', currentY.toFixed(4));

      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.001) {
        raf = window.requestAnimationFrame(paintPointer);
      } else {
        raf = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = root.getBoundingClientRect();
      if (rect.height === 0) return;
      targetX = (event.clientX - rect.left) / rect.width - 0.5;
      targetY = (event.clientY - rect.top) / rect.height - 0.5;
      if (raf === 0) raf = window.requestAnimationFrame(paintPointer);
    };

    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      if (raf === 0) raf = window.requestAnimationFrame(paintPointer);
    };

    /* --- Scroll-exit глубина ---------------------------------------------- */

    const paintScroll = () => {
      frame = 0;
      const viewportHeight = window.innerHeight || 1;
      const progress = Math.min(Math.max(window.scrollY / (viewportHeight * 0.9), 0), 1);
      root.style.setProperty('--hero-exit-progress', progress.toFixed(4));
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paintScroll);
    };

    if (finePointer) {
      root.addEventListener('pointermove', onPointerMove, { passive: true });
      root.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paintScroll();

    return () => {
      if (finePointer) {
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerleave', onPointerLeave);
      }
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      if (raf !== 0) window.cancelAnimationFrame(raf);
      root.style.removeProperty('--hero-parallax-x');
      root.style.removeProperty('--hero-parallax-y');
      root.style.removeProperty('--hero-exit-progress');
    };
  }, [finePointer, reducedMotion]);

  if (reducedMotion) return null;

  return <div ref={anchorRef} aria-hidden className="contents" data-slot="hero-fx" />;
}
