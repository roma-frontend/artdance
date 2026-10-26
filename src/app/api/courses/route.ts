/**
 * API: GET /api/courses — каталог курсов для мобильного приложения.
 *
 * Те же запросы, что у страницы `/courses`. Выключенный тумблер `courses`
 * отвечает `FEATURE_DISABLED` (404), как и страница на вебе.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import { danceStyles, skillLevels, type DanceStyle, type SkillLevel } from '@/domain/enums';
import { defaultLocale, isLocale, type Locale } from '@/i18n/config';
import { getCourseList, type CourseQuery } from '@/server/queries/courses';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: object, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': cacheControl.none } });
}

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request): Promise<NextResponse> {
  const effective = await getEffectiveEntitlementsSafe();
  if (!effective.courses) return json({ error: 'FEATURE_DISABLED' }, 404);

  const params = new URL(request.url).searchParams;
  const style = params.get('style');
  const level = params.get('level');
  const localeParam = params.get('locale') ?? '';
  const locale: Locale = isLocale(localeParam) ? localeParam : defaultLocale;

  const query: CourseQuery = {
    page: positiveInt(params.get('page'), 1),
    pageSize: positiveInt(params.get('pageSize'), 12),
    style: style && (danceStyles as readonly string[]).includes(style) ? (style as DanceStyle) : undefined,
    level: level && (skillLevels as readonly string[]).includes(level) ? (level as SkillLevel) : undefined,
  };

  return json(await getCourseList(query, locale), 200);
}
