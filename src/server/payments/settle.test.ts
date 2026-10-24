/**
 * ДОСТАВКА ОПЛАЧЕННОГО ЗАКАЗА — ровно один раз, даже при повторах вебхука.
 *
 * Проверяется свойство, ради которого `settle.ts` существует отдельным шагом:
 * подтверждение оплаты приходит от провайдера (и повторно), а пакет, подписка,
 * комиссия и реферальный бонус выдаются один раз. Ошибка здесь стоит денег:
 * двойной пакет — это занятия, за которые не заплатили, задвоенная комиссия —
 * выплата инструктору из ниоткуда.
 *
 * Заявка на доставку моделируется так же, как в коде: `UPDATE … WHERE settledAt
 * IS NULL` возвращает `count`. Первый вызов получает `count: 1`, повторный — 0.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  order: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  subscription: { findFirst: vi.fn(), create: vi.fn() },
  courseEnrollment: { upsert: vi.fn() },
  commissionRecord: { create: vi.fn() },
  referral: { findFirst: vi.fn() },
  purchaseClassPass: vi.fn(),
  creditWallet: vi.fn(),
  payReferralBonus: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    order: mocks.order,
    subscription: mocks.subscription,
    courseEnrollment: mocks.courseEnrollment,
    commissionRecord: mocks.commissionRecord,
    referral: mocks.referral,
  },
}));
vi.mock('@/server/class-pass/service', () => ({ purchaseClassPass: mocks.purchaseClassPass }));
vi.mock('@/server/wallet/service', () => ({ creditWallet: mocks.creditWallet }));
vi.mock('@/server/referral/service', () => ({ payReferralBonus: mocks.payReferralBonus }));
vi.mock('@/lib/audit', () => ({ recordAudit: mocks.recordAudit }));

import { settlePaidOrder } from './settle';

const NOW = new Date('2026-10-21T12:00:00Z');

/* `EVENT_TICKET` — комиссионная линия; `PRODUCT` ею не является. */
function orderWith(items: Array<Record<string, unknown>> = [{ id: 'item-1', type: 'EVENT_TICKET', unitPrice: 10_000, lineTotal: 10_000, metadata: null, commission: null }]) {
  return { id: 'order-1', userId: 'user-1', items };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.order.updateMany.mockResolvedValue({ count: 1 });
  mocks.order.findUnique.mockResolvedValue(orderWith());
  mocks.order.update.mockResolvedValue({ id: 'order-1' });
  mocks.subscription.findFirst.mockResolvedValue(null);
  mocks.subscription.create.mockResolvedValue({ id: 'sub-1' });
  mocks.courseEnrollment.upsert.mockResolvedValue({ id: 'enrol-1' });
  mocks.commissionRecord.create.mockResolvedValue({ id: 'commission-1' });
  mocks.referral.findFirst.mockResolvedValue(null);
  mocks.purchaseClassPass.mockResolvedValue({ id: 'pass-1' });
  mocks.creditWallet.mockResolvedValue({ balance: 0, idempotent: false });
  mocks.payReferralBonus.mockResolvedValue({ bonus: 3_000 });
});

describe('идемпотентность доставки', () => {
  it('повторная доставка проигрывает заявку и ничего не выдаёт второй раз', async () => {
    const first = await settlePaidOrder('order-1', NOW);
    expect(first.settled).toBe(true);

    /* Вебхук доставлен повторно: `settledAt` уже стоит. */
    mocks.order.updateMany.mockResolvedValue({ count: 0 });
    const second = await settlePaidOrder('order-1', NOW);

    expect(second).toEqual({ settled: false, effects: [] });
    /* Заказ прочитан один раз: повтор не доходит до выдачи. */
    expect(mocks.order.findUnique).toHaveBeenCalledTimes(1);
    expect(mocks.commissionRecord.create).toHaveBeenCalledTimes(1);
    expect(mocks.creditWallet).not.toHaveBeenCalled();
  });

  it('заявка привязана к оплаченным статусам, а не к отменённым и возвращённым', async () => {
    await settlePaidOrder('order-1', NOW);

    expect(mocks.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: { in: ['PAID', 'PACKING', 'SHIPPED', 'DELIVERED'] }, settledAt: null },
      data: { settledAt: NOW },
    });
  });

  it('сбой доставки снимает отметку, чтобы заказ можно было доставить снова', async () => {
    mocks.order.findUnique.mockRejectedValue(new Error('database gone'));

    await expect(settlePaidOrder('order-1', NOW)).rejects.toThrow('database gone');

    expect(mocks.order.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'order-1', settledAt: { not: null } },
      data: { settledAt: null },
    });
  });
});

