'use client';

import { motion as animated, useAnimationControls, useInView, useTransform } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { useCursorFollow } from '@/hooks/use-cursor-follow';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';
import { revealTransition } from '@/lib/animations/scroll-reveal';
import { cn } from '@/lib/utils';
import { useIsLiteMode } from '@/lib/perf/lite-mode';

interface CardTiltLiteProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

export function CardTilt({ children, className, index = 0 }: CardTiltLiteProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cursor = useCursorFollow(ref);
  const reducedMotion = usePrefersReducedMotion();
  const lite = useIsLiteMode();
  // В лёгком режиме — никакой 3D-магии, только появление.
  const motionDisabled = reducedMotion || lite;
  const rotateX = useTransform(cursor.y, (value) => -value * motion.cardTilt.maxRotateDeg);
  const rotateY = useTransform(cursor.x, (value) => value * motion.cardTilt.maxRotateDeg);
  const x = useTransform(cursor.x, (value) => value * motion.cardTilt.pointerTravelPx);
  const y = useTransform(cursor.y, (value) => value * motion.cardTilt.pointerTravelPx);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const controls = useAnimationControls();
  const revealed = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const size = { width: node.offsetWidth, height: node.offsetHeight };
    const resize = new ResizeObserver(() => {
      size.width = node.offsetWidth;
      size.height = node.offsetHeight;
    });
    resize.observe(node);
    const writeX = (value: number) => {
      node.style.setProperty('--card-cursor-x', `${(value + 0.5) * size.width}px`);
      node.style.setProperty('--card-media-x', `${value * -motion.cardTilt.mediaTravelPx}px`);
    };
    const writeY = (value: number) => {
      node.style.setProperty('--card-cursor-y', `${(value + 0.5) * size.height}px`);
      node.style.setProperty('--card-media-y', `${value * -motion.cardTilt.mediaTravelPx}px`);
    };
    writeX(cursor.x.get());
    writeY(cursor.y.get());
    const stopX = cursor.x.on('change', writeX);
    const stopY = cursor.y.on('change', writeY);
    return () => {
      resize.disconnect();
      stopX();
      stopY();
      node.style.removeProperty('--card-cursor-x');
      node.style.removeProperty('--card-cursor-y');
      node.style.removeProperty('--card-media-x');
      node.style.removeProperty('--card-media-y');
    };
  }, [cursor.x, cursor.y]);

  useEffect(() => {
    if (motionDisabled) {
      controls.stop();
      controls.set({ opacity: 1, scale: 1 });
      return;
    }
    if (revealed.current) return;
    const node = ref.current;
    if (!node) return;
    if (inView || node.getBoundingClientRect().top < window.innerHeight) {
      revealed.current = true;
      node.setAttribute('data-card-entering', '');
      void controls.start({ opacity: 1, scale: 1, transition: revealTransition(index) }).then(() => {
        node.removeAttribute('data-card-entering');
      });
    } else {
      controls.set({ opacity: 0, scale: 0.94 });
    }
  }, [controls, inView, index, motionDisabled]);

  return (
    <animated.div
      ref={ref}
      data-slot="card-tilt"
      data-animation-card=""
      data-cursor-depth={cursor.enabled ? '' : undefined}
      className={cn('relative h-full', className)}
      initial={false}
      animate={controls}
      onFocusCapture={() => {
        revealed.current = true;
        controls.stop();
        controls.set({ opacity: 1, scale: 1 });
      }}
      style={{
        rotateX: cursor.enabled ? rotateX : 0,
        rotateY: cursor.enabled ? rotateY : 0,
        x: cursor.enabled ? x : 0,
        y: cursor.enabled ? y : 0,
        transformPerspective: cursor.enabled ? motion.cardTilt.perspectivePx : undefined,
      }}
    >
      {children}
    </animated.div>
  );
}
