/**
 * Тесты политики отмены и переноса. Обязательны по конвенциям: здесь считаются
 * деньги, и разница в один драм превращается в спор с эквайрером.
 *
 * Условия берутся из снимка брони, а не из конфигурации. В тестах это проверяется
 * прямо: снимок со старыми условиями решается по старым условиям, даже если
 * текущие правила платформы другие.
 */

import { describe, expect, it } from 'vitest';

import { booking as bookingRules } from '@/config/business';
import type { BookingStatus } from '@/domain/enums';
import { isDomainError } from '@/domain/errors';
import type { Interval } from '@/lib/time/interval';

import {
  cancellationOutcome,
  cancellationRefusalMessageKey,
  refundAmountFor,
  rescheduleOutcome,
  rescheduleRefusalMessageKey,
  type BookingSnapshot,
} from './policy';

const utc = (iso: string): Date => new Date(iso);

/** Суббота 12 сентября 2026, 18:00 по Еревану. Цена — из макета. */
function snapshot(overrides: Partial<BookingSnapshot> = {}): BookingSnapshot {
  return {
    startsAt: utc('2026-09-12T14:00:00Z'),
    status: 'CONFIRMED',
    totalPrice: 12_000,
    cancellationWindowHours: bookingRules.freeCancellationHours,
    lateCancellationRate: bookingRules.lateCancellationFeeRate,
    rescheduleWindowHours: bookingRules.freeRescheduleHours,
    rescheduleCount: 0,
    maxReschedules: bookingRules.maxReschedulesPerBooking,
    ...overrides,
  };
}

const target = (startIso: string, endIso: string, price?: number): Interval & { price?: number } => ({
  start: utc(startIso),
  end: utc(endIso),
  ...(price === undefined ? {} : { price }),
});

describe('cancellationOutcome', () => {
  it('отмена задолго до начала — бесплатная', () => {
    /** Трое суток до занятия при окне 24 часа. */
    const outcome = cancellationOutcome(snapshot(), utc('2026-09-09T14:00:00Z'));

    expect(outcome).toEqual({ kind: 'free' });
  });

  it('граница окна включительна: ровно за 24 часа — бесплатно', () => {
    const outcome = cancellationOutcome(snapshot(), utc('2026-09-11T14:00:00Z'));

    expect(outcome.kind).toBe('free');
  });

  it('минутой позже границы удерживается доля из снимка брони', () => {
    const outcome = cancellationOutcome(snapshot(), utc('2026-09-11T14:01:00Z'));

    expect(outcome).toEqual({ kind: 'fee', rate: 0.5, amount: 6_000 });
  });

  it('условия берутся из снимка, а не из текущего конфига', () => {
    /*
     * Бронь создана, когда окно было 48 часов, а удержание — 30%. Изменение
     * конфигурации не должно переписывать историю: спор решается по тем условиям,
     * которые человек видел при бронировании.
     */
    const old = snapshot({ cancellationWindowHours: 48, lateCancellationRate: 0.3 });

    expect(cancellationOutcome(old, utc('2026-09-11T14:00:00Z'))).toEqual({
      kind: 'fee',
      rate: 0.3,
      amount: 3_600,
    });
  });

  it('нулевая ставка удержания означает бесплатную отмену в любой момент до начала', () => {
    const generous = snapshot({ lateCancellationRate: 0 });

    expect(cancellationOutcome(generous, utc('2026-09-12T13:59:00Z')).kind).toBe('free');
  });

  it('после начала занятия отменять нечего', () => {
    const outcome = cancellationOutcome(snapshot(), utc('2026-09-12T14:00:00Z'));

    expect(outcome).toEqual({ kind: 'forbidden', reason: 'ALREADY_STARTED' });
  });

  it.each<BookingStatus>([
    'COMPLETED',
    'CANCELLED_BY_CUSTOMER',
    'CANCELLED_BY_PROVIDER',
    'NO_SHOW',
    'RESCHEDULED',
    'WAITLISTED',
    'EXPIRED',
  ])('статус %s отменить нельзя', (status) => {
    const outcome = cancellationOutcome(snapshot({ status }), utc('2026-09-09T14:00:00Z'));

    expect(outcome).toEqual({ kind: 'forbidden', reason: 'NOT_ACTIVE' });
  });

  it('неоплаченная бронь в PENDING отменяется как обычная', () => {
    expect(cancellationOutcome(snapshot({ status: 'PENDING' }), utc('2026-09-09T14:00:00Z'))).toEqual(
      { kind: 'free' },
    );
  });

  it('удержание округляется одним правилом с остальными деньгами', () => {
    /** 0.5 от 12 345 = 6 172,5 → 6 173 (половина вверх, как у эквайрера). */
    const outcome = cancellationOutcome(
      snapshot({ totalPrice: 12_345 }),
      utc('2026-09-11T20:00:00Z'),
    );

    expect(outcome).toEqual({ kind: 'fee', rate: 0.5, amount: 6_173 });
  });
});

describe('refundAmountFor', () => {
  it('бесплатная отмена возвращает всё оплаченное', () => {
    expect(refundAmountFor({ kind: 'free' }, 12_000)).toBe(12_000);
  });

  it('поздняя отмена возвращает оплаченное минус удержание', () => {
    expect(refundAmountFor({ kind: 'fee', rate: 0.5, amount: 6_000 }, 12_000)).toBe(6_000);
  });

  it('возврат не превышает оплаченное при частичной оплате', () => {
    /** Клиент внёс 4 000 ֏, удержание — 6 000: возвращать нечего, но и долга нет. */
    expect(refundAmountFor({ kind: 'fee', rate: 0.5, amount: 6_000 }, 4_000)).toBe(0);
  });

  it('ничего не оплачено — ничего не возвращается', () => {
    expect(refundAmountFor({ kind: 'free' }, 0)).toBe(0);
  });

  it('запрещённая отмена бросает REFUND_NOT_ALLOWED, а не возвращает ноль', () => {
    try {
      refundAmountFor({ kind: 'forbidden', reason: 'NOT_ACTIVE' }, 12_000);
      expect.unreachable('расчёт возврата по запрещённой отмене — ошибка вызывающего кода');
    } catch (error) {
      if (!isDomainError(error)) throw error;
      expect(error.code).toBe('REFUND_NOT_ALLOWED');
    }
  });
});

