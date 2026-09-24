/**
 * SCROLL WORDS — текст проявляется по словам в такт прокрутке, а не по таймеру.
 *
 * Слова стартуют приглушёнными и доходят до полной яркости, пока абзац идёт
 * через нижнюю половину экрана; прокрутка назад гасит их обратно. На сервере,
 * без JS и при просьбе убрать движение — обычный текст целиком: серверный
 * снимок `usePrefersReducedMotion` равен `true`.
 */

'use client';

import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Fragment, useRef } from 'react';

import { splitWords } from '@/lib/animations/scroll-reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

const DIMMED = 0.25;

export function ScrollWords({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.55'] });

  const parts = splitWords(children);
  const total = parts.filter((part) => !/^\s+$/u.test(part)).length;
  let word = 0;

  return (
    <span ref={ref}>
      {reduced
        ? children
        : parts.map((part, index) => {
            if (/^\s+$/u.test(part)) return <Fragment key={index}>{part}</Fragment>;
            const start = word++ / total;
            return (
              <Word key={index} progress={scrollYProgress} range={[start, start + 1 / total]}>
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
  const opacity = useTransform(progress, range, [DIMMED, 1]);
  return <motion.span style={{ opacity }}>{children}</motion.span>;
}
