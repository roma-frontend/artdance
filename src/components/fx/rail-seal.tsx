'use client';

import { cn } from '@/lib/utils';

interface RailSealProps {
  className?: string;
  text?: string;
}

export function RailSeal({
  className,
  text = 'ARTDANCE · DISCOVER · ALL STYLES · ',
}: RailSealProps) {
  return (
    <span
      data-slot="rail-seal"
      aria-hidden="true"
      className={cn('pointer-events-none select-none inline-block text-content-metal', className)}
    >
      <svg width="88" height="88" viewBox="0 0 100 100" focusable="false" className="size-20">
        <defs>
          <path
            id="rail-seal-circle"
            d="M 50 50 m -36 0 a 36 36 0 1 1 72 0 a 36 36 0 1 1 -72 0"
            fill="none"
          />
        </defs>
        <circle cx="50" cy="50" r="48" className="fill-none stroke-current opacity-25" strokeWidth="1" />
        <circle cx="50" cy="50" r="26" className="fill-none stroke-accent opacity-40" strokeWidth="1" />
        <polygon points="50,38 53,47 62,50 53,53 50,62 47,53 38,50 47,47" className="fill-accent opacity-75" />
        <text className="fill-current text-caption font-semibold uppercase tracking-widest" style={{ letterSpacing: '0.28em' }}>
          <textPath href="#rail-seal-circle">{text}</textPath>
        </text>
      </svg>
    </span>
  );
}
