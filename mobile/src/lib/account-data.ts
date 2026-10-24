import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type SubscriptionUsage = { metric: string; used: number };

export type ClientSubscription = {
  id: string;
  planId: string;
  interval: string;
  status: string;
  price: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  usage: SubscriptionUsage[];
};

export type WalletEntry = {
  id: string;
  amount: number;
  kind: string;
  createdAt: string;
};

export type ClientWallet = { balance: number; entries: WalletEntry[] };

export type InvitedReferral = { id: string; createdAt: string; bonusPaid: boolean };

export type ClientReferrals = { code: string; bonusAmount: number; invited: InvitedReferral[] };

export class AccountDataError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа; текст сервера переводится, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<AccountDataError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new AccountDataError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Общий GET с bearer-токеном. Личность определяет сервер. */
async function getJson<T>(path: string): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new AccountDataError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as T;
}

export async function getMySubscription(): Promise<ClientSubscription | null> {
  const body = await getJson<{ subscription: ClientSubscription | null }>('/api/account/subscription');
  return body.subscription;
}

export function getMyWallet(): Promise<ClientWallet> {
  return getJson<ClientWallet>('/api/account/wallet');
}

export function getMyReferrals(): Promise<ClientReferrals> {
  return getJson<ClientReferrals>('/api/account/referrals');
}

/** JSON-дамп персональных данных (GDPR) в виде текста, как его отдал сервер. */
export async function exportMyData(): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new AccountDataError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  return response.text();
}
