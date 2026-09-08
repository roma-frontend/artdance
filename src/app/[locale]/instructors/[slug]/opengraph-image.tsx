/**
 * Карточка ссылки на преподавателя.
 *
 * Ссылку на свой профиль преподаватель рассылает сам — это его визитка в
 * мессенджере, и она должна работать на него: фотография, имя, специализация,
 * ставка. Отсюда и состав, отличный от занятия: здесь важен человек, а не место
 * и время.
 *
 * Ставка выводится готовой строкой из каталога переводов
 * (`instructor.rateFrom`), а не склейкой «от» + число + «в час»: порядок слов в
 * армянском другой, и собранная по частям фраза читалась бы как перевод машиной.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { danceStyleLabelKey } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';
import { getCatalogSlugs, getInstructorDetail } from '@/server/content/catalog';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

/** Те же слаги, что у страницы профиля: иначе карточка рисуется по запросу. */
export async function generateStaticParams() {
  return (await getCatalogSlugs()).instructors.map((slug) => ({ slug }));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const item = await getInstructorDetail(slug);
  if (!item) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const format = await getFormatter({ locale: locale as Locale });

  return renderOgCard({
    kind: t('common.labels.instructor'),
    eyebrow: item.headline,
    title: item.name,
    meta: [
      /*
       * Направления перечисляются форматтером списка: в русском это «сальса,
       * латина и бачата», в английском — «salsa, Latin, and bachata». Запятая
       * руками дала бы английскую пунктуацию во всех трёх локалях.
       */
      format.list(
        item.styles.map((style) => t(danceStyleLabelKey(style as never))),
        'enumeration',
      ),
      t('instructor.rateFrom', { price: format.number(item.hourlyRateFrom, 'price') }),
    ],
    imageKey: item.image.key,
  });
}
