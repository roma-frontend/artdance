/**
 * GET /api/catalog/[section]/[slug] — публичная карточка одного объекта каталога.
 *
 * Тот же `getXDetail`, что у страницы. Неопубликованный или снятый объект даёт
 * `NOT_FOUND` (404): запрос сам отсекает непубличное, здесь это только передаётся
 * наружу. Раздел без тарифного флага — `FEATURE_DISABLED`.
 */

import { NextResponse } from 'next/server';

import { cacheControl } from '@/config/cache';
import type { FeatureKey } from '@/config/features';
import { listingSections, type ListingSection } from '@/config/routes';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import {
  getClassDetail,
  getEventDetail,
  getInstructorDetail,
  getProductDetail,
  getVenueDetail,
} from '@/server/content/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  _request: Request,
  { params }: { params: Promise<{ section: string; slug: string }> },
): Promise<NextResponse> {
  const { section, slug } = await params;

  if (!(listingSections as readonly string[]).includes(section) || section === 'discover') {
    return jsonResponse({ error: 'NOT_FOUND' }, 404);
  }

  const feature = sectionFeature[section as ListingSection];
  if (feature) {
    const effective = await getEffectiveEntitlementsSafe();
    if (!effective[feature]) return jsonResponse({ error: 'FEATURE_DISABLED' }, 404);
  }

  let detail: unknown;
  switch (section as ListingSection) {
    case 'classes':
      detail = await getClassDetail(slug);
      break;
    case 'instructors':
      detail = await getInstructorDetail(slug);
      break;
    case 'studios':
      detail = await getVenueDetail(slug);
      break;
    case 'events':
      detail = await getEventDetail(slug);
      break;
    case 'shop':
      detail = await getProductDetail(slug);
      break;
    default:
      detail = null;
  }

  if (!detail) return jsonResponse({ error: 'NOT_FOUND' }, 404);
  return jsonResponse(detail, 200);
}
