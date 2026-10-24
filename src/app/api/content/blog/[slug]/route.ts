/**
 * GET /api/content/blog/[slug]?locale= — одна опубликованная статья с похожими материалами.
 *
 * Неизвестный или неопубликованный слаг — 404 JSON, как и на `/blog/[slug]`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { httpStatusFor, isDomainError } from '@/domain/errors';
import { defaultLocale, isLocale } from '@/i18n/config';
import { getBlogDetail } from '@/server/queries/blog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number, locale?: string) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
      ...(locale ? { 'Content-Language': locale } : {}),
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const rawLocale = new URL(request.url).searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  try {
    const post = await getBlogDetail(slug, locale);
    if (!post) return json({ error: 'NOT_FOUND' }, 404);
    return json(post, 200, locale);
  } catch (e) {
    if (isDomainError(e)) return json({ error: e.code, messageKey: e.messageKey, params: e.params }, httpStatusFor(e.code));
    console.error('[content/blog/slug]', e);
    return json({ error: 'INTERNAL', messageKey: 'errors.generic.description' }, 500);
  }
}
