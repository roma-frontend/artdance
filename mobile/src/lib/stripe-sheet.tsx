import type { ReactElement } from 'react';

export type SheetResult = 'COMPLETED' | 'CANCELED' | 'FAILED' | 'UNAVAILABLE';

// Веб-сборка: Stripe нативной формы не имеет. Нативная реализация — stripe-sheet.native.tsx.
export function isNativeStripeAvailable(): boolean {
  return false;
}

export function StripeRoot({ children }: { children: ReactElement }) {
  return children;
}

export async function presentStripeSheet(_clientSecret: string, _returnURL: string): Promise<SheetResult> {
  return 'UNAVAILABLE';
}
