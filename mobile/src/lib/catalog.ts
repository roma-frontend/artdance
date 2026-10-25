import type { Messages } from '@/i18n/types';

import { API_URL } from './config';

export type Section = 'classes' | 'instructors' | 'studios' | 'events' | 'shop';

/** Картинка из базы: ключ R2 или готовый URL. Публичный URL строится через `mediaUri`. */
export type MediaRef = { key: string; alt: { hy: string; ru: string; en: string } };

export type CatalogPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ClassCard = {
  slug: string;
  title: string;
  style: string;
  level: string;
  instructorName: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  price: number;
  spotsLeft: number;
  isTrending: boolean;
  image: MediaRef;
};

export type InstructorCard = {
  slug: string;
  name: string;
  headline: string;
  styles: string[];
  yearsExperience: number;
  hourlyRateFrom: number;
  ratingAverage: number;
  ratingCount: number;
  isVerified?: boolean;
  image?: MediaRef;
};

export type StudioCard = {
  slug: string;
  name: string;
  description: string;
  district: string;
  amenities: string[];
  pricePerHour: number;
  ratingAverage: number;
  ratingCount: number;
  image: MediaRef;
};

export type EventCard = {
  slug: string;
  title: string;
  type: string;
  startsAt: string;
  startTime: string;
  endTime: string;
  locationName: string;
  price: number;
  spotsLeft: number;
  image: MediaRef;
};

export type ProductCard = {
  slug: string;
  title: string;
  brand: string;
  price: number;
  priceFrom: boolean;
  stock: number;
  image: MediaRef;
};

export type CatalogItem = ClassCard | InstructorCard | StudioCard | EventCard | ProductCard;

export class CatalogError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const response = await fetch(`${API_URL}/api/catalog/${path}${query}`);
  if (!response.ok) {
    let code = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) code = body.error;
    } catch {
      // Тело не JSON — оставляем статус.
    }
    throw new CatalogError(code, response.status);
  }
  return (await response.json()) as T;
}

export function listCatalog(section: Section, params: Record<string, string> = {}) {
  return getJson<CatalogPage<CatalogItem>>(section, params);
}

export function getCatalogDetail<T = Record<string, unknown>>(section: Section, slug: string) {
  return getJson<T>(`${section}/${encodeURIComponent(slug)}`);
}

/** Бейдж постера по правилам веба: «мест нет» важнее «в тренде». */
export function posterBadge(item: { spotsLeft: number; isTrending?: boolean }, t: Messages): string | null {
  if (item.spotsLeft <= 0) return t.classDetail.fullBadge;
  if (item.isTrending) return t.classDetail.trendingBadge;
  return null;
}

/**
 * Публичный URL картинки. Как и на вебе, всё медиа отдаётся через `/media-proxy/`
 * сайта (`src/proxy.ts`): ключи `/media/...` и голые ключи R2 идут через прокси.
 */
export function mediaUri(key: string): string {
  if (!key) return '';
  if (key.startsWith('http')) return key;
  // Загрузки из админки: мастер в AVIF, рядом лежит `-768.webp`, который декодируют все платформы.
  if (key.endsWith('.avif') && !/-\d+\.avif$/.test(key)) key = key.replace(/\.avif$/, '-768.webp');
  if (key.startsWith('/media-proxy/')) return `${API_URL}${key}`;
  if (key.startsWith('/media/')) return `${API_URL}/media-proxy${key}`;
  return `${API_URL}/media-proxy/${key.replace(/^\//, '')}`;
}

/** Логотип ассистента: объект R2 `brand/apple-icon.png`. */
export const ASSISTANT_LOGO_URI = mediaUri('brand/apple-icon.png');

/** Файлы с отпечатком из R2; обновляется вместе с `scripts/upload-instructor-videos.ts`. */
const INSTRUCTOR_PEEK_FILES: Readonly<Record<string, string>> = {
  'david-sargsyan': 'david-sargsyan.fcfe4c7e.mp4',
};

/** Превью-ролик инструктора. */
export function instructorPeekVideoUri(slug: string): string {
  const file = INSTRUCTOR_PEEK_FILES[slug] ?? `${slug}.mp4`;
  return mediaUri(`media/instructor-peek/${file}`);
}
