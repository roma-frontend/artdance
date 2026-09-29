/**
 * WALLET — единая книга (B-03/B-04): CREDIT_REFUND/DEBIT_CHECKOUT + бонусы/рефералы/подарочки.
 * Одна таблица WalletEntry — чекаут применяет баланс одной транзакцией, история единая.
 */

export type WalletKind =
  | 'CREDIT_REFUND'
  | 'DEBIT_CHECKOUT'
  | 'CREDIT_BONUS'
  | 'CREDIT_REFERRAL'
  | 'CREDIT_GIFT'
  | 'CREDIT_MANUAL'
  | 'DEBIT_MANUAL';

export function walletValidKind(kind: string): kind is WalletKind {
  return (
    [
      'CREDIT_REFUND',
      'DEBIT_CHECKOUT',
      'CREDIT_BONUS',
      'CREDIT_REFERRAL',
      'CREDIT_GIFT',
      'CREDIT_MANUAL',
      'DEBIT_MANUAL',
    ] as const
  ).includes(kind as WalletKind);
}
