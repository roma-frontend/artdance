import { describe, expect, it } from 'vitest';
import { nextOccurrences } from '@/domain/recurring';

describe('recurring', () => {
  it('генерирует вторник 19:00 на 3 недели', () => {
    const from = new Date('2026-09-28T00:00:00Z'); // Mon
    const occ = nextOccurrences({ weekday: 2, startTime: '19:00', durationMinutes: 60 }, from, 3, 'Asia/Yerevan');
    expect(occ).toHaveLength(3);
    expect(occ[0]!.startsAt.getUTCDay()).toBe(2);
    expect(occ[1]!.startsAt.getTime() - occ[0]!.startsAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('отклоняет недели вне лимита', () => {
    expect(() => nextOccurrences({ weekday: 1, startTime: '10:00', durationMinutes: 60 }, new Date(), 1, 'Asia/Yerevan')).toThrow();
    expect(() => nextOccurrences({ weekday: 1, startTime: '10:00', durationMinutes: 60 }, new Date(), 50, 'Asia/Yerevan')).toThrow();
  });
});
