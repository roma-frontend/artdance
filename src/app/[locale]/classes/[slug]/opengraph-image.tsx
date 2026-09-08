/**
 * Карточка ссылки на занятие.
 *
 * Из всех сущностей этой ссылкой делятся чаще всего — «пойдём вот на это», — и
 * решение принимается по превью, а не по адресу. Поэтому на карточке ровно то,
 * что нужно для решения: направление и уровень, название, кто ведёт, где и
 * сколько стоит.
 *
 * Обложка занятия проходит через тот же рендерер, что и остальные карточки
 * (`lib/seo/og-image.tsx`): он же пережимает WebP в формат, который понимает
 * движок отрисовки.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { danceStyleLabelKey, skillLevelLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';
import { getCatalogSlugs, getClassDetail } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/**
 * Те же слаги, что у самой страницы.
 *
 * Без этого списка картинка остаётся динамической: Next не знает, для каких
 * адресов её собирать, и рисует по запросу — то есть при каждой отправке ссылки в
 * мессенджер. Со списком карточки лежат в CDN готовыми.
 */
export function generateStaticParams() {
  return getCatalogSlugs().classes.map((slug) => ({ slug }));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = getClassDetail(slug);
  if (!item) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const format = await getFormatter({ locale: locale as Locale });

  return renderOgCard({
    kind: t('common.labels.class'),
    eyebrow: [t(danceStyleLabelKey(item.style as never)), t(skillLevelLabelKey(item.level as never))].join(
      ' · ',
    ),
    title: item.title,
    meta: [item.instructorName, item.venueName, format.number(item.price, 'price')],
    imageKey: item.image.key,
  });
}
