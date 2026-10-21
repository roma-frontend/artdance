/**
 * РЕФЕРАЛЫ — код, приглашённые, выплата бонуса.
 *
 * Код заводится при первом открытии страницы (`ensureReferralCode`), а не при
 * регистрации: не все регистрируются в первый заход, а код нужен тому, кто
 * решил пригласить, — и до этого момента он никому не мешает.
 *
 * **Приглашённый без оплаты — не «выплачено».** Бонус платит `settle` после
 * первой оплаченной покупки, и страница различает три состояния: приглашён,
 * ждёт первой покупки, выплачено. Обещать выплату раньше времени значит
 * получить вопрос «где деньги» через минуту после регистрации друга.
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { AccountNav } from '@/components/account/account-nav';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { ensureReferralCode, referralBonusAmount } from '@/server/referral/service';

interface PageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountReferrals(), title: t('referrals.title'), noIndex: true });
}

export default async function AccountReferralsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await assertEntitlementOrNotFound('referrals');

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountReferrals()), locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('account');
  const format = await getFormatter({ locale: locale as Locale });
  const entitlements = await getEffectiveEntitlementsSafe();

  const code = await ensureReferralCode(caller.id);

  /* Приглашённые по этому коду: дата привязки и факт выплаты, без чужих данных. */
  const invited = await db.referral.findMany({
    where: { referrerId: caller.id, refereeId: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, createdAt: true, bonusPaidAt: true },
  });

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('referrals.title')}</h1>
        <AccountNav locale={locale as Locale} pathname={routes.accountReferrals()} entitlements={entitlements} />

        <section aria-labelledby="referral-code" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
          <h2 id="referral-code" className="text-eyebrow text-content-tertiary">{t('referrals.codeLabel')}</h2>
          <p className="mt-2 select-all font-mono text-heading-3 tracking-widest">{code}</p>
          <p className="text-body-sm mt-3 text-content-secondary">
            {t('referrals.hint', { bonus: format.number(referralBonusAmount, 'price') })}
          </p>
        </section>

        <section aria-labelledby="referral-list" className="mt-6">
          <h2 id="referral-list" className="text-card-title">{t('referrals.invited')}</h2>
          {invited.length === 0 ? (
            <p className="text-body-sm mt-3 text-content-tertiary">{t('referrals.empty')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border-default overflow-hidden rounded-xl border border-border-default bg-surface-card">
              {invited.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="text-body-sm text-content-secondary">
                    {format.dateTime(row.createdAt, { dateStyle: 'medium' })}
                  </span>
                  <Badge variant={row.bonusPaidAt ? 'success' : 'neutral'}>
                    {row.bonusPaidAt ? t('referrals.paid') : t('referrals.pending')}
                  </Badge>
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
