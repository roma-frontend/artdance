import { API_URL } from './config';
import { getSessionToken } from './session';

export type ClientBooking = {
  id: string;
  reference: string;
  status: string;
  startsAt: string;
  endsAt: string;
  totalPrice: number;
  currencyCode: string;
  classTitle: string | null;
  instructorName: string | null;
};

export class BookingsError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Брони текущего клиента. Личность определяет сервер по bearer-токену. */
export async function listMyBookings(): Promise<ClientBooking[]> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/bookings`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new BookingsError(`HTTP ${response.status}`, response.status);
  const body = (await response.json()) as { bookings: ClientBooking[] };
  return body.bookings;
}
