import { API_URL } from './config';
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
  ) {
    super(message);
  }
}

/** Общий GET с bearer-токеном. Личность определяет сервер. */
async function getJson<T>(path: string): Promise<T> {
  const token = await getSessionToken();
  if (!token) throw new AccountDataError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new AccountDataError(`HTTP ${response.status}`, response.status);
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
