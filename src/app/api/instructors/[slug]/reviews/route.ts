/**
 * API: GET /api/instructors/[slug]/reviews — одобренные отзывы инструктора для мобильного приложения.
 *
 * Правила как у страницы `/instructors/[slug]/reviews`: только одобренные отзывы,
 * неизвестный или непубликованный инструктор и страница за пределами списка — 404.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { limits } from '@/config/business';
import { getInstructorReviewsPage } from '@/server/queries/instructors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

/** Некорректный или отсутствующий номер страницы — первая страница, а не ошибка. */
function parsePage(raw: string | null): number {
  const value = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = parsePage(new URL(request.url).searchParams.get('page'));
  const pageSize = limits.pagination.reviewsPerPage;

  const data = await getInstructorReviewsPage({ slug, page, pageSize });
  if (!data) return json({ error: 'NOT_FOUND' }, 404);

  const totalPages = Math.max(1, Math.ceil(data.total / pageSize));
  if (page > totalPages) return json({ error: 'NOT_FOUND' }, 404);

  return json({ ...data, totalPages }, 200);
}
