import { getFormatter, getTranslations } from 'next-intl/server';

import { promotions, routes } from '@/config';
import type { Locale } from '@/i18n/config';

export type GiftCardsStepId = 'choose' | 'pay' | 'send' | 'redeem';
export type GiftCardsTermId = 'balance' | 'nonRefundable' | 'combinable' | 'lostCode';

export interface GiftCardsPreset {
  amount: number;
  label: string;
}

export interface GiftCardsStep {
  id: GiftCardsStepId;
  title: string;
  body: string;
}

export interface GiftCardsTerm {
  id: GiftCardsTermId;
  text: string;
}

export interface GiftCardsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  amounts: {
    title: string;
    note: string;
    presets: GiftCardsPreset[];
    validity: string;
  };
  steps: { title: string; items: GiftCardsStep[] };
  terms: { title: string; items: GiftCardsTerm[] };
  cta: {
    title: string;
    subtitle: string;
    primary: string;
    primaryPath: string;
    secondary: string;
    secondaryPath: string;
  };
}

/** Тексты и номиналы подарочных карт. Суммы форматируются здесь, чтобы веб и приложение показывали одно и то же. */
export async function buildGiftCardsContent(locale: Locale): Promise<GiftCardsContent> {
  const t = await getTranslations({ locale, namespace: 'giftCards' });
  const tRoot = await getTranslations({ locale });
  const format = await getFormatter({ locale });

  const card = promotions.giftCard;
  const money = (amount: number): string => format.number(amount, 'price');

  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    amounts: {
      title: t('amountsTitle'),
      note: t('amountsNote', {
        min: money(card.minAmount),
        max: money(card.maxAmount),
        step: money(card.amountStep),
      }),
      presets: card.presetAmounts.map((amount) => ({ amount, label: money(amount) })),
      validity: t('validityNote', {
        months: tRoot('common.units.months', { count: card.validityMonths }),
      }),
    },
    steps: {
      title: t('steps.title'),
      items: [
        { id: 'choose', title: t('steps.choose.title'), body: t('steps.choose.body') },
        { id: 'pay', title: t('steps.pay.title'), body: t('steps.pay.body') },
        { id: 'send', title: t('steps.send.title'), body: t('steps.send.body') },
        { id: 'redeem', title: t('steps.redeem.title'), body: t('steps.redeem.body') },
      ],
    },
    terms: {
      title: t('terms.title'),
      items: [
        { id: 'balance', text: t('terms.noExpiryReset') },
        { id: 'nonRefundable', text: t('terms.nonRefundable') },
        { id: 'combinable', text: t('terms.combinable') },
        { id: 'lostCode', text: t('terms.lostCode') },
      ],
    },
    cta: {
      title: t('cta.title'),
      subtitle: t('cta.subtitle'),
      primary: t('cta.primary'),
      primaryPath: routes.product('gift-card'),
      secondary: t('cta.secondary'),
      secondaryPath: routes.refundPolicy(),
    },
  };
}
