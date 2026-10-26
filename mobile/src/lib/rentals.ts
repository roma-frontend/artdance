import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

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
  ) {
    super(message);
  }
}

async function failureFor(response: Response): Promise<RentalsError> {
  return new RentalsError(`HTTP ${response.status}`, response.status, await readServerMessage(response, catalogFor(deviceLocale(undefined))));
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

export async function createRentalBooking(input: {
  roomId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}): Promise<{ booking: { id: string; reference: string; totalPrice: number; startsAt: string; endsAt: string } }> {
  const hold = await postAuthed<{ hold: { id: string } }>('/api/booking/hold', input);
  return postAuthed('/api/booking', { holdId: hold.hold.id });
}
