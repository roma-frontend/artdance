/**
 * ЗАЛЫ — листинг площадок для аренды.
 *
 * Фильтр по направлению у зала означает «здесь этому учат»: своего направления у
 * помещения нет, но выбирать зал под сальсу — осмысленный запрос, потому что
 * вместе с залом человек ищет компанию и расписание.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogShell } from '@/components/catalog/catalog-shell';
import { VenueCard } from '@/components/catalog/venue-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import { parseCatalogQuery, type RawSearchParams } from '@/domain/catalog';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { Link } from '@/i18n/routing';
import {
  getClassFacets,
  getListingHero,
  getVenueFacets,
  getVenueList,
  venueSortOptions,
} from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.studios' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.studios(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function StudiosPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = parseCatalogQuery(await searchParams);
  const result = getVenueList(query);
  const facets = getVenueFacets();

  const t = await getTranslations('catalog');
  const tNav = await getTranslations('nav');
  const tStudio = await getTranslations('studio');

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('studios.title')}
        subtitle={t('studios.subtitle')}
        eyebrow={tNav('studios')}
        image={getListingHero('studios')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('studios') }]}
      >
        <Button asChild variant="onCinema" size="md">
          <Link href={routes.listYourStudio()}>{tStudio('listYourStudioCta')}</Link>
        </Button>
      </PageHero>

      <CatalogShell
        query={query}
        result={result}
        /* Направления берутся из занятий: у зала своего списка направлений нет. */
        facets={{ districts: facets.districts, styles: getClassFacets().styles }}
        sorts={venueSortOptions}
        section="studios"
      >
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={item.slug}>
              <CardTilt>
                <VenueCard item={item} locale={locale as Locale} />
              </CardTilt>
            </li>
          ))}
        </ul>
      </CatalogShell>

      <SiteFooter />
    </main>
  );
}
