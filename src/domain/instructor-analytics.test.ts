import { describe, expect, it } from 'vitest';

import { summarizeInstructorBookings, type InstructorBookingRow } from './instructor-analytics';

const now = new Date('2026-10-31T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

function row(overrides: Partial<InstructorBookingRow>): InstructorBookingRow {
  return { status: 'COMPLETED', customerId: 'c1', totalPrice: 10_000, startsAt: daysAgo(1), ...overrides };
}

describe('summarizeInstructorBookings', () => {
  it('считает исходы и выручку только по состоявшимся занятиям', () => {
    const summary = summarizeInstructorBookings(
      [
        row({ status: 'COMPLETED', totalPrice: 12_000 }),
        row({ status: 'COMPLETED', customerId: 'c2', totalPrice: 8_000 }),
        row({ status: 'CANCELLED_BY_CUSTOMER' }),
        row({ status: 'CANCELLED_BY_PROVIDER' }),
        row({ status: 'NO_SHOW', customerId: 'c3' }),
        row({ status: 'CONFIRMED', customerId: 'c4' }),
      ],
      now,
      30,
    );

    expect(summary).toMatchObject({
      windowDays: 30,
      completed: 2,
      cancelled: 2,
      noShows: 1,
      unmarked: 1,
      revenue: 20_000,
      averageCheck: 10_000,
      uniqueClients: 2,
    });
  });

  it('не учитывает брони вне окна и будущие занятия', () => {
    const summary = summarizeInstructorBookings(
      [
        row({ startsAt: daysAgo(31) }),
        row({ startsAt: new Date(now.getTime() + 60_000) }),
        row({ startsAt: daysAgo(29) }),
      ],
      now,
      30,
    );

    expect(summary.completed).toBe(1);
  });

  it('не считает PENDING, RESCHEDULED, WAITLISTED и EXPIRED исходами', () => {
    const summary = summarizeInstructorBookings(
      [
        row({ status: 'PENDING' }),
        row({ status: 'RESCHEDULED' }),
        row({ status: 'WAITLISTED' }),
        row({ status: 'EXPIRED' }),
      ],
      now,
      30,
    );

    expect(summary).toMatchObject({ completed: 0, cancelled: 0, noShows: 0, unmarked: 0, revenue: 0 });
    expect(summary.averageCheck).toBeNull();
    expect(summary.attendanceRate).toBeNull();
  });

  it('доля пришедших — состоявшиеся к сумме состоявшихся и неявок', () => {
    const summary = summarizeInstructorBookings(
      [
        row({ status: 'COMPLETED' }),
        row({ status: 'COMPLETED', customerId: 'c2' }),
        row({ status: 'COMPLETED', customerId: 'c3' }),
        row({ status: 'NO_SHOW', customerId: 'c4' }),
      ],
      now,
      30,
    );

    expect(summary.attendanceRate).toBeCloseTo(0.75);
  });

  it('постоянными считаются клиенты с двумя занятиями и больше', () => {
    const summary = summarizeInstructorBookings(
      [
        row({ customerId: 'a' }),
        row({ customerId: 'a' }),
        row({ customerId: 'a' }),
        row({ customerId: 'b' }),
        row({ customerId: 'c' }),
        row({ customerId: 'c' }),
      ],
      now,
      30,
    );

    expect(summary.uniqueClients).toBe(3);
    expect(summary.returningClients).toBe(2);
  });

  it('средний чек округляет до целого', () => {
    const summary = summarizeInstructorBookings(
      [row({ totalPrice: 10_000 }), row({ totalPrice: 10_001, customerId: 'c2' })],
      now,
      30,
    );

    expect(summary.averageCheck).toBe(10_001);
  });
});
