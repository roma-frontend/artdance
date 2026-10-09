import { describe, expect, it, vi } from 'vitest';

import { getBlogDetail, getBlogList, resolveTranslation } from './blog';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn().mockResolvedValue({}),
  mediaFindMany: vi.fn(), mediaFindFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: {
  blogPost: { findMany: mocks.findMany, findFirst: mocks.findFirst, count: mocks.count, update: mocks.update },
  mediaAsset: { findMany: mocks.mediaFindMany, findFirst: mocks.mediaFindFirst },
} }));
vi.mock('@/server/query', () => ({ defineQuery: (config: { handler: unknown }) => config.handler }));

const base = { title: 'Base title', excerpt: 'Base excerpt', body: 'Base body' };

describe('blog translations', () => {
  it.each(['hy', 'ru', 'en'] as const)('uses the %s translation even for the default locale', (locale) => {
    const translated = { title: `${locale} title`, excerpt: `${locale} excerpt`, body: `${locale} body` };
    expect(resolveTranslation(base, [{ locale, ...translated }], locale)).toEqual(translated);
  });

  it('falls back to base fields when a translation is missing', () => {
    expect(resolveTranslation(base, [], 'hy')).toEqual(base);
  });

  it('falls back only for empty translated fields', () => {
    expect(resolveTranslation(base, [{ locale: 'hy', title: 'hy title', excerpt: ' ', body: '' }], 'hy'))
      .toEqual({ ...base, title: 'hy title' });
  });
});

describe('public blog queries', () => {
  it('keeps Armenian translations and absolute R2 covers in lists and details', async () => {
    const coverKey = 'https://pub-example.r2.dev/media/blog/cover.jpg';
    const translated = { locale: 'hy', title: 'hy title', excerpt: 'hy excerpt', body: 'hy body' };
    const source = {
      ...base, id: 'post', slug: 'salsa-first-steps', coverKey, coverAlt: null,
      category: null, tags: [], authorName: null, readingMinutes: null, viewCount: 0,
      isPublished: true, publishedAt: new Date('2026-10-09'),
      createdAt: new Date('2026-10-09'), updatedAt: new Date('2026-10-09'),
      translations: [translated], media: [],
    };
    mocks.findMany.mockResolvedValueOnce([source]).mockResolvedValueOnce([]);
    mocks.findFirst.mockResolvedValue(source);
    mocks.count.mockResolvedValue(1);
    mocks.mediaFindMany.mockResolvedValue([]);
    mocks.mediaFindFirst.mockResolvedValue(null);

    const list = await getBlogList({ locale: 'hy' });
    expect(list.items[0]).toMatchObject({ title: translated.title, excerpt: translated.excerpt, image: { key: coverKey } });
    const detail = await getBlogDetail(source.slug, 'hy');
    expect(detail).toMatchObject({ title: translated.title, body: translated.body, image: { key: coverKey } });
  });
});