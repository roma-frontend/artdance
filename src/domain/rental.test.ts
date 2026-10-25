import { describe, expect, it } from 'vitest';
import { assertRentalDuration, isRentalHold, rentalMinutes, rentalPrice } from './rental';

const rules = { minMinutes: 60, maxMinutes: 480, granularityMinutes: 30 };

describe('isRentalHold', () => {
  it('считает холд зала арендой, если нет инструктора и занятия', () => {
    expect(isRentalHold({ roomId: 'room-1', instructorId: null, sessionId: null })).toBe(true);
  });

  it('не считает арендой холд инструктора или занятия', () => {
    expect(isRentalHold({ roomId: null, instructorId: 'anna', sessionId: null })).toBe(false);
    expect(isRentalHold({ roomId: 'room-1', instructorId: 'anna', sessionId: null })).toBe(false);
    expect(isRentalHold({ roomId: 'room-1', instructorId: null, sessionId: 'session-1' })).toBe(false);
  });
});

describe('rentalMinutes', () => {
  it('считает минуты между началом и концом', () => {
    const start = new Date('2026-10-03T14:00:00Z');
    expect(rentalMinutes(start, new Date('2026-10-03T16:00:00Z'))).toBe(120);
  });
});

describe('assertRentalDuration', () => {
  it('принимает длительность в границах и кратную сетке', () => {
    expect(() => assertRentalDuration(60, rules)).not.toThrow();
    expect(() => assertRentalDuration(90, rules)).not.toThrow();
    expect(() => assertRentalDuration(480, rules)).not.toThrow();
  });

  it('отклоняет меньше минимума и больше максимума', () => {
    expect(() => assertRentalDuration(30, rules)).toThrow();
    expect(() => assertRentalDuration(510, rules)).toThrow();
  });

  it('отклоняет длительность не кратную сетке', () => {
    expect(() => assertRentalDuration(75, rules)).toThrow();
  });
});

describe('rentalPrice', () => {
  it('считает пропорционально минутам и округляет до целого', () => {
    expect(rentalPrice(6000, 60)).toBe(6000);
    expect(rentalPrice(6000, 90)).toBe(9000);
    expect(rentalPrice(5000, 30)).toBe(2500);
    expect(rentalPrice(1000, 40)).toBe(667);
  });
});
