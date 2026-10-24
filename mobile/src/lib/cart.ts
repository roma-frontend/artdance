import { API_URL } from './config';
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
  ) {
    super(message);
  }
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
  const data = (await response.json().catch(() => ({}))) as { snapshot?: CartSnapshot; error?: string };
  if (!response.ok || !data.snapshot) throw new CartError(data.error ?? `HTTP ${response.status}`, response.status);
  return data.snapshot;
}

export function getCart(): Promise<CartSnapshot> {
  return send('GET', '');
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
  const body = (await response.json().catch(() => ({}))) as { id?: string };
  if (!response.ok || !body.id) throw new CartError(`HTTP ${response.status}`, response.status);
  return body.id;
}
