/**
 * ПЛОЩАДКА — детальная страница зала.
 *
 * Что решено осознанно.
 *
 * **Главное действие здесь — не аренда.** Аренда зала (`/studios/[slug]/book`,
 * `venue.minRentalMinutes`) приходит вместе с движком доступности — это фаза 3
 * плана. Ссылка на несуществующий маршрут была бы 404 в каталоге, а кнопка,
 * которая ничего не делает, хуже её отсутствия. Поэтому первичное действие —
 * «занятия здесь»: они бронируются уже сегодня, через инструктора. Аренда стоит
 * рядом ценой и выключенной кнопкой с объяснением (`common.states.comingSoon`) —
 * тем же приёмом, что недоступный способ оплаты на оформлении заказа.
 *
 * **Залов внутри площадки нет.** Инвентарь экранов обещает «залы», но в данных
 * заказчика у площадки одна площадь и одна вместимость. Придумать три зала ради
 * красивой таблицы значило бы показать то, чего в его базе нет; поле появится
 * вместе с `VenueRoom`.
 *
 * **Карта — ссылка, а не встроенный фрейм.** Встроенная карта требует
 * `NEXT_PUBLIC_MAPS_API_KEY` и стоит отдельной задачей (2.10 плана). Ссылка по
 * координатам работает без ключа и нужна независимо от неё: маршрут человек всё
 * равно строит в своём приложении.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExternalLinkIcon, MapPinIcon } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ClassCard } from '@/components/catalog/class-card';
import { EventCard } from '@/components/catalog/event-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { ReviewList } from '@/components/reviews/review-list';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Price } from '@/components/ui/price';
import { RatingStars } from '@/components/ui/rating-stars';
import { directionsUrl, routes, site } from '@/config';
import { venueAmenityLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema, localBusinessSchema, type Crumb } from '@/lib/seo/jsonld';
import { Link } from '@/i18n/routing';
import { getCatalogSlugs, getVenueDetail } from '@/server/content/catalog';

/** Якорь на раздел занятий: он и есть доступное действие страницы. */
const CLASSES_ANCHOR = 'classes';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return getCatalogSlugs().venues.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = getVenueDetail(slug);
  if (!item) return {};

  return buildMetadata({
    locale: locale as Locale,
    path: routes.studio(slug),
    title: `${item.name} — ${item.district}`,
    description: item.description,
  });
}

