/**
 * sitemap.xml
 *
 * Одна запись на страницу, а не на страницу × локаль: у каждой записи есть
 * `alternates.languages`, и это ровно то, что нужно сообщить поисковику — одна
 * страница в трёх версиях, а не три страницы. Дубликаты в карте сайта
 * конкурируют между собой в выдаче.
 *
 * Состав карты живёт в `src/lib/seo/sitemap.ts` и проверяется тестом против
 * файлов маршрутов: URL из карты, отвечающий 404, обесценивает всю карту.
 *
 * Слаги читаются из контент-слоя, поэтому файл серверный и попадает в сборку как
 * статический артефакт вместе с остальными страницами каталога.
 */

import type { MetadataRoute } from 'next';

import { buildSitemap } from '@/lib/seo/sitemap';
import { getCatalogSlugs, getStyleHubSlugs } from '@/server/content/catalog';

export default function sitemap(): MetadataRoute.Sitemap {
  const slugs = getCatalogSlugs();

  return buildSitemap({
    classes: slugs.classes,
    instructors: slugs.instructors,
    venues: slugs.venues,
    events: slugs.events,
    /*
     * Хабы направлений приходят отдельной функцией: `generateStaticParams`
     * собирает все восемнадцать страниц, а в карту сайта попадают только те, у
     * которых есть занятия или преподаватели.
     */
    styles: getStyleHubSlugs(),
  });
}
