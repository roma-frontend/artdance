/**
 * WALLET — кредит вместо возврата (B-03).
 * Деньги, которые клиент отменил, остаются в леджере и списываются на следующую бронь/заказ.
 * Операции идемпотентны по refId (bookingId/paymentId).
 */

export type WalletKind = 'CREDIT_REFUND' | 'DEBIT_CHECKOUT' | 'CREDIT_MANUAL' | 'DEBIT_MANUAL';

export function walletValidKind(kind: string): kind is WalletKind {
  return (['CREDIT_REFUND', 'DEBIT_CHECKOUT', 'CREDIT_MANUAL', 'DEBIT_MANUAL'] as const).includes(kind as WalletKind);
}
