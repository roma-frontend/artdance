/**
 * HELP — справочный центр.
 *
 * Не база знаний со своими статьями (это A-25 из бэклога, приоритет P2), а
 * маршрутизатор: шесть тем, каждая ведёт туда, где ответ действительно есть —
 * в раздел вопросов, в правовой документ или к живому человеку.
 *
 * Так честнее, чем плодить страницы `/help/booking` с пересказом того же FAQ:
 * два места с одним ответом расходятся на первой же правке правил, а поисковик
 * получает две конкурирующие страницы про одно и то же.
 *
 * Ссылки на разделы FAQ используют якоря групп (`#booking`), которые
 * `FaqAccordion` ставит сам: тема справки открывает нужную группу вопросов, а не
 * начало длинной страницы.
 */

import type { Metadata } from 'next';
import {
  BookOpenIcon,
  CalendarCheckIcon,
  CreditCardIcon,
  ScaleIcon,
  TruckIcon,
  UserCogIcon,
} from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { ValueGrid, type ValueItem } from '@/components/content/value-grid';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.help' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.help(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function HelpPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('help');
  const tFooter = await getTranslations('footer');

  /** Якорь группы вопросов на странице FAQ. Идентификаторы задаёт сама страница. */
  const faqGroup = (group: string): string => `${routes.faq()}#${group}`;

  const topics: ValueItem[] = [
    {
      id: 'booking',
      icon: CalendarCheckIcon,
      title: t('topics.booking.title'),
      body: t('topics.booking.body'),
      href: faqGroup('booking'),
      linkLabel: t('topics.booking.cta'),
    },
    {
      id: 'payments',
      icon: CreditCardIcon,
      title: t('topics.payments.title'),
      body: t('topics.payments.body'),
      href: faqGroup('payments'),
      linkLabel: t('topics.payments.cta'),
    },
    {
      id: 'account',
      icon: UserCogIcon,
      title: t('topics.account.title'),
      body: t('topics.account.body'),
      href: routes.privacy(),
      linkLabel: t('topics.account.cta'),
    },
    {
      id: 'providers',
      icon: BookOpenIcon,
      title: t('topics.providers.title'),
      body: t('topics.providers.body'),
      href: routes.becomeInstructor(),
      linkLabel: t('topics.providers.cta'),
    },
    {
      id: 'rules',
      icon: ScaleIcon,
      title: t('topics.rules.title'),
      body: t('topics.rules.body'),
      href: routes.terms(),
      linkLabel: t('topics.rules.cta'),
    },
    {
      id: 'shop',
      icon: TruckIcon,
      title: t('topics.shop.title'),
      body: t('topics.shop.body'),
      href: faqGroup('shop'),
      linkLabel: t('topics.shop.cta'),
    },
  ];

  const trail: Crumb[] = [{ name: tFooter('help'), path: routes.help() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection>
        <ValueGrid items={topics} columns={3} />
      </ContentSection>

      <ContentSection tone="raised" spacing="tight" prose>
        <h2 className="text-heading-3">{t('stillStuck.title')}</h2>
        <p className="text-body mt-3 text-content-secondary">{t('stillStuck.body')}</p>
        <Button asChild className="mt-6">
          <Link href={routes.contact()}>{t('stillStuck.cta')}</Link>
        </Button>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
