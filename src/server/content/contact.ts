import { getTranslations } from 'next-intl/server';

import { routes, site } from '@/config';
import { contactTopicLabelKey, contactTopics, type ContactTopic } from '@/domain/contact';
import type { Locale } from '@/i18n/config';

export interface ContactTopicOption {
  value: ContactTopic;
  label: string;
}

export interface ContactChannel {
  id: 'general' | 'support' | 'social' | 'city';
  title: string;
  note: string;
  /** Что показать на экране: адрес, ссылка без протокола или `null` для города. */
  value: string | null;
  href: string | null;
}

export interface ContactContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  responseTime: string;
  channelsTitle: string;
  channels: ContactChannel[];
  form: {
    title: string;
    nameLabel: string;
    emailLabel: string;
    topicLabel: string;
    messageLabel: string;
    messagePlaceholder: string;
    submit: string;
    defaultTopic: ContactTopic;
    topics: ContactTopicOption[];
  };
  /** `successBody` содержит литерал `{email}`: клиент подставляет адрес, который ввёл пользователь. */
  outcome: { successTitle: string; successBody: string; failedTitle: string; failedBody: string };
  errors: { required: string; email: string };
  supportEmail: string;
  /** Путь страницы на сайте без локали — для перехода из приложения, если отправка через приложение недоступна. */
  webPath: string;
}

/** Тексты и каналы формы обращения. Страница `/contact` и API для приложения берут их отсюда. */
export async function buildContactContent(locale: Locale): Promise<ContactContent> {
  const t = await getTranslations({ locale, namespace: 'contact' });
  const tRoot = await getTranslations({ locale });
  const tValidation = await getTranslations({ locale, namespace: 'validation' });

  return {
    eyebrow: t('eyebrow'),
    title: t('title'),
    subtitle: t('subtitle'),
    responseTime: t('responseTime'),
    channelsTitle: t('channels.title'),
    channels: [
      {
        id: 'general',
        title: t('channels.generalTitle'),
        note: t('channels.generalNote'),
        value: site.contact.email,
        href: `mailto:${site.contact.email}`,
      },
      {
        id: 'support',
        title: t('channels.supportTitle'),
        note: t('channels.supportNote'),
        value: site.contact.supportEmail,
        href: `mailto:${site.contact.supportEmail}`,
      },
      {
        id: 'social',
        title: t('channels.socialTitle'),
        note: t('channels.socialNote'),
        value: site.social.instagram.replace('https://', ''),
        href: site.social.instagram,
      },
      {
        id: 'city',
        title: t('channels.cityTitle'),
        note: t('channels.cityNote', { city: site.address.city }),
        value: null,
        href: null,
      },
    ],
    form: {
      title: t('form.title'),
      nameLabel: t('form.nameLabel'),
      emailLabel: t('form.emailLabel'),
      topicLabel: t('form.topicLabel'),
      messageLabel: t('form.messageLabel'),
      messagePlaceholder: t('form.messagePlaceholder'),
      submit: t('form.submit'),
      defaultTopic: 'booking',
      topics: contactTopics.map((value) => ({ value, label: tRoot(contactTopicLabelKey(value)) })),
    },
    outcome: {
      successTitle: t('form.successTitle'),
      successBody: t('form.successBody', { email: '{email}' }),
      failedTitle: t('form.failedTitle'),
      failedBody: t('form.failedBody', { email: site.contact.supportEmail }),
    },
    errors: {
      required: tValidation('required'),
      email: tValidation('email'),
    },
    supportEmail: site.contact.supportEmail,
    webPath: routes.contact(),
  };
}
