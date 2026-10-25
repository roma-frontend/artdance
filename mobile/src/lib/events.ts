import { catalogFor } from '@/i18n/catalog';
import { API_URL } from './config';
import { deviceLocale } from './i18n';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

/** Категория соревнования из `GET /api/catalog/events/[slug]`. `spotsLeft` есть только при лимите мест. */
export type CompetitionCategory = {
  id: string;
  name: string;
  ageGroup: string;
  minAge?: number;
  maxAge?: number;
  program: string;
  discipline?: string;
  conditions?: string;
  entryFee?: number;
  spotsLeft?: number;
  maxEntries?: number;
};

/** Поля события, нужные для регистрации. Остальное приходит в том же ответе и здесь не нужно. */
export type CompetitionEventDetail = {
  slug: string;
  title: string;
  type: string;
  startsAt: string;
  locationName: string;
  registrationOpenAt?: string;
  registrationCloseAt?: string;
  competitionCategories?: CompetitionCategory[];
};

/** Зеркало `registrationIsOpen` из `src/domain/competition.ts`: отсутствующая граница не ограничивает. */
export function isRegistrationOpen(
  detail: Pick<CompetitionEventDetail, 'registrationOpenAt' | 'registrationCloseAt'>,
  now: number = Date.now(),
): boolean {
  const openAt = detail.registrationOpenAt ? Date.parse(detail.registrationOpenAt) : null;
  const closeAt = detail.registrationCloseAt ? Date.parse(detail.registrationCloseAt) : null;
  if (openAt !== null && now < openAt) return false;
  if (closeAt !== null && now > closeAt) return false;
  return true;
}

/** Формат `YYYY-MM-DD`, реальная дата и не в будущем. Сервер проверяет то же самое. */
export function isValidBirthDate(value: string, now: number = Date.now()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(time) || time > now) return false;
  return new Date(time).toISOString().slice(0, 10) === value;
}

/** Зеркало `ageFitsCategory` из `src/domain/competition.ts`: возраст на дату события, границы включительно. */
export function ageFitsCategory(birthDate: string, eventStartsAt: string, category: Pick<CompetitionCategory, 'minAge' | 'maxAge'>): boolean {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const event = new Date(eventStartsAt);
  let age = event.getUTCFullYear() - birth.getUTCFullYear();
  const month = event.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && event.getUTCDate() < birth.getUTCDate())) age -= 1;
  return (category.minAge === undefined || age >= category.minAge) && (category.maxAge === undefined || age <= category.maxAge);
}

/** Ошибка регистрации. `serverMessage` уже переведён через словарь приложения, если сервер прислал ключ. */
export class EventsError extends Error {
  readonly status: number;
  readonly serverMessage: string | null;

  constructor(status: number, serverMessage: string | null) {
    super(`EVENTS_${status}`);
    this.name = 'EventsError';
    this.status = status;
    this.serverMessage = serverMessage;
  }
}

/** Заявка на соревнование. Сервер сам проверяет окно, возраст, лимит мест и повторную заявку. */
export async function registerForCompetition(
  eventSlug: string,
  input: { categoryId: string; birthDate: string; partnerName?: string },
): Promise<{ registration: { id: string } }> {
  const token = await getSessionToken();
  if (!token) throw new EventsError(401, null);

  const response = await fetch(`${API_URL}/api/events/${encodeURIComponent(eventSlug)}/register`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      categoryId: input.categoryId,
      birthDate: input.birthDate,
      ...(input.partnerName ? { partnerName: input.partnerName } : {}),
    }),
  });
  if (!response.ok) {
    throw new EventsError(response.status, await readServerMessage(response, catalogFor(deviceLocale(undefined))));
  }
  return (await response.json()) as { registration: { id: string } };
}
