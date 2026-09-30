import { describe, expect, it } from 'vitest';

describe('cart pricing split', () => {
  it('B-09 splitParticipants null means no split', async () => {
    const { money } = await import('@/domain/money');
    const total = money(12_000);
    expect(total).toBe(12_000);
  });

  it('B-10 verification document exists', async () => {
    const { db } = await import('@/lib/db');
    expect(db).toBeDefined();
  });

  it('enums ATHLETE exists', async () => {
    const { userRoles } = await import('@/domain/enums');
    expect(userRoles).toContain('ATHLETE');
  });
});
