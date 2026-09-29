/**
 * /blog — публичный список: большие редакционные карточки, фильтр по категории,
 * поиск по заголовку. Дизайн — тёмная шапка + воздушная сетка на светлом.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { PageHero } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { BlogCard } from '@/components/blog/blog-card';
import { BlogFilter } from '@/components/blog/blog-filter';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import { buildMetadata } from '@/lib/seo/metadata';
import type { Locale } from '@/i18n/config';
import { getRootTranslate } from '@/i18n/translate';
import { getBlogList } from '@/server/queries/blog';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale });
  const tt = t as unknown as (k: string) => string;
  return buildMetadata({
    locale: locale as Locale,
    path: routes.blog(),
    title: tt('blog.title'),
    description: tt('blog.subtitle'),
    openGraphType: 'website',
  });
}

export default async function BlogPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const sp = await searchParams;
  const category = sp.category?.trim() || undefined;
  const q = sp.q?.trim() || undefined;

  const { items, categories } = await getBlogList({ locale: locale as Locale, category, q });

  const tRaw = await getTranslations({ locale: locale as Locale });
  const t = tRaw as unknown as (k: string) => string;
  const tRoot = await getRootTranslate();

  const featured = items[0];
  const rest = items.slice(1);

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('blog.title')}
        subtitle={t('blog.subtitle')}
        eyebrow={tRoot('nav.megaDescBlog' as never)}
        locale={locale as Locale}
      />

      <div className="page-container py-10 md:py-12">
        {/* Filters */}
        {categories.length > 0 && (
          <div className="mb-8">
            <BlogFilter categories={categories} active={category ?? null} locale={locale} labelAll={t('blog.filterAll')} />
          </div>
        )}

        {items.length === 0 ? (
          <EmptyState title={t('blog.empty')} description={t('blog.emptyHint')} />
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <section className="mb-10">
                <p className="text-eyebrow mb-3 text-content-tertiary">{t('blog.featuredTitle')}</p>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                  <BlogCard item={featured} locale={locale as Locale} featured priority />
                </div>
              </section>
            )}

            {/* Latest */}
            {rest.length > 0 && (
              <section>
                <p className="text-eyebrow mb-3 text-content-tertiary">{t('blog.latestTitle')}</p>
                <ul className="grid gap-5 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((item) => (
                    <li key={item.slug}>
                      <BlogCard item={item} locale={locale as Locale} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {rest.length === 0 && featured && (
              <p className="text-body-sm text-content-tertiary mt-6">{t('blog.relatedEmpty')}</p>
            )}

          </>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
