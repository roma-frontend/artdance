/**
 * МОЯ ПОДПИСКА.
 *
 * Маршрут `routes.accountSubscription()` существовал с первой версии навигации,
 * а страницы за ним не было: подписку можно было купить (когда включён тариф), но
 * не увидеть купленное. Здесь — план, период и израсходованная квота.
 *
 * **Квота читается из `SubscriptionUsage`, а не считается на лету.** «4 занятия
 * в месяц» обещаны в тарифах; показать «использовано 2 из 4» можно только по
 * журналу, который заполняется при списании. Пересчитывать по броням значило бы
 * завести вторую арифметику того же факта — и однажды она разойдётся с первой.
 *
 * Тумблер `subscriptions` запирает страницу: при MVP/FULL подписок нет, и
 * страница обязана отвечать 404, как и остальные разделы пресета.
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import { routes, site, subscriptionPlanNameKey } from '@/config';
import { subscriptionStatusLabelKey, type SubscriptionStatus } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link, redirect } from '@/i18n/routing';
import { getCaller } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import { buildMetadata } from '@/lib/seo/metadata';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';

interface PageProps { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'account' });
  return buildMetadata({ locale: locale as Locale, path: routes.accountSubscription(), title: t('subscription.title'), noIndex: true });
}

export default async function AccountSubscriptionPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  await assertEntitlementOrNotFound('subscriptions');

  const caller = await getCaller();
  if (!caller) {
    redirect({ href: routes.signIn(routes.accountSubscription()), locale: locale as Locale });
    return null;
  }

  const t = await getTranslations('account');
  const tRoot = await getTranslations();
  const format = await getFormatter();

  const subscription = await db.subscription.findFirst({
    where: { userId: caller.id, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { currentPeriodEnd: 'desc' },
    select: {
      id: true,
      planId: true,
      interval: true,
      status: true,
      priceSnapshot: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      usage: {
        where: { periodStart: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
        select: { metric: true, used: true },
      },
    },
  });

  /* Метрики, которые подписка показывает. Незнакомая метрика из журнала не ломает страницу. */
  const shownMetrics = ['groupClasses', 'privateSessions'] as const;
  const usageOf = (metric: string): number =>
    subscription?.usage.find((row) => row.metric === metric)?.used ?? 0;

  return (
    <>
      <main id={site.mainContentId} className="page-container inner-page">
        <h1 className="text-heading-2">{t('subscription.title')}</h1>

        {!subscription ? (
          <div className="mt-6 rounded-xl border border-dashed border-border-default bg-surface-raised px-6 py-10 text-center">
            <p className="text-body text-content-secondary">{t('subscription.empty')}</p>
            <p className="text-caption mt-2 text-content-tertiary">{t('subscription.emptyHint')}</p>
            <Button asChild variant="accent" className="mt-5">
              <Link href={routes.pricing()}>{t('subscription.choosePlanCta')}</Link>
            </Button>
          </div>
        ) : (
          <>
            <section aria-labelledby="subscription-plan" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="subscription-plan" className="text-card-title">
                    {tRoot(subscriptionPlanNameKey(subscription.planId as never))}
                  </h2>
                  <p className="text-body-sm mt-1 text-content-secondary">
                    {tRoot(subscription.interval === 'YEARLY' ? 'common.labels.perYear' : 'common.labels.perMonth')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={subscription.status === 'ACTIVE' ? 'success' : 'warning'}>
                    {tRoot(subscriptionStatusLabelKey(subscription.status as SubscriptionStatus))}
                  </Badge>
                  {subscription.cancelAtPeriodEnd && (
                    <Badge variant="neutral">{t('subscription.cancelAtPeriodEnd')}</Badge>
                  )}
                </div>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-caption text-content-tertiary">{t('subscription.period')}</dt>
                  <dd className="text-body-sm mt-1 font-medium">
                    {format.dateTime(subscription.currentPeriodStart, { day: '2-digit', month: 'short' })}
                    {' — '}
                    {format.dateTime(subscription.currentPeriodEnd, { day: '2-digit', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-caption text-content-tertiary">{t('subscription.renewsOn', { date: '' })}</dt>
                  <dd className="text-body-sm mt-1 font-medium">
                    {format.dateTime(subscription.currentPeriodEnd, { dateStyle: 'long' })}
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <Price amount={subscription.priceSnapshot} emphasis="total" />
              </div>
            </section>

            <section aria-labelledby="subscription-usage" className="mt-6 rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
              <h2 id="subscription-usage" className="text-card-title">{t('subscription.usageTitle')}</h2>
              {subscription.usage.length === 0 ? (
                <p className="text-body-sm mt-3 text-content-tertiary">{t('subscription.usageEmpty')}</p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {shownMetrics.map((metric) => (
                    <li key={metric} className="flex items-center justify-between text-body-sm">
                      <span className="text-content-secondary">{t(`subscription.metrics.${metric}` as never)}</span>
                      <span className="font-semibold tabular-nums">{usageOf(metric)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-caption mt-4 text-content-tertiary">{t('subscription.manageNote')}</p>
            </section>
          </>
        )}

        <SiteFooter />
      </main>
    </>
  );
}
