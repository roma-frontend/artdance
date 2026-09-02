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

import { Button } from '@/components/ui/button';
import { Media } from '@/components/ui/media';
import { features, orderedSubscriptionPlans, routes, site } from '@/config';
import { danceStyleLabelKey, danceStyles } from '@/domain/enums';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/config';

/** Показатели главной. Значения придут из аналитики; структура фиксирована здесь. */
const heroStats = [
  { id: 'activeDancers', labelKey: 'statActiveDancers', value: 2500, suffix: '+' },
  { id: 'instructors', labelKey: 'statInstructors', value: 150, suffix: '+' },
  { id: 'styles', labelKey: 'statStyles', value: danceStyles.length, suffix: '+' },
  { id: 'rating', labelKey: 'statRating', value: 4.9, suffix: '' },
] as const;

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');
  const tStyles = await getTranslations();
  const tBrand = await getTranslations('brand');
  const tPricing = await getTranslations('pricing');
  const format = await getFormatter();

  return (
    <main id="content">
      {/* ── HERO: всегда кинематографичная тёмная плоскость, независимо от темы ── */}
      <section className="cinema-surface relative flex min-h-dvh items-center overflow-hidden">
        <Media
          src="hero-dancer"
          alt={t('hero.imageAlt')}
          preset="heroFullBleed"
          className="absolute inset-0 z-0 size-full"
          imageClassName="opacity-75"
          fill
          priority
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
            {heroStats.map((stat) => (
              <div key={stat.id}>
                <dd className="text-heading-3 text-content-on-cinema">
                  <span className="text-metal">
                    {stat.id === 'rating'
                      ? format.number(stat.value, 'rating')
                      : format.number(stat.value, 'plain')}
                  </span>
                  {stat.suffix}
                </dd>
                <dt className="text-eyebrow mt-1 text-content-on-cinema-muted">
                  {t(`hero.${stat.labelKey}` as 'hero.statActiveDancers')}
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
          <header className="mx-auto mb-12 max-w-xl text-center">
            <p className="text-eyebrow text-accent mb-3">{t('discover.eyebrow')}</p>
            <h2 className="text-heading-2 mb-3">{t('discover.title')}</h2>
            <p className="text-body text-content-secondary">
              {t('discover.subtitle', { styles: danceStyles.length })}
            </p>
          </header>

          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {danceStyles.slice(0, 5).map((style) => (
              <li key={style}>
                <Link
                  href={routes.discover({ style })}
                  className="flex aspect-[3/4] items-end rounded-lg border border-border-default bg-surface-sunken p-5 transition-colors duration-300 ease-brand hover:border-accent"
                >
                  <span className="text-card-title">
                    {tStyles(danceStyleLabelKey(style) as 'danceStyles.hipHop')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── EDITORIAL: цитата брендгайда как полноэкранное заявление ── */}
      <section
        className="cinema-surface text-center"
        style={{ paddingBlock: 'var(--layout-section-y-wide)' }}
      >
        <div className="page-container">
          <h2 className="text-display-editorial uppercase">
            {t('editorial.titleLine1')} {t('editorial.titleLine2')}{' '}
            <span className="text-accent">{t('editorial.titleAccent')}</span>
          </h2>
          <p className="text-body-lg mt-4 text-content-on-cinema-muted">{t('editorial.subtitle')}</p>
          <Button asChild className="mt-8" size="lg" variant="accent">
            <Link href={routes.classes()}>{t('editorial.cta')}</Link>
          </Button>
        </div>
      </section>

      {/* ── PRICING: суммы и квоты приходят из config/pricing, не из разметки ── */}
      {features.subscriptions && (
        <section className="section-y bg-surface-raised">
          <div className="page-container">
            <header className="mx-auto mb-12 max-w-xl text-center">
              <p className="text-eyebrow text-accent mb-3">{tPricing('eyebrow')}</p>
              <h2 className="text-heading-2 mb-3">{tPricing('title')}</h2>
              <p className="text-body text-content-secondary">{tPricing('subtitle')}</p>
            </header>

            <ul className="grid gap-6 lg:grid-cols-3">
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
                    <p className="text-eyebrow text-accent mb-4">{tPricing('mostPopular')}</p>
                  )}
                  <h3 className="text-card-title mb-2">
                    {tPricing(`plans.${plan.id}.name` as 'plans.pro.name')}
                  </h3>
                  <p className="text-body-sm mb-6 text-content-secondary">
                    {tPricing(`plans.${plan.id}.description` as 'plans.pro.description')}
                  </p>
                  <p className="text-heading-3">
                    {format.number(plan.price.MONTHLY, 'price')}
                    <span className="text-body-sm text-content-tertiary">
                      {' '}
                      {tPricing('perMonth')}
                    </span>
                  </p>
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
            </ul>
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
