/**
 * КОШЕЛЁК — баланс, пополнение, история.
 *
 * Маршрут существовал, но ссылки на него не было нигде: попасть можно было
 * только по прямому адресу. Теперь он в общей навигации кабинета
 * (`components/account/account-nav`), а на самом экране — пополнение, которое
 * идёт тем же платёжным путём, что и покупка товара.
 *
 * **Проводки показываются переводом вида, а не сырым `kind`.** `CREDIT_REFUND`
 * в интерфейсе клиента — это код из базы, а не «Возврат». Неизвестный вид
 * (новая проводка, добавленная сервером раньше интерфейса) показывается как
 * есть: пустая строка скрыла бы от человека движение денег.
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountNav } from '@/components/account/account-nav';
import { WalletTopUp } from '@/components/account/wallet-top-up';
import { SiteFooter } from '@/components/layout/site-footer';
import { Price } from '@/components/ui/price';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';
import { walletTopUpPresets } from '@/domain/wallet';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

interface PageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountWallet(), title: t('walletScreen.title'), noIndex: true });
}

/** Виды проводок, у которых есть перевод. Остальные показываются кодом. */
const knownKinds = ['CREDIT_TOPUP', 'CREDIT_REFUND', 'CREDIT_REFERRAL', 'CREDIT_GIFT', 'DEBIT_CHECKOUT', 'DEBIT_MANUAL'] as const;
type KnownKind = (typeof knownKinds)[number];

function isKnownKind(kind: string): kind is KnownKind {
  return (knownKinds as readonly string[]).includes(kind);
}

export default async function AccountWalletPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await assertEntitlementOrNotFound('wallet');

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountWallet()), locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('account');
  const format = await getFormatter({ locale: locale as Locale });
  const entitlements = await getEffectiveEntitlementsSafe();

  const account = await db.walletAccount.findUnique({
    where: { userId: caller.id },
    select: {
      balance: true,
      entries: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, amount: true, kind: true, refId: true, createdAt: true },
      },
    },
  });
  const balance = account?.balance ?? 0;
  const entries = account?.entries ?? [];

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('walletScreen.title')}</h1>
        <AccountNav locale={locale as Locale} pathname={routes.accountWallet()} entitlements={entitlements} />

        <section aria-labelledby="wallet-balance" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
          <h2 id="wallet-balance" className="text-eyebrow text-content-tertiary">{t('walletScreen.balanceTitle')}</h2>
          <div className="mt-1"><Price amount={balance} emphasis="total" /></div>
          <p className="text-body-sm mt-2 text-content-secondary">{t('walletScreen.hint')}</p>
        </section>

        <section aria-labelledby="wallet-topup" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
          <h2 id="wallet-topup" className="text-card-title">{t('walletScreen.topUpTitle')}</h2>
          <WalletTopUp presets={walletTopUpPresets} />
        </section>

        <section aria-labelledby="wallet-history" className="mt-6">
          <h2 id="wallet-history" className="text-card-title">{t('walletScreen.historyTitle')}</h2>
          {entries.length === 0 ? (
            <p className="text-body-sm mt-3 text-content-tertiary">{t('walletScreen.historyEmpty')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-card">
              {entries.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium">
                      {isKnownKind(entry.kind) ? t(`walletScreen.kinds.${entry.kind}`) : entry.kind}
                    </p>
                    <p className="text-caption text-content-tertiary">
                      {format.dateTime(entry.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <span
                    className={
                      entry.amount >= 0
                        ? 'shrink-0 text-body-sm font-semibold tabular-nums text-content-success'
                        : 'shrink-0 text-body-sm font-semibold tabular-nums text-content-danger'
                    }
                  >
                    {entry.amount > 0 ? '+' : '−'}
                    {format.number(Math.abs(entry.amount), 'price')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SiteFooter />
      </main>
    </>
  );
}
