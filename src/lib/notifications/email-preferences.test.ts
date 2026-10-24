import { describe, expect, it } from 'vitest';

import { emailPreferencesFrom } from './email-preferences';

const NOW = new Date('2026-01-01T00:00:00Z');

describe('emailPreferencesFrom', () => {
  it('включает email по всем типам, если предпочтений нет', () => {
    const result = emailPreferencesFrom([], NOW);
    expect(result.every((p) => p.enabled)).toBe(true);
    expect(result.map((p) => p.type)).toEqual([
      'booking.confirmed',
      'booking.reminder',
      'booking.cancelled',
      'waitlist.ready',
    ]);
  });

  it('выключает только тот тип, у которого EMAIL отключён', () => {
    const result = emailPreferencesFrom(
      [{ channel: 'EMAIL', type: 'booking.reminder', enabled: false }],
      NOW,
    );
    expect(result.find((p) => p.type === 'booking.reminder')?.enabled).toBe(false);
    expect(result.find((p) => p.type === 'booking.confirmed')?.enabled).toBe(true);
  });

  it('снова включает тип после строки enabled=true', () => {
    const result = emailPreferencesFrom(
      [{ channel: 'EMAIL', type: 'waitlist.ready', enabled: true }],
      NOW,
    );
    expect(result.find((p) => p.type === 'waitlist.ready')?.enabled).toBe(true);
  });
});
