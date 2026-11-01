import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  entitlements: vi.fn(),
  liveBanners: vi.fn(),
}));

vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }));
vi.mock('@/server/entitlements/service', () => ({ getEffectiveEntitlementsSafe: h.entitlements }));
vi.mock('@/server/content/banners', () => ({ getLiveBanners: h.liveBanners }));
vi.mock('@/components/layout/announcement-bar-dismiss', () => ({ AnnouncementBarDismiss: () => null }));
vi.mock('@/components/ui/media', () => ({ Media: () => null }));
vi.mock('@/i18n/routing', () => ({ Link: () => null }));

import { AnnouncementBar } from './announcement-bar';

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

describe('AnnouncementBar', () => {
  beforeEach(() => {
    h.entitlements.mockReset();
    h.liveBanners.mockReset();
  });

  it('при выключенном cms не читает баннеры и ничего не выводит', async () => {
    h.entitlements.mockResolvedValue({ cms: false });
    h.liveBanners.mockResolvedValue([banner]);

    expect(await AnnouncementBar({ locale: 'en' })).toBeNull();
    expect(h.liveBanners).not.toHaveBeenCalled();
  });

  it('при включённом cms выводит первый живой баннер', async () => {
    h.entitlements.mockResolvedValue({ cms: true });
    h.liveBanners.mockResolvedValue([banner]);

    expect(await AnnouncementBar({ locale: 'en' })).not.toBeNull();
    expect(h.liveBanners).toHaveBeenCalledWith('en');
  });
});
