import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    reliabilityEvent: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));

import { recordReliabilityEvent, reliabilityFor } from './service';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => unknown) => fn(mocks.db));
  mocks.db.reliabilityEvent.findFirst.mockResolvedValue(null);
  mocks.db.reliabilityEvent.create.mockResolvedValue({});
  mocks.db.user.findUniqueOrThrow.mockResolvedValue({ reliabilityScore: 80 });
  mocks.db.user.update.mockResolvedValue({});
});

describe('recordReliabilityEvent (D-07)', () => {
  it('новое событие пишет строку и пересчитывает счёт', async () => {
    const result = await recordReliabilityEvent({ userId: 'user-1', kind: 'NO_SHOW', refId: 'booking-1' });

    expect(mocks.db.reliabilityEvent.create).toHaveBeenCalledWith({ data: { userId: 'user-1', kind: 'NO_SHOW', refId: 'booking-1' } });
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { reliabilityScore: 65 } });
    expect(result).toEqual({ recorded: true, previous: 80, next: 65 });
  });

  it('повтор того же (userId, kind, refId) не пишет строку и не меняет счёт', async () => {
    mocks.db.reliabilityEvent.findFirst.mockResolvedValue({ id: 'event-1' });

    const result = await recordReliabilityEvent({ userId: 'user-1', kind: 'NO_SHOW', refId: 'booking-1' });

    expect(mocks.db.reliabilityEvent.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', kind: 'NO_SHOW', refId: 'booking-1' },
      select: { id: true },
    });
    expect(result).toEqual({ recorded: false });
    expect(mocks.db.reliabilityEvent.create).not.toHaveBeenCalled();
    expect(mocks.db.user.update).not.toHaveBeenCalled();
  });

  it('дубликат определяется парой kind + refId: другой вид или другая бронь засчитываются', async () => {
    mocks.db.reliabilityEvent.findFirst.mockImplementation(async ({ where }: { where: { kind: string; refId: string } }) =>
      where.kind === 'NO_SHOW' && where.refId === 'booking-1' ? { id: 'event-1' } : null,
    );

    await expect(recordReliabilityEvent({ userId: 'user-1', kind: 'LATE_CANCEL', refId: 'booking-1' })).resolves.toMatchObject({ recorded: true });
    await expect(recordReliabilityEvent({ userId: 'user-1', kind: 'NO_SHOW', refId: 'booking-2' })).resolves.toMatchObject({ recorded: true });
  });

  it('счёт не опускается ниже 0', async () => {
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({ reliabilityScore: 10 });

    await expect(recordReliabilityEvent({ userId: 'user-1', kind: 'NO_SHOW', refId: 'booking-1' })).resolves.toEqual({ recorded: true, previous: 10, next: 0 });
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { reliabilityScore: 0 } });
  });

  it('счёт не поднимается выше 100', async () => {
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({ reliabilityScore: 99 });

    await expect(recordReliabilityEvent({ userId: 'user-1', kind: 'COMPLETED', refId: 'booking-1' })).resolves.toEqual({ recorded: true, previous: 99, next: 100 });
  });

  it('без переданного клиента открывает собственную транзакцию', async () => {
    await recordReliabilityEvent({ userId: 'user-1', kind: 'COMPLETED', refId: 'booking-1' });

    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('reliabilityFor (D-07)', () => {
  it('для неизвестного пользователя возвращает стартовый счёт 100', async () => {
    mocks.db.user.findUnique.mockResolvedValue(null);

    await expect(reliabilityFor('user-1')).resolves.toBe(100);
  });
});
