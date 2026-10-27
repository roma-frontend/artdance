import { API_URL } from './config';
import { getSessionToken } from './session';

export type SupportFeature = {
  key: string;
  group: 'store' | 'content' | 'platform';
  tier: 'mvp' | 'full' | 'premium';
  enabled: boolean;
  overridden: boolean;
};

export type SupportTicket = {
  id: string;
  name: string;
  topic: string;
  message: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED';
  createdAt: string;
};

export type SupportPayout = {
  id: string;
  reference: string;
  amount: number;
  currencyCode: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'PAID' | 'FAILED' | 'ON_HOLD';
  periodEnd: string;
  failureReason: string | null;
};

export type SupportIntegration = { key: string; provider: string; connected: boolean };

export type SupportSnapshot = {
  canManageEntitlements: boolean;
  pulse: {
    counts: Record<string, number>;
    stats: Record<string, number>;
  };
  entitlements: { preset: 'mvp' | 'full' | 'premium'; features: SupportFeature[] };
  tickets: SupportTicket[];
  payouts: SupportPayout[];
  integrations: SupportIntegration[];
};

export class SupportApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new SupportApiError('unauthorized', 401);
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const json = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new SupportApiError(json.error ?? `HTTP ${response.status}`, response.status);
  return json;
}

export function getSupportAccess(): Promise<{ canAccess: true; canManageEntitlements: boolean }> {
  return call<{ canAccess: true; canManageEntitlements: boolean }>('/api/mobile/support/access');
}

export function getSupportSnapshot(): Promise<SupportSnapshot> {
  return call<SupportSnapshot>('/api/mobile/support/snapshot');
}

export function setSupportPreset(preset: 'mvp' | 'full' | 'premium'): Promise<unknown> {
  return call('/api/mobile/support/entitlements', { method: 'POST', body: { preset } });
}

export function setSupportOverride(key: string, enabled: boolean | null): Promise<unknown> {
  return call('/api/mobile/support/entitlements', { method: 'POST', body: { key, enabled } });
}

export function releaseSupportPayout(id: string, hold: boolean): Promise<unknown> {
  return call('/api/mobile/support/payouts', { method: 'POST', body: { id, hold } });
}

export function setSupportTicketStatus(id: string, status: SupportTicket['status']): Promise<unknown> {
  return call('/api/mobile/support/tickets', { method: 'POST', body: { id, status } });
}
