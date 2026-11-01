import { apiRequest } from './api-client';

/** Кабинет атлета (DS-04): программы, клуб, разряд, регистрации, рейтинг и достижения. */

export const danceSportPrograms = ['STANDARD', 'LATINE'] as const;
export type DanceSportProgram = (typeof danceSportPrograms)[number];

export type CompetitionPlace = 'GOLD' | 'SILVER' | 'BRONZE' | 'FINALIST' | 'PARTICIPANT';

export type AthleteRegistration = {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  partnerName: string | null;
  event: { title: string; slug: string; startsAt: string };
  category: { name: string };
};

export type AthleteAchievement = {
  place: CompetitionPlace;
  eventTitle: string;
  eventSlug: string;
  eventStartsAt: string;
  categoryName: string;
};

export type AthleteCabinet = {
  id: string;
  wdsfId: string | null;
  programs: DanceSportProgram[];
  clubName: string | null;
  rank: string | null;
  registrations: AthleteRegistration[];
  rating: number;
  achievements: AthleteAchievement[];
};

export type AthleteProfileInput = {
  programs: DanceSportProgram[];
  clubName: string;
  rank: string;
};

export function getAthleteCabinet() {
  return apiRequest<{ athlete: AthleteCabinet | null }>('/api/account/athlete');
}

export function saveAthleteProfile(input: AthleteProfileInput) {
  return apiRequest<{ profile: { programs: DanceSportProgram[]; clubName: string | null; rank: string | null } }>(
    '/api/account/athlete',
    { method: 'PUT', body: input },
  );
}

/** Окно рейтинга в месяцах. Совпадает с `ratingWindowMonths` в `src/domain/athlete-rating.ts`. */
export const ratingWindowMonths = 24;
