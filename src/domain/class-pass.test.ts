import { describe, expect, it } from 'vitest';

import { activePasses, classPassConfigById, passExpiresAt, pickUsablePass } from '@/domain/class-pass';

const now = new Date('2026-09-29T10:00:00Z');

describe('class-pass domain', () => {
  it('отсекает истёкшие и израсходованные пакеты', () => {
    const passes = [
      { id: 'a', lessonsTotal: 10, lessonsRemaining: 3, pricePaid: 90000, expiresAt: passExpiresAt(now, 10), createdAt: now },
      { id: 'b', lessonsTotal: 5, lessonsRemaining: 0, pricePaid: 22000, expiresAt: passExpiresAt(now, 10), createdAt: now },
      { id: 'c', lessonsTotal: 10, lessonsRemaining: 2, pricePaid: 90000, expiresAt: new Date(now.getTime() - 1000), createdAt: now },
    ] as const;
    const active = activePasses(passes as never, now);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe('a');
  });

  it('pickUsablePass выбирает минимальный остаток, затем ближайший дедлайн', () => {
    const a = { id: 'a', lessonsTotal: 10, lessonsRemaining: 2, pricePaid: 90000, expiresAt: passExpiresAt(now, 30), createdAt: now };
    const b = { id: 'b', lessonsTotal: 10, lessonsRemaining: 1, pricePaid: 90000, expiresAt: passExpiresAt(now, 90), createdAt: now };
    expect(pickUsablePass([a, b] as never, now)?.id).toBe('b');
  });

  it('резолвит id пакета из pricing', () => {
    expect(classPassConfigById('cp-10')?.lessons).toBe(10);
    expect(classPassConfigById('unknown')).toBeNull();
  });

  it('срок пакетов считает от момента покупки', () => {
    expect(passExpiresAt(new Date('2026-01-01T00:00:00Z'), 90).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
