import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCaller: vi.fn(),
  checkRateLimit: vi.fn(),
  createDirectOrder: vi.fn(),
  assertEntitlementOrThrow: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({ getCaller: mocks.getCaller }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  clientIdentifier: vi.fn(() => 'client-1'),
  rateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/server/orders/service', () => ({ createDirectOrder: mocks.createDirectOrder, createOrder: vi.fn(), transitionOrder: vi.fn() }));
vi.mock('@/server/entitlements/guard', () => ({ assertEntitlementOrThrow: mocks.assertEntitlementOrThrow }));

import { classPassById } from '@/config/pricing';
import { domainErrors, httpStatusFor } from '@/domain/errors';
import { POST } from './route';

const caller = { id: 'user-1', email: 'dancer@example.com', name: 'Dancer', role: 'CUSTOMER', locale: 'ru' };

function request(body: unknown) {
  return new Request('http://localhost/api/class-passes/purchase', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getCaller.mockResolvedValue(caller);
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.assertEntitlementOrThrow.mockResolvedValue(undefined);
  mocks.createDirectOrder.mockResolvedValue({ id: 'order-1', orderNumber: 'AD00000001', total: 108_000 });
});

describe('POST /api/class-passes/purchase', () => {
  it('rejects anonymous callers without creating an order', async () => {
    mocks.getCaller.mockResolvedValue(null);

    const response = await POST(request({ passId: 'cp-10' }));

    expect(response.status).toBe(401);
    expect(mocks.createDirectOrder).not.toHaveBeenCalled();
  });

  it('rejects a pass id that is not in the catalog', async () => {
    const response = await POST(request({ passId: 'cp-unknown' }));

    expect(response.status).toBe(400);
    expect(mocks.createDirectOrder).not.toHaveBeenCalled();
  });

  it('ignores a client-supplied price and creates a CLASS_PASS order for the caller', async () => {
    const response = await POST(request({ passId: 'cp-10', unitPrice: 1 }));

    expect(response.status).toBe(201);
    expect(mocks.assertEntitlementOrThrow).toHaveBeenCalledWith('packages');
    const [input] = mocks.createDirectOrder.mock.calls[0] as [{ userId: string; lines: Array<{ type: string; unitPrice: number }> }];
    expect(input.userId).toBe('user-1');
    expect(input.lines).toHaveLength(1);
    expect(input.lines[0]).toMatchObject({ type: 'CLASS_PASS' });
    expect(input.lines[0]!.unitPrice).not.toBe(1);
    expect(classPassById('cp-10')).toBeDefined();
    expect(await response.json()).toEqual({ order: { id: 'order-1', orderNumber: 'AD00000001', total: 108_000 } });
  });

  it('returns the module-disabled error and creates no order when packages are off', async () => {
    mocks.assertEntitlementOrThrow.mockRejectedValue(domainErrors.featureDisabled());

    const response = await POST(request({ passId: 'cp-10' }));

    expect(response.status).toBe(httpStatusFor('FEATURE_DISABLED'));
    expect(mocks.createDirectOrder).not.toHaveBeenCalled();
  });

  it('returns 429 before reading the body when rate limited', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, retryAfterSeconds: 30 });

    const response = await POST(request({ passId: 'cp-10' }));

    expect(response.status).toBe(429);
    expect(mocks.createDirectOrder).not.toHaveBeenCalled();
  });
});
