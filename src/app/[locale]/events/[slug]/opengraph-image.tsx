/**
 * Карточка ссылки на событие.
 *
 * У афиши превью работает иначе, чем у занятия: событие происходит один раз, и
 * первое, что нужно знать получателю ссылки, — когда и где. Поэтому дата стоит в
 * начале строки деталей, а не после названия места.
 *
 * Дата собирается форматтером (`bookingStamp`), а не строкой из данных: в данных
 * лежит момент времени, а «сб, 7 сент., 19:00» — это уже локаль.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { eventTypeLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';
import { getCatalogSlugs, getEventDetail } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/** Те же слаги, что у страницы события: иначе карточка рисуется по запросу. */
export function generateStaticParams() {
  return getCatalogSlugs().events.map((slug) => ({ slug }));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = getEventDetail(slug);
  if (!item) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const format = await getFormatter({ locale: locale as Locale });

  return renderOgCard({
    kind: t('common.labels.event'),
    eyebrow: t(eventTypeLabelKey(item.type as never)),
    title: item.title,
    meta: [
      format.dateTime(item.startsAt, 'dayWithWeekday'),
      item.startTime,
      item.locationName,
    ],
    imageKey: item.image.key,
  });
}
