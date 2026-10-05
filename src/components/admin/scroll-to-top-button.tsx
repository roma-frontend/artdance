'use client';

/**
 * SCROLL TO TOP BUTTON — танцевальная пружина, spring без рывка.
 */

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { motion as designMotion } from '@/design/motion';

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 400);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: reduce ? 'instant' : 'smooth' });
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="scroll-top"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
          transition={reduce ? { duration: 0.15 } : (designMotion.admin.spring as unknown as Record<string, unknown>)}
          className="fixed bottom-14 right-6 z-sticky"
          style={{ willChange: 'transform, opacity' }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={scrollToTop}
            aria-label="Scroll to top"
            className="size-10 rounded-full p-0 shadow-lg backdrop-blur-md border-border-strong bg-surface-card/95 hover:border-accent hover:text-content-accent"
          >
            <ArrowUp className="size-4" />
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
