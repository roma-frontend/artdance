import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  campaignUpdate: vi.fn(),
  campaignFindMany: vi.fn(),
  profileFind: vi.fn(),
  profileUpdate: vi.fn(),
}));

vi.mock('@/lib/db', () => {
  const client = {
    boostCampaign: { update: h.campaignUpdate, findMany: h.campaignFindMany },
    instructorProfile: { findUniqueOrThrow: h.profileFind, update: h.profileUpdate },
  };
  return { db: Object.assign(client, { $transaction: (fn: (tx: unknown) => unknown) => fn(client) }) };
});
vi.mock('@/server/entitlements/guard', () => ({ assertEntitlementOrThrow: vi.fn() }));
vi.mock('@/server/entitlements/service', () => ({ getEffectiveEntitlementsSafe: vi.fn() }));

import { approveBoost, boostCampaignsForModeration, rejectBoost } from './service';

const endsAt = new Date('2026-11-20T00:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  h.campaignUpdate.mockResolvedValue({ instructorId: 'i1', endsAt });
});

describe('approveBoost', () => {
  it('выставляет instructorProfile.boostedUntil, если его не было', async () => {
    h.profileFind.mockResolvedValue({ boostedUntil: null });

    await approveBoost('b1');

    expect(h.campaignUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'APPROVED' } }));
    expect(h.profileUpdate).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { boostedUntil: endsAt } });
  });

  it('не сокращает более позднее boostedUntil короткой кампанией', async () => {
    h.profileFind.mockResolvedValue({ boostedUntil: new Date('2026-12-01T00:00:00Z') });

    await approveBoost('b1');

    expect(h.profileUpdate).not.toHaveBeenCalled();
  });
});

describe('rejectBoost', () => {
  it('переводит кампанию в REJECTED и не трогает профиль', async () => {
    h.campaignUpdate.mockResolvedValue({ id: 'b1' });

    await rejectBoost('b1');

    expect(h.campaignUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REJECTED' } }));
    expect(h.profileUpdate).not.toHaveBeenCalled();
  });
});

describe('boostCampaignsForModeration', () => {
  it('ставит ожидающие заявки выше одобренных и отклонённых', async () => {
    h.campaignFindMany.mockResolvedValue([
      { id: 'a', status: 'APPROVED' },
      { id: 'r', status: 'REJECTED' },
      { id: 'p', status: 'PENDING' },
    ]);

    const rows = await boostCampaignsForModeration();

    expect(rows.map((row) => row.id)).toEqual(['p', 'a', 'r']);
  });
});
