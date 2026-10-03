'use client';

import { FinalCtaVideoText } from '@/components/home/final-cta-video-text';
import { Button } from '@/components/ui/button';
import { TextReveal } from '@/components/fx/text-reveal';
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
        <FinalCtaVideoText text="MOVE DIFFERENT" />
        <h2 className="text-heading-1 text-content-on-cinema"><TextReveal>{title}</TextReveal></h2>
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
