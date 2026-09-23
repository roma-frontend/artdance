/**
 * CARD TILT — наклон карточки к курсору.
 *
 * Эффект из прототипа (`.cat`, `.inst`, `.card`), где он живёт в inline-JS и
 * пишет в `transform` самой карточки. Здесь он вынесен в обёртку, и это не
 * косметика: у карточки есть свой hover-подъём с тенью, тоже через `transform`.
 * Два источника одного свойства означают, что одно состояние затирает другое —
 * карточка либо не поднимается, либо не наклоняется, в зависимости от порядка
 * событий. Обёртка отвечает за поворот, карточка — за подъём, и они складываются.
 *
 * Включается только при точном указателе: без курсора наклон не воспроизводится
 * вообще, а слушатель `pointermove` на десятке карточек стоит кадров. При
 * `prefers-reduced-motion` эффекта нет.
 *
 * Значение поворота пишется прямо в стиль узла, минуя состояние React: движение
 * мыши даёт десятки событий в секунду.
 */

'use client';

import { motion as animated, useAnimationControls, useInView, useTransform } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

import { motion } from '@/design/motion';
import { useCursorFollow } from '@/hooks/use-cursor-follow';
import { useScrollAnimation } from '@/hooks/use-scroll-animation';
import { revealTransition } from '@/lib/animations/scroll-reveal';
import { cn } from '@/lib/utils';

interface CardTiltProps {
  children: ReactNode;
  className?: string;
  index?: number;
}

export function CardTilt({ children, className, index = 0 }: CardTiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { rotate, enabled, reducedMotion } = useScrollAnimation(ref);
  const cursor = useCursorFollow(ref);
  const rotateX = useTransform(cursor.y, (value) => -value * motion.cardTilt.maxRotateDeg);
  const rotateY = useTransform(cursor.x, (value) => value * motion.cardTilt.maxRotateDeg);
  const x = useTransform(cursor.x, (value) => value * 6);
  const y = useTransform(cursor.y, (value) => value * 6);
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const controls = useAnimationControls();
  const revealed = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
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
  }, [controls, inView, reducedMotion, index]);

  return (
    <animated.div
      ref={ref}
      data-slot="card-tilt"
      data-animation-card=""
      className={cn('h-full', className)}
      initial={false}
      animate={controls}
      onFocusCapture={() => {
        revealed.current = true;
        controls.stop();
        controls.set({ opacity: 1, scale: 1 });
      }}
      style={{
        rotate: enabled ? rotate : 0,
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
