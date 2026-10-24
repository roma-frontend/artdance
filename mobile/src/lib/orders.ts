import { API_URL } from './config';
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
  ) {
    super(message);
  }
}

/** Заказы текущего клиента. Личность определяет сервер по bearer-токену. */
export async function listMyOrders(): Promise<ClientOrder[]> {
  const token = await getSessionToken();
  if (!token) throw new OrdersError('UNAUTHORIZED', 401);
  const response = await fetch(`${API_URL}/api/account/orders`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new OrdersError(`HTTP ${response.status}`, response.status);
  const body = (await response.json()) as { orders: ClientOrder[] };
  return body.orders;
}
