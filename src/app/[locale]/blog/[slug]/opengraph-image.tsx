import { notFound } from 'next/navigation';

import { ogImageAlt, ogImageContentType, ogImageSize, renderOgCard } from '@/lib/seo/og-image';
import { locales, type Locale } from '@/i18n/config';
import { getBlogDetail, getBlogSlugs } from '@/server/queries/blog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export async function generateStaticParams() {
  const slugs = await getBlogSlugs();
  return slugs.flatMap((slug) => locales.map((locale) => ({ locale, slug })));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  const item = await getBlogDetail(slug, locale as Locale);
  if (!item) notFound();

  return renderOgCard({
    title: item.title,
    eyebrow: item.category ?? 'Blog',
    meta: [item.excerpt.slice(0, 80)],
    imageKey: item.image?.key ?? null,
    kind: 'Blog',
  });
}
