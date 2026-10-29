import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import type { MediaRef } from '@/domain/content';
import type { Locale } from '@/i18n/config';
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

/** Строка баннера из `Banner`: всё, кроме картинки и перевода заголовка. */
export type BannerRow = Omit<LiveBanner, 'image'>;

/**
 * Дополняет строки баннеров картинкой и заголовком на языке страницы.
 *
 * Изображение читается из связанного `MediaAsset`. Так замена картинки в админке
 * не требует пересборки и в production использует тот же CDN/R2-конвейер, что и
 * остальные фотографии сайта. Этим путём пользуются промо-полоса и рекламные
 * слоты (`src/server/content/ad-slots.ts`), поэтому баннер выглядит одинаково.
 */
export async function hydrateLiveBanners(
  banners: readonly BannerRow[],
  locale: Locale,
): Promise<LiveBanner[]> {
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

  /*
   * Заголовок собирается из переводов. Отдельный запрос, а не `include`:
   * связь `Banner→BannerTranslation` вложена в `select` и вернула бы строки
   * всех локалей сразу. Локаль без перевода получает базовый `Banner.title`.
   */
  const translationRows = await db.bannerTranslation.findMany({
    where: { bannerId: { in: banners.map((banner) => banner.id) } },
    select: { bannerId: true, locale: true, title: true },
  });
  const titleByBannerId = new Map(
    translationRows
      .filter((row) => row.locale === locale)
      .map((row) => [row.bannerId, row.title]),
  );

  return banners.map((banner) => ({
    ...banner,
    title: titleByBannerId.get(banner.id) ?? banner.title,
    image: mediaByBannerId.get(banner.id) ?? null,
  }));
}

/** Активные баннеры для промо-полосы: выборка из `Banner` плюс сборка для показа. */
export const getLiveBanners = defineQuery({
  name: 'liveBanners',
  tags: () => [cacheTags.content('banners')],
  revalidate: dataRevalidate.content,
  handler: async (locale: Locale): Promise<readonly LiveBanner[]> =>
    hydrateLiveBanners(await listLiveBanners(), locale),
});
