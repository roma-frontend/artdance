import { apiRequest } from './api-client';

/**
 * Кабинет инструктора: заявки на бронь (D-04), отзывы с ответом, аналитика (PREMIUM) и бусты
 * (B-07). Маршруты совпадают с веб-страницами `/studio/*`; права и пакеты проверяет сервер.
 */

export type BookingRequestSubject = 'CLASS_SESSION' | 'PRIVATE_SESSION' | 'STUDIO_RENTAL' | 'EVENT_TICKET';

export type BookingRequest = {
  id: string;
  subject: BookingRequestSubject;
  startsAt: string;
  endsAt: string;
  participants: number;
  requestExpiresAt: string;
  customerName: string;
  className: string | null;
};

export type StudioReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
  reply: string | null;
};

export type InstructorAnalytics = {
  windowDays: number;
  completed: number;
  cancelled: number;
  noShows: number;
  unmarked: number;
  revenue: number;
  averageCheck: number | null;
  attendanceRate: number | null;
  uniqueClients: number;
  returningClients: number;
  rating: { average: number | null; count: number };
};

export type BoostStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type BoostCampaign = {
  id: string;
  status: BoostStatus;
  bidAmount: number;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

/** Границы ставки буста. Совпадают с `boostBidValid` в `src/domain/boost.ts`; сервер проверяет сам. */
export const boostBid = { min: 1000, max: 100_000, step: 100 } as const;

/** Минимальная длина ответа на отзыв. Совпадает с `replyLengths` в `src/domain/review-reply.ts`. */
export const replyMinLength = 10;

export function listBookingRequests() {
  return apiRequest<{ requests: BookingRequest[] }>('/api/studio/requests');
}

export function respondToBookingRequest(bookingId: string, decision: 'ACCEPT' | 'DECLINE', reason?: string) {
  return apiRequest<{ status: string }>(`/api/studio/bookings/${encodeURIComponent(bookingId)}/respond`, {
    method: 'POST',
    body: { decision, reason: reason?.trim() ? reason.trim() : undefined },
  });
}

export function listStudioReviews() {
  return apiRequest<{ reviews: StudioReview[] }>('/api/studio/reviews');
}

export function saveReviewReply(reviewId: string, body: string) {
  return apiRequest(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, { method: 'POST', body: { body: body.trim() } });
}

export function deleteReviewReply(reviewId: string) {
  return apiRequest(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, { method: 'DELETE' });
}

export function getInstructorAnalytics() {
  return apiRequest<{ analytics: InstructorAnalytics }>('/api/studio/analytics');
}

export function listBoosts() {
  return apiRequest<{ enabled: boolean; campaigns: BoostCampaign[] }>('/api/studio/boosts');
}

export function requestBoost(input: { bidAmount: number; startsAt: Date; endsAt: Date }) {
  return apiRequest<{ id: string }>('/api/studio/boosts', {
    method: 'POST',
    body: {
      bidAmount: input.bidAmount,
      startsAt: input.startsAt.toISOString(),
      endsAt: input.endsAt.toISOString(),
    },
  });
}
