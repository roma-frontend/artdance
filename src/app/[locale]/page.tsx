/**
 * Лендинг — сборка секций, и только она.
 *
 * В этом файле нет ни текста, ни цветов, ни путей, ни размеров. Он решает
 * ровно одну задачу: в каком порядке идут секции и какие данные каждая получает.
 *   • текст  → i18n (`useTranslations`)
 *   • цифры  → `businessRules` / `pricing` + `useFormatter`
 *   • цвета  → семантические токен-утилиты Tailwind
 *   • ссылки → `routes`
 *   • фичи   → `features`
 *   • медиа  → `getHomeContent()` (единственный шов с будущей базой и админкой)
 *
 * Разметка секции живёт в компоненте секции. Здесь остаются только те блоки,
 * которые сводятся к «заголовок + сетка карточек»: у них нет собственного
 * поведения, и отдельный файл на каждый добавил бы уровень косвенности, ничего
 * не спрятав.
 */

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HeroSection } from '@/components/home/hero-section';
import { HeroSearchBar } from '@/components/home/hero-search-bar';
import { EditorialStatement } from '@/components/home/editorial-statement';
import { NewsletterSection } from '@/components/home/newsletter-section';
import { StyleMarquee } from '@/components/home/style-marquee';
import { TestimonialCard } from '@/components/home/testimonial-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { Reveal } from '@/components/fx/reveal';
import { ClassCard } from '@/components/catalog/class-card';
import { ClassCarousel } from '@/components/catalog/class-carousel';
import { EventCard } from '@/components/catalog/event-card';
import { InstructorCard } from '@/components/catalog/instructor-card';
import { StyleTileGrid } from '@/components/catalog/style-tile-grid';
import { VenueCard } from '@/components/catalog/venue-card';
import { ProductCard } from '@/components/shop/product-card';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { SectionHeading } from '@/components/ui/section-heading';
import {
  features,
  orderedSubscriptionPlans,
  routes,
  site,
  subscriptionPlanDescriptionKey,
  subscriptionPlanNameKey,
} from '@/config';
import { danceStyles } from '@/domain/enums';
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
  const tPricing = await getTranslations('pricing');
  /** Корневой переводчик — для ключей, собранных из данных (`MessageKey`). */
  const tRoot = await getTranslations();

  return (
    <main id={site.mainContentId}>
      {/* ── HERO: тёмная плоскость в обеих темах, поиск внутри первого экрана ── */}
      <HeroSection hero={content.hero} locale={locale as Locale}>
        {/* Отсюда же вырастет ассистент: запрос уходит в URL, а не в состояние. */}
        <HeroSearchBar />
      </HeroSection>

      {/* ── MARQUEE: направления берутся из домена, не из вёрстки ── */}
      <StyleMarquee />

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

          <StyleTileGrid tiles={content.styleTiles} locale={locale as Locale} />
        </div>
      </section>

      {/* ── POPULAR: горизонтальная лента занятий ── */}
      <section className="section-y bg-surface-raised">
        <div className="page-container">
          <Reveal variant="left" className="mb-8">
            <SectionHeading
              eyebrow={t('popular.eyebrow')}
              title={t('popular.title')}
              subtitle={t('popular.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal variant="right">
            <ClassCarousel label={t('popular.title')}>
              {content.popularClasses.map((item) => (
                /*
                 * Карточка эластична, как в макете (`min-width: 260px;
                 * max-width: 300px`): на широком экране четыре карточки
                 * растягиваются и заполняют строку без обрезанного края, на
                 * узком — сохраняют минимум и лента начинает прокручиваться.
                 */
                <li key={item.slug} className="max-w-75 shrink-0 grow basis-65 snap-start">
                  <CardTilt>
                    <ClassCard item={item} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </ClassCarousel>
          </Reveal>
        </div>
      </section>

      {/* ── EDITORIAL: цитата брендгайда как полноэкранное заявление ── */}
      <EditorialStatement
        video={content.editorial.video}
        image={content.editorial.image}
        locale={locale as Locale}
      />

      {/* ── INSTRUCTORS ── */}
      <section className="section-y">
        <div className="page-container">
          <Reveal className="mb-12">
            <SectionHeading
              align="center"
              eyebrow={t('instructors.eyebrow')}
              title={t('instructors.title')}
              subtitle={t('instructors.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal
            as="ul"
            variant="stagger"
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {content.instructors.slice(0, 4).map((item) => (
              <li key={item.slug}>
                <CardTilt>
                  <InstructorCard item={item} locale={locale as Locale} />
                </CardTilt>
              </li>
            ))}
          </Reveal>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={routes.instructors()}>{tCommon('actions.viewAll')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── STUDIOS ── */}
      <section className="section-y bg-surface-raised">
        <div className="page-container">
          <Reveal className="mb-12">
            <SectionHeading
              align="center"
              eyebrow={t('studios.eyebrow')}
              title={t('studios.title')}
              subtitle={t('studios.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal as="ul" variant="stagger" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {content.venues.map((item) => (
              <li key={item.slug}>
                <CardTilt>
                  <VenueCard item={item} locale={locale as Locale} />
                </CardTilt>
              </li>
            ))}
          </Reveal>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href={routes.studios()}>{tCommon('actions.viewAll')}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── SHOP: раздел появляется только при включённом модуле ── */}
      {features.shop && (
        <section className="section-y">
          <div className="page-container">
            <Reveal className="mb-12">
              <SectionHeading
                eyebrow={t('shop.eyebrow')}
                title={t('shop.title')}
                subtitle={t('shop.subtitle')}
                className="mb-0"
              />
            </Reveal>

            <Reveal as="ul" variant="stagger" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {content.products.slice(0, 4).map((item) => (
                <li key={item.slug}>
                  <CardTilt>
                    <ProductCard item={item} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </Reveal>

            <div className="mt-10 text-center">
              <Button asChild variant="outline">
                <Link href={routes.shop()}>{tCommon('actions.viewAll')}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── EVENTS ── */}
      {features.events && (
        <section className="section-y bg-surface-raised">
          <div className="page-container">
            <Reveal className="mb-12">
              <SectionHeading
                eyebrow={t('events.eyebrow')}
                title={t('events.title')}
                subtitle={t('events.subtitle')}
                className="mb-0"
              />
            </Reveal>

            <Reveal as="ul" variant="stagger" className="grid gap-5 md:grid-cols-3">
              {content.events.map((item) => (
                <li key={item.slug}>
                  <CardTilt>
                    <EventCard item={item} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </Reveal>

            <div className="mt-10 text-center">
              <Button asChild variant="outline">
                <Link href={routes.events()}>{tCommon('actions.viewAll')}</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS ── */}
      <section className="section-y">
        <div className="page-container">
          <Reveal className="mb-12">
            <SectionHeading
              align="center"
              eyebrow={t('testimonials.eyebrow')}
              title={t('testimonials.title')}
              subtitle={t('testimonials.subtitle')}
              className="mb-0"
            />
          </Reveal>

          <Reveal as="ul" variant="stagger" className="grid gap-5 md:grid-cols-3">
            {content.testimonials.map((item) => (
              <li key={item.id}>
                <TestimonialCard item={item} locale={locale as Locale} />
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA: последнее предложение перед подвалом ── */}
      <section className="cinema-surface section-y text-center">
        <Reveal variant="scale" className="page-container">
          <h2 className="text-heading-1 text-content-on-cinema">{t('finalCta.title')}</h2>
          <p className="text-body-lg mt-3 text-content-on-cinema-muted">{t('finalCta.subtitle')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button asChild size="lg" variant="accent">
              <Link href={routes.discover()}>{t('finalCta.primaryCta')}</Link>
            </Button>
            <Button asChild size="lg" variant="onCinema">
              <Link href={routes.booking()}>{t('finalCta.secondaryCta')}</Link>
            </Button>
          </div>
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
                    {tRoot(subscriptionPlanNameKey(plan.id))}
                  </h3>
                  <p className="text-body-sm mb-6 text-content-secondary">
                    {tRoot(subscriptionPlanDescriptionKey(plan.id))}
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
                        plan: tRoot(subscriptionPlanNameKey(plan.id)),
                      })}
                    </Link>
                  </Button>
                </li>
              ))}
            </Reveal>
          </div>
        </section>
      )}

      {/* ── NEWSLETTER: последний шанс остаться на связи, перед подвалом ── */}
      <NewsletterSection locale={locale as Locale} source="home" />

      {/* ── FOOTER: колонки из слоя навигации, год из системного времени ── */}
      <SiteFooter />
    </main>
  );
}
