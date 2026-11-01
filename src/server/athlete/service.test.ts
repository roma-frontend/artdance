import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  db: {
    athleteProfile: { findUnique: vi.fn(), update: vi.fn() },
    competitionResult: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock('@/lib/db', () => ({ db: h.db }));

import { athleteProfileSchema } from '@/domain/athlete';

import { athleteCabinetFor, updateAthleteProfile } from './service';

describe('athleteCabinetFor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('без профиля кабинета нет', async () => {
    h.db.athleteProfile.findUnique.mockResolvedValue(null);

    expect(await athleteCabinetFor('user-1')).toBeNull();
  });

  it('регистрации выходят отдельным списком, а не вложенным полем профиля', async () => {
    h.db.athleteProfile.findUnique.mockResolvedValue({
      id: 'a1',
      wdsfId: null,
      programs: ['STANDARD'],
      clubName: 'Club',
      rank: 'A',
      competitionRegistrations: [
        {
          id: 'r1',
          status: 'PENDING',
          partnerName: 'Partner',
          event: { title: 'Cup', slug: 'cup', startsAt: new Date('2026-12-01') },
          category: { name: 'Open' },
        },
      ],
    });

    const cabinet = await athleteCabinetFor('user-1');

    expect(cabinet).toMatchObject({ programs: ['STANDARD'], clubName: 'Club', rank: 'A' });
    expect(cabinet).not.toHaveProperty('competitionRegistrations');
    expect(cabinet?.registrations).toHaveLength(1);
    expect(cabinet?.registrations[0]).toMatchObject({ id: 'r1', partnerName: 'Partner' });
  });
});

describe('updateAthleteProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('без профиля сохранять нечего', async () => {
    h.db.athleteProfile.findUnique.mockResolvedValue(null);

    await expect(updateAthleteProfile('user-1', { programs: [] })).rejects.toThrow();
    expect(h.db.athleteProfile.update).not.toHaveBeenCalled();
  });

  it('программы без повторов, пустые клуб и разряд — null', async () => {
    h.db.athleteProfile.findUnique.mockResolvedValue({ id: 'a1' });
    h.db.athleteProfile.update.mockResolvedValue({ programs: ['LATINE'], clubName: null, rank: null });

    await updateAthleteProfile('user-1', { programs: ['LATINE', 'LATINE'], clubName: '  ', rank: '' });

    expect(h.db.athleteProfile.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { programs: ['LATINE'], clubName: null, rank: null },
      select: { programs: true, clubName: true, rank: true },
    });
  });
});

describe('athleteProfileSchema', () => {
  it('принимает пустой список программ', () => {
    expect(athleteProfileSchema.safeParse({ programs: [] }).success).toBe(true);
  });

  it('отклоняет программу, которой нет в справочнике', () => {
    expect(athleteProfileSchema.safeParse({ programs: ['BALLET'] }).success).toBe(false);
  });
});
