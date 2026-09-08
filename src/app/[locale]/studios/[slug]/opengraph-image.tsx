/**
 * Карточка ссылки на зал.
 *
 * Зал выбирают по трём вещам: где он, сколько стоит час и сколько людей влезает.
 * Ровно они и стоят на карточке — район в надзаголовке, ставка и площадь в строке
 * деталей.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import type { Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';
import { getCatalogSlugs, getVenueDetail } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/** Те же слаги, что у страницы зала: иначе карточка рисуется по запросу. */
export function generateStaticParams(): Array<{ slug: string }> {
  return getCatalogSlugs().venues.map((slug) => ({ slug }));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = getVenueDetail(slug);
  if (!item) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const format = await getFormatter({ locale: locale as Locale });

  return renderOgCard({
    kind: t('common.labels.studio'),
    eyebrow: item.district,
    title: item.name,
    meta: [
      t('studio.rentPerHour', { price: format.number(item.pricePerHour, 'price') }),
      t('common.units.squareMeters', { value: item.areaSqm }),
    ],
    imageKey: item.image.key,
  });
}
