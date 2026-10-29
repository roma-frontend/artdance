import { describe, expect, it } from 'vitest';

import { resolveAdSlotBanner, type AdSlotState } from './ad-slot';

const now = new Date('2026-09-08T12:00:00.000Z');
const banner = { id: 'b1', isActive: true, startsAt: null, endsAt: null };

describe('resolveAdSlotBanner', () => {
  it('нет слота — нет баннера', () => {
    expect(resolveAdSlotBanner(null, now)).toBeNull();
  });

  it('выключенный слот не показывает даже привязанный баннер', () => {
    const slot: AdSlotState<typeof banner> = { isActive: false, banner };
    expect(resolveAdSlotBanner(slot, now)).toBeNull();
  });

  it('слот без привязки ничего не показывает', () => {
    expect(resolveAdSlotBanner({ isActive: true, banner: null }, now)).toBeNull();
  });

  it('выключенный баннер не показывается', () => {
    const slot = { isActive: true, banner: { ...banner, isActive: false } };
    expect(resolveAdSlotBanner(slot, now)).toBeNull();
  });

  it('баннер вне окна показа не показывается ни до начала, ни после конца', () => {
    const notStarted = {
      isActive: true,
      banner: { ...banner, startsAt: new Date('2026-09-09T00:00:00.000Z') },
    };
    const ended = {
      isActive: true,
      banner: { ...banner, endsAt: new Date('2026-09-01T00:00:00.000Z') },
    };

    expect(resolveAdSlotBanner(notStarted, now)).toBeNull();
    expect(resolveAdSlotBanner(ended, now)).toBeNull();
  });

  it('живой баннер возвращается тем же объектом', () => {
    const slot = { isActive: true, banner };
    expect(resolveAdSlotBanner(slot, now)).toBe(banner);
  });
});
