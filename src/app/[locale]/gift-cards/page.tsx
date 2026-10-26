/**
 * GIFT CARDS — подарочные карты.
 *
 * Номиналы, границы суммы, шаг и срок действия — из `promotions.giftCard`. В
 * разметке ни одной цифры: «сделайте минимум 10 000» правится в конфигурации.
 *
 * Покупка идёт через обычную страницу товара, корзину и оформление заказа. Здесь
 * остаётся объяснение номиналов и правил, а CTA ведёт в существующий product flow.
 */

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { FactList } from '@/components/content/fact-list';
import { StepList } from '@/components/content/step-list';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { routes, site } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';
import { getContentHero } from '@/server/content/catalog';
import { buildGiftCardsContent } from '@/server/content/gift-cards';
import { assertEntitlementOrNotFound } from '@/server/entitlements/guard';

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
  await assertEntitlementOrNotFound('shop');
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const content = await buildGiftCardsContent(locale as Locale);
  const tFooter = await getTranslations('footer');

  const trail: Crumb[] = [{ name: tFooter('giftCards'), path: routes.giftCards() }];

  return (
    <main id={site.mainContentId}>
      <PageHero
        title={content.title}
        subtitle={content.subtitle}
        eyebrow={content.eyebrow}
        image={await getContentHero('giftCards')}
        locale={locale as Locale}
        breadcrumbs={breadcrumbsFromTrail(trail)}
      />

      <ContentSection title={content.amounts.title} subtitle={content.amounts.note}>
        {/* Номиналы — данные страницы; выбор варианта выполняется на странице товара. */}
        <ul aria-label={content.amounts.title} className="flex flex-wrap gap-3">
          {content.amounts.presets.map((preset) => (
            <li
              key={preset.amount}
              className="text-price rounded-lg border border-border-default bg-surface-card px-6 py-4 text-content-primary"
            >
              {preset.label}
            </li>
          ))}
        </ul>

        <p className="text-caption mt-4 text-content-tertiary">{content.amounts.validity}</p>
      </ContentSection>

      <ContentSection tone="raised" title={content.steps.title}>
        <StepList items={content.steps.items} />
      </ContentSection>

      <ContentSection title={content.terms.title} prose>
        <FactList items={content.terms.items} tone="info" />
      </ContentSection>

      <ContentSection tone="cinema" align="center" title={content.cta.title} subtitle={content.cta.subtitle}>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" variant="accent">
            <Link href={content.cta.primaryPath}>{content.cta.primary}</Link>
          </Button>
          <Button asChild size="lg" variant="onCinema">
            <Link href={content.cta.secondaryPath}>{content.cta.secondary}</Link>
          </Button>
        </div>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
