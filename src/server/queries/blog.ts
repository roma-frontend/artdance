/**
 * БЛОГ ИЗ БАЗЫ — `BlogPost` + `BlogPostTranslation`.
 *
 * Публичная выдача показывает только `isPublished`; админка видит всё.
 * Переводы собираются в `resolveBlogTranslation`: локаль, у которой перевода
 * нет, получает базовые поля — иначе карточка на русском показывала бы пустую
 * строку вместо русского названия.
 */

import 'server-only';

import { cacheTags, dataRevalidate } from '@/config/cache';
import type { Locale } from '@/i18n/config';
import { defaultLocale } from '@/i18n/config';
import type { BlogCardItem, BlogDetail } from '@/domain/blog';
import { toReadingMinutes } from '@/domain/blog';
import { db } from '@/lib/db';
import { defineQuery } from '@/server/query';

import { firstMediaRef, type MediaRow } from './media';

/* ── Переводы ── */

interface BlogTranslationRow {
  locale: Locale;
  title: string;
  excerpt: string;
  body: string;
}

export function resolveTranslation(
  base: { title: string; excerpt: string; body: string },
  translations: readonly BlogTranslationRow[],
  locale: Locale,
) {
  const found = translations.find((t) => t.locale === locale);
  if (!found) return base;
  return {
    title: found.title?.trim() ? found.title : base.title,
    excerpt: found.excerpt?.trim() ? found.excerpt : base.excerpt,
    body: found.body?.trim() ? found.body : base.body,
  };
}

/* ── Строка Prisma → карточка ── */

interface BlogRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverKey: string | null;
  coverAlt: string | null;
  category: string | null;
  tags: string[];
  authorName: string | null;
  readingMinutes: number | null;
  viewCount: number;
  isPublished: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  translations: BlogTranslationRow[];
  // cover media if matched — optional join via coverKey ~ storageKey OR via MediaAsset.blogPostId
  coverMedia?: MediaRow | null;
  blogCoverMedia?: MediaRow | null;
  media?: MediaRow[] | null;
}

const blogSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  body: true,
  coverKey: true,
  coverAlt: true,
  media: { where: { deletedAt: null }, select: { storageKey: true, altText: true, width: true, height: true, blurDataUrl: true, focalPoint: true, sortOrder: true, translations: { select: { locale: true, altText: true } } } },
  category: true,
  tags: true,
  authorName: true,
  readingMinutes: true,
  viewCount: true,
  isPublished: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  translations: { select: { locale: true, title: true, excerpt: true, body: true } },
} as const;

function toCard(row: BlogRow, locale: Locale): BlogCardItem {
  const t = resolveTranslation({ title: row.title, excerpt: row.excerpt, body: row.body }, row.translations, locale);
  const reading = row.readingMinutes ?? toReadingMinutes(t.body);

  let image: BlogCardItem['image'] = null;
  if (row.media?.length) {
    image = firstMediaRef(row.media);
  } else if (row.coverMedia) {
    image = firstMediaRef([row.coverMedia]);
  } else if (row.coverKey) {
    image = { key: row.coverKey, alt: { hy: row.coverAlt ?? t.title, ru: row.coverAlt ?? t.title, en: row.coverAlt ?? t.title } };
  }

  return {
    slug: row.slug,
    title: t.title,
    excerpt: t.excerpt,
    category: row.category,
    tags: row.tags,
    authorName: row.authorName,
    readingMinutes: reading,
    viewCount: row.viewCount,
    publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
    image,
  };
}

/* ── Публичные запросы ── */

/** Условие публичной выдачи: опубликованные и не удалённые (trashed скрывает расширение). */
const publicWhere = { isPublished: true } as const;

async function fetchBlogListRaw(opts: { locale?: Locale; category?: string; q?: string; take?: number; skip?: number } = {}): Promise<{ items: BlogCardItem[]; total: number; categories: string[] }> {
  const locale = opts.locale ?? defaultLocale;
  const where: Record<string, unknown> = { ...publicWhere };
  if (opts.category) where.category = opts.category;
  if (opts.q?.trim()) {
    const term = opts.q.trim();
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { excerpt: { contains: term, mode: 'insensitive' } },
      { category: { contains: term, mode: 'insensitive' } },
    ];
  }

  const take = opts.take ?? 100;
  const skip = opts.skip ?? 0;

  let rows: BlogRow[];
  try {
    rows = (await db.blogPost.findMany({
      where: where as never,
      select: blogSelect,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      skip,
    })) as unknown as BlogRow[];
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) {
      return { items: [], total: 0, categories: [] };
    }
    throw err;
  }

  // Подтянуть MediaAsset для обложек одним запросом, если есть coverKey
  const keys = [...new Set(rows.map((r) => r.coverKey).filter(Boolean) as string[])];
  const mediaByKey = new Map<string, MediaRow>();
  if (keys.length > 0) {
    const mediaRows = await db.mediaAsset.findMany({
      where: { storageKey: { in: keys } },
      select: { storageKey: true, altText: true, width: true, height: true, blurDataUrl: true, focalPoint: true, sortOrder: true, translations: { select: { locale: true, altText: true } } },
    });
    for (const m of mediaRows) mediaByKey.set(m.storageKey, m as unknown as MediaRow);
  }
  for (const row of rows) {
    if (row.coverKey && mediaByKey.has(row.coverKey)) row.coverMedia = mediaByKey.get(row.coverKey)!;
  }

  let total = 0;
  try {
    total = await db.blogPost.count({ where: where as never });
  } catch {
    total = rows.length;
  }

  const items = rows.map((r) => toCard(r, locale));
  const categories = [...new Set(rows.map((r) => r.category).filter(Boolean) as string[])].sort();

  return { items, total, categories };
}

