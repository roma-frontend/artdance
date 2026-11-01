import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  db: {
    competitionRegistration: { findUnique: vi.fn() },
    competitionResult: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ db: h.db }));

import { recordCompetitionResult } from './results';

const now = new Date('2026-11-01T12:00:00Z');
const input = { registrationId: 'r1', place: 'SILVER' as const, recordedById: 'admin-1' };

describe('recordCompetitionResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('регистрация не утверждена — места нет', async () => {
    h.db.competitionRegistration.findUnique.mockResolvedValue({
      status: 'PENDING',
      event: { startsAt: new Date('2026-10-01T10:00:00Z') },
    });

    await expect(recordCompetitionResult(input, now)).rejects.toThrow();
    expect(h.db.competitionResult.upsert).not.toHaveBeenCalled();
  });

  it('соревнование ещё не прошло — места нет', async () => {
    h.db.competitionRegistration.findUnique.mockResolvedValue({
      status: 'APPROVED',
      event: { startsAt: new Date('2026-12-01T10:00:00Z') },
    });

    await expect(recordCompetitionResult(input, now)).rejects.toThrow();
    expect(h.db.competitionResult.upsert).not.toHaveBeenCalled();
  });

  it('неизвестное место отклоняется до обращения к регистрации', async () => {
    await expect(recordCompetitionResult({ ...input, place: 'PLATINUM' as never }, now)).rejects.toThrow();
    expect(h.db.competitionRegistration.findUnique).not.toHaveBeenCalled();
  });

  it('утверждённая регистрация после соревнования — место записывается', async () => {
    h.db.competitionRegistration.findUnique.mockResolvedValue({
      status: 'APPROVED',
      event: { startsAt: new Date('2026-10-01T10:00:00Z') },
    });
    h.db.competitionResult.upsert.mockResolvedValue({ id: 'res-1', place: 'SILVER' });

    const result = await recordCompetitionResult(input, now);

    expect(h.db.competitionResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { registrationId: 'r1' },
        create: { registrationId: 'r1', place: 'SILVER', recordedById: 'admin-1' },
      }),
    );
    expect(result).toEqual({ id: 'res-1', place: 'SILVER' });
  });
});
