import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    booking: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    classSession: { updateMany: vi.fn() },
    event: { updateMany: vi.fn() },
    classPass: { update: vi.fn() },
    classPassRedemption: { findUnique: vi.fn(), delete: vi.fn() },
    notification: { findFirst: vi.fn() },
    reliabilityEvent: { findFirst: vi.fn(), create: vi.fn() },
    user: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  notifyBookingConfirmed: vi.fn(),
  notifyBookingCancelled: vi.fn(),
  notifyBookingRequestDue: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/server/booking/notify', () => ({
  notifyBookingConfirmed: mocks.notifyBookingConfirmed,
  notifyBookingCancelled: mocks.notifyBookingCancelled,
  notifyBookingRequestDue: mocks.notifyBookingRequestDue,
}));

import { expireBookingRequests, remindBookingRequests, respondToBookingRequest } from './requests';

const CREATED = new Date('2026-10-01T06:00:00Z');
const EXPIRES = new Date('2026-10-03T08:00:00Z');
// SLA ответа (24 ч от создания) уже прошёл, срок заявки ещё не наступил
const NOW = new Date('2026-10-02T07:00:00Z');

/** Открытая заявка в форме, которую возвращают выборки сервиса. */
function openRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    status: 'PENDING',
    createdAt: CREATED,
    updatedAt: CREATED,
    requestExpiresAt: EXPIRES,
    sessionId: null,
    eventId: null,
    participants: 1,
    startsAt: new Date('2026-10-05T10:00:00Z'),
    cancellationWindowHours: 24,
    instructor: { userId: 'instructor-user-1' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => unknown) => fn(mocks.db));
  mocks.db.booking.findFirst.mockResolvedValue(null);
  mocks.db.booking.findMany.mockResolvedValue([]);
  mocks.db.booking.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.classSession.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.event.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.classPass.update.mockResolvedValue({});
  mocks.db.classPassRedemption.findUnique.mockResolvedValue(null);
  mocks.db.classPassRedemption.delete.mockResolvedValue({});
  mocks.db.notification.findFirst.mockResolvedValue(null);
  mocks.notifyBookingConfirmed.mockResolvedValue(undefined);
  mocks.notifyBookingCancelled.mockResolvedValue(undefined);
  mocks.notifyBookingRequestDue.mockResolvedValue(true);
  mocks.db.reliabilityEvent.findFirst.mockResolvedValue(null);
  mocks.db.reliabilityEvent.create.mockResolvedValue({});
  mocks.db.user.findUniqueOrThrow.mockResolvedValue({ reliabilityScore: 100 });
  mocks.db.user.update.mockResolvedValue({});
});

describe('ответ инструктора на заявку', () => {
  it('принятие переводит заявку в CONFIRMED, снимает срок и шлёт подтверждение клиенту', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest({ sessionId: 'session-1' }));

    const result = await respondToBookingRequest({
      bookingId: 'booking-1',
      instructorId: 'instructor-1',
      decision: 'ACCEPT',
      now: NOW,
    });

    expect(result).toEqual({ status: 'CONFIRMED' });
    expect(mocks.db.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'booking-1', instructorId: 'instructor-1' } }),
    );
    expect(mocks.db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'PENDING', updatedAt: CREATED },
      data: { status: 'CONFIRMED', requestExpiresAt: null },
    });
    expect(mocks.db.classSession.updateMany).not.toHaveBeenCalled();
    expect(mocks.notifyBookingConfirmed).toHaveBeenCalledWith('booking-1');
    expect(mocks.notifyBookingCancelled).not.toHaveBeenCalled();
  });

  it('отказ отменяет бронь, возвращает место и шлёт письмо об отмене без возврата', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest({ sessionId: 'session-1', participants: 2 }));

    await respondToBookingRequest({
      bookingId: 'booking-1',
      instructorId: 'instructor-1',
      decision: 'DECLINE',
      now: NOW,
    });

    expect(mocks.db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'PENDING', updatedAt: CREATED },
      data: { status: 'CANCELLED_BY_PROVIDER', cancelledAt: NOW, cancellationReason: 'REQUEST_DECLINED' },
    });
    expect(mocks.db.classSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', bookedCount: { gte: 2 } },
      data: { bookedCount: { decrement: 2 } },
    });
    expect(mocks.notifyBookingCancelled).toHaveBeenCalledWith('booking-1', 0);
    expect(mocks.notifyBookingConfirmed).not.toHaveBeenCalled();
  });

  it('отказ возвращает урок абонемента, списанный под заявку', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest());
    mocks.db.classPassRedemption.findUnique.mockResolvedValue({ id: 'redemption-1', passId: 'pass-1' });

    await respondToBookingRequest({
      bookingId: 'booking-1',
      instructorId: 'instructor-1',
      decision: 'DECLINE',
      now: NOW,
    });

    expect(mocks.db.classPass.update).toHaveBeenCalledWith({
      where: { id: 'pass-1' },
      data: { lessonsRemaining: { increment: 1 } },
    });
    expect(mocks.db.classPassRedemption.delete).toHaveBeenCalledWith({ where: { id: 'redemption-1' } });
  });

  it('поздний отказ засчитывает LATE_CANCEL инструктору в транзакции отказа', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest({ startsAt: new Date('2026-10-02T12:00:00Z') }));
    mocks.db.user.findUniqueOrThrow.mockResolvedValue({ reliabilityScore: 80 });

    await respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-1', decision: 'DECLINE', now: NOW });

    expect(mocks.db.reliabilityEvent.create).toHaveBeenCalledWith({ data: { userId: 'instructor-user-1', kind: 'LATE_CANCEL', refId: 'booking-1' } });
    expect(mocks.db.user.update).toHaveBeenCalledWith({ where: { id: 'instructor-user-1' }, data: { reliabilityScore: 70 } });
  });

  it('принятие поздней заявки и отказ за окно до старта ничего не засчитывают', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest({ startsAt: new Date('2026-10-02T12:00:00Z') }));
    await respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-1', decision: 'ACCEPT', now: NOW });

    mocks.db.booking.findFirst.mockResolvedValue(openRequest());
    await respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-1', decision: 'DECLINE', now: NOW });

    expect(mocks.db.reliabilityEvent.create).not.toHaveBeenCalled();
  });

  it('после срока ответ отклоняется и бронь не меняется', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest({ requestExpiresAt: NOW }));

    await expect(
      respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-1', decision: 'ACCEPT', now: NOW }),
    ).rejects.toMatchObject({ messageKey: 'booking.request.expired' });
    expect(mocks.db.booking.updateMany).not.toHaveBeenCalled();
  });

  it('уже решённую заявку повторно не меняет', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest({ status: 'CONFIRMED', requestExpiresAt: null }));

    await expect(
      respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-1', decision: 'DECLINE', now: NOW }),
    ).rejects.toMatchObject({ messageKey: 'booking.request.notPending' });
    expect(mocks.db.booking.updateMany).not.toHaveBeenCalled();
    expect(mocks.notifyBookingCancelled).not.toHaveBeenCalled();
  });

  it('чужую или несуществующую бронь не находит', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(null);

    await expect(
      respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-2', decision: 'ACCEPT', now: NOW }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('если заявку опередили параллельно, второй ответ не применяется', async () => {
    mocks.db.booking.findFirst.mockResolvedValue(openRequest());
    mocks.db.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      respondToBookingRequest({ bookingId: 'booking-1', instructorId: 'instructor-1', decision: 'ACCEPT', now: NOW }),
    ).rejects.toMatchObject({ messageKey: 'booking.request.notPending' });
    expect(mocks.notifyBookingConfirmed).not.toHaveBeenCalled();
  });
});

