'use client';

/**
 * HERO MYTHIC DUST — золотая пыль в луче прожектора.
 *
 * 45-60 частиц дрейфуют по hero со случайной скоростью и мерцанием.
 * Читается как пылинки в тёплом боковом свете храма — делает видео объёмным.
 * Canvas один на весь hero, blend screen.
 *
 * Отключается: reducedMotion / stillImage / tab hidden.
 */

import { useEffect, useRef } from 'react';

import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { usePrefersReducedMotion, usePrefersStillImage } from '@/lib/hooks/use-motion-preferences';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

interface Particle {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  opacity: number;
  twinkle: number;
  twinkleSpeed: number;
}

export function HeroMythicDust() {
  const ref = useRef<HTMLCanvasElement>(null);
  const still = usePrefersStillImage();
  const reduced = usePrefersReducedMotion();
  const wide = useMediaQuery('(min-width: 768px)');
  const lite = useIsLiteMode();

  useEffect(() => {
    if (still || reduced || lite) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    const hero = canvas.parentElement;
    if (!hero) return;

    let particles: Particle[] = [];
    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let visible = false;
    const count = wide ? 56 : 32;

    // Одна текстура вместо 56 градиентов и path/arc на каждом кадре.
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 32;
    const spriteContext = sprite.getContext('2d');
    if (!spriteContext) return;
    const gradient = spriteContext.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,233,165,1)');
    gradient.addColorStop(0.45, 'rgba(212,175,55,0.55)');
    gradient.addColorStop(1, 'rgba(212,175,55,0)');
    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(0, 0, 32, 32);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = width = hero.clientWidth;
      const h = height = hero.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const init = () => {
      const w = hero.clientWidth;
      const h = hero.clientHeight;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.6,
        vx: -0.18 + Math.random() * 0.36,
        vy: -0.35 - Math.random() * 0.55,
        opacity: 0.18 + Math.random() * 0.42,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.012 + Math.random() * 0.018,
      }));
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      raf = 0;
      if (document.hidden || !visible) return;
      const w = width;
      const h = height;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.twinkle += p.twinkleSpeed * (dt / 16);
        if (p.y < -4) {
          p.y = h + 4;
          p.x = Math.random() * w;
        }
        if (p.x < -4) p.x = w + 4;
        if (p.x > w + 4) p.x = -4;
        const tw = 0.55 + 0.45 * Math.sin(p.twinkle);
        const a = p.opacity * tw;
        const radius = p.r * 2.2;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    init();
    const syncPlayback = () => {
      if (visible && !document.hidden) {
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      syncPlayback();
    });
    observer.observe(hero);
    const onResize = () => resize();
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', syncPlayback);
    };
  }, [still, reduced, wide, lite]);

  if (still || reduced || lite) return null;

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="hero-mythic-dust pointer-events-none absolute inset-0 z-[3]"
      style={{ mixBlendMode: 'screen' as const }}
    />
  );
}
