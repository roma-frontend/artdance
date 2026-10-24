import { getFormatter, getTranslations } from 'next-intl/server';

import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';

export type AboutValueId = 'trust' | 'craft' | 'local' | 'openness';

export interface AboutValue {
  id: AboutValueId;
  title: string;
  body: string;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  mission: { title: string; body: string };
  values: { title: string; items: AboutValue[] };
  story: { title: string; body: string };
  cta: {
    title: string;
    subtitle: string;
    primary: string;
    primaryPath: string;
    secondary: string;
    secondaryPath: string;
  };
}

/** Тексты страницы «О нас». Страница и API для приложения берут их отсюда. */
export async function buildAboutContent(locale: Locale): Promise<AboutContent> {
  const t = await getTranslations({ locale, namespace: 'about' });
  // Формат `year` без разделителя разрядов: иначе в ru получится «2 026».
  const format = await getFormatter({ locale });

  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    mission: { title: t('mission.title'), body: t('mission.body') },
    values: {
      title: t('values.title'),
      items: [
        { id: 'trust', title: t('values.trust.title'), body: t('values.trust.body') },
        { id: 'craft', title: t('values.craft.title'), body: t('values.craft.body') },
        { id: 'local', title: t('values.local.title'), body: t('values.local.body') },
        { id: 'openness', title: t('values.openness.title'), body: t('values.openness.body') },
      ],
    },
    story: {
      title: t('story.title'),
      body: t('story.body', { year: format.number(site.foundedYear, 'year') }),
    },
    cta: {
      title: t('cta.title'),
      subtitle: t('cta.subtitle'),
      primary: t('cta.primary'),
      primaryPath: routes.classes(),
      secondary: t('cta.secondary'),
      secondaryPath: routes.becomeInstructor(),
    },
  };
}
