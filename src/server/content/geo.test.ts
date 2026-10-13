import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: (fn: never) => fn }));

import { cities as staticCities } from '@/domain/geo';

import { buildCityList } from './geo';

describe('buildCityList', () => {
  it('откатывается на статический список, когда таблица пуста', () => {
    expect(buildCityList([])).toBe(staticCities);
  });

  it('координаты прототипа для известного города, свои — для нового', () => {
    const list = buildCityList([
      { slug: 'yerevan', latitude: 40.1, longitude: 44.1, districts: [{ slug: 'kentron' }] },
      { slug: 'new-city', latitude: 10, longitude: 20, districts: [] },
    ]);
    expect(list[0]!.center).toEqual({ lat: 40.1772, lng: 44.5035 });
    expect(list[0]!.districts).toEqual([{ slug: 'kentron' }]);
    expect(list[1]!.center).toEqual({ lat: 10, lng: 20 });
  });
});
