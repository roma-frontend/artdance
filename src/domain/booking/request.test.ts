import { describe, expect, it } from 'vitest';
import {
  needsResponse,
  requestCronAction,
  requestDueAtFor,
  requestDueDedupeKey,
  requestExpiresAtFor,
} from './request';

const createdAt = new Date('2026-10-01T08:00:00Z');
const expiresAt = new Date('2026-10-03T08:00:00Z');

describe('needsResponse', () => {
  it('без правила бронь подтверждается сразу', () => {
    expect(needsResponse('CLASS_SESSION', {})).toBe(false);
  });

  it('правило действует только на свой тип брони', () => {
    expect(needsResponse('PRIVATE_SESSION', { PRIVATE_SESSION: true })).toBe(true);
    expect(needsResponse('CLASS_SESSION', { PRIVATE_SESSION: true })).toBe(false);
  });
});

describe('requestExpiresAtFor', () => {
  it('срок — autoDeclineAfterHours от создания, если занятие далеко', () => {
    const startsAt = new Date('2026-10-10T14:00:00Z');
    expect(requestExpiresAtFor(createdAt, 48, startsAt)).toEqual(expiresAt);
  });

  it('срок не позже начала занятия', () => {
    const startsAt = new Date('2026-10-02T10:00:00Z');
    expect(requestExpiresAtFor(createdAt, 48, startsAt)).toEqual(startsAt);
  });
});

describe('requestDueAtFor', () => {
  it('напоминание через SLA, если до срока ещё есть время', () => {
    expect(requestDueAtFor(createdAt, 24, expiresAt)).toEqual(new Date('2026-10-02T08:00:00Z'));
  });

  it('заявка на скорую дату: напоминание сразу, а не после истечения', () => {
    const soonExpires = new Date('2026-10-01T12:00:00Z');
    expect(requestDueAtFor(createdAt, 24, soonExpires)).toEqual(createdAt);
  });
});

describe('requestCronAction', () => {
  const open = { status: 'PENDING' as const, requestExpiresAt: expiresAt, createdAt, slaHours: 24 };

  it('до SLA ничего не делает', () => {
    expect(requestCronAction({ ...open, now: new Date('2026-10-02T07:59:59Z') })).toBe('NONE');
  });

  it('после SLA, но до срока, напоминает', () => {
    expect(requestCronAction({ ...open, now: new Date('2026-10-02T08:00:00Z') })).toBe('REMIND');
    expect(requestCronAction({ ...open, now: new Date('2026-10-03T07:59:59Z') })).toBe('REMIND');
  });

  it('в момент срока заявка уже истекла (граница включительно)', () => {
    expect(requestCronAction({ ...open, now: expiresAt })).toBe('EXPIRE');
  });

  it('заявку, которую уже обработали, не трогает', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    expect(requestCronAction({ ...open, status: 'CONFIRMED', now })).toBe('NONE');
    expect(requestCronAction({ ...open, status: 'CANCELLED_BY_PROVIDER', now })).toBe('NONE');
  });

  it('без срока ответа заявки нет', () => {
    expect(requestCronAction({ ...open, requestExpiresAt: null, now: expiresAt })).toBe('NONE');
  });

  it('заявка на скорую дату напоминает в первом же прогоне', () => {
    const soonExpires = new Date('2026-10-01T12:00:00Z');
    expect(requestCronAction({ ...open, requestExpiresAt: soonExpires, now: createdAt })).toBe('REMIND');
  });
});

describe('requestDueDedupeKey', () => {
  it('один ключ на заявку', () => {
    expect(requestDueDedupeKey('booking-1')).toBe('booking:booking-1:request-due');
  });
});