describe('истечение заявок без ответа', () => {
  it('истекает просроченную заявку: место возвращается, клиент получает письмо', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest({ requestExpiresAt: NOW, sessionId: 'session-1' })]);

    const result = await expireBookingRequests(NOW);

    expect(result).toEqual({ expired: 1 });
    expect(mocks.db.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'PENDING', updatedAt: CREATED },
      data: { status: 'EXPIRED', cancellationReason: 'REQUEST_TIMEOUT' },
    });
    expect(mocks.db.classSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', bookedCount: { gte: 1 } },
      data: { bookedCount: { decrement: 1 } },
    });
    expect(mocks.notifyBookingCancelled).toHaveBeenCalledWith('booking-1', 0);
  });

  it('не трогает заявку, срок которой ещё не наступил', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest()]);

    const result = await expireBookingRequests(NOW);

    expect(result).toEqual({ expired: 0 });
    expect(mocks.db.booking.updateMany).not.toHaveBeenCalled();
  });

  it('не возвращает место повторно, если заявку уже решили', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest({ requestExpiresAt: NOW })]);
    mocks.db.booking.updateMany.mockResolvedValue({ count: 0 });

    const result = await expireBookingRequests(NOW);

    expect(result).toEqual({ expired: 0 });
    expect(mocks.db.classSession.updateMany).not.toHaveBeenCalled();
    expect(mocks.notifyBookingCancelled).not.toHaveBeenCalled();
  });
});

describe('напоминание инструктору о заявке', () => {
  it('напоминает, когда прошёл SLA ответа', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest()]);

    const result = await remindBookingRequests(NOW);

    expect(result).toEqual({ reminded: 1 });
    expect(mocks.notifyBookingRequestDue).toHaveBeenCalledWith('booking-1', 'instructor-user-1', EXPIRES);
  });

  it('до истечения SLA не напоминает', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest()]);

    const result = await remindBookingRequests(new Date('2026-10-01T10:00:00Z'));

    expect(result).toEqual({ reminded: 0 });
    expect(mocks.notifyBookingRequestDue).not.toHaveBeenCalled();
  });

  it('заявка на скорую дату получает напоминание сразу', async () => {
    mocks.db.booking.findMany.mockResolvedValue([
      openRequest({ requestExpiresAt: new Date('2026-10-01T11:00:00Z') }),
    ]);

    const result = await remindBookingRequests(CREATED);

    expect(result).toEqual({ reminded: 1 });
  });

  it('не шлёт второе напоминание по той же заявке', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest()]);
    mocks.db.notification.findFirst.mockResolvedValue({ id: 'notification-1' });

    const result = await remindBookingRequests(NOW);

    expect(result).toEqual({ reminded: 0 });
    expect(mocks.notifyBookingRequestDue).not.toHaveBeenCalled();
  });

  it('не считает напоминание, если письмо не поставлено (канал отключён)', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest()]);
    mocks.notifyBookingRequestDue.mockResolvedValue(false);

    const result = await remindBookingRequests(NOW);

    expect(result).toEqual({ reminded: 0 });
  });

  it('пропускает заявку без инструктора', async () => {
    mocks.db.booking.findMany.mockResolvedValue([openRequest({ instructor: null })]);

    const result = await remindBookingRequests(NOW);

    expect(result).toEqual({ reminded: 0 });
    expect(mocks.notifyBookingRequestDue).not.toHaveBeenCalled();
  });
});
