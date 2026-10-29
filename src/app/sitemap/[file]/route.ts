/**
 * `/sitemap/<раздел>.xml` — карта сайта по разделам (A-24).
 *
 * Это route handler, а не metadata-файл `app/sitemap.ts`. Turbopack относит
 * metadata-файл `sitemap` к адресу `/sitemap.xml/route`, а индекс
 * `app/sitemap.xml/route.ts` занимает тот же адрес: сборка падает с ошибкой
 * «Conflicting route and metadata at /sitemap.xml».
 *
 * Одна запись на страницу, а не на страницу × локаль: версии по языкам идут в
 * `alternates.languages`. Состав карты живёт в `src/lib/seo/sitemap.ts` и
 * проверяется тестом против файлов маршрутов.
 *
 * Route handler в Next 16 по умолчанию не кешируется, поэтому ответ строится на
 * каждый запрос: слаги читаются из БД. `cacheControl.none` (`no-store, max-age=0,
 * must-revalidate`) не даёт промежуточным кешам держать старый состав. Неизвестный
 * раздел отвечает 404 до обращения к данным.
 */

import { cacheControl } from '@/config/cache';
import { buildSitemapUrlsetXml } from '@/lib/seo/feeds';
import { buildSitemapSectionWithEntitlements, sitemapSectionFromFile } from '@/lib/seo/sitemap';
import { getCatalogSlugs, getStyleHubSlugs } from '@/server/content/catalog';
import { getBlogSlugs } from '@/server/queries/blog';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const section = sitemapSectionFromFile(file);
  if (!section) return new Response('Not Found', { status: 404 });

  const slugs = await getCatalogSlugs();
  const entries = await buildSitemapSectionWithEntitlements(section, {
    classes: slugs.classes,
    instructors: slugs.instructors,
    venues: slugs.venues,
    events: slugs.events,
    blog: await getBlogSlugs(),
    /*
     * Хабы направлений приходят отдельной функцией: `generateStaticParams`
     * собирает все восемнадцать страниц, а в карту сайта попадают только те, у
     * которых есть занятия или преподаватели.
     */
    styles: await getStyleHubSlugs(),
  });

  return new Response(buildSitemapUrlsetXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': cacheControl.none,
    },
  });
}
