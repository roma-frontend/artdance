import { describe, expect, it } from 'vitest';
import { booking } from '@/config/business';
import { isDomainError } from '@/domain/errors';
import {
  assertValidSlotHoldInput,
  canExtendHold,
  extendRefusal,
  holdInterval,
  holdOwnerKey,
  holdResourceKey,
  isHoldActive,
  isHoldExpired,
  isValidSlotHoldInput,
  remainingHoldMs,
  slotHoldExpiresAt,
} from './slot-hold';

const utc = (iso: string): Date => new Date(iso);

const hold = (overrides: Partial<{ expiresAt: Date; extensions: number }> = {}) => ({
  expiresAt: overrides.expiresAt ?? utc('2026-09-12T14:15:00Z'),
  extensions: overrides.extensions ?? 0,
});

const input = (
  overrides: Partial<{
    instructorId: string | null;
    roomId: string | null;
    userId: string | null;
    anonymousId: string | null;
    startsAt: Date;
    endsAt: Date;
    expiresAt: Date;
  }> = {},
) => ({
  instructorId: overrides.instructorId !== undefined ? overrides.instructorId : 'instructor-1',
  roomId: overrides.roomId !== undefined ? overrides.roomId : null,
  startsAt: overrides.startsAt ?? utc('2026-09-12T14:00:00Z'),
  endsAt: overrides.endsAt ?? utc('2026-09-12T15:00:00Z'),
  userId: overrides.userId !== undefined ? overrides.userId : 'user-1',
  anonymousId: overrides.anonymousId !== undefined ? overrides.anonymousId : null,
  expiresAt: overrides.expiresAt ?? utc('2026-09-12T14:15:00Z'),
});

const HOLD_TTL = booking.holdTtlMinutes;
const MAX_EXT = booking.holdMaxExtensions;

describe('slotHoldExpiresAt', () => {
  it('adds TTL to now', () => {
    const now = utc('2026-09-12T14:00:00Z');
    expect(slotHoldExpiresAt(now, 15).toISOString()).toBe('2026-09-12T14:15:00.000Z');
  });
  it('uses config TTL value', () => {
    const now = utc('2026-09-12T14:00:00Z');
    expect(slotHoldExpiresAt(now, HOLD_TTL).getTime() - now.getTime()).toBe(HOLD_TTL * 60_000);
  });
  it('rejects non-positive TTL', () => {
    expect(() => slotHoldExpiresAt(utc('2026-09-12T14:00:00Z'), 0)).toThrow();
    expect(() => slotHoldExpiresAt(utc('2026-09-12T14:00:00Z'), -5)).toThrow();
  });
});

describe('isHoldExpired / isHoldActive', () => {
  it('not expired before expiresAt', () => {
    expect(isHoldExpired(hold(), utc('2026-09-12T14:14:59Z'))).toBe(false);
    expect(isHoldActive(hold(), utc('2026-09-12T14:14:59Z'))).toBe(true);
  });
  it('expired exactly at expiresAt inclusive', () => {
    expect(isHoldExpired(hold(), utc('2026-09-12T14:15:00Z'))).toBe(true);
  });
  it('expired after expiresAt', () => {
    expect(isHoldExpired(hold(), utc('2026-09-12T14:16:00Z'))).toBe(true);
  });
  it('remaining is zero when expired', () => {
    expect(remainingHoldMs(hold(), utc('2026-09-12T14:16:00Z'))).toBe(0);
  });
  it('remaining is positive when active', () => {
    expect(remainingHoldMs(hold(), utc('2026-09-12T14:10:00Z'))).toBe(5 * 60_000);
  });
  it('holdInterval returns start/end', () => {
    const i = holdInterval({ startsAt: utc('2026-09-12T14:00:00Z'), endsAt: utc('2026-09-12T15:00:00Z') });
    expect(i.start.toISOString()).toBe('2026-09-12T14:00:00.000Z');
    expect(i.end.toISOString()).toBe('2026-09-12T15:00:00.000Z');
  });
});

