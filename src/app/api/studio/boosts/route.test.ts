import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  requireInstructorProfile: vi.fn(),
  checkRateLimit: vi.fn(),
  recordAudit: vi.fn(),
  createBoost: vi.fn(),
  instructorBoosts: vi.fn(),
  loadEntitlementSnapshot: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ requireInstructorProfile: h.requireInstructorProfile }));
vi.mock('@/lib/security/rate-limit', () => ({ checkRateLimit: h.checkRateLimit, rateLimitHeaders: () => ({}) }));
vi.mock('@/lib/audit', () => ({ recordAudit: h.recordAudit }));
vi.mock('@/server/boost/service', () => ({ createBoost: h.createBoost, instructorBoosts: h.instructorBoosts }));
vi.mock('@/server/entitlements/guard', () => ({ loadEntitlementSnapshot: h.loadEntitlementSnapshot }));

import { GET, POST } from './route';

const caller = { id: 'user-1' };

function post(body: unknown) {
  return new Request('http://localhost/api/studio/boosts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/studio/boosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requireInstructorProfile.mockResolvedValue({ caller, instructorId: 'inst-1' });
  });

  it('отдаёт флаг пакета и кампании инструктора', async () => {
    h.loadEntitlementSnapshot.mockResolvedValue({ boost: true });
    h.instructorBoosts.mockResolvedValue([{ id: 'c1' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: true, campaigns: [{ id: 'c1' }] });
    expect(h.instructorBoosts).toHaveBeenCalledWith('inst-1');
  });

  it('без пакета с бустами enabled выключен, но история остаётся', async () => {
    h.loadEntitlementSnapshot.mockResolvedValue({ boost: false });
    h.instructorBoosts.mockResolvedValue([]);

    const response = await GET();

    expect(await response.json()).toEqual({ enabled: false, campaigns: [] });
  });
});

describe('POST /api/studio/boosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.requireInstructorProfile.mockResolvedValue({ caller, instructorId: 'inst-1' });
    h.checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it('невалидное тело отклоняется до создания заявки', async () => {
    const response = await POST(post({ bidAmount: 'много' }));

    expect(response.status).toBe(400);
    expect(h.createBoost).not.toHaveBeenCalled();
  });

  it('валидная заявка создаётся с датами и пишется в аудит', async () => {
    h.createBoost.mockResolvedValue({ id: 'c9' });

    const response = await POST(
      post({ bidAmount: 5000, startsAt: '2026-12-01T10:00:00.000Z', endsAt: '2026-12-08T10:00:00.000Z' }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'c9' });
    expect(h.createBoost).toHaveBeenCalledWith({
      instructorId: 'inst-1',
      bidAmount: 5000,
      startsAt: new Date('2026-12-01T10:00:00.000Z'),
      endsAt: new Date('2026-12-08T10:00:00.000Z'),
    });
    expect(h.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'instructor.boost.request', entityId: 'c9' }));
  });
});
