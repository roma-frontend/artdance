import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type PartnerRoom = {
  id: string;
  name: string;
  venueId?: string;
  capacity?: number;
  pricePerHour?: number;
  isActive?: boolean;
};

export type StudioClassSession = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  roomId: string | null;
  venue: { id: string; name: string };
};

export type StudioClassesSnapshot = {
  sessions: StudioClassSession[];
  rooms: PartnerRoom[];
};

export type VenueDashboardVenue = {
  id: string;
  slug: string;
  name: string;
  district: string;
  rooms: PartnerRoom[];
};

export type VenueBooking = {
  id: string;
  reference: string;
  subject: string;
  startsAt: string;
  endsAt: string;
  venueId: string;
  room: { name: string } | null;
};

export type VenueSession = StudioClassSession;

export type VenueDashboardSnapshot = {
  venues: VenueDashboardVenue[];
  bookings: VenueBooking[];
  sessions: VenueSession[];
};

export type RoomAssignmentSnapshot = {
  session: StudioClassSession;
  rooms: PartnerRoom[];
};

export class PartnerDashboardError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
    this.name = 'PartnerDashboardError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new PartnerDashboardError('UNAUTHORIZED', 401);

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new PartnerDashboardError(
      `HTTP ${response.status}`,
      response.status,
      await readServerMessage(response, catalogFor(deviceLocale(undefined))),
    );
  }
  return (await response.json()) as T;
}

export function getStudioClasses(): Promise<StudioClassesSnapshot> {
  return request<StudioClassesSnapshot>('/api/studio/classes');
}

export function getVenueDashboard(): Promise<VenueDashboardSnapshot> {
  return request<VenueDashboardSnapshot>('/api/venue');
}

export function getRoomAssignment(sessionId: string): Promise<RoomAssignmentSnapshot> {
  return request<RoomAssignmentSnapshot>(`/api/venue/room-assignment?sessionId=${encodeURIComponent(sessionId)}`);
}

export async function assignSessionRoom(input: { sessionId: string; roomId: string | null }): Promise<void> {
  await request<{ status: 'success' }>('/api/venue/room-assignment', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
