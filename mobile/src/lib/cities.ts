import { API_URL } from './config';

export type CityDistrict = { slug: string };

export type CityView = {
  slug: string;
  center: { lat: number; lng: number };
  districts?: CityDistrict[];
};

type CitiesResponse = { cities: CityView[] };

/** Список городов с районами, тот же, что на веб-странице `/cities`. */
export async function listCities(): Promise<CityView[]> {
  const response = await fetch(`${API_URL}/api/content/cities`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = (await response.json()) as CitiesResponse;
  return body.cities;
}

/** Слаг `yerevan` → `Yerevan`, `kanaker-zeytun` → `Kanaker Zeytun`. */
export function slugTitle(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Координаты с четырьмя знаками, как в веб-списке городов. */
export function coordsLabel(center: CityView['center']): string {
  return `${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`;
}
