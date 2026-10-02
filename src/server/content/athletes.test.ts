import { beforeEach, expect, it, vi } from 'vitest';

const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db', () => ({ db: { instructorProfile: { findMany } } }));
vi.mock('@/server/query', () => ({ defineQuery: (definition: { handler: unknown }) => definition.handler }));

import { getAthletes } from './athletes';

function profile(slug: string, startYear: number) {
  return {
    slug, user: { name: slug }, headline: 'Teacher', bio: '', styles: ['BALLROOM'],
    specializations: ['Quickstep'], yearsExperience: 4, hourlyRateFrom: 10_000,
    isVerified: true, acceptsTravel: false, ratingAverage: null, ratingCount: 0,
    studentCount: 0, createdAt: new Date('2026-01-01'), media: [],
    translations: [{ headline: 'Спортивные танцы' }],
    experiences: [{ title: 'Gold championship', organization: null, startYear, endYear: 2025 }],
  };
}

beforeEach(() => vi.resetAllMocks());

it('читает публичные профили и переводы, сортирует по охвату опыта', async () => {
  findMany.mockResolvedValue([profile('newer', 2021), profile('older', 2015)]);
  const result = await getAthletes('ru');
  expect(result.map(item => item.slug)).toEqual(['older', 'newer']);
  expect(result[0]).toMatchObject({
    name: 'older', headline: 'Спортивные танцы', competitionYears: 10,
    disciplines: ['Quickstep'], bestResult: 'GOLD', image: { key: '' },
  });
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
    where: { moderation: 'APPROVED', publishedAt: { not: null }, user: { isActive: true } },
    select: expect.objectContaining({ translations: { where: { locale: 'ru' }, select: { headline: true } } }),
  }));
});

it('пустой каталог не подменяется демо-атлетами', async () => {
  findMany.mockResolvedValue([]);
  expect(await getAthletes('en')).toEqual([]);
});

it('без опыта не выдумывает стаж или медали и использует исходный заголовок', async () => {
  findMany.mockResolvedValue([{ ...profile('teacher', 2021), experiences: [], translations: [] }]);
  expect((await getAthletes('hy'))[0]).toMatchObject({
    headline: 'Teacher', competitionYears: 0, bestResult: 'PARTICIPANT',
  });
});
