/**
 * HeroParallaxFX — движок глубины первого экрана, невидимый компонент.
 *
 * Два эффекта, и оба не стоят ни одного рендера React:
 *
 * **1. Параллакс за курсором** (только `fine pointer` на широком экране): кадр
 * уходит от курсора, контурное слово — ещё дальше, текстовая колонка следует
 * за курсором. Разница векторов создаёт планы между кадром и контентом.
 * Величины пишутся в CSS-переменные `--hero-parallax-x/y` на секции и
 * сглаживаются lerp-ом в rAF-цикле: прямое присваивание «за палец» дрожит.
 *
 * **2. Глубина при прокрутке** (все устройства, на узком — ослабленная): четыре
 * плана уходят с разной скоростью (`heroDepthFrame`, числа в
 * `motion.heroDepth`). Кадр отстаёт от прокрутки и растёт, слово отстаёт
 * меньше, текст почти идёт с прокруткой и гаснет, световой проход обгоняет.
 * Страница не «обрывается» швом секций, а уходит вглубь, как отъезд камеры.
 *
 * Оба эффекта отключаются при `prefers-reduced-motion: reduce` — здесь и в CSS:
 * два источника истины защищают от гонки «стили применились, JS ещё нет».
 * Пока фокус внутри hero, текст стоит на месте и не гаснет: клавиатурный
 * пользователь не должен искать кнопку, уехавшую вместе с колонкой.
 *
 * DOM-якорь — `display: contents`: компонент не должен участвовать в раскладке,
 * только держать ref, по которому находится секция.
 */

'use client';

import { useScroll } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { motion } from '@/design/motion';
import { heroDepthFrame } from '@/lib/animations/parallax';
import { useFinePointer, useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function HeroParallaxFX() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const { scrollY } = useScroll();

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || reducedMotion) return;

    const root = anchor.parentElement;
    if (!root) return;
    const background = root.querySelector<HTMLElement>('[data-hero-background]');
    const word = root.querySelector<HTMLElement>('[data-hero-depth="word"]');
    const content = root.querySelector<HTMLElement>('.hero-content');
    const foreground = root.querySelector<HTMLElement>('.hero-light-sweep');
    const factor = wide ? 1 : motion.heroDepth.narrowFactor;
    const pointerEnabled = finePointer && wide;

    let frame = 0;
    let raf = 0;

    /* --- Параллакс за курсором -------------------------------------------- */

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let pointer: { x: number; y: number } | null = null;

    const paintPointer = () => {
      if (pointer) {
        const rect = root.getBoundingClientRect();
        if (rect.width && rect.height) {
          targetX = Math.max(-0.5, Math.min(0.5, (pointer.x - rect.left) / rect.width - 0.5));
          targetY = Math.max(-0.5, Math.min(0.5, (pointer.y - rect.top) / rect.height - 0.5));
        }
        pointer = null;
      }
      /* Цикл живёт, пока есть ненулевая разница — в покое ни кадра работы. */
      currentX += (targetX - currentX) * motion.heroDepth.pointerLerp;
      currentY += (targetY - currentY) * motion.heroDepth.pointerLerp;
      root.style.setProperty('--hero-parallax-x', currentX.toFixed(4));
      root.style.setProperty('--hero-parallax-y', currentY.toFixed(4));

      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.001) {
        raf = window.requestAnimationFrame(paintPointer);
      } else {
        raf = 0;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || root.matches(':focus-within')) return;
      pointer = { x: event.clientX, y: event.clientY };
      if (raf === 0) raf = window.requestAnimationFrame(paintPointer);
    };

    const onPointerLeave = () => {
      pointer = null;
      targetX = 0;
      targetY = 0;
      if (raf === 0) raf = window.requestAnimationFrame(paintPointer);
    };

    /* --- Глубина при прокрутке -------------------------------------------- */

    const paintScroll = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      const progress = -rect.top / (rect.height || 1);
      const depth = heroDepthFrame(progress, rect.height, factor);
      const focused = root.matches(':focus-within');
      if (background) background.style.transform = `translate3d(0, ${depth.background}px, 0) scale(${depth.zoom})`;
      if (word) word.style.translate = `0 ${depth.word}px`;
      if (content) {
        content.style.translate = `0 ${focused ? 0 : depth.content}px`;
        content.style.opacity = focused ? '' : String(depth.contentOpacity);
      }
      if (foreground) foreground.style.transform = `translate3d(0, ${depth.foreground}px, 0)`;
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(paintScroll);
    };

    if (pointerEnabled) {
      root.addEventListener('pointermove', onPointerMove, { passive: true });
      root.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }
    const unsubscribe = scrollY.on('change', onScroll);
    root.addEventListener('focusin', onScroll);
    root.addEventListener('focusout', onScroll);
    window.addEventListener('resize', onScroll, { passive: true });
    paintScroll();

    return () => {
      if (pointerEnabled) {
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerleave', onPointerLeave);
      }
      unsubscribe();
      root.removeEventListener('focusin', onScroll);
      root.removeEventListener('focusout', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      if (raf !== 0) window.cancelAnimationFrame(raf);
      if (background) background.style.transform = '';
      if (word) word.style.translate = '';
      if (content) {
        content.style.translate = '';
        content.style.opacity = '';
      }
      if (foreground) foreground.style.transform = '';
      root.style.removeProperty('--hero-parallax-x');
      root.style.removeProperty('--hero-parallax-y');
    };
  }, [finePointer, reducedMotion, scrollY, wide]);

  if (reducedMotion) return null;

  return <div ref={anchorRef} aria-hidden className="contents" data-slot="hero-fx" />;
}
