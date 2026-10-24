import { getFormatter, getTranslations } from 'next-intl/server';

import { routes, tax } from '@/config';
import {
  classPassPricePerLesson,
  classPasses,
  orderedSubscriptionPlans,
  planFeatureLabelKey,
  priceGuidance,
  subscriptionPlanDescriptionKey,
  subscriptionPlanNameKey,
  type PlanFeatureId,
  type PlanQuota,
  type SubscriptionPlan,
} from '@/config/pricing';
import { classPassOfferPrice } from '@/domain/class-pass';
import type { Locale } from '@/i18n/config';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';

export type PricingCellState = 'yes' | 'no' | 'text';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  highlighted: boolean;
  badges: string[];
  price: string;
  priceUnit: string;
  yearlyNote: string;
  yearlySave: string;
  features: string[];
  cta: string;
}

export interface PricingComparisonCell {
  text: string;
  state: PricingCellState;
}

export interface PricingComparisonRow {
  id: string;
  label: string;
  cells: PricingComparisonCell[];
}

export interface PricingClassPass {
  id: string;
  badge: string | null;
  lessonsLabel: string;
  validityLabel: string;
  perLesson: string;
  total: string;
  cta: string;
}

export interface PricingContent {
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  webPath: string;
  plans: {
    includedTitle: string;
    note: string;
    items: PricingPlan[];
    comparison: {
      title: string;
      subtitle: string;
      plans: { id: string; name: string }[];
      rows: PricingComparisonRow[];
    };
  } | null;
  classPasses: { title: string; subtitle: string; items: PricingClassPass[] } | null;
  payAsYouGo: { title: string; body: string; planNote: string | null; cta: string; path: string };
}

type QuotaValue = number | 'unlimited' | 'all' | boolean;

interface QuotaRow {
  id: string;
  labelKey:
    | 'groupClasses'
    | 'privateSessions'
    | 'styles'
    | 'priorityBooking'
    | 'progressJournal'
    | 'studioDiscount'
    | 'guestWorkshops'
    | 'competitionPrep'
    | 'vipEvents';
  value: (quota: PlanQuota) => QuotaValue;
}

const QUOTA_ROWS: readonly QuotaRow[] = [
  { id: 'groupClasses', labelKey: 'groupClasses', value: (q) => q.groupClassesPerMonth },
  { id: 'privateSessions', labelKey: 'privateSessions', value: (q) => q.privateSessionsPerMonth },
  { id: 'styles', labelKey: 'styles', value: (q) => (q.danceStyles === 'all' ? 'all' : q.danceStyles) },
  { id: 'priorityBooking', labelKey: 'priorityBooking', value: (q) => q.priorityBooking },
  { id: 'progressJournal', labelKey: 'progressJournal', value: (q) => q.progressJournal },
  { id: 'studioDiscount', labelKey: 'studioDiscount', value: (q) => q.studioRentalDiscountRate },
  { id: 'guestWorkshops', labelKey: 'guestWorkshops', value: (q) => q.guestWorkshops },
  { id: 'competitionPrep', labelKey: 'competitionPrep', value: (q) => q.competitionPrep },
  { id: 'vipEvents', labelKey: 'vipEvents', value: (q) => q.vipEvents },
];

/** Значения плейсхолдеров возможности; соответствие задано явно, как на веб-странице. */
function featureValues(
  feature: PlanFeatureId,
  quota: PlanQuota,
  percent: (value: number) => string,
): Record<string, string | number> {
  switch (feature) {
    case 'groupClasses':
      return { count: quota.groupClassesPerMonth === 'unlimited' ? 0 : quota.groupClassesPerMonth };
    case 'privateSessions':
      return { count: quota.privateSessionsPerMonth };
    case 'styleAccess':
      return { count: quota.danceStyles === 'all' ? 0 : quota.danceStyles };
    case 'studioRentalDiscount':
      return { percent: percent(quota.studioRentalDiscountRate) };
    default:
      return {};
  }
}

