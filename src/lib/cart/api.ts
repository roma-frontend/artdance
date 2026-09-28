'use client';

import { getAnonymousId } from '@/lib/client/anonymous-id';
import type { CartSnapshot } from '@/server/cart/service';

function anonHeader(): Record<string, string> {
  const id = getAnonymousId();
  return id ? { 'x-anonymous-id': id } : {};
}

export async function fetchCart(): Promise<CartSnapshot | null> {
  const res = await fetch('/api/cart', { headers: anonHeader(), cache: 'no-store' });
  if (!res.ok) return null;
  const data = (await res.json()) as { snapshot: CartSnapshot };
  return data.snapshot ?? null;
}

export async function cartAdd(variantId: string, quantity?: number): Promise<CartSnapshot | null> {
  const res = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...anonHeader() },
    body: JSON.stringify({ variantId, quantity }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { snapshot: CartSnapshot };
  return data.snapshot ?? null;
}

export async function cartUpdate(itemId: string, quantity: number): Promise<CartSnapshot | null> {
  const res = await fetch('/api/cart', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...anonHeader() },
    body: JSON.stringify({ itemId, quantity }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { snapshot: CartSnapshot };
  return data.snapshot ?? null;
}

export async function cartRemove(itemId: string): Promise<CartSnapshot | null> {
  const res = await fetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, { headers: anonHeader() });
  if (!res.ok) {
    // fallback DELETE with header
    const r2 = await fetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: anonHeader() });
    if (!r2.ok) return null;
    const d2 = (await r2.json()) as { snapshot: CartSnapshot };
    return d2.snapshot ?? null;
  }
  const data = (await res.json().catch(() => null)) as { snapshot: CartSnapshot } | null;
  if (data?.snapshot) return data.snapshot;
  // если GET не реализован — пробуем DELETE
  const r2 = await fetch(`/api/cart?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE', headers: anonHeader() });
  if (!r2.ok) return null;
  const d2 = (await r2.json()) as { snapshot: CartSnapshot };
  return d2.snapshot ?? null;
}

export async function cartApplyPromo(code: string): Promise<CartSnapshot | null> {
  const res = await fetch('/api/cart', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...anonHeader() },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { snapshot: CartSnapshot };
  return data.snapshot ?? null;
}

export async function cartRemovePromo(): Promise<CartSnapshot | null> {
  const res = await fetch('/api/cart?op=removePromo', { method: 'DELETE', headers: anonHeader() });
  if (!res.ok) return null;
  const data = (await res.json()) as { snapshot: CartSnapshot };
  return data.snapshot ?? null;
}

export async function cartValidate(): Promise<CartSnapshot | null> {
  const res = await fetch('/api/cart?op=validate', { method: 'DELETE', headers: anonHeader() });
  if (!res.ok) return null;
  const data = (await res.json()) as { snapshot: CartSnapshot };
  return data.snapshot ?? null;
}
