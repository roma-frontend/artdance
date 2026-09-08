/**
 * СОБЫТИЕ — детальная страница воркшопа, батла, мастер-класса.
 *
 * Что решено осознанно.
 *
 * **Регистрация объявлена, но выключена.** Запись на событие — это тот же движок
 * доступности и та же оплата, что у брони (фазы 3 и 5 плана); отдельного
 * маршрута регистрации в инвентаре экранов ещё нет. Ссылка в никуда дала бы 404 в
 * каталоге, поэтому кнопка выключена и объяснена рядом
 * (`common.states.comingSoon`) — тем же приёмом, что недоступный способ оплаты на
 * оформлении заказа. Всё, что нужно человеку для решения — когда, где, сколько
 * стоит и сколько мест — на странице есть.
 *
 * **Бесплатный вход выводится словом.** Ноль в поле цены — это «вход свободный»
 * (`events.freeEntry`), а не «0 ֏». По той же причине у события с открытым входом
 * не показывается счётчик мест: «осталось 200 из 200» на площади — не информация.
 *
 * **Дата и время собираются форматтером.** В данных лежит день, месяц и `HH:mm`;
 * читаемый вид зависит от локали, и строка «15 SEP» из базы означала бы
 * английский месяц на армянской странице.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarDaysIcon, ClockIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { JsonLdScript } from '@/components/seo/json-ld';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { Price } from '@/components/ui/price';
import { SpotsLeft } from '@/components/ui/spots-left';
import { routes, site } from '@/config';
import { eventTypeLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema, eventSchema, type Crumb } from '@/lib/seo/jsonld';
import { Link } from '@/i18n/routing';
import { getCatalogSlugs, getEventDetail } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  return (await getCatalogSlugs()).events.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getEventDetail(slug);
  if (!item) return {};

  return buildMetadata({
    locale: locale as Locale,
    path: routes.event(slug),
    title: item.title,
    description: item.description,
    openGraphType: 'article',
  });
}

export default async function EventDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = await getEventDetail(slug);
  if (!item) notFound();

  const t = await getTranslations('events');
  const tRoot = await getTranslations();
  const tCommon = await getTranslations('common');
  const tNav = await getTranslations('nav');
  const tStudio = await getTranslations('studio');
  const format = await getFormatter({ locale: locale as Locale });

  const isFree = item.price <= 0;
  /** Открытый вход: мест столько же, сколько вместимость — считать нечего. */
  const isOpenEntry = item.spotsLeft >= item.capacity;
  const typeLabel = tRoot(eventTypeLabelKey(item.type as never));

  /** Один путь на страницу: и в крошках, и в структурированных данных. */
  const trail: Crumb[] = [
    { name: tNav('events'), path: routes.events() },
    { name: item.title, path: routes.event(item.slug) },
  ];

  return (
    <main id={site.mainContentId}>
      <JsonLdScript
        schema={[eventSchema(locale as Locale, item), breadcrumbSchema(locale as Locale, trail)]}
      />

      <PageHero
        title={item.title}
        eyebrow={typeLabel}
        image={item.image}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      >
        <div className="flex flex-wrap items-center gap-5">
          {isFree ? (
            <Badge variant="onMedia" size="md">
              {t('freeEntry')}
            </Badge>
          ) : (
            <Price amount={item.price} emphasis="onCinema" />
          )}

          {isOpenEntry ? (
            <Badge variant="onMedia" size="md">
              {t('openEntry')}
            </Badge>
          ) : (
            <SpotsLeft spots={item.spotsLeft} />
          )}
        </div>
      </PageHero>

      <div className="page-container py-12 md:py-16">
        <div className="detail-grid">
          {/* ── Содержимое ── */}
          <div className="min-w-0">
            <section className="mb-12">
              <div className="mb-4 flex items-start justify-between gap-4">
                <h2 className="text-heading-3">{t('aboutTitle')}</h2>
                <FavoriteButton target="event" slug={item.slug} name={item.title} />
              </div>

              <p className="text-body-lg max-w-(--layout-prose-max-width) text-content-secondary">
                {item.description}
              </p>
            </section>

            {/* ── Когда ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('whenTitle')}</h2>

              <ul className="grid gap-3 xs:grid-cols-2">
                <li className="text-body flex items-center gap-3 rounded-md border border-border-default bg-surface-card px-4 py-3">
                  <CalendarDaysIcon aria-hidden className="size-4 shrink-0 text-content-accent" />
                  <time dateTime={item.startsAt}>
                    {format.dateTime(new Date(item.startsAt), 'mediumDate')}
                  </time>
                </li>
                <li className="text-body flex items-center gap-3 rounded-md border border-border-default bg-surface-card px-4 py-3">
                  <ClockIcon aria-hidden className="size-4 shrink-0 text-content-accent" />
                  {t('timeRange', { start: item.startTime, end: item.endTime })}
                </li>
              </ul>
            </section>

            {/* ── Где ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('whereTitle')}</h2>

              <div className="rounded-lg border border-border-default bg-surface-card p-6">
                <p className="text-body flex items-center gap-2 text-content-primary">
                  <MapPinIcon aria-hidden className="size-4 shrink-0 text-content-accent" />
                  {/*
                    Площадка каталога — ссылка на её страницу; внешнее место
                    (площадь, парк) остаётся текстом: ссылки у него нет.
                  */}
                  {item.venueSlug === undefined ? (
                    item.locationName
                  ) : (
                    <Link
                      href={routes.studio(item.venueSlug)}
                      className="font-semibold underline decoration-border-strong hover:text-content-accent"
                    >
                      {item.locationName}
                    </Link>
                  )}
                </p>

                {item.venueDistrict !== undefined && (
                  <p className="text-body-sm mt-2 text-content-secondary">
                    {tStudio('districtLabel')}
                    {': '}
                    {item.venueDistrict}
                    {' · '}
                    {site.address.city}
                  </p>
                )}
              </div>
            </section>

            {/* ── Места ── */}
            <section className="mb-12">
              <h2 className="text-heading-3 mb-4">{t('spotsTitle')}</h2>

              <p className="text-body flex items-center gap-3 rounded-md border border-border-default bg-surface-card px-4 py-3 text-content-primary">
                <UsersIcon aria-hidden className="size-4 shrink-0 text-content-accent" />
                {t('capacityNote', { count: item.capacity })}
                {!isOpenEntry && (
                  <span className="ms-auto">
                    <SpotsLeft spots={item.spotsLeft} />
                  </span>
                )}
              </p>
            </section>
          </div>

          {/* ── Панель регистрации ── */}
          <aside>
            <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md">
              <p className="text-eyebrow mb-2 text-content-tertiary">{typeLabel}</p>

              {isFree ? (
                <p className="text-price text-content-primary">{t('freeEntry')}</p>
              ) : (
                <Price amount={item.price} emphasis="total" />
              )}

              <dl className="text-body-sm mt-5 space-y-3 border-t border-border-default pt-5">
                <div>
                  <dt className="text-content-tertiary">{tCommon('labels.date')}</dt>
                  <dd className="mt-0.5 font-semibold text-content-primary">
                    <time dateTime={item.startsAt}>
                      {format.dateTime(new Date(item.startsAt), 'dayWithWeekday')}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt className="text-content-tertiary">{tCommon('labels.time')}</dt>
                  <dd className="mt-0.5 font-semibold text-content-primary">
                    {t('timeRange', { start: item.startTime, end: item.endTime })}
                  </dd>
                </div>
                <div>
                  <dt className="text-content-tertiary">{tCommon('labels.location')}</dt>
                  <dd className="mt-0.5 font-semibold text-content-primary">
                    {item.locationName}
                  </dd>
                </div>
              </dl>

              {/*
                Кнопка выключена, а не спрятана: событие с датой и ценой обязано
                объяснить, как на него попасть, и «регистрация откроется» —
                честный ответ, в отличие от ссылки в 404.
              */}
              <Button
                block
                variant="accent"
                size="lg"
                disabled
                aria-describedby="registration-unavailable"
                className="mt-6"
              >
                {t('registerCta')}
              </Button>

              <p
                id="registration-unavailable"
                className="text-caption mt-3 rounded-md bg-accent-soft px-4 py-3 text-content-secondary"
              >
                {tCommon('states.comingSoon')}
              </p>

              {/* Пока регистрации нет, афиша остаётся живым разделом. */}
              <Button asChild block variant="outline" size="lg" className="mt-3">
                <Link href={routes.events()}>{t('title')}</Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
