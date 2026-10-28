import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    smsDispatch: { count: vi.fn() },
    reviewQueueEntry: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { smsBudget } from '@/config/sms';
import { assertSmsBudget, SmsBudgetExceededError } from '@/lib/notifications/channels';
import { checkSmsBudget } from './budget';

const NOW = new Date('2026-10-28T10:00:00.000Z');

function thrownBy(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('assertSmsBudget', () => {
  it('пропускает отправку, пока счёт ниже лимита', () => {
    expect(() => assertSmsBudget(smsBudget.day.limit - 1, 'day')).not.toThrow();
  });

  it('бросает на достигнутом лимите и называет окно', () => {
    const error = thrownBy(() => assertSmsBudget(smsBudget.month.limit, 'month'));

    expect(error).toBeInstanceOf(SmsBudgetExceededError);
    expect((error as SmsBudgetExceededError).period).toBe('month');
  });
});

describe('checkSmsBudget', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.db.reviewQueueEntry.upsert.mockResolvedValue({});
  });

  it('пропускает отправку, когда оба окна ниже лимита', async () => {
    mocks.db.smsDispatch.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    await expect(checkSmsBudget(NOW)).resolves.toEqual({ ok: true });
    expect(mocks.db.reviewQueueEntry.upsert).not.toHaveBeenCalled();
  });

  it('считает скользящие окна: сутки и 30 дней назад от текущего момента', async () => {
    mocks.db.smsDispatch.count.mockResolvedValue(0);

    await checkSmsBudget(NOW);

    expect(mocks.db.smsDispatch.count).toHaveBeenNthCalledWith(1, {
      where: { createdAt: { gt: new Date('2026-10-27T10:00:00.000Z') } },
    });
    expect(mocks.db.smsDispatch.count).toHaveBeenNthCalledWith(2, {
      where: { createdAt: { gt: new Date('2026-09-28T10:00:00.000Z') } },
    });
  });

  it('дневной лимит: отказ и запись в очередь с ключом суток', async () => {
    mocks.db.smsDispatch.count
      .mockResolvedValueOnce(smsBudget.day.limit)
      .mockResolvedValueOnce(smsBudget.day.limit);

    await expect(checkSmsBudget(NOW)).resolves.toEqual({ ok: false, period: 'day' });
    expect(mocks.db.reviewQueueEntry.upsert).toHaveBeenCalledWith({
      where: { kind_subject: { kind: 'SMS_BUDGET_EXCEEDED', subject: 'sms:day:2026-10-28' } },
      update: {},
      create: expect.objectContaining({ kind: 'SMS_BUDGET_EXCEEDED', subject: 'sms:day:2026-10-28' }),
    });
  });

  it('месячный лимит: отказ с ключом месяца, даже если сутки в норме', async () => {
    mocks.db.smsDispatch.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(smsBudget.month.limit);

    await expect(checkSmsBudget(NOW)).resolves.toEqual({ ok: false, period: 'month' });
    expect(mocks.db.reviewQueueEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind_subject: { kind: 'SMS_BUDGET_EXCEEDED', subject: 'sms:month:2026-10' } },
    }));
  });

  it('сбой записи в очередь не меняет отказ и не выходит наружу', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.db.smsDispatch.count
      .mockResolvedValueOnce(smsBudget.day.limit)
      .mockResolvedValueOnce(smsBudget.day.limit);
    mocks.db.reviewQueueEntry.upsert.mockRejectedValue(new Error('db down'));

    await expect(checkSmsBudget(NOW)).resolves.toEqual({ ok: false, period: 'day' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('ошибка чтения счёта пробрасывается: без известного счёта SMS не уходит', async () => {
    mocks.db.smsDispatch.count.mockRejectedValue(new Error('db down'));

    await expect(checkSmsBudget(NOW)).rejects.toThrow('db down');
  });
});