export default async function StudioDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = getVenueDetail(slug);
  if (!item) notFound();

  const t = await getTranslations('studio');
  const tRoot = await getTranslations();
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations('nav');
  const tReviews = await getTranslations('reviews');

  /** Подписи оснащения нужны и разметке, и структурированным данным. */
  const amenityLabels = item.amenities.map((amenity) =>
    tRoot(venueAmenityLabelKey(amenity as never)),
  );

  /** Один путь на страницу: и в крошках, и в структурированных данных. */
  const trail: Crumb[] = [
    { name: tNav('studios'), path: routes.studios() },
    { name: item.name, path: routes.studio(item.slug) },
  ];

  return (
    <main id={site.mainContentId}>
      <JsonLdScript
        schema={[
          localBusinessSchema(locale as Locale, item, amenityLabels),
          breadcrumbSchema(locale as Locale, trail),
        ]}
      />

      <PageHero
        title={item.name}
        eyebrow={item.district}
        subtitle={item.description}
        image={item.image}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      >
        <div className="flex flex-wrap items-center gap-5">
          <Price amount={item.pricePerHour} unit="perHour" emphasis="onCinema" />
        </div>
      </PageHero>

      <div className="page-container py-12 md:py-16">
        <div className="detail-grid">
          {/* ── Содержимое ── */}
          <div className="min-w-0">
            <section className="mb-12">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-heading-3">{t('aboutTitle')}</h2>
                <FavoriteButton target="venue" slug={item.slug} name={item.name} />
              </div>

              <p className="text-body-lg max-w-(--layout-prose-max-width) text-content-secondary">
                {item.description}
              </p>

              <dl className="mt-6 grid gap-4 xs:grid-cols-2">
                <div className="rounded-md border border-border-default bg-surface-card px-4 py-3">
                  <dt className="text-caption text-content-tertiary">{t('areaLabel')}</dt>
                  <dd className="text-body mt-1 font-semibold text-content-primary">
                    {tCommon('units.squareMeters', { value: item.areaSqm })}
                  </dd>
                </div>
                <div className="rounded-md border border-border-default bg-surface-card px-4 py-3">
                  <dt className="text-caption text-content-tertiary">
                    {tCommon('labels.capacity')}
                  </dt>
                  <dd className="text-body mt-1 font-semibold text-content-primary">
                    {t('capacityNote', { count: item.capacity })}
                  </dd>
                </div>
              </dl>
            </section>

            {item.amenities.length > 0 && (
              <section className="mb-12">
                <h2 className="text-heading-3 mb-4">{t('amenitiesTitle')}</h2>
                <ul className="flex flex-wrap gap-2">
                  {item.amenities.map((amenity, index) => (
                    <li key={amenity}>
                      <Badge size="md">{amenityLabels[index]}</Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Занятия здесь ── */}
            <section id={CLASSES_ANCHOR} className="mb-12 scroll-mt-(--layout-nav-height)">
              <h2 className="text-heading-3 mb-6">{t('classesTitle')}</h2>

              {item.classes.length === 0 ? (
                <p
                  role="status"
                  className="text-body rounded-lg border border-dashed border-border-default bg-surface-raised px-6 py-10 text-center text-content-secondary"
                >
                  {t('classesEmpty')}
                </p>
              ) : (
                <ul className="grid gap-5 xs:grid-cols-2">
                  {item.classes.map((entry) => (
                    <li key={entry.slug}>
                      <CardTilt>
                        <ClassCard item={entry} locale={locale as Locale} />
                      </CardTilt>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Афиша зала показывается только если она есть: пустой блок «События
                здесь» читается как незагрузившийся. */}
            {item.events.length > 0 && (
              <section className="mb-12">
                <h2 className="text-heading-3 mb-6">{t('eventsTitle')}</h2>
                <ul className="grid gap-5 xs:grid-cols-2">
                  {item.events.map((entry) => (
                    <li key={entry.slug}>
                      <CardTilt>
                        <EventCard item={entry} locale={locale as Locale} />
                      </CardTilt>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Как добраться ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('mapTitle')}</h2>

              <div className="rounded-lg border border-border-default bg-surface-card p-6">
                <p className="text-body flex items-center gap-2 text-content-primary">
                  <MapPinIcon aria-hidden className="size-4 shrink-0 text-content-accent" />
                  {item.district}
                  {' · '}
                  {site.address.city}
                </p>

                <a
                  href={directionsUrl(item.latitude, item.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-body-sm mt-4 inline-flex items-center gap-2 font-semibold text-content-accent underline"
                >
                  {t('mapTitle')}
                  <ExternalLinkIcon aria-hidden className="size-3.5" />
                  <span className="sr-only"> ({tRoot('a11y.openInNewTab')})</span>
                </a>
              </div>
            </section>

            <ReviewList
              rating={item.rating}
              items={item.reviews}
              locale={locale as Locale}
              title={tReviews('title')}
            />
          </div>

          {/* ── Панель аренды ── */}
          <aside>
            <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md">
              <p className="text-eyebrow mb-2 text-content-tertiary">{t('districtLabel')}</p>
              <p className="text-body mb-3 font-semibold text-content-primary">{item.district}</p>

              {/*
                Рейтинг стоит здесь, а не в баннере: на кинематографичной подложке
                серый счётчик отзывов контраст не проходит, а отдельный вид
                компонента ради одного места — новая пара «текст на подложке»,
                которую пришлось бы заводить в contrast.test.ts.
              */}
              <RatingStars rating={item.ratingAverage} count={item.ratingCount} size="md" />

              <div className="mt-4 border-t border-border-default pt-4">
                <Price amount={item.pricePerHour} unit="perHour" emphasis="total" />
              </div>

              <Button asChild block variant="accent" size="lg" className="mt-6">
                <Link href={`${routes.studio(item.slug)}#${CLASSES_ANCHOR}`}>
                  {t('classesTitle')}
                </Link>
              </Button>

              {/*
                Аренда объявлена, но недоступна. Кнопка выключена и объяснена
                рядом, а не спрятана: цена зала — половина причины, по которой на
                эту страницу заходят, и умолчание о самой аренде выглядело бы как
                недоделка, а не как решение.
              */}
              <Button
                block
                variant="outline"
                size="lg"
                disabled
                aria-describedby="rent-unavailable"
                className="mt-3"
              >
                {t('bookCta')}
              </Button>

              <p
                id="rent-unavailable"
                className="text-caption mt-3 rounded-md bg-accent-soft px-4 py-3 text-content-secondary"
              >
                {tCommon('states.comingSoon')}
              </p>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
