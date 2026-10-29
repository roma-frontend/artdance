import { describe, expect, it } from 'vitest';

import type { BookingStatus } from '@/domain/enums';
import {
  disputeLengths,
  disputeLoserId,
  disputeOpenable,
  disputeRespondentId,
  disputeValidReason,
  type DisputeSides,
} from '@/domain/dispute';

const sides: DisputeSides = { customerId: 'customer-1', instructorUserId: 'instructor-1' };
const NOW = new Date('2026-06-01T12:00:00Z');
const PAST = new Date('2026-06-01T10:00:00Z');
const FUTURE = new Date('2026-06-01T14:00:00Z');

describe('disputeValidReason', () => {
  it('accepts text from the minimum to the maximum length', () => {
    expect(disputeValidReason('x'.repeat(disputeLengths.min))).toBe(true);
    expect(disputeValidReason('x'.repeat(disputeLengths.max))).toBe(true);
  });

  it('rejects text below the minimum and above the maximum', () => {
    expect(disputeValidReason('x'.repeat(disputeLengths.min - 1))).toBe(false);
    expect(disputeValidReason('x'.repeat(disputeLengths.max + 1))).toBe(false);
  });

  it('measures the length after trimming spaces', () => {
    expect(disputeValidReason(`   ${'x'.repeat(disputeLengths.min - 1)}   `)).toBe(false);
  });
});

describe('disputeOpenable', () => {
  const cases: [string, BookingStatus, Date, boolean][] = [
    ['CONFIRMED after the lesson ends', 'CONFIRMED', PAST, true],
    ['CONFIRMED before the lesson ends', 'CONFIRMED', FUTURE, false],
    ['COMPLETED after the lesson ends', 'COMPLETED', PAST, true],
    ['NO_SHOW after the lesson ends', 'NO_SHOW', PAST, true],
    ['cancelled by customer before the lesson', 'CANCELLED_BY_CUSTOMER', FUTURE, true],
    ['cancelled by provider before the lesson', 'CANCELLED_BY_PROVIDER', FUTURE, true],
    ['PENDING even after the end time', 'PENDING', PAST, false],
    ['WAITLISTED even after the end time', 'WAITLISTED', PAST, false],
    ['EXPIRED even after the end time', 'EXPIRED', PAST, false],
    ['RESCHEDULED even after the end time', 'RESCHEDULED', PAST, false],
  ];

  it.each(cases)('%s', (_name, status, endsAt, expected) => {
    expect(disputeOpenable({ status, endsAt }, NOW)).toBe(expected);
  });
});

describe('disputeRespondentId', () => {
  it('is the instructor when the customer opened the dispute', () => {
    expect(disputeRespondentId(sides, 'customer-1')).toBe('instructor-1');
  });

  it('is the customer when someone else opened the dispute', () => {
    expect(disputeRespondentId(sides, 'instructor-1')).toBe('customer-1');
  });

  it('is null when the customer opened it and the booking has no instructor user', () => {
    const noInstructor: DisputeSides = { customerId: 'customer-1', instructorUserId: null };
    expect(disputeRespondentId(noInstructor, 'customer-1')).toBeNull();
  });
});

describe('disputeLoserId', () => {
  it('penalizes the respondent when the claimant wins', () => {
    // Клиент открыл спор и выиграл: проигрывает инструктор.
    expect(disputeLoserId('CLAIMANT', sides, 'customer-1')).toBe('instructor-1');
    // Инструктор открыл спор и выиграл: проигрывает клиент.
    expect(disputeLoserId('CLAIMANT', sides, 'instructor-1')).toBe('customer-1');
  });

  it('penalizes the claimant when the respondent wins', () => {
    expect(disputeLoserId('RESPONDENT', sides, 'customer-1')).toBe('customer-1');
    expect(disputeLoserId('RESPONDENT', sides, 'instructor-1')).toBe('instructor-1');
  });

  it('has no user to penalize when the respondent is missing', () => {
    const noInstructor: DisputeSides = { customerId: 'customer-1', instructorUserId: null };
    expect(disputeLoserId('CLAIMANT', noInstructor, 'customer-1')).toBeNull();
  });
});
