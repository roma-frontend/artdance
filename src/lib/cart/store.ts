/**
 * CART STORE — клиентское состояние корзины (zustand).
 *
 * Сервер — источник истины (см. src/server/cart/service.ts),
 * но корзина должна отвечать мгновенно. Поэтому:
 *  - сервер отдаёт слепок (CartSnapshot);
 *  - клиент хранит его в zustand + синхронизирует через actions.
 */

'use client';

import { create } from 'zustand';

import type { CartSnapshot, CartIssue } from '@/server/cart/service';
import type { CartTotals } from '@/domain/cart';
import { emptyCartTotals } from '@/domain/cart';

export interface CartState {
  snapshot: CartSnapshot | null;
  totals: CartTotals;
  issues: readonly CartIssue[];
  hydrated: boolean;
  pending: boolean;
  setSnapshot: (snapshot: CartSnapshot | null) => void;
  setPending: (v: boolean) => void;
}

export const useCartStore = create<CartState>((set) => ({
  snapshot: null,
  totals: emptyCartTotals() as CartTotals,
  issues: [],
  hydrated: false,
  pending: false,
  setSnapshot: (snapshot) =>
    set({
      snapshot,
      totals: snapshot?.totals ?? (emptyCartTotals() as CartTotals),
      issues: (snapshot?.issues ?? []) as readonly CartIssue[],
      hydrated: true,
    }),
  setPending: (pending) => set({ pending }),
}));

export function cartItemCount(totals: CartTotals): number {
  return totals.itemCount;
}
