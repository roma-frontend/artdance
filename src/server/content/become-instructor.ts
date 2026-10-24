import { getFormatter, getTranslations } from 'next-intl/server';

import { commission, payout, routes } from '@/config';
import type { Locale } from '@/i18n/config';

export type BecomeInstructorItemId = 'demand' | 'schedule' | 'money' | 'noShows' | 'apply' | 'review' | 'publish' | 'earn';
export type BecomeInstructorFactId = 'commission' | 'minimumFee' | 'payout' | 'cardFees' | 'experience' | 'documents' | 'reliability' | 'conduct';

export interface BecomeInstructorItem {
  id: BecomeInstructorItemId;
  title: string;
  body: string;
}

export interface BecomeInstructorFact {
  id: BecomeInstructorFactId;
  text: string;
}

export interface BecomeInstructorContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: { title: string; items: BecomeInstructorItem[] };
  steps: { title: string; items: BecomeInstructorItem[] };
  earnings: { title: string; body: string; items: BecomeInstructorFact[] };
  requirements: { title: string; items: BecomeInstructorFact[] };
  cta: {
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
    secondaryPath: string;
  };
}

/** Лендинг для преподавателей. Ставка и условия выплат берутся из конфигурации, как и на веб-странице. */
export async function buildBecomeInstructorContent(locale: Locale): Promise<BecomeInstructorContent> {
  const t = await getTranslations({ locale, namespace: 'becomeInstructor' });
  const tRoot = await getTranslations({ locale });
  const format = await getFormatter({ locale });

  const money = (amount: number): string => format.number(amount, 'price');

  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    primaryCta: t('primaryCta'),
    secondaryCta: t('secondaryCta'),
    benefits: {
      title: t('benefits.title'),
      items: [
        { id: 'demand', title: t('benefits.demand.title'), body: t('benefits.demand.body') },
        { id: 'schedule', title: t('benefits.schedule.title'), body: t('benefits.schedule.body') },
        { id: 'money', title: t('benefits.money.title'), body: t('benefits.money.body') },
        { id: 'noShows', title: t('benefits.noShows.title'), body: t('benefits.noShows.body') },
      ],
    },
    steps: {
      title: t('steps.title'),
      items: [
        { id: 'apply', title: t('steps.apply.title'), body: t('steps.apply.body') },
        { id: 'review', title: t('steps.review.title'), body: t('steps.review.body') },
        { id: 'publish', title: t('steps.publish.title'), body: t('steps.publish.body') },
        { id: 'earn', title: t('steps.earn.title'), body: t('steps.earn.body') },
      ],
    },
    earnings: {
      title: t('earnings.title'),
      body: t('earnings.body'),
      items: [
        {
          id: 'commission',
          text: t('earnings.commission', { rate: format.number(commission.instructorRate, 'percent') }),
        },
        { id: 'minimumFee', text: t('earnings.minimumFee', { amount: money(commission.minimumFee) }) },
        {
          id: 'payout',
          text: t('earnings.payout', {
            days: tRoot('common.units.days', { count: payout.holdbackDays }),
            minimum: money(payout.minimumAmount),
          }),
        },
        { id: 'cardFees', text: t('earnings.cardFees') },
      ],
    },
    requirements: {
      title: t('requirements.title'),
      items: [
        { id: 'experience', text: t('requirements.experience') },
        { id: 'documents', text: t('requirements.documents') },
        { id: 'reliability', text: t('requirements.reliability') },
        { id: 'conduct', text: t('requirements.conduct') },
      ],
    },
    cta: {
      title: t('cta.title'),
      subtitle: t('cta.subtitle'),
      primary: t('cta.primary'),
      secondary: t('cta.secondary'),
      secondaryPath: routes.terms(),
    },
  };
}
