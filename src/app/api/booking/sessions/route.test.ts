/**
 * Контракт `/api/booking/sessions`.
 *
 * Проверяется то, на что полагается мобильный клиент: коды ошибок, плоский список
 * слотов с `sessionId` и местами, личное место в листе ожидания только для
 * вошедшего клиента и запрет кеширования.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInstructorBookingContent = vi.hoisted(() => vi.fn());
const getCaller = vi.hoisted(() => vi.fn());
const findMany = vi.hoisted(() => vi.fn());
vi.mock('@/server/content/booking', () => ({ getInstructorBookingContent }));
vi.mock('@/lib/auth/guards', () => ({ getCaller }));
vi.mock('@/lib/db', () => ({ db: { waitlistEntry: { findMany } } }));

import { GET } from './route';
import { cacheControl } from '@/config/cache';

let requestCounter = 0;

function call(query: string): Promise<Response> {
  requestCounter += 1;
  return GET(
    new Request(`https://artdance.test/api/booking/sessions${query}`, {
      headers: { 'x-forwarded-for': `198.51.100.${requestCounter % 250}` },
    }),
  );
}

const hourFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000);

const free = {
  start: '10:00',
  available: true,
  sessionId: 'session-free',
  startIso: hourFromNow(24).toISOString(),
  endIso: hourFromNow(25).toISOString(),
  endTime: '11:00',
  spotsLeft: 2,
};

const full = {
  start: '12:00',
  available: false,
  sessionId: 'session-full',
  startIso: hourFromNow(26).toISOString(),
  endIso: hourFromNow(27).toISOString(),
  endTime: '13:00',
  spotsLeft: 0,
};

beforeEach(() => {
  getInstructorBookingContent.mockReset();
  getInstructorBookingContent.mockResolvedValue({
    lessonType: 'GROUP',
    days: [{ slots: [free, full] }],
  });
  getCaller.mockReset();
  getCaller.mockResolvedValue(null);
  findMany.mockReset();
  findMany.mockResolvedValue([]);
});

describe('GET /api/booking/sessions — отказы', () => {
  it('без параметра класса — 400 с машинным кодом', async () => {
    const response = await call('?instructor=teacher');

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe('class_required');
  });

  it('неизвестный класс или инструктор — 404', async () => {
    getInstructorBookingContent.mockResolvedValue(null);

    const response = await call('?instructor=teacher&class=unknown');

    expect(response.status).toBe(404);
    expect(((await response.json()) as { error: string }).error).toBe('not_found');
  });
});

describe('GET /api/booking/sessions — ответ', () => {
  it('отдаёт плоский список слотов с местами и идентификатором проведения', async () => {
    const response = await call('?instructor=teacher&class=salsa');
    const body = (await response.json()) as {
      slots: Array<{ sessionId: string; spotsLeft: number; available: boolean; waitlist: unknown }>;
    };

    expect(response.status).toBe(200);
    expect(body.slots.map((slot) => slot.sessionId)).toEqual(['session-free', 'session-full']);
    expect(body.slots[0]).toMatchObject({ spotsLeft: 2, available: true, startTime: '10:00', endTime: '11:00' });
  });

  it('гостю личное место не отдаётся, а сама база не запрашивается', async () => {
    const body = (await (await call('?instructor=teacher&class=salsa')).json()) as {
      slots: Array<{ waitlist: unknown }>;
    };

    expect(body.slots.every((slot) => slot.waitlist === null)).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('вошедший клиент видит своё место и может забрать освободившееся', async () => {
    getCaller.mockResolvedValue({ id: 'user-1' });
    findMany.mockResolvedValue([
      { sessionId: 'session-full', position: 3, claimUntil: hourFromNow(1) },
    ]);

    const body = (await (await call('?instructor=teacher&class=salsa')).json()) as {
      slots: Array<{ sessionId: string; waitlist: { position: number; claimable: boolean } | null }>;
    };

    expect(body.slots.find((slot) => slot.sessionId === 'session-full')?.waitlist).toEqual({
      position: 3,
      claimable: true,
    });
    expect(body.slots.find((slot) => slot.sessionId === 'session-free')?.waitlist).toBeNull();
  });

  it('истёкшее окно забора места не даёт claimable', async () => {
    getCaller.mockResolvedValue({ id: 'user-1' });
    findMany.mockResolvedValue([
      { sessionId: 'session-full', position: 1, claimUntil: new Date(Date.now() - 60_000) },
    ]);

    const body = (await (await call('?instructor=teacher&class=salsa')).json()) as {
      slots: Array<{ sessionId: string; waitlist: { claimable: boolean } | null }>;
    };

    expect(body.slots.find((slot) => slot.sessionId === 'session-full')?.waitlist?.claimable).toBe(false);
  });

  it('ответ никогда не кешируется: заполненность меняется с каждой бронью', async () => {
    const response = await call('?instructor=teacher&class=salsa');

    expect(response.headers.get('Cache-Control')).toBe(cacheControl.none);
  });
});
