/**
 * HeroParallaxFX — движок глубины первого экрана, невидимый компонент.
 *
 * Два эффекта, и оба не стоят ни одного рендера React:
 *
 * **1. Параллакс за курсором** (только `fine pointer` на широком экране): кадр
 * уходит от курсора, контурное слово — ещё дальше, текстовая колонка следует
 * за курсором. Разница векторов создаёт планы между кадром и контентом.
 * Величины пишутся в CSS-переменные `--hero-parallax-x/y` и переменные камеры
 * Stage Depth 2.0 на секции и сглаживаются lerp-ом в rAF-цикле:
 * прямое присваивание «за палец» дрожит.
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

import { useEffect, useRef } from 'react';

import { motion } from '@/design/motion';
import { heroDepthFrame } from '@/lib/animations/parallax';
import { registerScrollEffect, requestScrollFrame } from '@/lib/animations/scroll-engine';
import { useFinePointer, useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

export function HeroParallaxFX() {
  const anchorRef = useRef<HTMLDivElement>(null);
  const finePointer = useFinePointer();
  const reducedMotion = usePrefersReducedMotion();
  const lite = useIsLiteMode();
  const wide = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor || reducedMotion || lite) return;

    const root = anchor.parentElement;
    if (!root) return;
    const background = root.querySelector<HTMLElement>('[data-hero-background]');
    const word = root.querySelector<HTMLElement>('[data-hero-depth="word"]');
    const content = root.querySelector<HTMLElement>('.hero-content');
    const foreground = root.querySelector<HTMLElement>('.hero-light-sweep');
    const factor = wide ? 1 : motion.heroDepth.narrowFactor;
    const pointerEnabled = finePointer && wide;
    const stageMotion = motion.heroDepth.stage;

    let raf = 0;

    /* --- Параллакс за курсором -------------------------------------------- */

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let pointer: { x: number; y: number } | null = null;

    // rect кэшируется и обновляется только по resize/scroll — избегаем forced reflow на pointermove
    let cachedRect: DOMRect | null = null;
    let cachedRectTime = 0;

    const getCachedRect = () => {
      const now = performance.now();
      if (!cachedRect || now - cachedRectTime > 300) {
        cachedRect = root.getBoundingClientRect();
        cachedRectTime = now;
      }
      return cachedRect;
    };

    const paintPointer = () => {
      if (pointer) {
        const rect = getCachedRect();
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
      root.style.setProperty('--hero-stage-rotate-x', `${(-currentY * stageMotion.maxRotateDeg).toFixed(3)}deg`);
      root.style.setProperty('--hero-stage-rotate-y', `${(currentX * stageMotion.maxRotateDeg).toFixed(3)}deg`);
      root.style.setProperty(
        '--hero-stage-depth',
        `${(Math.hypot(currentX, currentY) * Math.SQRT2 * stageMotion.maxDepthPx).toFixed(2)}px`,
      );

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

    let lastBack = '';
    let lastWord = '';
    let lastContentTranslate = '';
    let lastContentOpacity = '';
    let lastFront = '';

    const setStyle = (el: HTMLElement | null, prop: 'transform' | 'translate' | 'opacity', val: string, prev: string) => {
      if (!el || val === prev) return prev;
      el.style[prop] = val;
      return val;
    };

    /** Значения, посчитанные в фазе чтения и применённые в фазе записи. */
    let nextBack = '';
    let nextWord = '';
    let nextContentTranslate = '';
    let nextContentOpacity = '';
    let nextFront = '';

    if (pointerEnabled) {
      root.addEventListener('pointermove', onPointerMove, { passive: true });
      root.addEventListener('pointerleave', onPointerLeave, { passive: true });
    }
    /* Фокус меняет кадр так же, как прокрутка: текст обязан встать на место. */
    root.addEventListener('focusin', requestScrollFrame);
    root.addEventListener('focusout', requestScrollFrame);

    const unregister = registerScrollEffect({
      element: root,
      read: () => {
        const rect = root.getBoundingClientRect();
        cachedRect = rect;
        cachedRectTime = performance.now();
        // Когда hero полностью ушёл далеко за верх экрана, замораживаем на финальном кадре (1), не переписывая DOM на каждом пикселе скролла ниже
        const rawProgress = -rect.top / (rect.height || 1);
        const progress = Math.min(1, Math.max(0, rawProgress));
        const depth = heroDepthFrame(progress, rect.height, factor);
        const focused = root.matches(':focus-within');
        nextBack = `translate3d(0, ${depth.background.toFixed(2)}px, 0) scale(${depth.zoom.toFixed(4)})`;
        nextWord = `0 ${depth.word.toFixed(2)}px`;
        nextContentTranslate = `0 ${focused ? 0 : Number(depth.content.toFixed(2))}px`;
        nextContentOpacity = focused ? '' : depth.contentOpacity.toFixed(3);
        nextFront = `translate3d(0, ${depth.foreground.toFixed(2)}px, 0)`;
      },
      write: () => {
        lastBack = setStyle(background, 'transform', nextBack, lastBack);
        lastWord = setStyle(word, 'translate', nextWord, lastWord);
        if (content) {
          lastContentTranslate = setStyle(content, 'translate', nextContentTranslate, lastContentTranslate);
          lastContentOpacity = setStyle(content, 'opacity', nextContentOpacity, lastContentOpacity);
        }
        lastFront = setStyle(foreground, 'transform', nextFront, lastFront);
      },
    });

    return () => {
      unregister();
      if (pointerEnabled) {
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerleave', onPointerLeave);
      }
      root.removeEventListener('focusin', requestScrollFrame);
      root.removeEventListener('focusout', requestScrollFrame);
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
      root.style.removeProperty('--hero-stage-rotate-x');
      root.style.removeProperty('--hero-stage-rotate-y');
      root.style.removeProperty('--hero-stage-depth');
    };
  }, [finePointer, reducedMotion, lite, wide]);

  if (reducedMotion || lite) return null;

  return <div ref={anchorRef} aria-hidden className="contents" data-slot="hero-fx" />;
}
