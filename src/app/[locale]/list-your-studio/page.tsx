/**
 * LIST YOUR STUDIO — лендинг привлечения площадок.
 *
 * Отвечает на единственный вопрос владельца зала: сколько я получу и чего это
 * стоит. Поэтому ставка комиссии, окно бесплатной отмены для арендатора,
 * минимальная аренда и график выплат берутся из `commission`, `venue` и `payout` —
 * страница не может обещать условия, отличные от тех, по которым считает система.
 *
 * Заявки принимаются письмом: собственный кабинет площадки — фаза 6 плана.
 * Ссылка ведёт на контакты, где письмо действительно уходит.
 */

import type { Metadata } from 'next';
import { CalendarCheckIcon, ImageIcon, ShieldCheckIcon, TrendingUpIcon } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { FactList, type FactItem } from '@/components/content/fact-list';
import { StepList, type StepItem } from '@/components/content/step-list';
import { ValueGrid, type ValueItem } from '@/components/content/value-grid';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { commission, payout, routes, site, venue } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { getContentHero } from '@/server/content/catalog';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.listYourStudio' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.listYourStudio(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function ListYourStudioPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('listYourStudio');
  const tRoot = await getTranslations();
  const tFooter = await getTranslations('footer');
  const format = await getFormatter();

  const benefits: ValueItem[] = [
    {
      id: 'occupancy',
      icon: TrendingUpIcon,
      title: t('benefits.occupancy.title'),
      body: t('benefits.occupancy.body'),
    },
    {
      id: 'calendar',
      icon: CalendarCheckIcon,
      title: t('benefits.calendar.title'),
      body: t('benefits.calendar.body'),
    },
    {
      id: 'payment',
      icon: ShieldCheckIcon,
      title: t('benefits.payment.title'),
      body: t('benefits.payment.body'),
    },
    {
      id: 'exposure',
      icon: ImageIcon,
      title: t('benefits.exposure.title'),
      body: t('benefits.exposure.body'),
    },
  ];

  const steps: StepItem[] = [
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
  ];

  const earnings: FactItem[] = [
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
  ];

  const requirements: FactItem[] = [
    { id: 'space', text: t('requirements.space') },
    { id: 'documents', text: t('requirements.documents') },
    { id: 'honesty', text: t('requirements.honesty') },
    { id: 'availability', text: t('requirements.availability') },
  ];

  const trail: Crumb[] = [{ name: tFooter('listStudio'), path: routes.listYourStudio() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        image={getContentHero('listYourStudio')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      >
        <div className="flex flex-wrap gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.contact()}>{t('primaryCta')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <a href="#earnings">{t('secondaryCta')}</a>
          </Button>
        </div>
      </PageHero>

      <ContentSection title={t('benefits.title')}>
        <ValueGrid items={benefits} columns={4} />
      </ContentSection>

      <ContentSection tone="raised" title={t('steps.title')}>
        <StepList items={steps} />
      </ContentSection>

      <ContentSection id="earnings" title={t('earnings.title')} prose>
        <p className="text-body-lg mb-6 text-content-secondary">{t('earnings.body')}</p>
        <FactList items={earnings} />
      </ContentSection>

      <ContentSection tone="raised" title={t('requirements.title')} prose>
        <FactList items={requirements} tone="info" />
      </ContentSection>

      <ContentSection tone="cinema" align="center" title={t('cta.title')} subtitle={t('cta.subtitle')}>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.contact()}>{t('cta.primary')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={routes.terms()}>{t('cta.secondary')}</Link>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
