/**
 * LEGAL — оферта, политики и правила.
 *
 * Один маршрут на шесть документов: различаются они текстом, а не устройством
 * страницы. Состав приходит из `config/legal.ts`, текст — из каталога переводов,
 * числа — из бизнес-правил (см. `LegalDocument`).
 *
 * Страницы статические: содержимое зависит только от конфигурации и локали, а
 * значит его незачем собирать на каждый запрос. `generateStaticParams` перечисляет
 * слаги из того же массива, который знает подвал и карта сайта, — документ не
 * может оказаться в навигации, но не собраться.
 *
 * Неизвестный слаг — это 404, а не пустой документ: адрес правового документа,
 * отвечающий страницей-заглушкой, хуже отсутствующего.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { LegalDocument } from '@/components/content/legal-document';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import {
  legalDocumentBySlug,
  legalDocumentIntroKey,
  legalDocumentSlugs,
  legalDocumentTitleKey,
  site,
} from '@/config';
import type { Locale } from '@/i18n/config';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return legalDocumentSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const document = legalDocumentBySlug(slug);
  if (!document) return {};

  const t = await getTranslations({ locale: locale as Locale });

  return buildMetadata({
    locale: locale as Locale,
    path: document.href,
    title: t(legalDocumentTitleKey(document.id)),
    /*
     * Описание — вступление документа. Из плейсхолдеров во вступлениях есть
     * только название бренда; ICU игнорирует лишние аргументы, поэтому лишних
     * здесь нет.
     */
    description: t(legalDocumentIntroKey(document.id), { brand: t('brand.name') }),
  });
}

export default async function LegalDocumentPage({ params }: PageProps) {
  const { locale, slug } = await params;
  setRequestLocale(locale as Locale);

  const document = legalDocumentBySlug(slug);
  if (!document) notFound();

  const t = await getTranslations();
  const tLegal = await getTranslations('legal');
  const format = await getFormatter();

  const title = t(legalDocumentTitleKey(document.id));
  const trail: Crumb[] = [{ name: title, path: document.href }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={title}
        subtitle={tLegal('lastUpdated', {
          date: format.dateTime(new Date(document.effectiveDate), 'mediumDate'),
        })}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <LegalDocument document={document} />

      <SiteFooter />
    </main>
  );
}
