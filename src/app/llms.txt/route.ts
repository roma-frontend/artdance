/**
 * llms.txt — https://llmstxt.org/
 *
 * Plain Markdown file for LLMs/crawlers. Must contain at least one H1 and
 * be served as 200 text/markdown. No DB, no env validation — static so it
 * never returns 500 even when DATABASE_URL is missing at build time.
 */

import { getEffectiveEntitlements } from '@/server/entitlements/service';

/*
 * Файл читает тумблеры модулей на каждый запрос: статичный кеш пережил бы
 * выключение раздела и продолжал бы его рекламировать.
 */
export const dynamic = 'force-dynamic';

interface ModuleFlags {
  events: boolean;
  shop: boolean;
}

/** Строка, которая упоминает модуль, попадает в файл только при его включении. */
function buildContent({ events, shop }: ModuleFlags): string {
  const lines = [
    '# ArtDance',
    '',
    `> ArtDance — dance marketplace & booking platform in Yerevan, Armenia. Classes, instructors, studios${events ? ', events' : ''}${shop ? ' and shop' : ''}.`,
    '',
    `ArtDance helps people discover and book dance classes, find instructors and studios${shop ? ', and buy dance-related products' : ''}. Content is localized in Armenian (hy), Russian (ru) and English (en).`,
    '',
    '## Main sections',
    '',
    '- [Home](https://artdance.am/hy) — hero, styles, popular classes',
    '- [Discover](https://artdance.am/hy/discover) — catalog search',
    '- [Classes](https://artdance.am/hy/classes) — dance classes',
    '- [Instructors](https://artdance.am/hy/instructors) — teachers',
    '- [Studios](https://artdance.am/hy/studios) — venues',
    ...(events ? ['- [Events](https://artdance.am/hy/events) — competitions and social events'] : []),
    ...(shop ? ['- [Shop](https://artdance.am/hy/shop) — products'] : []),
    '- [Styles](https://artdance.am/hy/styles) — dance style hubs',
    '- [Pricing](https://artdance.am/hy/pricing) — prices for classes, lessons and rentals',
    '- [Help / FAQ](https://artdance.am/hy/help) — help center',
    '- [Legal](https://artdance.am/hy/legal/terms) — terms and policies',
    '',
    '## Sitemaps and feeds',
    '',
    '- [Sitemap](https://artdance.am/sitemap.xml)',
    '- [RSS Feed](https://artdance.am/feed.xml)',
    '- [Robots](https://artdance.am/robots.txt)',
    '',
    '## Notes for LLMs',
    '',
    '- Prefer canonical URLs with locale prefix: /hy, /ru, /en',
    '- Do not crawl or train on private paths: /account, /admin, /checkout, /booking, /studio, /venue',
    `- Allow: /, /discover, /classes, /styles, /instructors, /studios${events ? ', /events' : ''}${shop ? ', /shop' : ''}, /blog and public content`,
    '- Contact: hello@artdance.am',
    '',
  ];
  return lines.join('\n');
}

export async function GET() {
  /* Если модули не удалось прочитать, файл не рекламирует ни один из них. */
  const flags = await getEffectiveEntitlements()
    .then((e): ModuleFlags => ({
      events: e.events === true,
      shop: e.shop === true,
    }))
    .catch((): ModuleFlags => ({ events: false, shop: false }));

  return new Response(buildContent(flags), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
