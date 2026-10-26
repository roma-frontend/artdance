import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';

/**
 * Одобренные отзывы инструктора. Публичные: токен не нужен, сервер отдаёт
 * только одобренные отзывы (модерация — на его стороне).
 */

export type InstructorReview = {
  id: string;
  authorName: string;
  authorRole: string;
  rating: number;
  body: string;
  isVerifiedPurchase: boolean;
};

export type InstructorReviews = {
  rating: { average: number; count: number };
  items: InstructorReview[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export class InstructorReviewsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Страница отзывов. Номер вне списка сервер отдаёт как 404. */
export async function listInstructorReviews(slug: string, page: number): Promise<InstructorReviews> {
  const response = await fetch(`${API_URL}/api/instructors/${encodeURIComponent(slug)}/reviews?page=${page}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
    throw new InstructorReviewsError(`HTTP ${response.status}`, response.status, serverMessage);
  }
  return (await response.json()) as InstructorReviews;
}
