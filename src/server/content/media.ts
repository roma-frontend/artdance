/** Медиа баннеров из Prisma; отсутствующий или удалённый кадр не подменяется фикстурой. */
import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import { seedMediaPath } from '@/design/seed-media';
import type { MediaRef } from '@/domain/content';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';
import { mediaSelect, toMediaRef } from '../queries/media';

/**
 * Старые баннеры выбирают кадр по имени манифеста. Сид хранит путь с фрагментом
 * владельца; выбираем точный путь или его копию, но не похожее имя файла.
 * Настройка выбранного MediaAsset через CMS остаётся отдельным шагом.
 */
export const mediaRef = defineQuery({
  name: 'contentMediaRef',
  tags: () => [cacheTags.content('media')],
  revalidate: dataRevalidate.content,
  handler: async (key: string): Promise<MediaRef | null> => {
    const storageKey = seedMediaPath(key) || key;
    const row = await db.mediaAsset.findFirst({
      where: {
        OR: [{ storageKey }, { storageKey: { startsWith: `${storageKey}#` } }],
      },
      orderBy: { storageKey: 'asc' },
      select: mediaSelect,
    });
    return row ? toMediaRef(row) : null;
  },
});
