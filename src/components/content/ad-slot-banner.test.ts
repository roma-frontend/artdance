import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  entitlements: vi.fn(),
  adSlotBanner: vi.fn(),
}));

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/server/entitlements/service', () => ({ getEffectiveEntitlementsSafe: h.entitlements }));
vi.mock('@/server/content/ad-slots', () => ({ getAdSlotBanner: h.adSlotBanner }));
vi.mock('@/components/content/content-section', () => ({ ContentSection: () => null }));
vi.mock('@/components/ui/media', () => ({ Media: () => null }));
vi.mock('@/i18n/routing', () => ({ Link: () => null }));

import { AdSlotBanner } from './ad-slot-banner';

const banner = {
  id: 'banner-1',
  key: 'find-your-rhythm',
  title: 'Find yours',
  imageKey: null,
  image: null,
  href: null,
  order: 0,
  isActive: true,
};

describe('AdSlotBanner', () => {
  beforeEach(() => {
    h.entitlements.mockReset();
    h.adSlotBanner.mockReset();
  });

  it('при выключенном cms не читает слот и ничего не выводит', async () => {
    h.entitlements.mockResolvedValue({ cms: false });
    h.adSlotBanner.mockResolvedValue(banner);

    expect(await AdSlotBanner({ slotKey: 'catalog-top', locale: 'en' })).toBeNull();
    expect(h.adSlotBanner).not.toHaveBeenCalled();
  });

  it('при включённом cms выводит баннер слота', async () => {
    h.entitlements.mockResolvedValue({ cms: true });
    h.adSlotBanner.mockResolvedValue(banner);

    expect(await AdSlotBanner({ slotKey: 'catalog-top', locale: 'en' })).not.toBeNull();
    expect(h.adSlotBanner).toHaveBeenCalledWith({ slotKey: 'catalog-top', locale: 'en' });
  });
});
