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
