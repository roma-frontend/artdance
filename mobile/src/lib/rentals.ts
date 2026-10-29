import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import type { BookingConsentId } from './booking-consents';
import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type RentalRoom = {
  id: string;
  name: string;
  capacity: number;
  areaSqm: number | null;
  pricePerHour: number;
};

export type RentalOptions = {
  venue: { slug: string; name: string; rooms: RentalRoom[] };
  rules: { minMinutes: number; maxMinutes: number; granularityMinutes: number };
};

export class RentalsError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
    /** Поле, которое сервер отверг (`consents` или `participantBirthDate`); null, если ошибка не про поле. */
    readonly field: string | null = null,
  ) {
    super(message);
  }
}

async function failureFor(response: Response): Promise<RentalsError> {
  const body = (await response.clone().json().catch(() => ({}))) as { field?: unknown };
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new RentalsError(`HTTP ${response.status}`, response.status, serverMessage, typeof body.field === 'string' ? body.field : null);
}

export async function getRentalOptions(slug: string): Promise<RentalOptions> {
  const response = await fetch(`${API_URL}/api/catalog/studios/${encodeURIComponent(slug)}/rent`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as RentalOptions;
}

async function postAuthed<T>(path: string, body: object): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new RentalsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as T;
}

/** Согласия и дата рождения участника: пусто, пока у аренды нет правила (D-03). Уходят только в бронь, не в удержание. */
export type RentalConsentFields = { consents?: BookingConsentId[]; participantBirthDate?: string };

export async function createRentalBooking({
  consentFields = {},
  ...slot
}: {
  roomId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  consentFields?: RentalConsentFields;
}): Promise<{ booking: { id: string; reference: string; totalPrice: number; startsAt: string; endsAt: string } }> {
  const hold = await postAuthed<{ hold: { id: string } }>('/api/booking/hold', slot);
  return postAuthed('/api/booking', { holdId: hold.hold.id, ...consentFields });
}
