'use client';

/**
 * FooterParallaxFX — глубина подвала, зеркальная hero.
 *
 * Тот же приём что в HeroParallaxFX, но инвертирован для финала:
 * контурное слово ARTDANCE лежит на дальнем плане и отстаёт от прокрутки,
 * контент подвала идёт почти синхронно, световой проход обгоняет.
 * Плюс лёгкое ведение за курсором — подвал «дышит» вместе с hero.
 */

import { useScroll } from 'framer-motion';
import { useEffect, useRef } from 'react';

import { motion } from '@/design/motion';
import { heroDepthFrame } from '@/lib/animations/parallax';
import { useFinePointer, useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

export function FooterParallaxFX() {
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
    const word = root.querySelector<HTMLElement>('[data-footer-word]');
    const content = root.querySelector<HTMLElement>('.footer-content');
    const foreground = root.querySelector<HTMLElement>('.footer-light-sweep');
    const factor = wide ? 1 : motion.heroDepth.narrowFactor;
    const pointerEnabled = finePointer && wide;

    let frame = 0;
    let raf = 0;
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
      currentX += (targetX - currentX) * motion.heroDepth.pointerLerp;
      currentY += (targetY - currentY) * motion.heroDepth.pointerLerp;
      root.style.setProperty('--footer-parallax-x', currentX.toFixed(4));
      root.style.setProperty('--footer-parallax-y', currentY.toFixed(4));
      if (Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.001) {
        raf = window.requestAnimationFrame(paintPointer);
      } else raf = 0;
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

    const paintScroll = () => {
      frame = 0;
      const rect = root.getBoundingClientRect();
      // 0 — подвал ещё не вошёл снизу, 1 — прошёл верх окна
      const raw = (window.innerHeight - rect.top) / (rect.height + window.innerHeight * 0.4);
      const progress = Math.min(1, Math.max(0, raw));
      const depth = heroDepthFrame(progress, rect.height, factor);
      // Инверсия: подвал въезжает снизу, поэтому слово идёт навстречу чуть медленнее
      if (word) word.style.translate = `0 ${depth.word * 0.55}px`;
      if (content) {
        const focused = root.matches(':focus-within');
        content.style.translate = `0 ${focused ? 0 : depth.content * 0.6}px`;
      }
      if (foreground) foreground.style.transform = `translate3d(0, ${depth.foreground * 0.6}px, 0)`;
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
      if (word) word.style.translate = '';
      if (content) content.style.translate = '';
      if (foreground) foreground.style.transform = '';
      root.style.removeProperty('--footer-parallax-x');
      root.style.removeProperty('--footer-parallax-y');
    };
  }, [finePointer, reducedMotion, scrollY, wide]);

  if (reducedMotion) return null;
  return <div ref={anchorRef} aria-hidden className="contents" data-slot="footer-fx" />;
}
