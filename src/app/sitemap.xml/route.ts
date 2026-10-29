/**
 * `/sitemap.xml` — индекс карты сайта.
 *
 * Адреса разделов берутся из того же `SITEMAP_SECTIONS`, что и файлы
 * `src/app/sitemap/[file]/route.ts`, так что индекс не может сослаться на раздел,
 * которого нет. Дат в индексе нет: время сборки было бы неправдой.
 *
 * Рядом не должно быть `app/sitemap.ts`: Turbopack относит metadata-файл `sitemap`
 * к тому же адресу `/sitemap.xml/route`, что и этот маршрут, и сборка падает с
 * «Conflicting route and metadata at /sitemap.xml».
 * Без кеша, как и разделы: их состав решают тумблеры (см. `buildCacheHeaderRules`).
 */

import { absoluteUrl } from '@/config';
import { cacheControl } from '@/config/cache';
import { buildSitemapIndexXml } from '@/lib/seo/feeds';
import { SITEMAP_SECTIONS } from '@/lib/seo/sitemap';

export function GET(): Response {
  const xml = buildSitemapIndexXml(
    SITEMAP_SECTIONS.map((section) => absoluteUrl(`/sitemap/${section}.xml`)),
  );

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': cacheControl.none,
    },
  });
}
