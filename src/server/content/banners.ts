import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import type { MediaRef } from '@/domain/content';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';
import { listLiveBanners } from '@/server/banners/service';
import { mediaSelect, toMediaRef, type MediaRow } from '@/server/queries/media';

/** Данные баннера, которые нужны публичной части сайта. */
export interface LiveBanner {
  id: string;
  key: string;
  title: string;
  /** Старый ключ оставлен для обратной совместимости с уже созданными записями. */
  imageKey: string | null;
  /** Новое изображение, загруженное через MediaSection в админке. */
  image: MediaRef | null;
  href: string | null;
  order: number;
  isActive: boolean;
}

/**
 * Активные баннеры для публичного макета.
 *
 * Баннер читается из `Banner`, а изображение — из связанного `MediaAsset`. Так
 * замена картинки в админке не требует пересборки и в production использует тот
 * же CDN/R2-конвейер, что и остальные фотографии сайта.
 */
export const getLiveBanners = defineQuery({
  name: 'liveBanners',
  tags: () => [cacheTags.content('banners')],
  revalidate: dataRevalidate.content,
  handler: async (): Promise<readonly LiveBanner[]> => {
    const banners = await listLiveBanners();
    if (banners.length === 0) return [];

    /*
     * Связь — to-one, а `db` не фильтрует удалённые записи внутри вложенного
     * select. Отдельный запрос с расширенным клиентом гарантирует, что удалённая
     * картинка не останется на публичной странице.
     */
    const mediaRows = await db.mediaAsset.findMany({
      where: { bannerId: { in: banners.map((banner) => banner.id) } },
      select: {
        ...mediaSelect,
        bannerId: true,
      },
    });
    const mediaByBannerId = new Map(
      mediaRows.map((row) => [row.bannerId, toMediaRef(row as MediaRow)]),
    );

    return banners.map((banner) => ({
      ...banner,
      image: mediaByBannerId.get(banner.id) ?? null,
    }));
  },
});
