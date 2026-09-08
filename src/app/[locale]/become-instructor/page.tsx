/**
 * BECOME INSTRUCTOR — лендинг привлечения преподавателей.
 *
 * Главная цифра страницы — комиссия, и она приходит из `commission`, а не из
 * текста. Обещание «15%» в переводе живёт своей жизнью: ставку меняют в
 * конфигурации, расчёты идут по новой, а лендинг ещё месяц зовёт по старой — и
 * это уже разговор о деньгах с человеком, который пришёл по этому обещанию.
 *
 * Заявки пока принимаются письмом: многошаговая форма с загрузкой документов —
 * это A-15 из бэклога (`InstructorApplication`), и делать её половину значит
 * собирать данные, которые некуда записать. Ссылка ведёт на контакты, где письмо
 * действительно уходит.
 *
 * Структура повторяет `/list-your-studio`, но файлы разные и это осознанно: у
 * двух аудиторий разные выгоды, разные требования и разные ставки. Общий шаблон с
 * десятком пропсов «кому это адресовано» стоил бы дороже двух похожих страниц,
 * которые дальше разойдутся окончательно.
 */

import type { Metadata } from 'next';
import { CalendarClockIcon, TrendingUpIcon, UsersIcon, WalletIcon } from 'lucide-react';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { FactList, type FactItem } from '@/components/content/fact-list';
import { StepList, type StepItem } from '@/components/content/step-list';
import { ValueGrid, type ValueItem } from '@/components/content/value-grid';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { commission, payout, routes, site } from '@/config';
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
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.becomeInstructor' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.becomeInstructor(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function BecomeInstructorPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('becomeInstructor');
  const tRoot = await getTranslations();
  const tFooter = await getTranslations('footer');
  const format = await getFormatter();

  const benefits: ValueItem[] = [
    {
      id: 'demand',
      icon: UsersIcon,
      title: t('benefits.demand.title'),
      body: t('benefits.demand.body'),
    },
    {
      id: 'schedule',
      icon: CalendarClockIcon,
      title: t('benefits.schedule.title'),
      body: t('benefits.schedule.body'),
    },
    {
      id: 'money',
      icon: WalletIcon,
      title: t('benefits.money.title'),
      body: t('benefits.money.body'),
    },
    {
      id: 'noShows',
      icon: TrendingUpIcon,
      title: t('benefits.noShows.title'),
      body: t('benefits.noShows.body'),
    },
  ];

  const steps: StepItem[] = [
    { id: 'apply', title: t('steps.apply.title'), body: t('steps.apply.body') },
    { id: 'review', title: t('steps.review.title'), body: t('steps.review.body') },
    { id: 'publish', title: t('steps.publish.title'), body: t('steps.publish.body') },
    { id: 'earn', title: t('steps.earn.title'), body: t('steps.earn.body') },
  ];

  const earnings: FactItem[] = [
    {
      id: 'commission',
      text: t('earnings.commission', {
        rate: format.number(commission.instructorRate, 'percent'),
      }),
    },
    {
      id: 'minimumFee',
      text: t('earnings.minimumFee', { amount: format.number(commission.minimumFee, 'price') }),
    },
    {
      id: 'payout',
      text: t('earnings.payout', {
        days: tRoot('common.units.days', { count: payout.holdbackDays }),
        minimum: format.number(payout.minimumAmount, 'price'),
      }),
    },
    { id: 'cardFees', text: t('earnings.cardFees') },
  ];

  const requirements: FactItem[] = [
    { id: 'experience', text: t('requirements.experience') },
    { id: 'documents', text: t('requirements.documents') },
    { id: 'reliability', text: t('requirements.reliability') },
    { id: 'conduct', text: t('requirements.conduct') },
  ];

  const trail: Crumb[] = [{ name: tFooter('becomeInstructor'), path: routes.becomeInstructor() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        image={getContentHero('becomeInstructor')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      >
        <div className="flex flex-wrap gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.contact()}>{t('primaryCta')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            {/* Внутрестраничная ссылка: комиссия — главный вопрос, и он ниже. */}
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
