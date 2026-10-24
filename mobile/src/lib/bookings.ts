import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
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
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<BookingsError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new BookingsError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Брони текущего клиента. Личность определяет сервер по bearer-токену. */
export async function listMyBookings(): Promise<ClientBooking[]> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/bookings`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { bookings: ClientBooking[] };
  return body.bookings;
}

export type BookingPass = { token: string; qrData: string; reference: string };

/** QR-пропуск брони владельца; токен подписан сервером и выдаётся заново при каждом открытии. */
export async function getBookingPass(bookingId: string): Promise<BookingPass> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/booking/pass/${encodeURIComponent(bookingId)}/qr`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as BookingPass;
}

const CANCELLED_STATUSES: ReadonlySet<string> = new Set(['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_PROVIDER']);

export function isCancelledBooking(status: string): boolean {
  return CANCELLED_STATUSES.has(status);
}

/** Подпись статуса из словаря; неизвестный статус показывается как есть. */
export function bookingStatusLabel(status: string, c: ReturnType<typeof catalogFor>): string {
  const labels = c.status.booking as Record<string, string>;
  return labels[status.toLowerCase().replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase())] ?? status;
}
