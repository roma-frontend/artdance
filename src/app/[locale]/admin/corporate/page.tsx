/**
 * КОРПОРАТИВНЫЕ СЧЕТА (B-06) — аккаунты, баланс и выставленные счета.
 *
 * Заявка приходит через контактную форму с темой `corporate` (страница /corporate).
 * Здесь администратор создаёт аккаунт, выставляет счёт и отмечает оплату переводом.
 * Баланс пополняется только при отметке оплаты.
 */

import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  CreateCorporateAccountForm,
  IssueCorporateInvoiceForm,
  MarkCorporateInvoicePaidButton,
} from '@/components/admin/corporate-forms';
import { AccessDenied } from '@/components/ui/access-denied';
import { EmptyState } from '@/components/ui/empty-state';
import type { Locale } from '@/i18n/config';
import { adminAccess } from '@/server/admin/access';
import { listCorporateAccounts, listCorporateInvoices } from '@/server/corporate/service';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function AdminCorporatePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { can } = await adminAccess();
  if (!can('corporate.manage')) return <AccessDenied />;

  const now = new Date();
  const [accounts, invoices, t, format] = await Promise.all([
    listCorporateAccounts(),
    listCorporateInvoices(now),
    getTranslations({ locale: locale as Locale, namespace: 'corporate.admin' }),
    getFormatter(),
  ]);
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Yerevan' });

  const statusLabel = (status: string) => {
    if (status === 'PAID') return t('status.PAID');
    if (status === 'CANCELLED') return t('status.CANCELLED');
    return t('status.PENDING');
  };

  return (
    <>
      <AdminPageHeader titleKey="corporate.admin.title" subtitleKey="corporate.admin.subtitle" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm">
          <CreateCorporateAccountForm />
        </section>
        <section className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm">
          <IssueCorporateInvoiceForm accounts={accounts.map(({ id, name }) => ({ id, name }))} />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-card-title mb-3">{t('accountsTitle')}</h2>
        {accounts.length === 0 ? (
          <EmptyState title={t('emptyAccounts')} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card">
            <table className="w-full text-left text-body-sm">
              <thead className="text-label text-content-secondary">
                <tr>
                  <th className="px-4 py-3">{t('name')}</th>
                  <th className="px-4 py-3">{t('contactEmail')}</th>
                  <th className="px-4 py-3">{t('balance')}</th>
                  <th className="px-4 py-3">{t('openInvoices')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3">{account.name}</td>
                    <td className="px-4 py-3">{account.contactEmail}</td>
                    <td className="px-4 py-3">{format.number(account.balance, 'price')}</td>
                    <td className="px-4 py-3">{account.openInvoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-card-title mb-3">{t('invoicesTitle')}</h2>
        {invoices.length === 0 ? (
          <EmptyState title={t('emptyInvoices')} />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border-default bg-surface-card">
            <table className="w-full text-left text-body-sm">
              <thead className="text-label text-content-secondary">
                <tr>
                  <th className="px-4 py-3">{t('number')}</th>
                  <th className="px-4 py-3">{t('account')}</th>
                  <th className="px-4 py-3">{t('amount')}</th>
                  <th className="px-4 py-3">{t('issued')}</th>
                  <th className="px-4 py-3">{t('statusHeader')}</th>
                  <th className="px-4 py-3 text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3 font-mono">{invoice.number}</td>
                    <td className="px-4 py-3">{invoice.account?.name ?? '—'}</td>
                    <td className="px-4 py-3">{format.number(invoice.amount, 'price')}</td>
                    <td className="px-4 py-3">{dateFormat.format(invoice.issuedAt)}</td>
                    <td className="px-4 py-3">
                      {statusLabel(invoice.status)}
                      {invoice.overdue ? <span className="ml-2 text-content-danger">{t('overdue')}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      {invoice.status === 'PENDING' ? <MarkCorporateInvoicePaidButton id={invoice.id} /> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
