/**
 * Полная карта сайта для e2e-проверок.
 *
 * `/sitemap.xml` — индекс разделов, а не список адресов. Проверка «страница есть в
 * карте» должна смотреть во все разделы, иначе она перестанет видеть адреса,
 * которые переехали из одного файла в другой.
 */

import type { APIRequestContext } from '@playwright/test';

const LOC = /<loc>([^<]+)<\/loc>/g;

export async function fetchFullSitemap(request: APIRequestContext): Promise<string> {
  const index = await request.get('/sitemap.xml');
  if (index.status() !== 200) {
    throw new Error(`индекс карты сайта ответил ${index.status()}`);
  }

  const sectionPaths = [...(await index.text()).matchAll(LOC)].map(
    (match) => new URL(match[1]!).pathname,
  );

  const bodies = await Promise.all(
    sectionPaths.map(async (path) => {
      const response = await request.get(path);
      if (response.status() !== 200) {
        throw new Error(`раздел карты ${path} ответил ${response.status()}`);
      }
      return response.text();
    }),
  );

  return bodies.join('\n');
}
