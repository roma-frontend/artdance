import 'server-only';

import { db } from '@/lib/db';
import { bannerLive } from '@/domain/banner';

export async function listLiveBanners(now = new Date()) {
  const all = await db.banner.findMany({ where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, key: true, title: true, imageKey: true, href: true, order: true, isActive: true } });
  return all.filter((b) => bannerLive(b as unknown as { isActive: boolean; startsAt: Date | null; endsAt: Date | null }, now));
}

export async function createBanner(input: { key: string; title: string; imageKey?: string | null; href?: string | null; order?: number }) {
  if (!input.key.trim() || !input.title.trim()) throw Object.assign(new Error('invalid banner'), { code: 'VALIDATION_FAILED' });
  return db.banner.create({ data: { key: input.key.trim(), title: input.title.trim(), imageKey: input.imageKey ?? null, href: input.href ?? null, order: input.order ?? 0 } });
}
