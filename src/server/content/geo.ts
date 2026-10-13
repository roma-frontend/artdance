import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import { cities as staticCities } from '@/domain/geo';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

export interface GeoDistrictView {
  slug: string;
}

export interface GeoCityView {
  slug: string;
  center: { lat: number; lng: number };
  districts?: readonly GeoDistrictView[];
}

interface CityDbRow {
  slug: string;
  latitude: number;
  longitude: number;
  districts: readonly { slug: string }[];
}

/**
 * Публичный список городов и районов.
 *
 * Источник — админка (`City`/`District`): оператор владеет набором городов и их
 * активностью. Координаты известных городов берутся из `domain/geo` — это факт
 * о городе, а не решение бизнеса; у города, добавленного в админке без
 * статического прототипа, — его собственные координаты.
 *
 * Пустая таблица откатывается на статический список: так ведёт себя любой
 * кешируемый контент в этом проекте (см. `src/server/content/footer.ts`).
 */
export function buildCityList(rows: readonly CityDbRow[]): readonly GeoCityView[] {
  if (rows.length === 0) return staticCities;

  const staticBySlug = new Map<string, (typeof staticCities)[number]>(
    staticCities.map((city) => [city.slug, city]),
  );
  return rows.map((row) => {
    const stat = staticBySlug.get(row.slug);
    return {
      slug: row.slug,
      center: stat?.center ?? { lat: row.latitude, lng: row.longitude },
      districts: row.districts.map((district) => ({ slug: district.slug })),
    };
  });
}

async function loadCities(): Promise<readonly GeoCityView[]> {
  const rows = await db.city.findMany({
    where: { deletedAt: null, isActive: true, moderation: { not: 'REJECTED' } },
    orderBy: { name: 'asc' },
    select: {
      slug: true,
      latitude: true,
      longitude: true,
      districts: {
        where: { deletedAt: null, isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { slug: true },
      },
    },
  });
  return buildCityList(rows);
}

export const getCityList = defineQuery({
  name: 'cityList',
  tags: () => [cacheTags.geo()],
  revalidate: dataRevalidate.content,
  handler: loadCities,
});

/** Город по слагу из живого списка: 404-логика страниц остаётся у них. */
export async function getCityBySlug(slug: string): Promise<GeoCityView | undefined> {
  const list = await getCityList();
  return list.find((city) => city.slug === slug);
}