export const getBlogList = defineQuery<[{ locale?: Locale; category?: string; q?: string; take?: number; skip?: number }?], { items: BlogCardItem[]; total: number; categories: string[] }>({
  name: 'blogList',
  tags: () => [cacheTags.blog()],
  revalidate: dataRevalidate.catalog,
  handler: fetchBlogListRaw,
});

export const getBlogDetail = defineQuery<[string, Locale | undefined], BlogDetail | null>({
  name: 'blogDetail',
  tags: (...args) => [cacheTags.blogPost(args[0]), cacheTags.blog()],
  revalidate: dataRevalidate.entity,
  handler: async (slug: string, locale: Locale | undefined): Promise<BlogDetail | null> => {
    const loc = locale ?? defaultLocale;
    let row: BlogRow | null;
    try {
      row = (await db.blogPost.findFirst({
        where: { slug, isPublished: true },
        select: blogSelect,
      })) as unknown as BlogRow | null;
    } catch (err) {
      if (err instanceof Error && err.message.includes('does not exist')) return null;
      throw err;
    }

    if (!row) return null;

    if (row.coverKey) {
      const media = await db.mediaAsset.findFirst({
        where: { storageKey: row.coverKey },
        select: { storageKey: true, altText: true, width: true, height: true, blurDataUrl: true, focalPoint: true, sortOrder: true, translations: { select: { locale: true, altText: true } } },
      });
      if (media) row.coverMedia = media as unknown as MediaRow;
    }

    const t = resolveTranslation({ title: row.title, excerpt: row.excerpt, body: row.body }, row.translations, loc);
    const card = toCard(row, loc);

    // Связанные — та же категория, кроме текущего, до 3
    let related: readonly BlogCardItem[] = [];
    if (row.category) {
      const relRows = (await db.blogPost.findMany({
        where: { isPublished: true, category: row.category, slug: { not: slug } },
        select: blogSelect,
        orderBy: [{ publishedAt: 'desc' }],
        take: 3,
      })) as unknown as BlogRow[];
      // медиа для связанных
      const relKeys = [...new Set(relRows.map((r) => r.coverKey).filter(Boolean) as string[])];
      if (relKeys.length > 0) {
        const relMedia = await db.mediaAsset.findMany({
          where: { storageKey: { in: relKeys } },
          select: { storageKey: true, altText: true, width: true, height: true, blurDataUrl: true, focalPoint: true, sortOrder: true, translations: { select: { locale: true, altText: true } } },
        });
        const mMap = new Map(relMedia.map((m) => [m.storageKey, m as unknown as MediaRow]));
        for (const r of relRows) if (r.coverKey && mMap.has(r.coverKey)) r.coverMedia = mMap.get(r.coverKey)!;
      }
      related = relRows.map((r) => toCard(r, loc));
    }
    if (related.length === 0) {
      const fallback = (await db.blogPost.findMany({
        where: { isPublished: true, slug: { not: slug } },
        select: blogSelect,
        orderBy: [{ publishedAt: 'desc' }],
        take: 3,
      })) as unknown as BlogRow[];
      if (fallback.length > 0) {
        const fbKeys = [...new Set(fallback.map((r) => r.coverKey).filter(Boolean) as string[])];
        if (fbKeys.length > 0) {
          const fbMedia = await db.mediaAsset.findMany({
            where: { storageKey: { in: fbKeys } },
            select: { storageKey: true, altText: true, width: true, height: true, blurDataUrl: true, focalPoint: true, sortOrder: true, translations: { select: { locale: true, altText: true } } },
          });
          const fbMap = new Map(fbMedia.map((m) => [m.storageKey, m as unknown as MediaRow]));
          for (const r of fallback) if (r.coverKey && fbMap.has(r.coverKey)) r.coverMedia = fbMap.get(r.coverKey)!;
        }
        related = fallback.map((r) => toCard(r, loc));
      }
    }

    // Инкремент просмотров — best-effort, не блокирует ответ
    void db.blogPost.update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

    return {
      ...card,
      body: t.body,
      authorName: row.authorName,
      category: row.category,
      tags: row.tags,
      related,
    };
  },
});

export async function getBlogSlugs(): Promise<string[]> {
  try {
    const rows = await db.blogPost.findMany({ where: publicWhere, select: { slug: true } });
    return rows.map((r: { slug: string }) => r.slug);
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) return [];
    throw err;
  }
}

export async function getBlogCategories(): Promise<string[]> {
  try {
    const rows = await db.blogPost.findMany({ where: publicWhere, select: { category: true }, distinct: ['category'] });
    return rows.map((r: { category: string | null }) => r.category).filter(Boolean) as string[];
  } catch (err) {
    if (err instanceof Error && err.message.includes('does not exist')) return [];
    throw err;
  }
}
