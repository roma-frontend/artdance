'use client';

/**
 * FINAL CTA OUTLINE TEXT (MOVE DIFFERENT)
 *
 * Элегантная контурная надпись «MOVE DIFFERENT» с прозрачной заливкой,
 * аккуратным штрихом и мягким свечением в стилистике ARTDANCE.
 */

import { cn } from '@/lib/utils';
import type { VideoRef } from '@/domain/content';

interface FinalCtaVideoTextProps {
  video?: VideoRef | null;
  text?: string;
  className?: string;
}

export function FinalCtaVideoText({
  text = 'MOVE DIFFERENT',
  className,
}: FinalCtaVideoTextProps) {
  return (
    <div
      data-slot="final-cta-video-text"
      className={cn(
        'relative mx-auto my-6 flex w-full max-w-5xl items-center justify-center select-none pointer-events-none',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="font-display font-black tracking-tighter uppercase text-center text-transparent text-5xl sm:text-6xl md:text-7xl lg:text-8xl opacity-30 select-none"
        style={{
          WebkitTextStroke: '1.5px color-mix(in srgb, var(--color-content-on-cinema) 80%, transparent)',
          textShadow: '0 0 25px rgba(255, 255, 255, 0.1), 0 0 50px var(--accent-glow)',
        }}
      >
        {text}
      </span>
    </div>
  );
}
