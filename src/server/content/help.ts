import { getTranslations } from 'next-intl/server';

import { routes } from '@/config';
import type { Locale } from '@/i18n/config';

export type HelpTopicId = 'booking' | 'payments' | 'account' | 'providers' | 'rules' | 'shop';

export interface HelpTopic {
  id: HelpTopicId;
  title: string;
  body: string;
  cta: string;
  /** Путь без локали. */
  path: string;
  /** Якорь группы на странице FAQ. */
  anchor?: string;
}

export interface HelpContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  topics: HelpTopic[];
  stillStuck: { title: string; body: string; cta: string; path: string };
}

/** Тексты и маршруты справки. Страница `/help` и API для приложения берут их отсюда. */
export async function buildHelpContent(locale: Locale): Promise<HelpContent> {
  const t = await getTranslations({ locale, namespace: 'help' });

  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    topics: [
      {
        id: 'booking',
        title: t('topics.booking.title'),
        body: t('topics.booking.body'),
        cta: t('topics.booking.cta'),
        path: routes.faq(),
        anchor: 'booking',
      },
      {
        id: 'payments',
        title: t('topics.payments.title'),
        body: t('topics.payments.body'),
        cta: t('topics.payments.cta'),
        path: routes.faq(),
        anchor: 'payments',
      },
      {
        id: 'account',
        title: t('topics.account.title'),
        body: t('topics.account.body'),
        cta: t('topics.account.cta'),
        path: routes.privacy(),
      },
      {
        id: 'providers',
        title: t('topics.providers.title'),
        body: t('topics.providers.body'),
        cta: t('topics.providers.cta'),
        path: routes.becomeInstructor(),
      },
      {
        id: 'rules',
        title: t('topics.rules.title'),
        body: t('topics.rules.body'),
        cta: t('topics.rules.cta'),
        path: routes.terms(),
      },
      {
        id: 'shop',
        title: t('topics.shop.title'),
        body: t('topics.shop.body'),
        cta: t('topics.shop.cta'),
        path: routes.faq(),
        anchor: 'shop',
      },
    ],
    stillStuck: {
      title: t('stillStuck.title'),
      body: t('stillStuck.body'),
      cta: t('stillStuck.cta'),
      path: routes.contact(),
    },
  };
}
