import { domainErrors } from '@/domain/errors';
import { assertValidInterval, isValidInterval, type Interval } from '@/lib/time/interval';

const MS_PER_MINUTE = 60_000;

export interface SlotHoldSnapshot {
  id: string;
  instructorId?: string | null;
  roomId?: string | null;
  sessionId?: string | null;
  startsAt: Date;
  endsAt: Date;
  userId?: string | null;
  anonymousId?: string | null;
  expiresAt: Date;
  extensions: number;
  createdAt: Date;
}

export interface SlotHoldInput {
  instructorId?: string | null;
  roomId?: string | null;
  sessionId?: string | null;
  startsAt: Date;
  endsAt: Date;
  userId?: string | null;
  anonymousId?: string | null;
  expiresAt: Date;
  extensions?: number;
}

export type HoldResource = { instructorId: string } | { roomId: string };
export type HoldOwner = { userId: string } | { anonymousId: string };

export function slotHoldExpiresAt(now: Date, ttlMinutes: number): Date {
  if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) throw domainErrors.validationFailed('expiresAt');
  return new Date(now.getTime() + ttlMinutes * MS_PER_MINUTE);
}

export function holdInterval(hold: Pick<SlotHoldSnapshot, 'startsAt' | 'endsAt'>): Interval {
  return { start: hold.startsAt, end: hold.endsAt };
}

export function isHoldExpired(hold: Pick<SlotHoldSnapshot, 'expiresAt'>, now: Date): boolean {
  return hold.expiresAt.getTime() <= now.getTime();
}

export function isHoldActive(hold: Pick<SlotHoldSnapshot, 'expiresAt'>, now: Date): boolean {
  return !isHoldExpired(hold, now);
}

export function remainingHoldMs(hold: Pick<SlotHoldSnapshot, 'expiresAt'>, now: Date): number {
  return Math.max(0, hold.expiresAt.getTime() - now.getTime());
}

export function canExtendHold(hold: Pick<SlotHoldSnapshot, 'expiresAt' | 'extensions'>, now: Date, maxExtensions: number): boolean {
  if (isHoldExpired(hold, now)) return false;
  if (hold.extensions >= maxExtensions) return false;
  return true;
}

export type ExtendRefusal = 'EXPIRED' | 'LIMIT_REACHED';

export function extendRefusal(hold: Pick<SlotHoldSnapshot, 'expiresAt' | 'extensions'>, now: Date, maxExtensions: number): ExtendRefusal | null {
  if (isHoldExpired(hold, now)) return 'EXPIRED';
  if (hold.extensions >= maxExtensions) return 'LIMIT_REACHED';
  return null;
}

export function assertValidSlotHoldInput(input: SlotHoldInput): void {
  const hasInstructor = Boolean(input.instructorId);
  const hasRoom = Boolean(input.roomId);
  if (hasInstructor === hasRoom) throw domainErrors.validationFailed('instructorId');
  const hasUser = Boolean(input.userId);
  const hasAnonymous = Boolean(input.anonymousId);
  if (hasUser === hasAnonymous) throw domainErrors.validationFailed('userId');
  const interval: Interval = { start: input.startsAt, end: input.endsAt };
  if (!isValidInterval(interval)) throw domainErrors.validationFailed('startsAt');
  if (!(input.expiresAt instanceof Date) || Number.isNaN(input.expiresAt.getTime())) throw domainErrors.validationFailed('expiresAt');
  assertValidInterval(interval, 'Slot');
}

export function isValidSlotHoldInput(input: SlotHoldInput): boolean {
  try { assertValidSlotHoldInput(input); return true; } catch { return false; }
}

export function holdResourceKey(hold: Pick<SlotHoldSnapshot, 'instructorId' | 'roomId'>): string {
  if (hold.instructorId) return 'instructor:' + hold.instructorId;
  if (hold.roomId) return 'room:' + hold.roomId;
  return 'unknown';
}

export function holdOwnerKey(hold: Pick<SlotHoldSnapshot, 'userId' | 'anonymousId'>): string {
  if (hold.userId) return 'user:' + hold.userId;
  if (hold.anonymousId) return 'anon:' + hold.anonymousId;
  return 'unknown';
}
