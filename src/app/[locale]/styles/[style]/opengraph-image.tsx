/**
 * Карточка ссылки на хаб направления.
 *
 * Хаб — целевая страница органики, и ссылку на него пересылают в ответ на вопрос
 * «где учат бачату». Поэтому в строке деталей стоит наличие предложения, а не
 * описание танца: получателю важно, есть ли занятия, а не то, откуда стиль родом.
 *
 * У направления без предложения та же честная подпись, что и в перечне: «ищем
 * преподавателей» вместо «0 занятий».
 */

import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { danceStyleLabelKey, danceStyleSlug, danceStyles, type DanceStyle } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';
import { getStyleHub } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/** Все восемнадцать, как и у страницы: карточка нужна и закрытому от индексации хабу. */
export function generateStaticParams(): Array<{ style: string }> {
  return danceStyles.map((style) => ({ style: danceStyleSlug(style) }));
}

interface ImageProps {
  params: Promise<{ locale: string; style: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, style: slug } = await params;
  setRequestLocale(locale as Locale);

  const hub = await getStyleHub(slug);
  if (!hub) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const styleLabel = t(danceStyleLabelKey(hub.style as DanceStyle));

  const supply =
    hub.classCount > 0 || hub.instructorCount > 0
      ? [
          hub.classCount > 0 ? t('common.counts.classes', { count: hub.classCount }) : null,
          hub.instructorCount > 0
            ? t('common.counts.instructors', { count: hub.instructorCount })
            : null,
        ]
      : [t('styleHub.seeking')];

  return renderOgCard({
    kind: t('common.labels.style'),
    title: t('styleHub.title', { style: styleLabel }),
    meta: supply,
    imageKey: hub.image?.key ?? null,
  });
}
