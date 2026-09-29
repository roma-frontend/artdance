import type { MediaRef } from './content';

export interface BlogCardItem {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: readonly string[];
  authorName: string | null;
  readingMinutes: number;
  viewCount: number;
  publishedAt: string;
  image: MediaRef | null;
}

export interface BlogDetail extends BlogCardItem {
  body: string;
  related: readonly BlogCardItem[];
}

export function toReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function excerptFromBody(body: string, maxLen = 160): string {
  const plain = body.replace(/\s+/g, ' ').trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).replace(/\s+\S*$/, '') + '…';
}
