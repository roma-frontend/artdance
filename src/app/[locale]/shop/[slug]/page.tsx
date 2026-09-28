/**
 * ТОВАР — детальная страница.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CardTilt } from '@/components/fx/card-tilt';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProductCard } from '@/components/shop/product-card';
import { ProductGallery } from '@/components/shop/product-gallery';
import { ProductVariants } from '@/components/shop/product-variants';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { routes, site } from '@/config';

import type { Locale } from '@/i18n/config';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema } from '@/lib/seo/jsonld';
import { JsonLdScript } from '@/components/seo/json-ld';
import type { Crumb } from '@/lib/seo/jsonld';
import { getCatalogSlugs, getProductDetail } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  return (await getCatalogSlugs()).products.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getProductDetail(slug);
  if (!item) return {};
  return buildMetadata({
    locale: locale as Locale,
    path: routes.product(slug),
    title: item.title,
    description: item.description,
    openGraphType: 'article',
  });
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = await getProductDetail(slug);
  if (!item) notFound();

  const tNav = await getTranslations('nav');
  const trail: Crumb[] = [
    { name: tNav('shop'), path: routes.shop() },
    { name: item.title, path: routes.product(item.slug) },
  ];

  return (
    <main id={site.mainContentId}>
      <JsonLdScript schema={[breadcrumbSchema(locale as Locale, trail)]} />

      <PageHero
        title={item.title}
        eyebrow={item.brand}
        image={item.image}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <div className="page-container py-12 md:py-16">
        <div className="detail-grid">
          <ProductGallery gallery={item.gallery} locale={locale as Locale} />

          <aside>
            <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md">
              <div className="mb-5 flex items-start justify-between gap-3">
                <h1 className="text-heading-3">{item.title}</h1>
                <FavoriteButton target="product" slug={item.slug} name={item.title} />
              </div>
              <p className="text-body text-content-secondary mb-6">{item.description}</p>
              <ProductVariants product={item} />
            </div>
          </aside>
        </div>

        {item.related.length > 0 && (
          <section className="mt-16">
            <h2 className="text-heading-3 mb-6">{(await getTranslations({ locale: locale as never, namespace: 'shop' }))('relatedTitle')}</h2>
            <ul className="grid gap-5 xs:grid-cols-2 lg:grid-cols-4">
              {item.related.map((rel) => (
                <li key={rel.slug}>
                  <CardTilt>
                    <ProductCard item={rel} locale={locale as Locale} />
                  </CardTilt>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
