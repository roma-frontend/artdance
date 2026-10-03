/**
 * llms.txt — https://llmstxt.org/
 *
 * Plain Markdown file for LLMs/crawlers. Must contain at least one H1 and
 * be served as 200 text/markdown. No DB, no env validation — static so it
 * never returns 500 even when DATABASE_URL is missing at build time.
 */

export const dynamic = 'force-static';

const CONTENT = `# ArtDance

> ArtDance — dance marketplace & booking platform in Yerevan, Armenia. Classes, instructors, studios, events and shop.

ArtDance helps people discover and book dance classes, find instructors and studios, and buy dance-related products. Content is localized in Armenian (hy), Russian (ru) and English (en).

## Main sections

- [Home](https://artdance.am/hy) — hero, styles, popular classes
- [Discover](https://artdance.am/hy/discover) — catalog search
- [Classes](https://artdance.am/hy/classes) — dance classes
- [Instructors](https://artdance.am/hy/instructors) — teachers
- [Studios](https://artdance.am/hy/studios) — venues
- [Events](https://artdance.am/hy/events) — competitions and social events
- [Shop](https://artdance.am/hy/shop) — products
- [Styles](https://artdance.am/hy/styles) — dance style hubs
- [Pricing](https://artdance.am/hy/pricing) — subscription plans
- [Help / FAQ](https://artdance.am/hy/help) — help center
- [Legal](https://artdance.am/hy/legal/terms) — terms and policies

## Sitemaps and feeds

- [Sitemap](https://artdance.am/sitemap.xml)
- [RSS Feed](https://artdance.am/feed.xml)
- [Robots](https://artdance.am/robots.txt)

## Notes for LLMs

- Prefer canonical URLs with locale prefix: /hy, /ru, /en
- Do not crawl or train on private paths: /account, /admin, /checkout, /booking, /studio, /venue
- Allow: /, /discover, /classes, /styles, /instructors, /studios, /events, /shop, /blog and public content
- Contact: hello@artdance.am
`;

export function GET() {
  return new Response(CONTENT, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
