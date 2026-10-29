import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import { resolveAdSlotBanner, type AdSlotKey } from '@/domain/ad-slot';
import type { Locale } from '@/i18n/config';
import { db } from '@/lib/db';
import { hydrateLiveBanners, type LiveBanner } from '@/server/content/banners';
import { defineQuery } from '@/server/query';

/**
 * Баннер рекламного слота для страницы.
 *
 * Слот читается из `AdSlot` вместе с привязанным `Banner`. Решение о показе
 * принимает `resolveAdSlotBanner`, а картинка и заголовок собираются тем же путём,
 * что и у промо-полосы (`hydrateLiveBanners`).
 *
 * Тег кеша общий с баннерами. Редактора слотов в админке пока нет, поэтому правка
 * слота сама кеш не сбрасывает: на сайте она появится не раньше, чем истечёт
 * `dataRevalidate.content`.
 */
export const getAdSlotBanner = defineQuery({
  name: 'adSlotBanner',
  tags: () => [cacheTags.content('banners')],
  revalidate: dataRevalidate.content,
  handler: async ({
    slotKey,
    locale,
  }: {
    slotKey: AdSlotKey;
    locale: Locale;
  }): Promise<LiveBanner | null> => {
    const slot = await db.adSlot.findUnique({
      where: { slotKey },
      select: {
        isActive: true,
        banner: {
          select: {
            id: true,
            key: true,
            title: true,
            imageKey: true,
            href: true,
            order: true,
            isActive: true,
          },
        },
      },
    });

    const banner = resolveAdSlotBanner(slot, new Date());
    if (!banner) return null;

    const [hydrated] = await hydrateLiveBanners([banner], locale);
    return hydrated ?? null;
  },
});
