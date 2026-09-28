/**
 * GEO — города, районы Еревана, зоны доставки.
 *
 * Домейн, а не конфиг: координаты и районы — факт о городе, а не решение
 * бизнеса. Конфиг (`business.commerce.deliveryFee`) решает, сколько стоит
 * доставка в зону; домейн решает, где зона находится.
 *
 * Покрывает 07 §6 `src/domain/geo.ts` для A-03 и карт.
 */

export type CitySlug = 'yerevan' | 'gyumri' | 'vanadzor';

export interface City {
  slug: CitySlug;
  nameKey: string;
  center: { lat: number; lng: number };
  districts?: readonly District[];
}

export interface District {
  slug: string;
  nameKey: string;
  center: { lat: number; lng: number };
}

export const cities: readonly City[] = [
  {
    slug: 'yerevan',
    nameKey: 'geo.city.yerevan',
    center: { lat: 40.1772, lng: 44.5035 },
    districts: [
      { slug: 'kentron', nameKey: 'geo.district.kentron', center: { lat: 40.1792, lng: 44.5078 } },
      { slug: 'arabkir', nameKey: 'geo.district.arabkir', center: { lat: 40.201, lng: 44.489 } },
      { slug: 'avan', nameKey: 'geo.district.avan', center: { lat: 40.214, lng: 44.564 } },
      { slug: 'davtashen', nameKey: 'geo.district.davtashen', center: { lat: 40.219, lng: 44.475 } },
      { slug: 'erebuni', nameKey: 'geo.district.erebuni', center: { lat: 40.135, lng: 44.523 } },
      { slug: 'kanaker-zeytun', nameKey: 'geo.district.kanakerZeytun', center: { lat: 40.213, lng: 44.525 } },
      { slug: 'malatia-sebastia', nameKey: 'geo.district.malatiaSebastia', center: { lat: 40.176, lng: 44.433 } },
      { slug: 'nork-marash', nameKey: 'geo.district.norkMarash', center: { lat: 40.165, lng: 44.528 } },
      { slug: 'nor-nork', nameKey: 'geo.district.norNork', center: { lat: 40.194, lng: 44.568 } },
      { slug: 'nubarashen', nameKey: 'geo.district.nubarashen', center: { lat: 40.081, lng: 44.552 } },
      { slug: 'shengavit', nameKey: 'geo.district.shengavit', center: { lat: 40.142, lng: 44.482 } },
      { slug: 'ajapnyak', nameKey: 'geo.district.ajapnyak', center: { lat: 40.194, lng: 44.463 } },
    ],
  },
  { slug: 'gyumri', nameKey: 'geo.city.gyumri', center: { lat: 40.789, lng: 43.847 } },
  { slug: 'vanadzor', nameKey: 'geo.city.vanadzor', center: { lat: 40.813, lng: 44.482 } },
] as const;

export function cityBySlug(slug: string): City | undefined {
  return cities.find((c) => c.slug === slug);
}

export function districtBySlug(citySlug: CitySlug, districtSlug: string): District | undefined {
  return cityBySlug(citySlug)?.districts?.find((d) => d.slug === districtSlug);
}

/** Зоны доставки — ключ совпадает с домейном корзины. */
export type DeliveryZone = 'yerevan' | 'regions' | 'pickup';
