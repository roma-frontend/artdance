/**
 * GET /api/content/styles/[slug] — хаб одного направления для мобильного приложения.
 *
 * Тот же `getStyleHub`, что у страницы `/styles/[style]`. Неизвестный слаг даёт
 * `NOT_FOUND` (404): слаг приходит снаружи, и это штатный ответ, а не сбой.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { getStyleHub } from '@/server/content/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': cacheControl.none,
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const hub = await getStyleHub(slug);

  if (!hub) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers });
  return NextResponse.json(hub, { headers });
}
