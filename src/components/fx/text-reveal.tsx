'use client';

import { motion, useAnimationControls, useInView } from 'framer-motion';
import { Fragment, useEffect, useRef } from 'react';

import { revealTransition, splitWords } from '@/lib/animations/scroll-reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/use-motion-preferences';

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
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
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
    </span>
  );
}
