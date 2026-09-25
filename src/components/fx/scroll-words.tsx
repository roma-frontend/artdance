/**
 * SCROLL WORDS — текст проявляется по словам в такт прокрутке, а не по таймеру.
 *
 * Слова стартуют приглушёнными, размытыми и чуть опущенными и доходят до
 * полной яркости, пока абзац идёт через экран; прокрутка назад гасит их
 * обратно. Окна слов перекрываются (`scrollWords.overlap`): проявление идёт
 * волной, а не щелчками по одному слову. На сервере, без JS и при просьбе
 * убрать движение — обычный текст целиком: серверный снимок
 * `usePrefersReducedMotion` равен `true`.
 */

'use client';

import { motion as animated, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Fragment, useRef } from 'react';

import { motion } from '@/design/motion';
import { splitWords } from '@/lib/animations/scroll-reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

interface ScrollWordsProps {
  children: string;
  /**
   * Отрезок прохода, за который проявляется весь текст (`useScroll` offset).
   * По умолчанию — пока абзац идёт от нижней кромки до середины экрана.
   */
  offset?: ['start 0.9', 'end 0.55'] | ['start 0.85', 'end 0.4'];
}

export function ScrollWords({ children, offset = ['start 0.9', 'end 0.55'] }: ScrollWordsProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset });

  const parts = splitWords(children);
  const total = parts.filter((part) => !/^\s+$/u.test(part)).length;
  const span = Math.min(1, motion.scrollWords.overlap / Math.max(1, total));
  let word = 0;

  return (
    <span ref={ref}>
      {reduced
        ? children
        : parts.map((part, index) => {
            if (/^\s+$/u.test(part)) return <Fragment key={index}>{part}</Fragment>;
            const start = total > 1 ? (word++ / (total - 1)) * (1 - span) : 0;
            return (
              <Word key={index} progress={scrollYProgress} range={[start, start + span]}>
                {part}
              </Word>
            );
          })}
    </span>
  );
}

function Word({
  children,
  progress,
  range,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const { dimmedOpacity, blurPx, risePx } = motion.scrollWords;
  const opacity = useTransform(progress, range, [dimmedOpacity, 1]);
  const y = useTransform(progress, range, [risePx, 0]);
  const filter = useTransform(progress, range, [`blur(${blurPx}px)`, 'blur(0px)']);
  return (
    <animated.span data-scroll-word="" className="inline-block" style={{ opacity, y, filter }}>
      {children}
    </animated.span>
  );
}
