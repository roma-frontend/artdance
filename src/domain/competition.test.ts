import { describe, expect, it } from 'vitest';

import { ageFitsCategory, ageOnDate, registrationIsOpen } from './competition';

describe('competition age rules', () => {
  const eventDate = new Date('2026-10-12T00:00:00.000Z');

  it('calculates the age before the birthday correctly', () => {
    expect(ageOnDate(new Date('2010-12-01T00:00:00.000Z'), eventDate)).toBe(15);
    expect(ageOnDate(new Date('2010-10-01T00:00:00.000Z'), eventDate)).toBe(16);
  });

  it('checks both category bounds', () => {
    expect(ageFitsCategory(new Date('2010-10-01T00:00:00.000Z'), eventDate, { minAge: 16, maxAge: 18 })).toBe(true);
    expect(ageFitsCategory(new Date('2007-10-01T00:00:00.000Z'), eventDate, { minAge: 16, maxAge: 18 })).toBe(false);
  });
});

describe('competition registration window', () => {
  it('supports open-ended windows', () => {
    expect(registrationIsOpen(new Date('2026-10-12T00:00:00.000Z'), { openAt: null, closeAt: null })).toBe(true);
    expect(registrationIsOpen(new Date('2026-10-12T00:00:00.000Z'), { openAt: new Date('2026-10-13T00:00:00.000Z'), closeAt: null })).toBe(false);
  });
});
