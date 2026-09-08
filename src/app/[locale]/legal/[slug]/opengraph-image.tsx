/**
 * Карточка ссылки на правовой документ.
 *
 * Эти ссылки шлёт поддержка в ответ на спор об отмене или возврате, и превью
 * должно подтверждать, что открывается именно тот документ и в какой редакции.
 * Поэтому строка деталей — дата вступления в силу: у документа это единственная
 * характеристика, которая имеет значение в разговоре.
 *
 * Без кадра: фотография над офертой не помогает её читать.
 */

import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { legalDocumentBySlug, legalDocumentSlugs, legalDocumentTitleKey } from '@/config';
import type { Locale } from '@/i18n/config';
import {
  ogImageAlt,
  ogImageContentType,
  ogImageSize,
  renderOgCard,
} from '@/lib/seo/og-image';

export const alt = ogImageAlt;
export const size = ogImageSize;
export const contentType = ogImageContentType;

export function generateStaticParams(): Array<{ slug: string }> {
  return legalDocumentSlugs.map((slug) => ({ slug }));
}

interface ImageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const document = legalDocumentBySlug(slug);
  if (!document) notFound();

  const t = await getTranslations({ locale: locale as Locale });
  const format = await getFormatter({ locale: locale as Locale });

  return renderOgCard({
    kind: t('footer.legalTitle'),
    title: t(legalDocumentTitleKey(document.id)),
    meta: [
      t('legal.lastUpdated', {
        date: format.dateTime(new Date(document.effectiveDate), 'mediumDate'),
      }),
    ],
  });
}
