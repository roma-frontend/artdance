/**
 * Карточка ссылки на товар.
 *
 * Цена показывается так же, как в каталоге: с приставкой «от», когда она зависит
 * от варианта (размер, номинал подарочной карты). Точная сумма на карточке
 * товара, у которого шесть номиналов, — обещание, которое страница не выполнит.
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
import { getCatalogSlugs, getProductDetail } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/** Те же слаги, что у страницы товара: иначе карточка рисуется по запросу. */
export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return (await getCatalogSlugs()).products.map((slug) => ({ slug }));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = await getProductDetail(slug);
  if (!item) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const format = await getFormatter({ locale: locale as Locale });

  const price = format.number(item.price, 'price');

  return renderOgCard({
    kind: t('nav.shop'),
    eyebrow: item.brand,
    title: item.title,
    meta: [item.priceFrom ? `${t('common.labels.from')} ${price}` : price],
    imageKey: item.image.key,
  });
}