describe('комиссия платформы', () => {
  it('записывается по линии заказа, с которым связана', async () => {
    const result = await settlePaidOrder('order-1', NOW);

    expect(result.effects).toContain('commission');
    expect(mocks.commissionRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderItemId: 'item-1',
          grossAmount: 10_000,
          platformFee: expect.any(Number) as number,
        }),
      }),
    );
  });

  it('не задваивается, если запись уже стоит', async () => {
    mocks.order.findUnique.mockResolvedValue(
      orderWith([{ id: 'item-1', type: 'EVENT_TICKET', unitPrice: 10_000, lineTotal: 10_000, metadata: null, commission: { id: 'existing' } }]),
    );

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.effects).not.toContain('commission');
    expect(mocks.commissionRecord.create).not.toHaveBeenCalled();
  });

  it('гонка двух доставок не роняет заказ: уникальный orderItemId выигрывает', async () => {
    mocks.commissionRecord.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    const result = await settlePaidOrder('order-1', NOW);

    /* Запись поставил соседний обработчик — доставка остального продолжается. */
    expect(result.settled).toBe(true);
    expect(result.effects).not.toContain('commission');
  });

  it('несвязанная ошибка записи комиссии не проглатывается', async () => {
    mocks.commissionRecord.create.mockRejectedValue(new Error('disk full'));

    await expect(settlePaidOrder('order-1', NOW)).rejects.toThrow('disk full');
  });
});

describe('выдача купленного', () => {
  it('пакет занятий выдаётся в режиме доставки, а не покупки', async () => {
    mocks.order.findUnique.mockResolvedValue(
      orderWith([{ id: 'item-1', type: 'CLASS_PASS', unitPrice: 50_000, lineTotal: 50_000, metadata: { passId: 'cp-10' }, commission: null }]),
    );

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.effects).toContain('classPass');
    expect(mocks.purchaseClassPass).toHaveBeenCalledWith(
      expect.objectContaining({ passId: 'cp-10', deliverOnly: true, idempotencyKey: 'classpass:order-1' }),
    );
  });

  it('пополнение кошелька зачисляется и переживает выключение модуля', async () => {
    mocks.order.findUnique.mockResolvedValue(
      orderWith([{ id: 'item-1', type: 'WALLET_TOPUP', unitPrice: 20_000, lineTotal: 20_000, metadata: null, commission: null }]),
    );

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.effects).toContain('wallet.topup');
    expect(mocks.creditWallet).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', amount: 20_000, kind: 'CREDIT_TOPUP', refId: 'wallet:order-1' }),
    );
  });

  it('подписка активируется один раз на план', async () => {
    mocks.order.findUnique.mockResolvedValue(
      orderWith([{ id: 'item-1', type: 'SUBSCRIPTION', unitPrice: 35_000, lineTotal: 35_000, metadata: { planId: 'pro', interval: 'MONTHLY' }, commission: null }]),
    );

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.effects).toContain('subscription');
    expect(mocks.subscription.create).toHaveBeenCalledTimes(1);

    /* Вторая покупка того же плана не создаёт вторую активную подписку. */
    mocks.subscription.findFirst.mockResolvedValue({ id: 'sub-1' });
    mocks.order.updateMany.mockResolvedValue({ count: 1 });
    const again = await settlePaidOrder('order-1', NOW);
    expect(again.effects).not.toContain('subscription');
    expect(mocks.subscription.create).toHaveBeenCalledTimes(1);
  });

  it('запись на курс не создаёт вторую запись на повторе', async () => {
    mocks.order.findUnique.mockResolvedValue(
      orderWith([{ id: 'item-1', type: 'COURSE_ENROLLMENT', unitPrice: 25_000, lineTotal: 25_000, metadata: { courseId: 'course-1' }, commission: null }]),
    );

    await settlePaidOrder('order-1', NOW);

    expect(mocks.courseEnrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { courseId_userId: { courseId: 'course-1', userId: 'user-1' } },
      }),
    );
  });

  it('неизвестный план не роняет доставку остального', async () => {
    mocks.order.findUnique.mockResolvedValue(
      orderWith([{ id: 'item-1', type: 'SUBSCRIPTION', unitPrice: 1, lineTotal: 1, metadata: { planId: 'gone' }, commission: null }]),
    );

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.settled).toBe(true);
    expect(mocks.subscription.create).not.toHaveBeenCalled();
  });
});

describe('реферальный бонус', () => {
  it('выплачивается первой оплатой реферала', async () => {
    mocks.referral.findFirst.mockResolvedValue({ id: 'referral-1' });

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.effects).toContain('referral');
    expect(mocks.payReferralBonus).toHaveBeenCalledWith('referral-1', { deliverOnly: true });
  });

  it('сбой выплаты не отменяет доставку оплаченного', async () => {
    mocks.referral.findFirst.mockResolvedValue({ id: 'referral-1' });
    mocks.payReferralBonus.mockRejectedValue(new Error('referrals off'));

    const result = await settlePaidOrder('order-1', NOW);

    expect(result.settled).toBe(true);
    expect(result.effects).not.toContain('referral');
  });

  it('гостевой заказ без пользователя не пытается платить бонус', async () => {
    mocks.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: null,
      items: [{ id: 'item-1', type: 'PRODUCT', unitPrice: 1_000, lineTotal: 1_000, metadata: null, commission: null }],
    });

    await settlePaidOrder('order-1', NOW);

    expect(mocks.referral.findFirst).not.toHaveBeenCalled();
  });
});
