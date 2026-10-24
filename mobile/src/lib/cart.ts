import { catalogFor } from '@/i18n/catalog';
import { deviceLocale } from '@/lib/i18n';

import { API_URL } from './config';
import { readServerMessage } from './server-message';
import { getSessionToken } from './session';

/** Позиция корзины, как её отдаёт `/api/cart`. Цены берутся на сервере из БД. */
export type CartItem = {
  id: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  sku: string | null;
  title: string;
  slug: string | null;
  image: { key: string } | null;
  brand: string | null;
  /** Доступный остаток (сток минус резервы). */
  stock: number;
  isActive: boolean;
};

export type CartTotals = {
  /** Штук в корзине, а не позиций. */
  itemCount: number;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
};

export type CartIssue =
  | { type: 'priceChanged'; variantId: string; from: number; to: number }
  | { type: 'outOfStock'; variantId: string }
  | { type: 'quantityClamped'; variantId: string; requested: number; allowed: number }
  | { type: 'promoInvalid'; reason: string };

export type CartSnapshot = {
  items: CartItem[];
  promoCode: string | null;
  totals: CartTotals;
  issues: CartIssue[];
};

export class CartError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly serverMessage: string | null = null,
  ) {
    super(message);
  }
}

/** Ошибка ответа с переведённым текстом сервера, если messageKey есть в словаре приложения. */
async function failureFor(response: Response): Promise<CartError> {
  const serverMessage = await readServerMessage(response, catalogFor(deviceLocale(undefined)));
  return new CartError(`HTTP ${response.status}`, response.status, serverMessage);
}

/**
 * Все операции корзины требуют сессию: личность определяет сервер по bearer-токену.
 * Каждый ответ содержит актуальный снимок корзины.
 */
async function send(method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', query: string, body?: unknown): Promise<CartSnapshot> {
  const token = await getSessionToken();
  if (!token) throw new CartError('UNAUTHORIZED', 401);
  const hasBody = body !== undefined;
  const response = await fetch(`${API_URL}/api/cart${query}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw await failureFor(response);
  const data = (await response.json().catch(() => ({}))) as { snapshot?: CartSnapshot };
  if (!data.snapshot) throw new CartError(`HTTP ${response.status}`, response.status);
  return data.snapshot;
}

/** `delivery` задаёт способ доставки для превью итога (с доставкой). Без него доставка не считается. */
export function getCart(delivery?: 'COURIER' | 'PICKUP_POINT'): Promise<CartSnapshot> {
  return send('GET', delivery ? `?delivery=${delivery}` : '');
}

export function addToCart(variantId: string, quantity = 1): Promise<CartSnapshot> {
  return send('POST', '', { variantId, quantity });
}

export function setCartItemQuantity(itemId: string, quantity: number): Promise<CartSnapshot> {
  return send('PATCH', '', { itemId, quantity });
}

export function removeCartItem(itemId: string): Promise<CartSnapshot> {
  return send('DELETE', `?itemId=${encodeURIComponent(itemId)}`);
}

export function applyPromoCode(code: string): Promise<CartSnapshot> {
  return send('PUT', '', { code });
}

export function removePromoCode(): Promise<CartSnapshot> {
  return send('DELETE', '?op=removePromo');
}

/**
 * Корзина принимает id варианта, а каталог отдаёт только SKU. Публичный поиск, токен не нужен.
 */
export async function resolveVariantId(sku: string): Promise<string> {
  const response = await fetch(`${API_URL}/api/cart/variant-id?sku=${encodeURIComponent(sku)}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw await failureFor(response);
  const body = (await response.json().catch(() => ({}))) as { id?: string };
  if (!body.id) throw new CartError(`HTTP ${response.status}`, response.status);
  return body.id;
}
