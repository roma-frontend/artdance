import { API_URL } from './config';

export type RedeemedGiftCard = { balance: number; expiresAt: string | null };

/** Код ответа сервера при отказе: NOT_FOUND, EXPIRED или ALREADY_REDEEMED. */
export class GiftCardRedeemError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

type RedeemResponse = Partial<RedeemedGiftCard> & { error?: string };

/** Проверка кода подарочной карты: баланс и срок. Эндпоинт публичный, вход не нужен. */
export async function redeemGiftCard(code: string): Promise<RedeemedGiftCard> {
  const response = await fetch(`${API_URL}/api/gift-cards/redeem`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = (await response.json().catch(() => null)) as RedeemResponse | null;
  if (!response.ok || !body || body.balance === undefined) {
    throw new GiftCardRedeemError(body?.error ?? 'INTERNAL', response.status);
  }
  return { balance: body.balance, expiresAt: body.expiresAt ?? null };
}
