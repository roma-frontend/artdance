/**
 * GIFT CARDS — подарочные карты.
 *
 * Номиналы, границы суммы, шаг и срок действия — из `promotions.giftCard`. В
 * разметке ни одной цифры: «сделайте минимум 10 000» правится в конфигурации.
 *
 * Купить карту онлайн пока нельзя: покупка проходит через корзину и оформление
 * (фаза 4 плана), а страница товара `/shop/[slug]` появится вместе с ними.
 * Поэтому главное действие — не поддельная кнопка «купить», а разговор с нами:
 * карту выпустят вручную. Кнопка, которая ничего не делает, стоит дороже, чем
 * честное «пока так».
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { FactList, type FactItem } from '@/components/content/fact-list';
import { StepList, type StepItem } from '@/components/content/step-list';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { promotions, routes, site } from '@/config';
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
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.giftCards' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.giftCards(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function GiftCardsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('giftCards');
  const tRoot = await getTranslations();
  const tFooter = await getTranslations('footer');
  const format = await getFormatter();

  const card = promotions.giftCard;
  const money = (amount: number): string => format.number(amount, 'price');

  const steps: StepItem[] = [
    { id: 'choose', title: t('steps.choose.title'), body: t('steps.choose.body') },
    { id: 'pay', title: t('steps.pay.title'), body: t('steps.pay.body') },
    { id: 'send', title: t('steps.send.title'), body: t('steps.send.body') },
    { id: 'redeem', title: t('steps.redeem.title'), body: t('steps.redeem.body') },
  ];

  const terms: FactItem[] = [
    { id: 'balance', text: t('terms.noExpiryReset') },
    { id: 'nonRefundable', text: t('terms.nonRefundable') },
    { id: 'combinable', text: t('terms.combinable') },
    { id: 'lostCode', text: t('terms.lostCode') },
  ];

  const trail: Crumb[] = [{ name: tFooter('giftCards'), path: routes.giftCards() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle')}
        eyebrow={t('eyebrow')}
        image={getContentHero('giftCards')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection title={t('amountsTitle')} subtitle={t('amountsNote', {
        min: money(card.minAmount),
        max: money(card.maxAmount),
        step: money(card.amountStep),
      })}>
        {/*
          Номиналы — данные, а не кнопки: покупка появится вместе с магазином.
          Пока это перечень, и он честно выглядит перечнем. У списка есть
          доступное имя: без него скринридер объявляет четыре суммы подряд без
          указания, что это варианты одного выбора.
        */}
        <ul aria-label={t('amountsTitle')} className="flex flex-wrap gap-3">
          {card.presetAmounts.map((amount) => (
            <li
              key={amount}
              className="text-price rounded-lg border border-border-default bg-surface-card px-6 py-4 text-content-primary"
            >
              {money(amount)}
            </li>
          ))}
        </ul>

        <p className="text-caption mt-4 flex items-center gap-2 text-content-tertiary">
          <Badge variant="metal">{tRoot('common.states.comingSoon')}</Badge>
          {t('validityNote', {
            months: tRoot('common.units.months', { count: card.validityMonths }),
          })}
        </p>
      </ContentSection>

      <ContentSection tone="raised" title={t('steps.title')}>
        <StepList items={steps} />
      </ContentSection>

      <ContentSection title={t('terms.title')} prose>
        <FactList items={terms} tone="info" />
      </ContentSection>

      <ContentSection tone="cinema" align="center" title={t('cta.title')} subtitle={t('cta.subtitle')}>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={routes.contact()}>{t('cta.primary')}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={routes.refundPolicy()}>{t('cta.secondary')}</Link>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
