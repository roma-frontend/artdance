/**
 * `/feed.xml` — RSS-лента блога (A-24).
 *
 * Язык берётся из `?locale=` и по умолчанию равен языку сайта. Адрес с точкой
 * прокси не переписывает под языковой префикс, поэтому лента доступна по одному
 * и тому же адресу на любом языке. Ссылка на неё объявлена в `<head>` страницы
 * блога (`alternates.types`).
 */

import { getTranslations } from 'next-intl/server';

import { absoluteUrl, routes } from '@/config';
import { cacheControl } from '@/config/cache';
import { defaultLocale, isLocale, localeMeta, type Locale } from '@/i18n/config';
import { buildBlogRss } from '@/lib/seo/feeds';
import { getBlogList } from '@/server/queries/blog';

export const runtime = 'nodejs';

/** Столько последних статей попадает в ленту: читалкам не нужен архив. */
const FEED_SIZE = 50;

export async function GET(request: Request): Promise<Response> {
  const requested = new URL(request.url).searchParams.get('locale') ?? '';
  const locale: Locale = isLocale(requested) ? requested : defaultLocale;

  const [list, t] = await Promise.all([
    getBlogList({ locale, take: FEED_SIZE }),
    getTranslations({ locale, namespace: 'blog' }),
  ]);

  const xml = buildBlogRss({
    title: t('title'),
    description: t('subtitle'),
    link: absoluteUrl(`/${locale}${routes.blog()}`),
    selfLink: absoluteUrl(routes.feed(locale)),
    language: localeMeta[locale].bcp47,
    items: list.items.map((item) => ({
      title: item.title,
      link: absoluteUrl(`/${locale}${routes.blogPost(item.slug)}`),
      description: item.excerpt,
      pubDate: new Date(item.publishedAt),
    })),
  });

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': cacheControl.content,
      'Content-Language': localeMeta[locale].bcp47,
    },
  });
}
