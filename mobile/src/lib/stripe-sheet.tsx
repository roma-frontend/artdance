import type { ReactElement } from 'react';

export type CardConfirmResult = 'PAID' | 'DECLINED' | 'FAILED' | 'CANCELED';

// Веб-сборка: Stripe нативной формы не имеет. Нативная реализация — stripe-sheet.native.tsx.
export function isNativeStripeAvailable(): boolean {
  return false;
}

export function StripeRoot({ children }: { children: ReactElement }) {
  return children;
}

/** Веб-сборка: нативного поля карты нет, оплата в браузере не открывается. */
export function NativeCardField(_props: { onComplete: (complete: boolean) => void }) {
  return null;
}

export async function confirmCardPayment(_clientSecret: string): Promise<CardConfirmResult> {
  return 'FAILED';
}
