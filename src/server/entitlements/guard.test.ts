/**
 * ГВАРДЫ отвечают отказом, а не пропуском.
 *
 * Здесь проверяется именно свойство, ради которого модуль появился: раньше
 * каждый вызов заканчивался `.catch(() => true)`, и сбой чтения тумблера
 * открывал модуль. В гварде отказ — всегда «выключено», независимо от того, что
 * пошло не так.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const loader = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('./service', () => ({ getEffectiveEntitlementsSafe: loader }));

import { notFound } from 'next/navigation';

import { assertEntitlementOrNotFound, assertEntitlementOrThrow } from './guard';

describe('assertEntitlementOrNotFound', () => {
  beforeEach(() => {
    vi.mocked(notFound).mockClear();
    loader.mockReset();
  });

  it('отдаёт 404 на выключенном модуле', async () => {
    loader.mockResolvedValue({ shop: false });

    await expect(assertEntitlementOrNotFound('shop')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it('пропускает на включённом', async () => {
    loader.mockResolvedValue({ shop: true });

    await expect(assertEntitlementOrNotFound('shop')).resolves.toBeUndefined();
    expect(notFound).not.toHaveBeenCalled();
  });

  it('не читает снимок повторно, если он уже передан', async () => {
    await assertEntitlementOrNotFound('events', { events: false } as never).catch(() => null);

    expect(loader).not.toHaveBeenCalled();
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});

describe('assertEntitlementOrThrow', () => {
  beforeEach(() => {
    loader.mockReset();
  });

  it('бросает FEATURE_DISABLED на выключенном модуле', async () => {
    loader.mockResolvedValue({ wallet: false });

    await expect(assertEntitlementOrThrow('wallet')).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    });
  });

  it('пропускает на включённом', async () => {
    loader.mockResolvedValue({ wallet: true });

    await expect(assertEntitlementOrThrow('wallet')).resolves.toBeUndefined();
  });
});

describe('снимок, который не бросает', () => {
  beforeEach(() => {
    loader.mockReset();
  });

  it('отсутствующий ключ трактуется как выключенный, а не пропускается', async () => {
    loader.mockResolvedValue({});

    await expect(assertEntitlementOrThrow('boost')).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    });
  });

  it('неопределённое значение — тоже выключено', async () => {
    loader.mockResolvedValue({ subscriptions: undefined });

    await expect(assertEntitlementOrThrow('subscriptions')).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    });
  });
});
