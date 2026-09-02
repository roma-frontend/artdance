/**
 * Лендинг — вертикальный срез архитектуры.
 *
 * Задача этой страницы на этапе подготовки: доказать, что вся цепочка работает
 * от конца до конца и что в разметке НЕТ ни текста, ни цветов, ни путей:
 *   • текст  → i18n (`useTranslations`)
 *   • цифры  → `businessRules` / `pricing` + `useFormatter`
 *   • цвета  → семантические токен-утилиты Tailwind
 *   • ссылки → `routes`
 *   • фичи   → `features`
 *
 * Полная вёрстка секций из прототипа делается на этапе реализации.
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { HeroVideo } from '@/components/home/hero-video';
import { Reveal } from '@/components/fx/reveal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { SectionHeading } from '@/components/ui/section-heading';
import { features, orderedSubscriptionPlans, routes, site } from '@/config';
import { danceStyleLabelKey, danceStyles } from '@/domain/enums';
import { resolveMedia } from '@/domain/content';
import { Link } from '@/i18n/routing';
import { getHomeContent } from '@/server/content/home';
import type { Locale } from '@/i18n/config';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const content = getHomeContent();
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');
  const tStyles = await getTranslations();
  const tBrand = await getTranslations('brand');
  const tPricing = await getTranslations('pricing');
  const format = await getFormatter();

  return (
    <main id={site.mainContentId}>
      {/* ── HERO: всегда кинематографичная тёмная плоскость, независимо от темы ── */}
      <section className="cinema-surface relative flex min-h-dvh items-center overflow-hidden">
        <HeroVideo
          video={content.hero.video}
          poster={content.hero.image}
          locale={locale as Locale}
          labels={{ play: t('hero.videoPlay'), pause: t('hero.videoPause') }}
        />
        <div
          aria-hidden
          className="absolute inset-0 z-[1]"
          style={{ background: 'var(--scrim-hero-diagonal)' }}
        />
        <div className="page-container relative z-10 pt-32 pb-20">
          <p className="text-eyebrow text-metal mb-8 inline-flex items-center gap-2 rounded-full border border-metal-soft px-4 py-1.5">
            {t('hero.badge')}
          </p>

          <h1 className="text-display-hero mb-6 max-w-3xl text-content-on-cinema">
            {t('hero.titleLine1')}
            <br />
            <em className="text-accent not-italic italic">{t('hero.titleAccent')}</em>
          </h1>

          <p className="text-body-lg mb-10 max-w-lg text-content-on-cinema-muted">
            {t('hero.subtitle')}
          </p>

          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" variant="accent">
              <Link href={routes.discover()}>{t('hero.primaryCta')}</Link>
            </Button>
            <Button asChild size="lg" variant="onCinema">
              <Link href={routes.instructors()}>{t('hero.secondaryCta')}</Link>
            </Button>
          </div>

          <dl className="mt-16 flex flex-wrap gap-12 border-t border-border-on-cinema pt-6">
            {content.hero.stats.map((stat) => (
              <div key={stat.id}>
                <dd className="text-heading-3 text-content-on-cinema">
                  <span className="text-metal">
                    {stat.decimals > 0
                      ? format.number(stat.value, 'rating')
                      : format.number(stat.value, 'plain')}
                  </span>
                  {stat.suffix}
                </dd>
                <dt className="text-eyebrow mt-1 text-content-on-cinema-muted">
                  {t(`hero.stat${stat.id.charAt(0).toUpperCase()}${stat.id.slice(1)}` as 'hero.statActiveDancers')}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── MARQUEE: направления танца берутся из домена, не из вёрстки ── */}
      <div className="overflow-hidden bg-accent py-3" aria-hidden>
        <div className="flex gap-8 whitespace-nowrap px-6">
          {danceStyles.slice(0, 10).map((style) => (
            <span
              key={style}
              className="text-eyebrow text-content-on-accent/85 flex items-center gap-3"
            >
              {tStyles(danceStyleLabelKey(style) as 'danceStyles.hipHop')}
              <i className="size-1 shrink-0 rounded-full bg-metal" />
            </span>
          ))}
        </div>
      </div>

      {/* ── DISCOVER ── */}
      <section className="section-y">
        <div className="page-container">
          <Reveal as="div" className="mb-12">
            <SectionHeading
              align="center"
              eyebrow={t('discover.eyebrow')}
              title={t('discover.title')}
              subtitle={t('discover.subtitle', { styles: danceStyles.length })}
              className="mb-0"
            />
          </Reveal>

          <Reveal as="ul" variant="stagger" className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {content.styleTiles.map((tile) => (
              <li key={tile.style}>
                <Link
                  href={routes.discover({ style: tile.style })}
                  className="group relative flex aspect-[3/4] items-end overflow-hidden rounded-lg border border-border-default transition-colors duration-300 ease-brand hover:border-accent"
                >
                  <Media
                    {...resolveMedia(tile.image, locale as Locale)}
                    preset="categoryCard"
                    fill
                    className="absolute inset-0 size-full"
                    imageClassName="transition-transform duration-slow ease-brand group-hover:scale-105"
                  />
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: 'var(--scrim-card-bottom)' }}
                  />
                  <span className="relative z-10 p-5 text-card-title text-content-on-cinema">
                    {tStyles(danceStyleLabelKey(tile.style as never) as 'danceStyles.hipHop')}
                    <span className="text-caption mt-1 block text-content-on-cinema-muted">
                      {tCommon('counts.classes', { count: tile.classCount })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── EDITORIAL: цитата брендгайда как полноэкранное заявление ── */}
      <section
        className="cinema-surface text-center"
        style={{ paddingBlock: 'var(--layout-section-y-wide)' }}
      >
        <Reveal variant="scale" className="page-container">
          <h2 className="text-display-editorial uppercase">
            {t('editorial.titleLine1')} {t('editorial.titleLine2')}{' '}
            <span className="text-accent">{t('editorial.titleAccent')}</span>
          </h2>
          <p className="text-body-lg mt-4 text-content-on-cinema-muted">{t('editorial.subtitle')}</p>
          <Button asChild className="mt-8" size="lg" variant="accent">
            <Link href={routes.classes()}>{t('editorial.cta')}</Link>
          </Button>
        </Reveal>
      </section>

      {/* ── PRICING: суммы и квоты приходят из config/pricing, не из разметки ── */}
      {features.subscriptions && (
        <section className="section-y bg-surface-raised">
          <div className="page-container">
            <Reveal as="div" className="mb-12">
              <SectionHeading
                align="center"
                eyebrow={tPricing('eyebrow')}
                title={tPricing('title')}
                subtitle={tPricing('subtitle')}
                className="mb-0"
              />
            </Reveal>

            <Reveal as="ul" variant="stagger" className="grid gap-6 lg:grid-cols-3">
              {orderedSubscriptionPlans.map((plan) => (
                <li
                  key={plan.id}
                  className={
                    plan.highlighted
                      ? 'rounded-xl border-2 border-accent bg-surface-card p-8 shadow-lg'
                      : 'rounded-xl border border-border-default bg-surface-card p-8'
                  }
                >
                  {plan.highlighted && (
                    <Badge variant="accent" className="mb-4">
                      {tPricing('mostPopular')}
                    </Badge>
                  )}
                  <h3 className="text-card-title mb-2">
                    {tPricing(`plans.${plan.id}.name` as 'plans.pro.name')}
                  </h3>
                  <p className="text-body-sm mb-6 text-content-secondary">
                    {tPricing(`plans.${plan.id}.description` as 'plans.pro.description')}
                  </p>
                  <Price amount={plan.price.MONTHLY} unit="perMonth" emphasis="total" />
                  <Button
                    asChild
                    block
                    className="mt-8"
                    variant={plan.highlighted ? 'accent' : 'outline'}
                  >
                    <Link href={routes.pricing()}>
                      {tPricing('selectCta', {
                        plan: tPricing(`plans.${plan.id}.name` as 'plans.pro.name'),
                      })}
                    </Link>
                  </Button>
                </li>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ── FOOTER (сокращённый): бренд и год не хардкодятся ── */}
      <footer className="border-t border-border-default bg-surface-raised py-12">
        <div className="page-container">
          <p className="text-card-title">{tBrand('name')}</p>
          <p className="text-body-sm mt-2 max-w-sm text-content-tertiary">{tBrand('tagline')}</p>
          <p className="text-caption mt-8 text-content-tertiary">
            {tCommon('labels.language')}: {locale.toUpperCase()} · {site.domains.primary}
          </p>
        </div>
      </footer>
    </main>
  );
}
