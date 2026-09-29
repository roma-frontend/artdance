/**
 * CORPORATE (B-06) — заявка корпорации → счёт → оплата переводом → баланс b2b.
 * Сумма Invoice — в AMD; Order связывается корпоративным счётом, когда оплата
 * прошла по безналу (status PAID), а не картой.
 */

export type CorporateInvoiceStatus = 'PENDING' | 'PAID' | 'CANCELLED';

export function invoiceOverdue(issuedAt: Date, paidAt: Date | null, now: Date, hours: number): boolean {
  if (paidAt) return false;
  return now.getTime() - issuedAt.getTime() > hours * 60 * 60 * 1000;
}
