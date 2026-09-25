/**
 * HERO — первый экран лендинга.
 */

import { getTranslations } from 'next-intl/server';
import type { CSSProperties, ReactNode } from 'react';

import { HeroVideo } from '@/components/home/hero-video';
import { HeroParallaxFX } from '@/components/home/hero-parallax-fx';
import { TextReveal } from '@/components/fx/text-reveal';
import { Button } from '@/components/ui/button';
import { routes } from '@/config';
import type { HomeContent } from '@/domain/content';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const HERO_ENTER_ORDER = ['badge', 'title', 'subtitle', 'actions'] as const;

function heroEnterOrder(name: (typeof HERO_ENTER_ORDER)[number]): CSSProperties {
  const index = HERO_ENTER_ORDER.indexOf(name);
  return { '--hero-enter-index': index } as CSSProperties;
}

interface HeroSectionProps {
  hero: HomeContent['hero'];
  locale: Locale;
  children?: ReactNode;
  className?: string;
}

export async function HeroSection({ hero, locale, children, className }: HeroSectionProps) {
  const t = await getTranslations('home.hero');

  return (
    <section className={cn('hero-viewport cinema-surface relative overflow-hidden', className)}>
      <HeroParallaxFX />

      <HeroVideo video={hero.video} poster={hero.image} locale={locale} />

      {/*
        Контурное слово ARTDANCE — нижний план глубины.
        Теперь над ним нет цифр, текст поднят выше, и слово открыто полностью!
      */}
      <span aria-hidden data-hero-depth="word" className="hero-depth-word">
        ARTDANCE
      </span>

      <div aria-hidden className="hero-scrim absolute inset-0 z-[1]" />
      <div aria-hidden data-slot="hero-light-sweep" className="hero-light-sweep" />

      {/* Кнопка поиска в самом правом верхнем углу первого экрана */}
      {children !== undefined && (
        <div className="absolute top-24 right-5 z-20 md:top-28 md:right-8 lg:right-12">
          {children}
        </div>
      )}

      {/* Контент сбалансированно центрирован по вертикали без лишнего задирания наверх */}
      <div className="hero-content page-container relative z-10 flex flex-1 flex-col items-start justify-center pt-24 pb-14 md:pt-28 md:pb-18">
        <p style={heroEnterOrder('badge')} className="text-eyebrow text-metal mb-4 inline-flex items-center gap-2 rounded-full border border-metal-soft px-4 py-1.5 md:mb-6">
          {t('badge')}
        </p>

        <h1 style={heroEnterOrder('title')} className="text-display-hero mb-3 max-w-3xl text-content-on-cinema md:mb-5">
          <TextReveal>{t('titleLine1')}</TextReveal>
          <br />
          <em data-hero-shine className="hero-shine text-accent-on-cinema italic"><TextReveal>{t('titleAccent')}</TextReveal></em>
        </h1>

        <p style={heroEnterOrder('subtitle')} className="text-body md:text-body-lg mb-6 max-w-lg text-content-on-cinema-muted md:mb-8">
          <TextReveal>{t('subtitle')}</TextReveal>
        </p>

        <div style={heroEnterOrder('actions')} className="flex flex-wrap gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.discover()}>{t('primaryCta')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema" className="liquid-glass">
            <Link href={routes.instructors()}>{t('secondaryCta')}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
