/**
 * QR alias — /qr/[code] → ShortLink.target (как /s/[code], A-22).
 */

import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const link = await db.shortLink.findUnique({ where: { code }, select: { target: true, expiresAt: true } });
  if (!link) return new Response('Not found', { status: 404 });
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return new Response('Expired', { status: 410 });
  db.shortLink.update({ where: { code }, data: { clicks: { increment: 1 } } }).catch(() => undefined);
  const { redirect } = await import('next/navigation');
  redirect(link.target);
}
