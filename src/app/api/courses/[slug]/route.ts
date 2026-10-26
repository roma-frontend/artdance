/**
 * API: GET /api/courses/[slug] — карточка курса с программой для мобильного приложения.
 *
 * Видео уроков наружу не отдаётся: ключ файла открывает доступ к контенту,
 * поэтому программа содержит только название, длительность и признак превью.
 * Признак `enrolled` вычисляется по серверной сессии (bearer-токен).
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { getCourseDetail } from '@/server/queries/courses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<NextResponse> {
  const effective = await getEffectiveEntitlementsSafe();
  if (!effective.courses) return json({ error: 'FEATURE_DISABLED' }, 404);

  const { slug } = await params;
  const localeParam = new URL(request.url).searchParams.get('locale') ?? '';
  const locale: Locale = isLocale(localeParam) ? localeParam : defaultLocale;

  const detail = await getCourseDetail(slug, locale);
  if (!detail) return json({ error: 'NOT_FOUND' }, 404);

  const caller = await getCaller();
  const enrollment = caller
    ? await db.courseEnrollment.findUnique({
        where: { courseId_userId: { courseId: detail.id, userId: caller.id } },
        select: { id: true },
      })
    : null;

  return json(
    {
      course: {
        ...detail,
        enrolled: Boolean(enrollment),
        lessons: detail.lessons.map((lesson) => ({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          description: lesson.description,
          durationMinutes: lesson.durationMinutes,
          isPreview: lesson.isPreview,
        })),
      },
    },
    200,
  );
}
