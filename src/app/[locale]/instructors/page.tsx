/**
 * ИНСТРУКТОРЫ — листинг с фильтрами.
 *
 * Фильтр «район» здесь означает не адрес инструктора, а район, где он ведёт
 * занятия: у частного преподавателя своего адреса может не быть вовсе, а искать
 * его человек будет по тому залу, куда готов ходить.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogShell } from '@/components/catalog/catalog-shell';
import { InstructorCard } from '@/components/catalog/instructor-card';
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
  getInstructorFacets,
  getInstructorList,
  getListingHero,
  instructorSortOptions,
} from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.instructors' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.instructors(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function InstructorsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = parseCatalogQuery(await searchParams);
  const result = getInstructorList(query);
  const facets = getInstructorFacets();

  const t = await getTranslations('catalog');
  const tNav = await getTranslations('nav');
  const tInstructor = await getTranslations('instructor');

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('instructors.title')}
        subtitle={t('instructors.subtitle')}
        eyebrow={tNav('instructors')}
        image={getListingHero('instructors')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('instructors') }]}
      >
        {/* Приглашение преподавать: половина трафика этого раздела — сами инструкторы. */}
        <Button asChild variant="onCinema" size="md">
          <Link href={routes.becomeInstructor()}>{tInstructor('becomeInstructorCta')}</Link>
        </Button>
      </PageHero>

      <CatalogShell
        query={query}
        result={result}
        facets={{ styles: facets.styles, districts: facets.districts }}
        sorts={instructorSortOptions}
        section="instructors"
      >
        <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-4">
          {result.items.map((item) => (
            <li key={item.slug}>
              <CardTilt>
                <InstructorCard item={item} locale={locale as Locale} />
              </CardTilt>
            </li>
          ))}
        </ul>
      </CatalogShell>

      <SiteFooter />
    </main>
  );
}
