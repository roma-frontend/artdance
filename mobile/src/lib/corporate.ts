import { apiRequest } from './api-client';

/** Кабинет компании (B-06, пакет PREMIUM): баланс и счета, только чтение. */

export type CompanyInvoice = {
  number: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  issuedAt: string;
  paidAt: string | null;
  order: { orderNumber: string } | null;
};

export type CompanyAccount = {
  name: string;
  balance: number;
  invoices: CompanyInvoice[];
};

/** `account` — `null`, если пользователь не привязан к компании. */
export function getCompanyAccount() {
  return apiRequest<{ account: CompanyAccount | null }>('/api/account/company');
}
