/**
 * ЗАНЯТИЯ — листинг с фильтрами.
 *
 * Страница делает три вещи и ничего больше: разбирает URL, спрашивает контент,
 * раскладывает карточки в сетку. Фильтры, сортировка, пустое состояние и
 * пагинация живут в `CatalogShell` — одинаково во всех шести разделах каталога.
 *
 * Маршрут кешируется CDN (`catalogPaths` в `config/cache.ts`): персональных
 * данных в серверном HTML нет, поэтому повторный просмотр не вызывает функцию.
 * Отметки «в избранное» — клиентский островок, и на кеш они не влияют.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogShell } from '@/components/catalog/catalog-shell';
import { ClassCard } from '@/components/catalog/class-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { routes, site } from '@/config';
import { parseCatalogQuery, type RawSearchParams } from '@/domain/catalog';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  classSortOptions,
  getClassFacets,
  getClassList,
  getListingHero,
} from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.classes' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.classes(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function ClassesPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = parseCatalogQuery(await searchParams);
  const result = getClassList(query);
  const facets = getClassFacets();

  const t = await getTranslations('catalog');
  const tNav = await getTranslations('nav');

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('classes.title')}
        subtitle={t('classes.subtitle')}
        eyebrow={tNav('discover')}
        image={getListingHero('classes')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('classes') }]}
      />

      <CatalogShell
        query={query}
        result={result}
        facets={{ styles: facets.styles, levels: facets.levels, districts: facets.districts }}
        sorts={classSortOptions}
        section="classes"
      >
        {/*
          Три колонки, а не четыре: у карточки занятия под фотографией четыре
          строки текста, и на четверти ширины 1440px название переносится на две
          строки у половины занятий.
        */}
        <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-3">
          {result.items.map((item) => (
            <li key={item.slug}>
              <CardTilt>
                <ClassCard item={item} locale={locale as Locale} />
              </CardTilt>
            </li>
          ))}
        </ul>
      </CatalogShell>

      <SiteFooter />
    </main>
  );
}
