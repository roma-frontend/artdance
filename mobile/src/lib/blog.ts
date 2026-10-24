import type { MediaRef } from './catalog';
import { API_URL } from './config';

export type BlogCard = {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: string[];
  authorName: string | null;
  readingMinutes: number;
  viewCount: number;
  publishedAt: string;
  image: MediaRef | null;
};
export type BlogDetail = BlogCard & { body: string; related: BlogCard[] };
export type BlogList = { items: BlogCard[]; total: number; categories: string[] };

/** Опубликованные статьи с сервера на выбранном языке; `category` и `q` необязательны. */
export async function getBlogList(locale: string, filter: { category?: string; q?: string } = {}): Promise<BlogList> {
  const search = new URLSearchParams({ locale });
  if (filter.category) search.set('category', filter.category);
  if (filter.q) search.set('q', filter.q);
  const response = await fetch(`${API_URL}/api/content/blog?${search.toString()}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as BlogList;
}

/** Статья по слагу. Неизвестный или неопубликованный слаг сервер отвечает 404. */
export async function getBlogDetail(locale: string, slug: string): Promise<BlogDetail> {
  const response = await fetch(
    `${API_URL}/api/content/blog/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as BlogDetail;
}
