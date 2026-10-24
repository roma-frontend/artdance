/**
 * GET /api/content/legal/[slug]?locale= — текст одного правового документа.
 *
 * Неизвестный слаг — 404 JSON, а не пустой документ: как и на `/legal/[slug]`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { legalDocumentBySlug } from '@/config';
import { defaultLocale, isLocale } from '@/i18n/config';
import { buildLegalDocumentContent } from '@/server/content/legal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const document = legalDocumentBySlug(slug);

  const headers = {
    'Cache-Control': cacheControl.none,
    'X-Content-Type-Options': 'nosniff',
  };

  if (!document) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404, headers });
  }

  const rawLocale = new URL(request.url).searchParams.get('locale') ?? '';
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const content = await buildLegalDocumentContent(locale, document);

  return NextResponse.json(content, {
    headers: { ...headers, 'Content-Language': locale },
  });
}
