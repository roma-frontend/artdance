/**
 * ВЫКЛЮЧЕННЫЙ МАГАЗИН НЕ ПРИНИМАЕТ ЗАКАЗЫ.
 *
 * Страницы `/cart` и `/checkout` отдают 404 при `shop=false`, но server action —
 * это публичный HTTP-эндпоинт: его вызывают напрямую, минуя интерфейс. Без
 * проверки внутри действия выключенный раздел продолжал бы принимать заказы,
 * то есть тумблер отключал бы витрину, а не продажу.
 *
 * Проверка стоит ПЕРВОЙ строкой действия — до чтения корзины и до создания
 * заказа. Тест это фиксирует: при отказе `createOrder` не вызывается вовсе,
 * иначе «выключено» означало бы «создай и не отдай».
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  transitionOrder: vi.fn(),
  getCaller: vi.fn(),
  assertEntitlementOrThrow: vi.fn(),
}));

vi.mock('@/server/orders/service', () => ({
  createOrder: mocks.createOrder,
  transitionOrder: mocks.transitionOrder,
}));
vi.mock('@/lib/auth/guards', () => ({ getCaller: mocks.getCaller, requireCapability: vi.fn() }));
vi.mock('@/server/entitlements/guard', () => ({ assertEntitlementOrThrow: mocks.assertEntitlementOrThrow }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: async () => ({ allowed: true, remaining: 10, resetAt: 0, retryAfterSeconds: 0, backend: 'memory' }),
  clientIdentifier: () => 'test',
}));

import { domainErrors } from '@/domain/errors';

import { createOrderAction } from './orders';

const input = {
  contactEmail: 'guest@example.com',
  contactPhone: '+37499123456',
  contactName: 'Guest Buyer',
  anonymousId: 'anon-key-12345',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCaller.mockResolvedValue(null);
  mocks.createOrder.mockResolvedValue({ id: 'order-1', orderNumber: 'AD00000001', total: 10_000 });
});

describe('createOrderAction', () => {
  it('отказывает при выключенном магазине и не создаёт заказ', async () => {
    /* Тот же отказ, что бросает гвард: `DomainError`, а не строковый код. */
    mocks.assertEntitlementOrThrow.mockRejectedValue(domainErrors.featureDisabled());

    const result = await createOrderAction(input);

    expect(result?.serverError?.code).toBe('FEATURE_DISABLED');
    expect(mocks.createOrder).not.toHaveBeenCalled();
  });

  it('создаёт заказ при включённом магазине', async () => {
    mocks.assertEntitlementOrThrow.mockResolvedValue(undefined);

    const result = await createOrderAction(input);

    expect(mocks.assertEntitlementOrThrow).toHaveBeenCalledWith('shop');
    expect(mocks.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, anonymousId: 'anon-key-12345' }),
    );
    expect(result?.data).toMatchObject({ id: 'order-1' });
  });

  it('берёт пользователя из сессии, а не из аргументов', async () => {
    mocks.assertEntitlementOrThrow.mockResolvedValue(undefined);
    mocks.getCaller.mockResolvedValue({ id: 'user-1' });

    await createOrderAction({ ...input, anonymousId: null });

    /* Гость не может назваться пользователем: `userId` приходит только из сессии. */
    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });
});
