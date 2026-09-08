/**
 * НАПРАВЛЕНИЯ — перечень всех восемнадцати.
 *
 * Страницы нет в бэклоге (A-01 просит только `/styles/[style]`), и она добавлена
 * по одной причине: без неё тринадцать хабов из восемнадцати оказываются
 * сиротами. На главной плиток пять — столько направлений с фотографией в макете,
 * — и на остальные не ссылается ни один документ сайта. Страница, на которую нет
 * внутренних ссылок, живёт только в карте сайта: её обходят реже, ранжируют хуже,
 * а человек до неё не добирается вовсе.
 *
 * Два блока с разным смыслом, а не один список дважды:
 *   • «идут сейчас» — направления, на занятия по которым можно записаться;
 *     показываются плитками с кадром, как в макете;
 *   • «все направления» — полный перечень текстом, включая те, для которых
 *     преподавателя пока нет. Прятать их нельзя: человек ищет фламенко и обязан
 *     получить ответ «пока не ведут», а не пустой поиск.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { StyleLinkList } from '@/components/catalog/style-link-list';
import { StyleTileGrid } from '@/components/catalog/style-tile-grid';
import { ContentSection } from '@/components/content/content-section';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { JsonLdScript } from '@/components/seo/json-ld';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { breadcrumbSchema, type Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { getContentHero, getStyleSummaries } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.styles' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.styles(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function StylesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const summaries = getStyleSummaries();

  /*
   * Плитками показываются только направления, у которых есть И кадр, И занятия:
   * плитка без фотографии — пустой прямоугольник, а плитка со счётчиком «нет
   * занятий» приглашает туда, откуда придётся вернуться.
   *
   * `flatMap` вместо `filter`, потому что фильтр не сужает тип: `image` остался бы
   * `MediaRef | null`, а плитке нужен кадр.
   */
  const featured = summaries.flatMap((item) =>
    item.image !== null && item.classCount > 0
      ? [{ style: item.style, slug: item.slug, image: item.image, classCount: item.classCount }]
      : [],
  );

  const t = await getTranslations('styleHub');
  const tNav = await getTranslations('nav');

  const trail: Crumb[] = [{ name: tNav('styles'), path: routes.styles() }];

  return (
    <main id={site.mainContentId}>
      <JsonLdScript schema={breadcrumbSchema(locale as Locale, trail)} />

      <PageHero
        title={t('index.title')}
        subtitle={t('index.subtitle')}
        eyebrow={tNav('discover')}
        image={getContentHero('styles')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      {featured.length > 0 && (
        <ContentSection title={t('index.liveTitle')} subtitle={t('index.liveSubtitle')}>
          <StyleTileGrid tiles={featured} locale={locale as Locale} />
        </ContentSection>
      )}

      <ContentSection
        tone="raised"
        title={t('index.allTitle')}
        subtitle={t('index.allSubtitle')}
      >
        <StyleLinkList items={summaries} />
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
