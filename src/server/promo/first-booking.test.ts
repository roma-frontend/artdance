import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFirstBookingPromo, consumeFirstBookingPromo, type FirstBookingPromoInput } from './first-booking';

const mocks = vi.hoisted(() => ({
  db: {
    promoCode: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    booking: { count: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));

const now = new Date('2026-10-01T08:00:00Z');

const promoRow = {
  id: 'promo-1',
  code: 'FIRST10',
  type: 'PERCENT',
  value: 10,
  minOrderTotal: null,
  maxDiscount: null,
  appliesTo: ['PRIVATE_SESSION'],
  usageLimit: null,
  usageCount: 0,
  perUserLimit: 1,
  startsAt: null,
  endsAt: null,
  isActive: true,
  deletedAt: null,
};

function promo(overrides: Record<string, unknown> = {}) {
  return { ...promoRow, ...overrides };
}

function request(overrides: Partial<FirstBookingPromoInput> = {}): FirstBookingPromoInput {
  return { userId: 'customer-1', promoCode: ' first10 ', lessonPrice: 13_200, travelFee: 0, lineType: 'PRIVATE_SESSION', now, ...overrides };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.promoCode.findFirst.mockResolvedValue(promo());
  mocks.db.booking.count.mockResolvedValue(0);
});

describe('applyFirstBookingPromo', () => {
  it('считает процент от цены урока, округляет как корзина и ничего не пишет', async () => {
    const result = await applyFirstBookingPromo(request({ lessonPrice: 12_345 }));

    expect(result).toEqual({ promoCodeId: 'promo-1', discountAmount: 1_235, usageLimit: null });
    expect(mocks.db.promoCode.findFirst).toHaveBeenCalledWith({ where: { code: 'FIRST10', deletedAt: null } });
    expect(mocks.db.promoCode.update).not.toHaveBeenCalled();
    expect(mocks.db.promoCode.updateMany).not.toHaveBeenCalled();
  });

  it('процент считается от цены урока, без выезда', async () => {
    const result = await applyFirstBookingPromo(request({ lessonPrice: 10_000, travelFee: 1_000 }));

    expect(result.discountAmount).toBe(1_000);
  });

  it('фиксированная скидка берётся как есть', async () => {
    mocks.db.promoCode.findFirst.mockResolvedValue(promo({ type: 'FIXED', value: 3_000 }));

    const result = await applyFirstBookingPromo(request());

    expect(result.discountAmount).toBe(3_000);
  });

  it('maxDiscount ограничивает процентную скидку', async () => {
    // 20% от 13 200 = 2 640, потолок 2 000
    mocks.db.promoCode.findFirst.mockResolvedValue(promo({ value: 20, maxDiscount: 2_000 }));

    const result = await applyFirstBookingPromo(request());

    expect(result.discountAmount).toBe(2_000);
  });

  it('скидка меньше всей суммы брони, но больше цены урока: часть уходит на выезд', async () => {
    mocks.db.promoCode.findFirst.mockResolvedValue(promo({ type: 'FIXED', value: 13_500 }));

    const result = await applyFirstBookingPromo(request({ lessonPrice: 13_200, travelFee: 1_000 }));

    expect(result.discountAmount).toBe(13_500);
  });

  it('скидка, которая покрывает всю бронь, отклоняется: оплата нулевой суммы не предусмотрена', async () => {
    mocks.db.promoCode.findFirst.mockResolvedValue(promo({ type: 'FIXED', value: 50_000 }));

    await expect(applyFirstBookingPromo(request({ lessonPrice: 13_200, travelFee: 1_000 }))).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
  });

  it('читает через транзакцию брони, если она передана', async () => {
    const tx = { promoCode: { findFirst: vi.fn().mockResolvedValue(promo()) }, booking: { count: vi.fn().mockResolvedValue(0) } };

    const result = await applyFirstBookingPromo(request({ tx: tx as unknown as FirstBookingPromoInput['tx'] }));

    expect(result.discountAmount).toBe(1_320);
    expect(tx.promoCode.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.db.promoCode.findFirst).not.toHaveBeenCalled();
  });

  it('код не найден или удалён → VALIDATION_FAILED', async () => {
    mocks.db.promoCode.findFirst.mockResolvedValue(null);

    await expect(applyFirstBookingPromo(request())).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
  });

  it.each<[string, Record<string, unknown>]>([
    ['выключен', { isActive: false }],
    ['ещё не начался', { startsAt: new Date('2026-10-02T00:00:00Z') }],
    ['истёк в момент брони', { endsAt: now }],
    ['не для этого типа занятия', { appliesTo: ['CLASS_BOOKING'] }],
    ['сумма ниже минимума заказа', { minOrderTotal: 20_000 }],
  ])('код %s → VALIDATION_FAILED', async (_label, overrides) => {
    mocks.db.promoCode.findFirst.mockResolvedValue(promo(overrides));

    await expect(applyFirstBookingPromo(request())).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
  });

  it('границы: начало акции в момент брони и минимум ровно по сумме — код действует', async () => {
    mocks.db.promoCode.findFirst.mockResolvedValue(promo({ startsAt: now, minOrderTotal: 13_200 }));

    const result = await applyFirstBookingPromo(request());

    expect(result.discountAmount).toBe(1_320);
  });

  it('не первая бронь → VALIDATION_FAILED', async () => {
    mocks.db.booking.count.mockResolvedValueOnce(1);

    await expect(applyFirstBookingPromo(request())).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
  });

  it('лимит использований исчерпан → VALIDATION_FAILED', async () => {
    mocks.db.promoCode.findFirst.mockResolvedValue(promo({ usageLimit: 100, usageCount: 100 }));

    await expect(applyFirstBookingPromo(request())).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
  });

  it('лимит на клиента исчерпан → VALIDATION_FAILED', async () => {
    // Первый подсчёт: прежних броней нет. Второй: уже есть бронь с этим кодом.
    mocks.db.booking.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(applyFirstBookingPromo(request())).rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
  });
});

describe('consumeFirstBookingPromo', () => {
  const tx = mocks.db as unknown as Parameters<typeof consumeFirstBookingPromo>[0];

  it('без лимита увеличивает счётчик', async () => {
    mocks.db.promoCode.update.mockResolvedValue({});

    await consumeFirstBookingPromo(tx, { promoCodeId: 'promo-1', discountAmount: 1_320, usageLimit: null });

    expect(mocks.db.promoCode.update).toHaveBeenCalledWith({ where: { id: 'promo-1' }, data: { usageCount: { increment: 1 } } });
  });

  it('с лимитом списывает условно и отказывает, если последнее использование уже занято', async () => {
    mocks.db.promoCode.updateMany.mockResolvedValue({ count: 0 });

    await expect(consumeFirstBookingPromo(tx, { promoCodeId: 'promo-1', discountAmount: 1_320, usageLimit: 5 }))
      .rejects.toMatchObject({ code: 'VALIDATION_FAILED', field: 'promoCode' });
    expect(mocks.db.promoCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'promo-1', usageCount: { lt: 5 } },
      data: { usageCount: { increment: 1 } },
    });
  });

  it('с лимитом списывает, если место есть', async () => {
    mocks.db.promoCode.updateMany.mockResolvedValue({ count: 1 });

    await expect(consumeFirstBookingPromo(tx, { promoCodeId: 'promo-1', discountAmount: 1_320, usageLimit: 5 })).resolves.toBeUndefined();
  });
});
