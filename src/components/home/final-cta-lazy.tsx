'use client';

import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import { Link } from '@/i18n/routing';
import { ScrollSeal } from '@/components/fx/scroll-seal';
import { Reveal } from '@/components/fx/reveal';

export function FinalCtaLazy({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
}) {
  return (
    <section className="cinema-surface section-y relative text-center">
      <ScrollSeal />
      <Reveal variant="scale" className="page-container">
        <div
          aria-hidden
          className="relative mx-auto my-6 flex w-full max-w-5xl items-center justify-center select-none pointer-events-none"
        >
          <span
            aria-hidden="true"
            className="font-display font-black tracking-tighter uppercase text-center text-content-on-cinema text-5xl sm:text-6xl md:text-7xl lg:text-8xl opacity-50 select-none"
            style={{
              WebkitTextStroke: '1px color-mix(in srgb, var(--color-content-on-cinema) 65%, transparent)',
              textShadow: '0 0 25px rgba(255,255,255,0.1), 0 0 50px var(--accent-glow)',
            } as React.CSSProperties}
          >
            MOVE DIFFERENT
          </span>
        </div>
        <h2 className="text-heading-1 text-content-on-cinema">{title}</h2>
        <p className="text-body-lg mt-3 text-content-on-cinema-muted">{subtitle}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.discover()}>{primaryCta}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={routes.booking()}>{secondaryCta}</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
