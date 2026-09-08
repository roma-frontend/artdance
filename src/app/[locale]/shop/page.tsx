/**
 * МАГАЗИН — листинг товаров.
 *
 * Категории — фильтр, а не отдельные маршруты `/shop/apparel`. Причина
 * практическая: у товара один адрес `/shop/[slug]`, и вложенный маршрут категории
 * создал бы второй путь к тому же товару — то есть дубль в индексе поисковика и
 * два места, где нужно поддерживать хлебные крошки.
 *
 * Раздел за флагом `features.shop`: выключенный модуль отдаёт 404, а не пустую
 * витрину.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { CatalogShell } from '@/components/catalog/catalog-shell';
import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProductCard } from '@/components/shop/product-card';
import { CardTilt } from '@/components/fx/card-tilt';
import { commerce, features, routes, site } from '@/config';
import { parseCatalogQuery, type RawSearchParams } from '@/domain/catalog';
import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { getListingHero, getProductCategories, getProductList, productSortOptions } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawSearchParams>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.shop' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.shop(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function ShopPage({ params, searchParams }: PageProps) {
  if (!features.shop) notFound();

  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const query = parseCatalogQuery(await searchParams);
  const result = await getProductList(query);

  const t = await getTranslations('catalog');
  const tNav = await getTranslations('nav');
  const tShop = await getTranslations('shop');
  const format = await getFormatter({ locale: locale as Locale });

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('shop.title')}
        subtitle={t('shop.subtitle')}
        eyebrow={tNav('shop')}
        image={getListingHero('shop')}
        locale={locale as Locale}
        breadcrumbs={[{ label: tNav('shop') }]}
      >
        {/* Порог бесплатной доставки — коммерческое правило, а не текст в баннере. */}
        <p className="text-body-sm text-content-on-cinema-muted">
          {tShop('freeDeliveryHint', {
            threshold: format.number(commerce.freeDeliveryThreshold, 'price'),
          })}
        </p>
      </PageHero>

      <CatalogShell
        query={query}
        result={result}
        facets={{ categories: await getProductCategories() }}
        sorts={productSortOptions}
        section="shop"
      >
        <ul className="grid grid-cols-2 gap-5 lg:grid-cols-4">
          {result.items.map((item) => (
            <li key={item.slug}>
              <CardTilt>
                <ProductCard item={item} locale={locale as Locale} />
              </CardTilt>
            </li>
          ))}
        </ul>
      </CatalogShell>

      <SiteFooter />
    </main>
  );
}
