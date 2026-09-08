/**
 * PRICING — тарифы подписки.
 *
 * Страница целиком выводится из `config/pricing.ts`: суммы, квоты, скидка за год,
 * пробный период. В разметке нет ни одной цифры — «поднимите Pro до 39 000»
 * должно быть правкой одной строки конфигурации, а не поиском по вёрстке.
 *
 * Переключателя «месяц / год» здесь нет намеренно. Он требует клиентского
 * состояния на статичной странице, а показывает то, что умещается в одну строку:
 * годовая цена стоит под месячной с бейджем выгоды. Человеку нужно сравнить два
 * числа, а не переключать вид.
 *
 * Подписки — модуль под флагом поставки. Когда он выключен, страница не исчезает,
 * а честно говорит, что оплата пока поштучная, и ведёт в каталог: адрес уже мог
 * попасть в переписку и в закладки.
 */

import type { Metadata } from 'next';
import { useFormatter, useTranslations } from 'next-intl';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { PlanComparisonTable } from '@/components/content/plan-comparison-table';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Price } from '@/components/ui/price';
import {
  isEnabled,
  orderedSubscriptionPlans,
  planFeatureLabelKey,
  routes,
  site,
  subscriptionPlanDescriptionKey,
  subscriptionPlanNameKey,
  tax,
  type PlanFeatureId,
  type SubscriptionPlan,
} from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.pricing' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.pricing(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function PricingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('pricing');
  const tNav = await getTranslations('nav');
  const format = await getFormatter();

  const trail: Crumb[] = [{ name: tNav('pricing'), path: routes.pricing() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      {isEnabled('subscriptions') ? (
        <>
          <ContentSection>
            <ul className="grid gap-6 lg:grid-cols-3">
              {orderedSubscriptionPlans.map((plan) => (
                <li key={plan.id} className="flex">
                  <PlanCard plan={plan} />
                </li>
              ))}
            </ul>

            <p className="text-caption mt-6 text-content-tertiary">
              {t('vatNote', { rate: format.number(tax.vatRate, 'percent') })} {t('cancelAnytime')}
            </p>
          </ContentSection>

          <ContentSection
            tone="raised"
            title={t('comparisonTitle')}
            subtitle={t('comparisonSubtitle')}
          >
            <PlanComparisonTable plans={orderedSubscriptionPlans} />
          </ContentSection>

          <ContentSection spacing="tight" prose>
            <h2 className="text-heading-3">{t('payAsYouGo.title')}</h2>
            <p className="text-body mt-3 text-content-secondary">{t('payAsYouGo.body')}</p>
            <Button asChild variant="outline" className="mt-6">
              <Link href={routes.classes()}>{t('payAsYouGo.cta')}</Link>
            </Button>
          </ContentSection>
        </>
      ) : (
        <ContentSection>
          <EmptyState
            title={t('comingSoon.title')}
            description={t('comingSoon.body')}
            action={
              <Button asChild variant="outline">
                <Link href={routes.classes()}>{t('comingSoon.cta')}</Link>
              </Button>
            }
          />
        </ContentSection>
      )}

      <SiteFooter />
    </main>
  );
}

/**
 * Карточка тарифа.
 *
 * Синхронный серверный компонент: `useTranslations` и `useFormatter` в таком
 * работают, а клиентского кода на страницу не добавляется.
 *
 * Состав «что входит» берётся из `plan.featureKeys`, значения плейсхолдеров — из
 * квоты того же плана. Ни одной пары «строка перевода — число» в разметке нет:
 * подпись знает, что ей нужно `{count}`, а сколько именно — знает конфигурация.
 */
function PlanCard({ plan }: { plan: SubscriptionPlan }) {
  const t = useTranslations('pricing');
  const tRoot = useTranslations();
  const format = useFormatter();

  return (
    <article
      className={cn(
        'flex h-full flex-col rounded-xl p-8',
        plan.highlighted
          ? 'border-2 border-accent bg-surface-card shadow-lg'
          : 'border border-border-default bg-surface-card',
      )}
    >
      {(plan.highlighted || plan.trialDays > 0) && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {plan.highlighted && <Badge variant="accent">{t('mostPopular')}</Badge>}
          {plan.trialDays > 0 && (
            <Badge variant="metal">
              {t('trialBadge', { days: tRoot('common.units.days', { count: plan.trialDays }) })}
            </Badge>
          )}
        </div>
      )}

      <h2 className="text-card-title">{tRoot(subscriptionPlanNameKey(plan.id))}</h2>
      <p className="text-body-sm mt-2 text-content-secondary">
        {tRoot(subscriptionPlanDescriptionKey(plan.id))}
      </p>

      <div className="mt-6">
        <Price amount={plan.price.MONTHLY} unit="perMonth" emphasis="total" />
        <p className="text-caption mt-2 flex flex-wrap items-center gap-2 text-content-tertiary">
          {t('yearlyNote', { price: format.number(plan.price.YEARLY, 'price') })}
          <Badge variant="metal">
            {t('yearlySaveBadge', {
              percent: format.number(plan.yearlyDiscountPercent / 100, 'percent'),
            })}
          </Badge>
        </p>
      </div>

      <h3 className="text-eyebrow mt-8 mb-3 text-content-tertiary">{t('includedTitle')}</h3>
      <ul className="flex flex-1 flex-col gap-2">
        {plan.featureKeys.map((feature) => (
          <li key={feature} className="text-body-sm text-content-secondary">
            {tRoot(planFeatureLabelKey(feature), featureValues(feature, plan, format))}
          </li>
        ))}
      </ul>

      <Button asChild block className="mt-8" variant={plan.highlighted ? 'accent' : 'outline'}>
        {/*
          Оформление подписки — фаза 3 бэклога (`B-*`). Пока кнопка ведёт к
          разговору с нами, а не к платёжной форме, которой нет: неработающая
          кнопка «оплатить» на странице тарифов дороже отсутствующей.
        */}
        <Link href={routes.contact()}>
          {t('selectCta', { plan: tRoot(subscriptionPlanNameKey(plan.id)) })}
        </Link>
      </Button>
    </article>
  );
}

/**
 * Значения плейсхолдеров для подписи возможности.
 *
 * Разные возможности используют один и тот же `{count}` с разными числами
 * (занятия в группе и индивидуальные), поэтому общий объект на все подписи здесь
 * не годится — соответствие задаётся явно.
 */
function featureValues(
  feature: PlanFeatureId,
  plan: SubscriptionPlan,
  format: ReturnType<typeof useFormatter>,
): Record<string, string | number> {
  const quota = plan.quota;

  switch (feature) {
    case 'groupClasses':
      return { count: quota.groupClassesPerMonth === 'unlimited' ? 0 : quota.groupClassesPerMonth };
    case 'privateSessions':
      return { count: quota.privateSessionsPerMonth };
    case 'styleAccess':
      return { count: quota.danceStyles === 'all' ? 0 : quota.danceStyles };
    case 'studioRentalDiscount':
      return { percent: format.number(quota.studioRentalDiscountRate, 'percent') };
    default:
      return {};
  }
}
