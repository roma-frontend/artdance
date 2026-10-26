import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

export type ClientOrder = {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currencyCode: string;
  placedAt: string;
  items: { title: string; quantity: number }[];
};

export class OrdersError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<OrdersError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new OrdersError(`HTTP ${response.status}`, response.status, serverMessage);
}

/** Заказы текущего клиента. Личность определяет сервер по bearer-токену. */
export async function listMyOrders(): Promise<ClientOrder[]> {
  const token = await getSessionToken();
  if (!token) throw new OrdersError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/orders`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { orders: ClientOrder[] };
  return body.orders;
}

export type ClientOrderDetail = {
  orderNumber: string;
  status: string;
  placedAt: string;
  currencyCode: string;
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
  items: { title: string; quantity: number; lineTotal: number }[];
  payments: { id: string; status: string; amount: number }[];
};

/** Заказ текущего клиента по номеру. Чужой заказ сервер отдаёт как 404. */
export async function getMyOrder(orderNumber: string): Promise<ClientOrderDetail> {
  const token = await getSessionToken();
  if (!token) throw new OrdersError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/orders/${encodeURIComponent(orderNumber)}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { order: ClientOrderDetail };
  return body.order;
}

/**
 * Сверка платежа с провайдером. Сервер сам проверяет владельца платежа; возвращает статус платежа.
 * Вызывать для PENDING и AUTHORIZED, не по таймеру: каждый вызов — запрос к эквайреру.
 */
export async function reconcileMyPayment(paymentId: string): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new OrdersError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/payments/reconcile`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ paymentId }),
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json()) as { status: string };
  return body.status;
}

export function orderStatusLabel(status: string, c: ReturnType<typeof catalogFor>): string {
  const labels = c.status.order as Record<string, string>;
  return labels[status.toLowerCase()] ?? status;
}

export function paymentStatusLabel(status: string, c: ReturnType<typeof catalogFor>): string {
  const key = status.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  const labels = c.status.payment as Record<string, string>;
  return labels[key] ?? status;
}
