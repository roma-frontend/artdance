/**
 * СЧЕТ КОМПАНИИ (B-06) — баланс и счета компании, к которой привязан пользователь.
 *
 * Страница только для чтения: списания и оплаты делает администратор через согласование
 * второго администратора. Видны только счета своей компании. Без привязки показывается
 * пояснение, а не пустой список: человек должен понимать, почему раздела нет.
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountNav } from '@/components/account/account-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { EmptyState } from '@/components/ui/empty-state';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { buildMetadata } from '@/lib/seo/metadata';
import { corporateCabinetFor } from '@/server/corporate/service';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

interface PageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'corporate.cabinet' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountCompany(), title: t('title'), noIndex: true });
}

export default async function AccountCompanyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountCompany()), locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('corporate.cabinet');
  const format = await getFormatter({ locale: locale as Locale });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Yerevan' });
  const entitlements = await getEffectiveEntitlementsSafe();
  const company = await corporateCabinetFor(caller.id);

  const statusLabel = (status: string) => {
    if (status === 'PAID') return t('statuses.PAID');
    if (status === 'CANCELLED') return t('statuses.CANCELLED');
    return t('statuses.PENDING');
  };

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('title')}</h1>
        <AccountNav locale={locale as Locale} pathname={routes.accountCompany()} entitlements={entitlements} />

        {!company ? (
          <div className="mt-6">
            <EmptyState title={t('notLinked')} />
          </div>
        ) : (
          <>
            <p className="text-body-sm mt-4 text-content-secondary">{t('intro')}</p>

            <section aria-labelledby="company-balance" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
              <h2 id="company-balance" className="text-eyebrow text-content-tertiary">{company.name}</h2>
              <p className="mt-2 text-heading-3">
                {t('balance')}: {format.number(company.balance, 'price')}
              </p>
            </section>

            <section aria-labelledby="company-invoices" className="mt-6">
              <h2 id="company-invoices" className="text-card-title">{t('invoicesTitle')}</h2>
              {company.invoices.length === 0 ? (
                <p className="text-body-sm mt-3 text-content-tertiary">{t('none')}</p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-xl border border-border-default bg-surface-card">
                  <table className="w-full text-left text-body-sm">
                    <thead className="text-label text-content-secondary">
                      <tr>
                        <th className="px-4 py-3">{t('number')}</th>
                        <th className="px-4 py-3">{t('orderHeader')}</th>
                        <th className="px-4 py-3">{t('amount')}</th>
                        <th className="px-4 py-3">{t('issued')}</th>
                        <th className="px-4 py-3">{t('statusHeader')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {company.invoices.map((invoice) => (
                        <tr key={invoice.number} className="border-t border-border-subtle">
                          <td className="px-4 py-3 font-mono">{invoice.number}</td>
                          <td className="px-4 py-3 font-mono">{invoice.order?.orderNumber ?? '—'}</td>
                          <td className="px-4 py-3">{format.number(invoice.amount, 'price')}</td>
                          <td className="px-4 py-3">{dateFormat.format(invoice.issuedAt)}</td>
                          <td className="px-4 py-3">{statusLabel(invoice.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <SiteFooter />
      </main>
    </>
  );
}