/** Тарифы, сравнение и пакеты занятий. Раздел без включённого модуля отдаётся как `null`. */
export async function buildPricingContent(locale: Locale): Promise<PricingContent> {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const tRoot = await getTranslations({ locale });
  const tNav = await getTranslations({ locale, namespace: 'nav' });
  const tQuota = await getTranslations({ locale, namespace: 'pricing.quota' });
  const format = await getFormatter({ locale });
  const entitlements = await getEffectiveEntitlementsSafe();

  const money = (amount: number): string => format.number(amount, 'price');
  const percent = (value: number): string => format.number(value, 'percent');

  function comparisonCell(row: QuotaRow, quota: PlanQuota): PricingComparisonCell {
    const value = row.value(quota);
    if (value === 'unlimited') return { text: tQuota('unlimited'), state: 'text' };
    if (value === 'all') return { text: tQuota('allStyles'), state: 'text' };
    if (typeof value === 'boolean') {
      return value
        ? { text: tQuota('included'), state: 'yes' }
        : { text: tQuota('notIncluded'), state: 'no' };
    }
    if (value === 0) return { text: tQuota('notIncluded'), state: 'no' };
    return { text: row.id === 'studioDiscount' ? percent(value) : format.number(value, 'plain'), state: 'text' };
  }

  function plan(item: SubscriptionPlan): PricingPlan {
    const name = tRoot(subscriptionPlanNameKey(item.id));
    const badges: string[] = [];
    if (item.highlighted) badges.push(t('mostPopular'));
    if (item.trialDays > 0) {
      badges.push(t('trialBadge', { days: tRoot('common.units.days', { count: item.trialDays }) }));
    }
    return {
      id: item.id,
      name,
      description: tRoot(subscriptionPlanDescriptionKey(item.id)),
      highlighted: item.highlighted,
      badges,
      price: money(item.price.MONTHLY),
      priceUnit: tRoot('common.labels.perMonth'),
      yearlyNote: t('yearlyNote', { price: money(item.price.YEARLY) }),
      yearlySave: t('yearlySaveBadge', { percent: percent(item.yearlyDiscountPercent / 100) }),
      features: item.featureKeys.map((feature) =>
        tRoot(planFeatureLabelKey(feature), featureValues(feature, item.quota, percent)),
      ),
      cta: t('selectCta', { plan: name }),
    };
  }

  const subscriptionsEnabled = entitlements.subscriptions;
  const packagesEnabled = entitlements.packages;
  const baseGroupPrice = priceGuidance.groupClass.typical;

  return {
    eyebrow: subscriptionsEnabled ? t('eyebrow') : null,
    title: subscriptionsEnabled ? t('title') : tNav('pricing'),
    subtitle: subscriptionsEnabled ? t('subtitle') : null,
    webPath: routes.pricing(),
    plans: subscriptionsEnabled
      ? {
          includedTitle: t('includedTitle'),
          note: `${t('vatNote', { rate: percent(tax.vatRate) })} ${t('cancelAnytime')}`,
          items: orderedSubscriptionPlans.map(plan),
          comparison: {
            title: t('comparisonTitle'),
            subtitle: t('comparisonSubtitle'),
            plans: orderedSubscriptionPlans.map((item) => ({ id: item.id, name: tRoot(subscriptionPlanNameKey(item.id)) })),
            rows: QUOTA_ROWS.map((row) => ({
              id: row.id,
              label: tQuota(row.labelKey),
              cells: orderedSubscriptionPlans.map((item) => comparisonCell(row, item.quota)),
            })),
          },
        }
      : null,
    classPasses: packagesEnabled
      ? {
          title: t('classPasses.title' as never),
          subtitle: t('classPasses.subtitle' as never),
          items: classPasses.map((offer) => {
            const total = classPassOfferPrice(baseGroupPrice, offer.discountRate, offer.lessons);
            return {
              id: offer.id,
              badge: offer.badge
                ? offer.badge === 'pricing.classPasses.popular'
                  ? t('classPasses.popular' as never)
                  : t('classPasses.bestValue' as never)
                : null,
              lessonsLabel: t('classPasses.lessonsCount' as never, { count: offer.lessons } as never),
              validityLabel: t('classPasses.validity' as never, { days: offer.validityDays } as never),
              perLesson: t('classPasses.fromPerLesson' as never, {
                price: money(classPassPricePerLesson(baseGroupPrice, offer.discountRate)),
              } as never),
              total: money(total),
              cta: t('classPasses.cta' as never, { lessons: offer.lessons, total: money(total) } as never),
            };
          }),
        }
      : null,
    payAsYouGo: {
      title: t('payAsYouGo.title'),
      body: t('payAsYouGo.body'),
      planNote: subscriptionsEnabled ? t('payAsYouGo.planNote') : null,
      cta: t('payAsYouGo.cta'),
      path: routes.classes(),
    },
  };
}