describe('canExtendHold', () => {
  it('can extend active hold within limit', () => {
    expect(canExtendHold(hold({ extensions: 0 }), utc('2026-09-12T14:10:00Z'), MAX_EXT)).toBe(true);
    expect(extendRefusal(hold({ extensions: 0 }), utc('2026-09-12T14:10:00Z'), MAX_EXT)).toBeNull();
  });
  it('cannot extend when limit reached', () => {
    expect(canExtendHold(hold({ extensions: 1 }), utc('2026-09-12T14:10:00Z'), 1)).toBe(false);
    expect(extendRefusal(hold({ extensions: 1 }), utc('2026-09-12T14:10:00Z'), 1)).toBe('LIMIT_REACHED');
  });
  it('cannot extend expired hold even within limit', () => {
    expect(canExtendHold(hold(), utc('2026-09-12T14:16:00Z'), 5)).toBe(false);
    expect(extendRefusal(hold(), utc('2026-09-12T14:16:00Z'), 5)).toBe('EXPIRED');
  });
  it('expired takes priority over limit', () => {
    expect(extendRefusal(hold({ extensions: 5 }), utc('2026-09-12T14:16:00Z'), 1)).toBe('EXPIRED');
  });
});

describe('assertValidSlotHoldInput', () => {
  it('passes for valid instructor + user hold', () => {
    expect(() => assertValidSlotHoldInput(input())).not.toThrow();
    expect(isValidSlotHoldInput(input())).toBe(true);
  });
  it('passes for room + anonymous hold', () => {
    expect(() => assertValidSlotHoldInput(input({ instructorId: null, roomId: 'room-1', userId: null, anonymousId: 'anon-1' }))).not.toThrow();
  });
  it('rejects when no resource', () => {
    try {
      assertValidSlotHoldInput(input({ instructorId: null, roomId: null }));
      expect.unreachable('must throw');
    } catch (e) {
      expect(isDomainError(e)).toBe(true);
    }
    expect(isValidSlotHoldInput(input({ instructorId: null, roomId: null }))).toBe(false);
  });
  it('rejects when both resources', () => {
    try {
      assertValidSlotHoldInput(input({ instructorId: 'a', roomId: 'b' }));
      expect.unreachable('must throw');
    } catch (e) {
      expect(isDomainError(e)).toBe(true);
    }
  });
  it('rejects when no owner', () => {
    try {
      assertValidSlotHoldInput(input({ userId: null, anonymousId: null }));
      expect.unreachable('must throw');
    } catch (e) {
      expect(isDomainError(e)).toBe(true);
    }
  });
  it('rejects when both owners', () => {
    try {
      assertValidSlotHoldInput(input({ userId: 'u', anonymousId: 'a' }));
      expect.unreachable('must throw');
    } catch (e) {
      expect(isDomainError(e)).toBe(true);
    }
  });
  it('rejects inverted interval', () => {
    try {
      assertValidSlotHoldInput(input({ startsAt: utc('2026-09-12T15:00:00Z'), endsAt: utc('2026-09-12T14:00:00Z') }));
      expect.unreachable('must throw');
    } catch (e) {
      expect(isDomainError(e)).toBe(true);
    }
  });
  it('rejects zero-duration interval', () => {
    const at = utc('2026-09-12T14:00:00Z');
    try {
      assertValidSlotHoldInput(input({ startsAt: at, endsAt: at }));
      expect.unreachable('must throw');
    } catch (e) {
      expect(isDomainError(e)).toBe(true);
    }
  });
});

describe('hold keys', () => {
  it('resource key for instructor', () => expect(holdResourceKey({ instructorId: 'abc', roomId: null })).toBe('instructor:abc'));
  it('resource key for room', () => expect(holdResourceKey({ instructorId: null, roomId: 'xyz' })).toBe('room:xyz'));
  it('owner key for user', () => expect(holdOwnerKey({ userId: 'u1', anonymousId: null })).toBe('user:u1'));
  it('owner key for anon', () => expect(holdOwnerKey({ userId: null, anonymousId: 'a1' })).toBe('anon:a1'));
});