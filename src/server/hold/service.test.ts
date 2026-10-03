import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  slotHold: { deleteMany: vi.fn(), create: vi.fn() },
  transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: { $transaction: mocks.transaction } }));

import { Prisma } from '@/generated/prisma/client';
import { createSlotHold, type HoldRequest } from './service';

const now = new Date('2026-10-01T08:00:00Z');
const startsAt = new Date('2026-10-06T06:00:00Z');
const endsAt = new Date('2026-10-06T07:00:00Z');
const input: HoldRequest = {
  instructorId: 'instructor-1',
  userId: 'customer-1',
  startsAt,
  endsAt,
  durationMinutes: 60,
  rules: [{ weekday: 2, startTime: '10:00', endTime: '12:00', isActive: true }],
  holidays: [],
  busy: [],
  now,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.transaction.mockImplementation(async handler => handler({ slotHold: mocks.slotHold }));
  mocks.slotHold.deleteMany.mockResolvedValue({ count: 1 });
  mocks.slotHold.create.mockResolvedValue({ id: 'new-hold', startsAt, endsAt });
});

describe('удержание: просроченный уникальный ключ', () => {
  it.each([
    { instructorId: 'instructor-1', roomId: null },
    { instructorId: null, roomId: 'room-1' },
  ])('освобождает только просроченный ключ ресурса $instructorId/$roomId', async resource => {
    await expect(createSlotHold({ ...input, ...resource })).resolves.toMatchObject({ id: 'new-hold' });
    expect(mocks.slotHold.deleteMany).toHaveBeenCalledWith({ where: {
      ...resource, startsAt, expiresAt: { lte: now },
    } });
    expect(mocks.slotHold.deleteMany.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.slotHold.create.mock.invocationCallOrder[0]!);
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });

  it('активное удержание сохраняет отказ уникального индекса', async () => {
    mocks.slotHold.deleteMany.mockResolvedValue({ count: 0 });
    mocks.slotHold.create.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed', { code: 'P2002', clientVersion: 'test' },
    ));
    await expect(createSlotHold(input)).rejects.toMatchObject({ code: 'SLOT_CONFLICT' });
    expect(mocks.slotHold.deleteMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: { lte: now } }),
    }));
  });
});