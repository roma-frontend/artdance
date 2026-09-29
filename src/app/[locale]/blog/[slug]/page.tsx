/**
 * /blog/[slug] — детальная страница статьи.
 *
 * Редакционный лейаут: большая обложка, читабельная типографика (prose),
 * мета-строка, шаринг, связка «ещё истории». Работает на переводах: текст берётся
 * под текущую локаль, а базовый — если перевода нет.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { CalendarDaysIcon, Clock3Icon, EyeIcon, Share2Icon, TagIcon } from 'lucide-react';

import { Media } from '@/components/ui/media';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BlogCard } from '@/components/blog/blog-card';
import { SiteFooter } from '@/components/layout/site-footer';
import { JsonLdScript } from '@/components/seo/json-ld';
import { routes, site } from '@/config';
import { resolveMedia } from '@/domain/content';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbSchema, type Crumb } from '@/lib/seo/jsonld';
import { absoluteUrl } from '@/config';
import { getBlogDetail, getBlogSlugs } from '@/server/queries/blog';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const item = await getBlogDetail(slug, locale as Locale);
  if (!item) return {};
  return buildMetadata({
    locale: locale as Locale,
    path: routes.blogPost(slug),
    title: item.title,
    description: item.excerpt,
    openGraphType: 'article',
  });
}

export default async function BlogDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = await getBlogDetail(slug, locale as Locale);
  if (!item) notFound();

  const tBlogRoot = await getTranslations({ locale: locale as Locale });
  const tNav = await getTranslations({ locale: locale as Locale, namespace: 'nav' });
  const format = await getFormatter({ locale: locale as Locale });

  const tt = tBlogRoot as unknown as (k: string, v?: Record<string, unknown>) => string;
  const publishedLabel = format.dateTime(new Date(item.publishedAt), { dateStyle: 'long' });
  const readingLabel = tt('blog.readingTime', { count: item.readingMinutes });

  const trail: Crumb[] = [
    { name: tt('blog.title'), path: routes.blog() },
    { name: item.title, path: routes.blogPost(item.slug) },
  ];

  const paragraphs = item.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main id={site.mainContentId}>
      <JsonLdScript
        schema={[
          breadcrumbSchema(locale as Locale, trail),
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: item.title,
            description: item.excerpt,
            datePublished: item.publishedAt,
            author: item.authorName ? { '@type': 'Person', name: item.authorName } : undefined,
            mainEntityOfPage: absoluteUrl(`/${locale}${routes.blogPost(item.slug)}`),
            image: item.image?.key ? absoluteUrl(item.image.key.startsWith('/') ? item.image.key : `/${item.image.key}`) : undefined,
            isAccessibleForFree: true,
          },
        ]}
      />

      {/* Hero cover */}
      <div className="relative isolate overflow-hidden bg-surface-cinema">
        <div className="page-container pt-(--layout-nav-height)">
          <div className="py-6 flex items-center gap-2 text-sm text-content-on-cinema-muted">
            <Link href={routes.blog()} className="hover:text-content-on-cinema underline-offset-4 hover:underline">
              {tt('blog.backToBlog')}
            </Link>
            <span aria-hidden>·</span>
            <span>{tNav('home')}</span>
          </div>
        </div>

        {item.image ? (
          <div className="page-container pb-6">
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <Media
                {...resolveMedia(item.image, locale as Locale)}
                preset="heroFullBleed"
                priority
                fallback="event"
                className="w-full"
                imageClassName="brightness-95"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Article head */}
      <div className="page-container py-8 md:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {item.category && <Badge variant="accent">{item.category}</Badge>}
            <span className="inline-flex items-center gap-1.5 text-caption text-content-tertiary">
              <CalendarDaysIcon className="size-3.5" aria-hidden />
              {publishedLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption text-content-tertiary">
              <Clock3Icon className="size-3.5" aria-hidden />
              {readingLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption text-content-tertiary">
              <EyeIcon className="size-3.5" aria-hidden />
              {tt('blog.viewsLabel', { count: item.viewCount + 1 })}
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight tracking-tight text-content-primary">
            {item.title}
          </h1>

          <p className="mt-4 text-lg md:text-xl leading-relaxed text-content-secondary">{item.excerpt}</p>

          {item.authorName && (
            <p className="mt-3 text-body-sm text-content-tertiary">
              {item.authorName}
            </p>
          )}

          {item.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-card px-2.5 py-1 text-xs text-content-secondary"
                >
                  <TagIcon className="size-3" aria-hidden /> #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="page-container pb-10">
        <div className="mx-auto max-w-3xl">
          <div className="prose prose-neutral max-w-none prose-p:leading-relaxed prose-p:text-content-primary prose-headings:font-display prose-headings:font-bold">
            {paragraphs.map((para, idx) => {
              // Simple heuristic: line starting with # is heading
              if (para.startsWith('## ')) {
                return (
                  <h2 key={idx} className="mt-8 text-2xl font-display font-bold">
                    {para.replace(/^##\s+/, '')}
                  </h2>
                );
              }
              if (para.startsWith('# ')) {
                return (
                  <h2 key={idx} className="mt-8 text-2xl font-display font-bold">
                    {para.replace(/^#\s+/, '')}
                  </h2>
                );
              }
              return (
                <p key={idx} className="text-body leading-7 text-content-primary">
                  {para}
                </p>
              );
            })}
          </div>

          {/* Share */}
          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-border-default pt-6">
            <span className="text-caption font-semibold text-content-tertiary flex items-center gap-1.5">
              <Share2Icon className="size-4" aria-hidden /> {tt('blog.shareTitle')}
            </span>
            <Button
              asChild
              variant="outline"
              size="sm"
            >
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(absoluteUrl(`/${locale}${routes.blogPost(item.slug)}`))}&text=${encodeURIComponent(item.title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Telegram
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(absoluteUrl(`/${locale}${routes.blogPost(item.slug)}`))}&text=${encodeURIComponent(item.title)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                X
              </a>
            </Button>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link href={routes.blog()}>{tt('blog.backToBlog')}</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Related */}
      <div className="page-container pb-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-heading-3 mb-4">{tt('blog.relatedTitle')}</h2>
          {item.related.length === 0 ? (
            <p className="text-body-sm text-content-tertiary">{tt('blog.relatedEmpty')}</p>
          ) : (
            <ul className="grid gap-5 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {item.related.map((rel) => (
                <li key={rel.slug}>
                  <BlogCard item={rel} locale={locale as Locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
