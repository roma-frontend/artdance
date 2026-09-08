/**
 * СОБЫТИЯ — афиша.
 *
 * Раздел живёт за флагом поставки `features.events`: выключенный модуль обязан
 * отдавать 404, а не пустую страницу. Пустая страница в выдаче поисковика
 * остаётся навсегда, а 404 исчезает.
 *
 * Порядок по умолчанию — ближайшее сначала. Афиша, отсортированная по
 * релевантности, бесполезна: у события главное свойство — когда оно.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogShell } from '@/components/catalog/catalog-shell';
import { EventCard } from '@/components/catalog/event-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { features, routes, site } from '@/config';
import { parseCatalogQuery, type RawSearchParams } from '@/domain/catalog';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { eventSortOptions, getEventList, getListingHero, getVenueFacets } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.events' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.events(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function EventsPage({ params, searchParams }: PageProps) {
  if (!features.events) notFound();

  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = parseCatalogQuery(await searchParams);
  const result = await getEventList(query);

  const t = await getTranslations('catalog');
  const tNav = await getTranslations('nav');

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('events.title')}
        subtitle={t('events.subtitle')}
        eyebrow={tNav('events')}
        image={getListingHero('events')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('events') }]}
      />

      <CatalogShell
        query={query}
        result={result}
        facets={{ districts: (await getVenueFacets()).districts }}
        sorts={eventSortOptions}
        section="events"
      >
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={item.slug}>
              <CardTilt>
                <EventCard item={item} locale={locale as Locale} />
              </CardTilt>
            </li>
          ))}
        </ul>
      </CatalogShell>

      <SiteFooter />
    </main>
  );
}
