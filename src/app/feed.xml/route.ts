/**
 * FEED — A-24: RSS блога (заглушка до ContentBlock/Banner CMS-lite).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  const { clientEnv } = await import('@/config/env');
  const base = clientEnv.NEXT_PUBLIC_APP_URL ?? 'https://artdance.am';
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>ArtDance</title><link>${base}</link><description>Новости и события</description></channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
