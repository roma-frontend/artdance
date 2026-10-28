import 'server-only';

import { getServerEnv } from '@/config/env';

import type { PaymentProviderId } from './types';

/**
 * Публикуемый ключ провайдера для встроенной формы оплаты, он отдаётся клиенту в ответе интента.
 *
 * Наружу уходит только ключ `pk_`: если в переменную по ошибке записали секретный `sk_`,
 * ответ его не раскроет и вернётся `null`. У mock ключа нет.
 */
export function publishableKeyFor(provider: PaymentProviderId | undefined): string | null {
  if (provider !== 'stripe') return null;
  const key = getServerEnv().STRIPE_PUBLISHABLE_KEY;
  return key?.startsWith('pk_') ? key : null;
}
