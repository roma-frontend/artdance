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
  instructorSlug: string | null;
  canReschedule: boolean;
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

export type ReviewModeration = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ClientBookingDetail = ClientBooking & {
  basePrice: number;
  travelFee: number;
  lessonType: string;
  partnerName: string | null;
  venueName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  reviewModeration: ReviewModeration | null;
};

/** Детали одной брони владельца. Чужая бронь сервером не отдаётся (404). */
export async function getMyBooking(bookingId: string): Promise<ClientBookingDetail> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/bookings/${encodeURIComponent(bookingId)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { booking: ClientBookingDetail };
  return body.booking;
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

const ACTIVE_STATUSES: ReadonlySet<string> = new Set(['PENDING', 'CONFIRMED']);

/** Отменить можно активную бронь, пока занятие не началось. Окно и удержание считает сервер. */
export function canCancelBooking(booking: ClientBooking, now = Date.now()): boolean {
  return ACTIVE_STATUSES.has(booking.status) && Date.parse(booking.startsAt) > now;
}

/** Перенос доступен индивидуальной активной брони, пока лимит не исчерпан и занятие не началось. */
export function canRescheduleBooking(booking: ClientBooking, now = Date.now()): boolean {
  return booking.canReschedule && booking.instructorSlug !== null && canCancelBooking(booking, now);
}

/** Бронь с ценой, ожидающая оплаты: её можно оплатить из списка. */
export function canPayBooking(booking: ClientBooking): boolean {
  return booking.status === 'PENDING' && booking.totalPrice > 0;
}

/** Отзыв по завершённой брони, по которой ещё нет отзыва. Статус и окно окончательно проверяет сервер. */
export function canReviewBooking(booking: ClientBookingDetail, now = Date.now()): boolean {
  if (booking.reviewModeration !== null) return false;
  if (booking.status === 'COMPLETED') return true;
  return booking.status === 'CONFIRMED' && Date.parse(booking.endsAt) <= now;
}

export type Slot = { startIso: string; startTime: string; endTime: string; endIso: string };

/** Ближайшие свободные слоты инструктора; эндпоинт публичный. */
export async function listAvailableSlots(instructorSlug: string): Promise<Slot[]> {
  const response = await fetch(`${API_URL}/api/availability?instructor=${encodeURIComponent(instructorSlug)}&count=20`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { slots: Slot[] };
  return body.slots;
}

export type ClassSessionSlot = Slot & {
  sessionId: string;
  available: boolean;
  spotsLeft: number;
  waitlist: { position: number; claimable: boolean } | null;
};

export type ClassSessions = {
  instructorSlug: string;
  classSlug: string;
  lessonType: 'GROUP' | 'PRIVATE' | 'PAIR';
  waitlistOpen: boolean;
  slots: ClassSessionSlot[];
};

/** Проведения группового занятия. Личное место в листе ожидания видно только с входом. */
export async function listClassSessions(instructorSlug: string, classSlug: string): Promise<ClassSessions> {
  const token = await getSessionToken();
  const query = `instructor=${encodeURIComponent(instructorSlug)}&class=${encodeURIComponent(classSlug)}`;
  const response = await fetch(`${API_URL}/api/booking/sessions?${query}`, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as ClassSessions;
}

async function postAuthed<T>(path: string, body: object): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as T;
}

export type PayMethod = 'CARD' | 'ARCA' | 'IDRAM' | 'TELCELL' | 'ARCA_QR';

/** Оплата конкретной брони: сервер возвращает ссылку провайдера. */
export function payBooking(bookingId: string, method: PayMethod): Promise<{ redirectUrl: string | null }> {
  return postAuthed(`/api/booking/${encodeURIComponent(bookingId)}/pay`, { method, locale: deviceLocale(undefined), fromApp: true });
}

/** Отзыв по своей брони; сервер проверяет владельца, статус, окно и публикует после модерации. */
export function submitBookingReview(input: {
  bookingId: string;
  rating: number;
  body: string;
}): Promise<{ review: { id: string; moderation: ReviewModeration } }> {
  return postAuthed('/api/account/reviews', input);
}

/** Встать в лист ожидания на заполненное проведение. */
export function joinClassWaitlist(sessionId: string): Promise<{ waitlist: { id: string; position: number } }> {
  return postAuthed('/api/waitlist', { sessionId });
}

/** Забрать освободившееся место: сервер выдаёт удержание, дальше обычная бронь и оплата. */
export function claimWaitlistHold(sessionId: string): Promise<{ hold: { id: string; expiresAt: string } }> {
  return postAuthed('/api/waitlist/claim', { sessionId });
}

export type RecurringSeries = { seriesId: string; bookings: { id: string; startsAt: string }[] };

/** Серия еженедельных броней у инструктора. Занятия, которые не удалось забронировать, сервер пропускает. */
export function createRecurringSeries(input: {
  instructorId: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  weeks: number;
}): Promise<RecurringSeries> {
  return postAuthed('/api/booking/recurring', input);
}

export type RescheduleResult = {
  booking: { id: string; startsAt: string; endsAt: string; totalPrice: number };
  priceDifference: number;
  remaining: number;
  durationMinutes: number;
};

/** Перенос брони на другой слот. Цену и окно переноса проверяет сервер. */
export async function rescheduleMyBooking(bookingId: string, slot: { newStartsAt: string; newEndsAt: string }): Promise<RescheduleResult> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/booking/${encodeURIComponent(bookingId)}/reschedule`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(slot),
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as RescheduleResult;
}

export type CancelResult = {
  outcome: 'free' | 'fee';
  fee: number;
  refund: number;
  credited: boolean;
  booking: { totalPrice: number };
};

/** Отмена брони владельцем. Ошибки окна отмены приходят с переведённым текстом. */
export async function cancelMyBooking(bookingId: string): Promise<CancelResult> {
  const token = await getSessionToken();
  if (!token) throw new BookingsError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/booking/${encodeURIComponent(bookingId)}/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as CancelResult;
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