describe('rescheduleOutcome', () => {
  /** Пятница 11 сентября, 12:00 по Еревану: до занятия 30 часов. */
  const wellBefore = utc('2026-09-11T08:00:00Z');
  const nextWeek = target('2026-09-19T14:00:00Z', '2026-09-19T15:00:00Z');

  it('перенос в окне разрешён и не меняет цену', () => {
    expect(rescheduleOutcome(snapshot(), nextWeek, wellBefore)).toEqual({
      kind: 'allowed',
      priceDifference: 0,
      remaining: 1,
    });
  });

  it('разница в цене считается от стоимости нового времени', () => {
    const outcome = rescheduleOutcome(
      snapshot(),
      target('2026-09-19T14:00:00Z', '2026-09-19T15:00:00Z', 15_000),
      wellBefore,
    );

    expect(outcome).toMatchObject({ kind: 'allowed', priceDifference: 3_000 });
  });

  it('дешёвое новое время даёт отрицательную разницу — возврат, а не ноль', () => {
    const outcome = rescheduleOutcome(
      snapshot(),
      target('2026-09-19T14:00:00Z', '2026-09-19T15:00:00Z', 9_000),
      wellBefore,
    );

    expect(outcome).toMatchObject({ priceDifference: -3_000 });
  });

  it('лимит переносов исчерпан', () => {
    const used = snapshot({ rescheduleCount: bookingRules.maxReschedulesPerBooking });

    expect(rescheduleOutcome(used, nextWeek, wellBefore)).toEqual({
      kind: 'forbidden',
      reason: 'LIMIT_REACHED',
    });
  });

  it('последний доступный перенос сообщает, что запаса больше нет', () => {
    const almost = snapshot({ rescheduleCount: bookingRules.maxReschedulesPerBooking - 1 });

    expect(rescheduleOutcome(almost, nextWeek, wellBefore)).toMatchObject({ remaining: 0 });
  });

  it('позже окна перенос закрыт: остаётся отмена по общим правилам', () => {
    /** Шесть часов до начала при окне переноса 12 часов. */
    const outcome = rescheduleOutcome(snapshot(), nextWeek, utc('2026-09-12T08:00:00Z'));

    expect(outcome).toEqual({ kind: 'forbidden', reason: 'WINDOW_CLOSED' });
  });

  it('граница окна переноса включительна', () => {
    /** Ровно 12 часов до начала. */
    const outcome = rescheduleOutcome(snapshot(), nextWeek, utc('2026-09-12T02:00:00Z'));

    expect(outcome.kind).toBe('allowed');
  });

  it('окно переноса берётся из снимка брони', () => {
    const generous = snapshot({ rescheduleWindowHours: 2 });
    const outcome = rescheduleOutcome(generous, nextWeek, utc('2026-09-12T08:00:00Z'));

    expect(outcome.kind).toBe('allowed');
  });

  it('новое время в прошлом отклоняется', () => {
    const outcome = rescheduleOutcome(
      snapshot(),
      target('2026-09-10T14:00:00Z', '2026-09-10T15:00:00Z'),
      wellBefore,
    );

    expect(outcome).toEqual({ kind: 'forbidden', reason: 'INVALID_TARGET' });
  });

  it('перевёрнутый интервал отклоняется, а не считается длительностью в минус', () => {
    const outcome = rescheduleOutcome(
      snapshot(),
      target('2026-09-19T15:00:00Z', '2026-09-19T14:00:00Z'),
      wellBefore,
    );

    expect(outcome).toEqual({ kind: 'forbidden', reason: 'INVALID_TARGET' });
  });

  it('перенос на то же время — не перенос', () => {
    const outcome = rescheduleOutcome(
      snapshot(),
      target('2026-09-12T14:00:00Z', '2026-09-12T15:00:00Z'),
      wellBefore,
    );

    expect(outcome).toEqual({ kind: 'forbidden', reason: 'SAME_TIME' });
  });

  it('завершённую бронь перенести нельзя', () => {
    expect(rescheduleOutcome(snapshot({ status: 'COMPLETED' }), nextWeek, wellBefore)).toEqual({
      kind: 'forbidden',
      reason: 'NOT_ACTIVE',
    });
  });

  it('начавшуюся бронь перенести нельзя', () => {
    expect(rescheduleOutcome(snapshot(), nextWeek, utc('2026-09-12T14:00:00Z'))).toEqual({
      kind: 'forbidden',
      reason: 'ALREADY_STARTED',
    });
  });
});

describe('ключи объяснений отказа', () => {
  it('у каждой причины отказа в отмене есть свой ключ', () => {
    expect(cancellationRefusalMessageKey('ALREADY_STARTED')).toBe('booking.cancelForbidden');
    expect(cancellationRefusalMessageKey('NOT_ACTIVE')).toBe('booking.cancelForbidden');
  });

  it('лимит и окно переноса объясняются разными строками', () => {
    expect(rescheduleRefusalMessageKey('LIMIT_REACHED')).toBe('booking.rescheduleLimit');
    expect(rescheduleRefusalMessageKey('WINDOW_CLOSED')).toBe('booking.rescheduleWindowClosed');
  });
});
