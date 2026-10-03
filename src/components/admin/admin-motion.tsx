'use client';

/**
 * ADMIN MOTION — танцевальная плавность для инструмента.
 *
 * Все wrappers изолированы в клиенте, чтобы серверные DataTable/StatGrid
 * остались серверными (ноль гидратации ячеек). Анимация — только
 * transform + opacity, пружина без перелёта, stagger 52мс — волна сцены.
 * При prefers-reduced-motion — мгновенно в конечном состоянии.
 */

import { AnimatePresence, motion, useReducedMotion, type Easing } from 'framer-motion';
import type { ReactNode } from 'react';

import { motion as designMotion } from '@/design/motion';

const admin = designMotion.admin;
const adminEase = admin.ease as unknown as Easing;

// ---------------------------------------------------------------------------
// Reveal — одиночный блок (header, секция, фильтр)
// ---------------------------------------------------------------------------
export function AdminReveal({
  children,
  delay = 0,
  y = admin.card.yPx,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y, scale: admin.card.scaleFrom }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: admin.durationMs.enter / 1000,
        delay: delay / 1000,
        ease: adminEase,
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stagger контейнер + элемент
// ---------------------------------------------------------------------------
export function AdminStagger({
  children,
  className,
  baseDelayMs = admin.stagger.baseDelayMs,
  stepMs = admin.stagger.stepMs,
}: {
  children: ReactNode;
  className?: string;
  baseDelayMs?: number;
  stepMs?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stepMs / 1000,
            delayChildren: baseDelayMs / 1000,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AdminStaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: admin.card.yPx, scale: admin.card.scaleFrom },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: admin.durationMs.enter / 1000,
            ease: adminEase,
          },
        },
      }}
      className={className}
      style={{ willChange: 'transform, opacity' }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Fade + scale для карточки/строки — используется внутри StaggerItem при
// необходимости более плотной пружины.
// ---------------------------------------------------------------------------
export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: admin.card.yPx, scale: admin.card.scaleFrom },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: admin.spring as unknown as Record<string, unknown>,
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Page transition — мягкий кроссфейд между страницами админки.
// Обёртка вокруг <main>. Не блокирует навигацию, уважает reduced-motion.
// ---------------------------------------------------------------------------
export function AdminPageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="admin-page"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: adminEase }}
        style={{ willChange: 'opacity, transform' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
