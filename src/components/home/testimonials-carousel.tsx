'use client';

import { ArrowLeftIcon, ArrowRightIcon, PauseIcon, PlayIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Children, useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

/** Native scroll keeps touch inertia, trackpads and the server-rendered quotes usable without JS. */
export function TestimonialsCarousel({ children, label }: { children: ReactNode; label: string }) {
  const t = useTranslations('home.testimonials');
  const reduced = usePrefersReducedMotion();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLUListElement>(null);
  const drag = useRef<{ pointer: number; x: number; scroll: number; moved: boolean } | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = Children.count(children);
  const animation = useRef(0);
  const selected = useRef(0);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animation.current);
    animation.current = 0;
    rail.current?.removeAttribute('data-animating');
  }, []);

  const select = useCallback((index: number) => {
    const node = rail.current;
    const card = node?.children[(index + count) % count] as HTMLElement | undefined;
    if (!node || !card) return;
    stopAnimation();
    const target = Math.max(0, Math.min(node.scrollWidth - node.clientWidth, card.offsetLeft - (node.clientWidth - card.offsetWidth) / 2));
    if (reduced) { node.scrollLeft = target; return; }
    const start = node.scrollLeft;
    const began = performance.now();
    node.dataset.animating = 'true';
    const tick = (now: number) => {
      const progress = Math.min(1, (now - began) / 1400);
      // Camera dolly: deliberate acceleration, long gentle landing, no abrupt snap.
      const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      node.scrollLeft = start + (target - start) * eased;
      if (progress < 1) animation.current = requestAnimationFrame(tick);
      else { animation.current = 0; node.removeAttribute('data-animating'); }
    };
    animation.current = requestAnimationFrame(tick);
  }, [count, reduced, stopAnimation]);

  useEffect(() => stopAnimation, [stopAnimation, reduced]);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    let frame = 0;
    const sync = () => {
      const center = node.scrollLeft + node.clientWidth / 2;
      let nearest = 0;
      let distance = Infinity;
      Array.from(node.children).forEach((child, index) => {
        const card = child as HTMLElement;
        const delta = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        const depth = Math.min(1, delta / card.offsetWidth);
        card.style.setProperty('--review-turn', reduced ? '0deg' : `${Math.max(-1, Math.min(1, (card.offsetLeft + card.offsetWidth / 2 - center) / card.offsetWidth)) * -7}deg`);
        card.style.setProperty('--review-depth', reduced ? '0' : String(depth));
        if (delta < distance) { nearest = index; distance = delta; }
      });
      selected.current = nearest;
      setActive(nearest);
    };
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(sync); };
    let previousWidth = node.clientWidth;
    const observer = new ResizeObserver(() => {
      if (node.clientWidth === previousWidth) { sync(); return; }
      previousWidth = node.clientWidth;
      stopAnimation();
      // Keep the selected card centered after rotating a phone or resizing the window.
      const index = Number(node.dataset.active || 0);
      const card = node.children[index] as HTMLElement | undefined;
      if (card) node.scrollLeft = card.offsetLeft - (node.clientWidth - card.offsetWidth) / 2;
      sync();
    });
    observer.observe(node);
    node.addEventListener('scroll', onScroll, { passive: true });
    sync();
    return () => { observer.disconnect(); node.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame); };
  }, [reduced, stopAnimation]);

  useEffect(() => {
    const element = root.current;
    if (!element || paused || reduced || count < 2) return;
    let visible = false;
    const observer = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; }, { threshold: 0.4 });
    observer.observe(element);
    const timer = window.setInterval(() => {
      if (visible && !document.hidden && !drag.current && !animation.current) select(selected.current + 1);
    }, 5500);
    return () => { observer.disconnect(); window.clearInterval(timer); };
  }, [count, paused, reduced, select]);

  const finishDrag = (pointer: number) => {
    const node = rail.current;
    const gesture = drag.current;
    if (!node || !gesture || gesture.pointer !== pointer) return;
    drag.current = null;
    node.removeAttribute('data-dragging');
    if (node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer);
    if (gesture.moved) {
      const center = node.scrollLeft + node.clientWidth / 2;
      let closest = 0;
      let distance = Infinity;
      Array.from(node.children).forEach((child, index) => {
        const card = child as HTMLElement;
        const delta = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        if (delta < distance) { closest = index; distance = delta; }
      });
      select(closest);
    }
  };

  if (!count) return null;

  return (
    <div ref={root} className="reviews-stage" role="region" aria-label={label} data-slot="testimonials-carousel">
      <div className="reviews-stage-light" aria-hidden />
      <ul
        ref={rail}
        id={id}
        tabIndex={0}
        aria-label={label}
        data-active={active}
        className="reviews-rail scrollbar-none"
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            select(event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : active + (event.key === 'ArrowRight' ? 1 : -1));
          }
        }}
        onPointerDown={(event) => {
          stopAnimation();
          if (event.pointerType !== 'mouse' || event.button !== 0 || count < 2) return;
          drag.current = { pointer: event.pointerId, x: event.clientX, scroll: event.currentTarget.scrollLeft, moved: false };
        }}
        onPointerMove={(event) => {
          const gesture = drag.current;
          if (gesture && gesture.pointer === event.pointerId) {
            const delta = event.clientX - gesture.x;
            if (Math.abs(delta) > 5) {
              gesture.moved = true;
              event.currentTarget.dataset.dragging = 'true';
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.scrollLeft = gesture.scroll - delta;
            }
            return;
          }
          if (reduced || event.pointerType !== 'mouse') return;
          const card = (event.target as HTMLElement).closest<HTMLElement>('.review-slide');
          if (!card) return;
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          card.style.setProperty('--review-light-x', `${x * 100}%`);
          card.style.setProperty('--review-light-y', `${y * 100}%`);
          card.style.setProperty('--review-tilt-x', `${(0.5 - y) * 4}deg`);
          card.style.setProperty('--review-tilt-y', `${(x - 0.5) * 4}deg`);
        }}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
        onLostPointerCapture={(event) => finishDrag(event.pointerId)}
        onPointerLeave={(event) => {
          if (drag.current && !drag.current.moved) drag.current = null;
          Array.from(event.currentTarget.children).forEach((child) => {
            const card = child as HTMLElement;
            card.style.setProperty('--review-tilt-x', '0deg');
            card.style.setProperty('--review-tilt-y', '0deg');
          });
        }}
      >
        {Children.map(children, (child, index) => (
          <li className="review-slide" data-selected={index === active}>
            <div className="review-card-depth">{child}</div>
          </li>
        ))}
      </ul>
      {count > 1 && (
        <div className="reviews-controls">
          <Button variant="outline" size="icon" aria-controls={id} aria-label={t('previous')} onClick={() => select(active - 1)}><ArrowLeftIcon className="size-4" aria-hidden /></Button>
          <div className="reviews-dots" role="group" aria-label={t('navigation')}>
            {Array.from({ length: count }, (_, index) => (
              <button type="button" key={index} aria-controls={id} aria-label={t('goTo', { number: index + 1 })} aria-current={index === active ? 'true' : undefined} onClick={() => select(index)} className="review-dot"><span /></button>
            ))}
          </div>
          <Button variant="outline" size="icon" aria-controls={id} aria-label={t('next')} onClick={() => select(active + 1)}><ArrowRightIcon className="size-4" aria-hidden /></Button>
          {!reduced && <Button variant="outline" size="icon" aria-label={paused ? t('play') : t('pause')} aria-pressed={paused} onClick={() => { if (paused) { setPaused(false); select(selected.current + 1); } else { setPaused(true); stopAnimation(); } }}>{paused ? <PlayIcon className="size-4" aria-hidden /> : <PauseIcon className="size-4" aria-hidden />}</Button>}
        </div>
      )}
      <p className="reviews-caption text-caption text-content-secondary">
        <span className="tabular-nums">{String(active + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
        <span aria-hidden> · </span>{t('dragHint')}
      </p>
      <span className="sr-only" aria-live={paused || reduced ? 'polite' : 'off'} aria-atomic="true">{t('position', { number: active + 1, total: count })}</span>
    </div>
  );
}
