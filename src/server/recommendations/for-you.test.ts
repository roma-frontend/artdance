import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  profileFind: vi.fn(),
  classCardsBy: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: { dancerProfile: { findUnique: h.profileFind } } }));
vi.mock('@/server/queries/classes', () => ({ classCardsBy: h.classCardsBy }));

import { forYouClasses, forYouLimit } from './for-you';

beforeEach(() => {
  vi.clearAllMocks();
  h.classCardsBy.mockResolvedValue([{ slug: 'bachata-group' }]);
});

describe('forYouClasses', () => {
  it('без анкеты подборки нет и база по занятиям не читается', async () => {
    h.profileFind.mockResolvedValue(null);

    await expect(forYouClasses('u1')).resolves.toEqual([]);
    expect(h.classCardsBy).not.toHaveBeenCalled();
  });

  it('анкета без онбординга или без направлений — подборки нет', async () => {
    h.profileFind.mockResolvedValue({ onboardingCompleted: false, styles: ['BACHATA'] });
    await expect(forYouClasses('u1')).resolves.toEqual([]);

    h.profileFind.mockResolvedValue({ onboardingCompleted: true, styles: [] });
    await expect(forYouClasses('u1')).resolves.toEqual([]);

    expect(h.classCardsBy).not.toHaveBeenCalled();
  });

  it('берёт занятия только по направлениям из анкеты и с ограничением выдачи', async () => {
    h.profileFind.mockResolvedValue({ onboardingCompleted: true, styles: ['BACHATA', 'TANGO'] });

    const items = await forYouClasses('u1');

    expect(items).toEqual([{ slug: 'bachata-group' }]);
    expect(h.classCardsBy).toHaveBeenCalledWith({ style: { in: ['BACHATA', 'TANGO'] } }, forYouLimit);
  });
});
