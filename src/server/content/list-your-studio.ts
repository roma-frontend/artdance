import { getFormatter, getTranslations } from 'next-intl/server';

import { commission, payout, routes, venue } from '@/config';
import type { Locale } from '@/i18n/config';

export type ListYourStudioItemId = 'occupancy' | 'calendar' | 'payment' | 'exposure' | 'apply' | 'review' | 'earn';
export type ListYourStudioFactId =
  | 'commission'
  | 'cancellation'
  | 'payout'
  | 'control'
  | 'space'
  | 'honesty'
  | 'availability'
  | 'documents';

export interface ListYourStudioItem {
  id: ListYourStudioItemId;
  title: string;
  body: string;
}

export interface ListYourStudioFact {
  id: ListYourStudioFactId;
  text: string;
}

export interface ListYourStudioContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  benefits: { title: string; items: ListYourStudioItem[] };
  steps: { title: string; items: ListYourStudioItem[] };
  earnings: { title: string; body: string; items: ListYourStudioFact[] };
  requirements: { title: string; items: ListYourStudioFact[] };
  cta: {
    title: string;
    subtitle: string;
    primary: string;
    secondary: string;
    secondaryPath: string;
  };
}

/** Лендинг для владельцев площадок. Комиссия, окно отмены и выплаты берутся из конфигурации, как и на веб-странице. */
export async function buildListYourStudioContent(locale: Locale): Promise<ListYourStudioContent> {
  const t = await getTranslations({ locale, namespace: 'listYourStudio' });
  const tRoot = await getTranslations({ locale });
  const format = await getFormatter({ locale });

  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    primaryCta: t('primaryCta'),
    secondaryCta: t('secondaryCta'),
    benefits: {
      title: t('benefits.title'),
      items: [
        { id: 'occupancy', title: t('benefits.occupancy.title'), body: t('benefits.occupancy.body') },
        { id: 'calendar', title: t('benefits.calendar.title'), body: t('benefits.calendar.body') },
        { id: 'payment', title: t('benefits.payment.title'), body: t('benefits.payment.body') },
        { id: 'exposure', title: t('benefits.exposure.title'), body: t('benefits.exposure.body') },
      ],
    },
    steps: {
      title: t('steps.title'),
      items: [
        { id: 'apply', title: t('steps.apply.title'), body: t('steps.apply.body') },
        { id: 'review', title: t('steps.review.title'), body: t('steps.review.body') },
        {
          id: 'calendar',
          title: t('steps.calendar.title'),
          body: t('steps.calendar.body', {
            minMinutes: tRoot('common.units.minutes', { count: venue.minRentalMinutes }),
          }),
        },
        { id: 'earn', title: t('steps.earn.title'), body: t('steps.earn.body') },
      ],
    },
    earnings: {
      title: t('earnings.title'),
      body: t('earnings.body'),
      items: [
        {
          id: 'commission',
          text: t('earnings.commission', { rate: format.number(commission.venueRate, 'percent') }),
        },
        {
          id: 'cancellation',
          text: t('earnings.cancellation', {
            hours: tRoot('common.units.hours', { count: venue.freeCancellationHours }),
          }),
        },
        {
          id: 'payout',
          text: t('earnings.payout', {
            days: tRoot('common.units.days', { count: payout.holdbackDays }),
            minimum: format.number(payout.minimumAmount, 'price'),
          }),
        },
        { id: 'control', text: t('earnings.control') },
      ],
    },
    requirements: {
      title: t('requirements.title'),
      items: [
        { id: 'space', text: t('requirements.space') },
        { id: 'documents', text: t('requirements.documents') },
        { id: 'honesty', text: t('requirements.honesty') },
        { id: 'availability', text: t('requirements.availability') },
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
