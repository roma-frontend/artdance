import { expect, it, vi } from 'vitest';

import type { BlogCardItem } from '@/domain/blog';

import { BlogCard } from './blog-card';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
  getFormatter: async () => ({ dateTime: () => '2026-10-09' }),
}));
vi.mock('@/i18n/routing', () => ({ Link: 'a' }));

it('fills the aspect-ratio container with the blog cover', async () => {
  const item: BlogCardItem = {
    slug: 'salsa-first-steps', title: 'Salsa', excerpt: 'First steps', category: null,
    tags: [], authorName: null, readingMinutes: 3, viewCount: 0,
    publishedAt: '2026-10-09T00:00:00Z',
    image: { key: 'https://pub-example.r2.dev/blog/cover.jpg', alt: { hy: 'Salsa', ru: 'Salsa', en: 'Salsa' } },
  };
  const card = await BlogCard({ item, locale: 'hy' });
  const media = card.props.children[1].props.children[0];
  expect(media.props).toMatchObject({ fill: true, className: 'absolute inset-0' });
});