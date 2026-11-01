import { describe, expect, it } from 'vitest';

import { invoiceOverdue } from './corporate';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-31T12:00:00Z');
const issuedHoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR_MS);

describe('invoiceOverdue', () => {
  it('неоплаченный счёт старше срока просрочен', () => {
    expect(invoiceOverdue(issuedHoursAgo(121), null, now, 120)).toBe(true);
  });

  it('счёт в пределах срока не просрочен', () => {
    expect(invoiceOverdue(issuedHoursAgo(119), null, now, 120)).toBe(false);
  });

  it('оплаченный счёт не просрочен, даже если он старый', () => {
    expect(invoiceOverdue(issuedHoursAgo(500), now, now, 120)).toBe(false);
  });
});
