/**
 * ПАКЕТ ЗАНЯТИЙ ПРОДАЁТСЯ ЧЕРЕЗ ОПЛАТУ, А НЕ В ОБХОД НЕЁ.
 *
 * Раньше покупка отвечала `FEATURE_DISABLED` всегда — до появления платёжного
 * контура. Теперь она создаёт заказ (`CLASS_PASS`), а выдаёт пакет `settle`
 * после подтверждения оплаты. Проверяется именно это разделение: действие НЕ
 * создаёт пакет само, иначе пакет можно было бы получить, не заплатив.
 *
 * Тумблер `packages` спрашивается до создания заказа: выключенный модуль не
 * должен оставить в базе даже черновик.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDirectOrder: vi.fn(),
  assertEntitlementOrThrow: vi.fn(),
  requireCaller: vi.fn(),
}));

vi.mock('@/server/orders/service', () => ({ createDirectOrder: mocks.createDirectOrder, createOrder: vi.fn(), transitionOrder: vi.fn() }));
vi.mock('@/server/entitlements/guard', () => ({ assertEntitlementOrThrow: mocks.assertEntitlementOrThrow }));
vi.mock('@/lib/auth/guards', () => ({ requireCaller: mocks.requireCaller, getCaller: vi.fn(), requireCapability: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: async () => ({ allowed: true, remaining: 10, resetAt: 0, retryAfterSeconds: 0, backend: 'memory' }),
  clientIdentifier: () => 'test',
}));

import { classPassById, priceGuidance } from '@/config/pricing';
import { classPassOfferPrice } from '@/domain/class-pass';
import { domainErrors } from '@/domain/errors';

import { purchaseClassPassAction } from './class-passes';

const caller = { id: 'user-1', email: 'dancer@example.com', name: 'Dancer', role: 'CUSTOMER' as const, locale: 'en' as const };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireCaller.mockResolvedValue(caller);
  mocks.assertEntitlementOrThrow.mockResolvedValue(undefined);
  mocks.createDirectOrder.mockResolvedValue({ id: 'order-1', orderNumber: 'AD00000001', total: 108_000 });
});

describe('purchaseClassPassAction', () => {
  it('отказывает при выключенном модуле пакетов и не создаёт заказ', async () => {
    mocks.assertEntitlementOrThrow.mockRejectedValue(domainErrors.featureDisabled());

    const result = await purchaseClassPassAction({ passId: 'cp-10' });

    expect(result?.serverError?.code).toBe('FEATURE_DISABLED');
    expect(mocks.createDirectOrder).not.toHaveBeenCalled();
  });

  it('создаёт заказ с типом CLASS_PASS, а не выдаёт пакет', async () => {
    const result = await purchaseClassPassAction({ passId: 'cp-10' });

    expect(mocks.assertEntitlementOrThrow).toHaveBeenCalledWith('packages');

    const offer = classPassById('cp-10')!;
    const perLesson = classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons);

    expect(mocks.createDirectOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        lines: [
          expect.objectContaining({
            type: 'CLASS_PASS',
            unitPrice: perLesson * offer.lessons,
            metadata: expect.objectContaining({ passId: 'cp-10', lessons: offer.lessons }) as unknown,
          }),
        ],
      }),
    );
    expect(result?.data).toMatchObject({ orderId: 'order-1', orderNumber: 'AD00000001' });
  });

  it('вход принимает только идентификатор пакета', async () => {
    /*
     * Цены во входе нет by design: подставить свою сумму нельзя, даже вызвав
     * действие напрямую. Передача «лишнего» поля отбрасывается схемой.
     */
    const result = await purchaseClassPassAction({ passId: 'cp-10', unitPrice: 1 } as never);

    expect(result?.serverError).toBeUndefined();
    const [call] = mocks.createDirectOrder.mock.calls[0] as [{ lines: Array<{ unitPrice: number }> }];
    const offer = classPassById('cp-10')!;
    expect(call.lines[0]!.unitPrice).toBe(
      classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons) * offer.lessons,
    );
  });
});
