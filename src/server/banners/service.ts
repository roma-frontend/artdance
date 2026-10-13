import 'server-only';

import { db } from '@/lib/db';
import { bannerLive } from '@/domain/banner';

export async function listLiveBanners(now = new Date()) {
  const all = await db.banner.findMany({
    where: { isActive: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      key: true,
      title: true,
      imageKey: true,
      href: true,
      order: true,
      isActive: true,
    },
  });

  /*
   * `Banner` пока не хранит окно публикации, но доменное правило уже умеет его
   * проверять. Передаём только поля, которые реально есть в схеме: когда окно
   * появится, его можно добавить здесь без изменения публичного компонента.
   */
  return all.filter((banner) => bannerLive(banner, now));
}

export async function createBanner(input: { key: string; title: string; imageKey?: string | null; href?: string | null; order?: number }) {
  if (!input.key.trim() || !input.title.trim()) throw Object.assign(new Error('invalid banner'), { code: 'VALIDATION_FAILED' });
  return db.banner.create({ data: { key: input.key.trim(), title: input.title.trim(), imageKey: input.imageKey ?? null, href: input.href ?? null, order: input.order ?? 0 } });
}
