import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { paymentReturnUrl } from './payment-url';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

/**
 * Способы оплаты, которые предлагает приложение: те же, что на вебе, кроме ARCA QR. У провайдера
 * QR пока нет адаптера (как и у ARCA, IDRAM и TELCELL в проде). Наличные при получении провайдер
 * не обрабатывает: заказ сразу уходит в сборку, поэтому экран оплаты для них не открывается.
 */
export const mobilePaymentMethods = ['CARD', 'ARCA', 'IDRAM', 'TELCELL', 'CASH_ON_DELIVERY'] as const;
export type MobilePaymentMethod = (typeof mobilePaymentMethods)[number];

export type DeliveryMethod = 'COURIER' | 'PICKUP_POINT';

export type PlaceOrderInput = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: { street: string; city: string; postalCode: string | null } | null;
  deliveryNotes: string | null;
};

export type PlacedOrder = {
  id: string;
  orderNumber: string;
  total: number;
};

export type PaymentIntentResult = {
  orderNumber: string;
  status: string;
  /** Провайдер платежа: 'stripe' или 'mock'. */
  provider: string;
  /** Сумма, уходящая провайдеру. Ноль, если заказ закрыт балансом кошелька. */
  amount: number;
  providerTransactionId: string | null;
  /** Секрет встроенной формы оплаты; есть только при inAppSheet. */
  clientSecret?: string | null;
  /** Заказ закрыт балансом кошелька целиком: провайдер не участвует. */
  settledByWallet: boolean;
};

export class CheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<CheckoutError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new CheckoutError(`HTTP ${response.status}`, response.status, serverMessage);
}

/**
 * Создаёт заказ из корзины текущего клиента. Сервер сам пересчитывает цены и доставку,
 * очищает корзину и возвращает номер заказа.
 */
export async function placeMyOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const token = await getSessionToken();
  if (!token) throw new CheckoutError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/orders`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { order: PlacedOrder };
  return body.order;
}

/**
 * Создаёт заказ на пакет занятий. Пакет выдаёт сервер после оплаты, поэтому ответ — заказ, а не пакет.
 */
export async function placeClassPassOrder(passId: string): Promise<PlacedOrder> {
  const token = await getSessionToken();
  if (!token) throw new CheckoutError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/class-passes/purchase`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ passId }),
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { order: PlacedOrder };
  return body.order;
}

/**
 * Отправляет заказ провайдеру и возвращает секрет для встроенной формы оплаты. Кошелёк применяется
 * автоматически. Подтверждение оплаты приходит с webhook'а и сверки, поэтому статус здесь — только
 * ответ на запрос, а не доказательство оплаты.
 */
export async function payMyOrder(orderId: string, method: MobilePaymentMethod, locale: string): Promise<PaymentIntentResult> {
  const token = await getSessionToken();
  if (!token) throw new CheckoutError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/payments/intent`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId, method, locale, useWallet: true, fromApp: true, returnTo: paymentReturnUrl(), inAppSheet: true }),
  });
  if (!response.ok) throw await failureFor(response);
  return (await response.json()) as PaymentIntentResult;
}
