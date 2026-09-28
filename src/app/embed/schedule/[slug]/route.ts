/**
 * EMBED — A-19: виджет расписания для сайта студии (заглушка P2).
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const html = `<!doctype html><meta charset="utf-8"><title>ArtDance Schedule — ${slug}</title><p>Виджет расписания ${slug} — скоро.</p>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'ALLOWALL' } });
}
