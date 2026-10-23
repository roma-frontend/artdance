/**
 * GET /api/catalog/[section] — публичный список каталога для мобильного приложения.
 *
 * Те же серверные запросы, что у страниц раздела: фильтры разбираются тем же
 * `parseCatalogQuery`, публичность и порядок — в самих запросах. Раздел без
 * тарифного флага отвечает `FEATURE_DISABLED`, как и в вебе (404 там, код здесь).
 *
 * Ошибки — машинные коды; строки для человека выбирает клиент по своей локали.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import type { FeatureKey } from '@/config/features';
import { listingSections, type ListingSection } from '@/config/routes';
import { parseCatalogQuery } from '@/domain/catalog';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import {
  getClassList,
  getEventList,
  getInstructorList,
  getProductList,
  getVenueList,
} from '@/server/content/catalog';

export const runtime = 'nodejs';
/** Список зависит от строки запроса и тарифов; кеш ведёт сам запрос (`defineQuery`). */
export const dynamic = 'force-dynamic';

/** Разделы, у которых есть список. «Открыть» — обзорная страница, списка нет. */
const sectionFeature: Partial<Record<ListingSection, FeatureKey>> = {
  shop: 'shop',
  events: 'events',
};

function jsonResponse(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl.none,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
): Promise<NextResponse> {
  const { section } = await params;

  if (!(listingSections as readonly string[]).includes(section) || section === 'discover') {
    return jsonResponse({ error: 'NOT_FOUND' }, 404);
  }

  const feature = sectionFeature[section as ListingSection];
  if (feature) {
    const effective = await getEffectiveEntitlementsSafe();
    if (!effective[feature]) return jsonResponse({ error: 'FEATURE_DISABLED' }, 404);
  }

  const query = parseCatalogQuery(Object.fromEntries(new URL(request.url).searchParams));

  switch (section as ListingSection) {
    case 'classes':
      return jsonResponse(await getClassList(query), 200);
    case 'instructors':
      return jsonResponse(await getInstructorList(query), 200);
    case 'studios':
      return jsonResponse(await getVenueList(query), 200);
    case 'events':
      return jsonResponse(await getEventList(query), 200);
    case 'shop':
      return jsonResponse(await getProductList(query), 200);
    default:
      return jsonResponse({ error: 'NOT_FOUND' }, 404);
  }
}
