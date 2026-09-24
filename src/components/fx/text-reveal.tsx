'use client';

import { motion, useAnimationControls, useInView } from 'framer-motion';
import { Fragment, useEffect, useRef } from 'react';

import { revealTransition, splitWords } from '@/lib/animations/scroll-reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

/**
 * TEXT REVEAL — пословное появление заголовка.
 *
 * Одна копия текста, без sr-only-дубля. Слова — инлайновые блоки внутри строки:
 * скринридер читает их в порядке следования, а дубль для вспомогательных
 * технологий ломал проверки заголовков — доступное имя и textContent удваивались
 * («Hip-Hop classes in YerevanHip-Hop classes in Yerevan»), и e2e-тесты падали
 * на честном ожидании «заголовок называет направление и город».
 *
 * `data-reveal-word` на словах — точка расширения: шапка навешивает на слова
 * заголовка золотой блик (`.hero-shine` в globals.css), а reduced-motion и
 * no-JS-режим сбрасывают слова в видимое состояние через `[data-reveal-word]`.
 */
export function TextReveal({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const controls = useAnimationControls();
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.1 });
  const started = useRef(false);

  useEffect(() => {
    if (reduced) {
      controls.stop();
      controls.set('visible');
      return;
    }
    if (started.current) return;
    controls.set('hidden');
    if (inView) {
      started.current = true;
      void controls.start('visible');
    }
  }, [controls, inView, reduced]);

  let word = 0;
  return (
    <span ref={ref} data-text-reveal="">
      {splitWords(children).map((part, index) => /^\s+$/u.test(part) ? (
        <Fragment key={index}>{part}</Fragment>
      ) : (
        <motion.span
          key={index}
          data-reveal-word=""
          className="inline-block"
          initial={false}
          animate={controls}
          custom={word++}
          variants={{
            hidden: { opacity: 0, y: 12, filter: 'blur(10px)' },
            visible: (order: number) => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: revealTransition(order) }),
          }}
        >
          {part}
        </motion.span>
      ))}
    </span>
  );
}
