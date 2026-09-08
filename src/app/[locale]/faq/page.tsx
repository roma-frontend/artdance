/**
 * FAQ — вопросы и ответы.
 *
 * Единственная страница, где содержание почти целиком приходит из каталога
 * переводов, но числа в ответах — из бизнес-правил. Это принципиально: ответ «можно
 * отменить за 24 часа» обязан меняться вместе с `booking.freeCancellationHours`,
 * иначе поддержка отвечает одно, а страница обещает другое, и правым в споре
 * оказывается клиент.
 *
 * Ключи перечислены литералами, а не собраны из шаблона. Это длиннее, зато
 * компилятор проверяет каждый: вопрос, потерянный при переименовании, иначе
 * превращается в пустую строку в списке — и заметен только глазами.
 *
 * Разметка `FAQPage` выводится внутри `FaqAccordion` из того же массива, что и
 * список: расхождение схемы с видимым текстом Google трактует как обман.
 */

import type { Metadata } from 'next';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';

import { ContentSection } from '@/components/content/content-section';
import { FaqAccordion, type FaqGroup } from '@/components/content/faq-accordion';
import { PageHero, breadcrumbsFromTrail } from '@/components/layout/page-hero';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { booking, commerce, commission, payout, promotions, routes, site, tax } from '@/config';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import type { Crumb } from '@/lib/seo/jsonld';
import { buildMetadata } from '@/lib/seo/metadata';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: locale as Locale, namespace: 'seo.faq' });

  return buildMetadata({
    locale: locale as Locale,
    path: routes.faq(),
    title: t('title'),
    description: t('description'),
  });
}

export default async function FaqPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations('faq');
  const tRoot = await getTranslations();
  const tHelp = await getTranslations('help');
  const tFooter = await getTranslations('footer');
  const format = await getFormatter();

  const hours = (count: number): string => tRoot('common.units.hours', { count });
  const days = (count: number): string => tRoot('common.units.days', { count });
  const percent = (rate: number): string => format.number(rate, 'percent');
  const money = (amount: number): string => format.number(amount, 'price');
  const dayRange = (range: { min: number; max: number }): string =>
    tRoot('common.units.daysRange', range);

  /*
   * Окно на подтверждение места из листа ожидания задано в минутах, а читается
   * человеком в часах. Пересчёт только когда он точный: «2 часа» понятнее «120
   * минут», а «1,5 часа» — уже нет.
   */
  const claimWindow =
    booking.waitlistClaimWindowMinutes % 60 === 0
      ? hours(booking.waitlistClaimWindowMinutes / 60)
      : tRoot('common.units.minutes', { count: booking.waitlistClaimWindowMinutes });

  const groups: FaqGroup[] = [
    {
      id: 'booking',
      title: t('groups.booking.title'),
      items: [
        {
          question: t('groups.booking.items.howToBook.question'),
          answer: t('groups.booking.items.howToBook.answer'),
        },
        {
          question: t('groups.booking.items.account.question'),
          answer: t('groups.booking.items.account.answer'),
        },
        {
          question: t('groups.booking.items.leadTime.question'),
          answer: t('groups.booking.items.leadTime.answer', {
            minutes: tRoot('common.units.minutes', { count: booking.minLeadTimeMinutes }),
          }),
        },
        {
          question: t('groups.booking.items.waitlist.question'),
          answer: t('groups.booking.items.waitlist.answer', { claimHours: claimWindow }),
        },
        {
          question: t('groups.booking.items.firstTime.question'),
          answer: t('groups.booking.items.firstTime.answer'),
        },
      ],
    },
    {
      id: 'payments',
      title: t('groups.payments.title'),
      items: [
        {
          question: t('groups.payments.items.methods.question'),
          answer: t('groups.payments.items.methods.answer'),
        },
        {
          question: t('groups.payments.items.vat.question'),
          answer: t('groups.payments.items.vat.answer', { vat: percent(tax.vatRate) }),
        },
        {
          question: t('groups.payments.items.currency.question'),
          answer: t('groups.payments.items.currency.answer'),
        },
        {
          question: t('groups.payments.items.receipt.question'),
          answer: t('groups.payments.items.receipt.answer'),
        },
      ],
    },
    {
      id: 'cancellation',
      title: t('groups.cancellation.title'),
      items: [
        {
          question: t('groups.cancellation.items.freeWindow.question'),
          answer: t('groups.cancellation.items.freeWindow.answer', {
            hours: hours(booking.freeCancellationHours),
            feeRate: percent(booking.lateCancellationFeeRate),
          }),
        },
        {
          question: t('groups.cancellation.items.reschedule.question'),
          answer: t('groups.cancellation.items.reschedule.answer', {
            maxTimes: booking.maxReschedulesPerBooking,
            hours: hours(booking.freeRescheduleHours),
          }),
        },
        {
          question: t('groups.cancellation.items.noShow.question'),
          answer: t('groups.cancellation.items.noShow.answer'),
        },
        {
          question: t('groups.cancellation.items.providerCancels.question'),
          answer: t('groups.cancellation.items.providerCancels.answer'),
        },
        {
          question: t('groups.cancellation.items.refundTiming.question'),
          answer: t('groups.cancellation.items.refundTiming.answer'),
        },
      ],
    },
    {
      id: 'providers',
      title: t('groups.providers.title'),
      items: [
        {
          question: t('groups.providers.items.join.question'),
          answer: t('groups.providers.items.join.answer'),
        },
        {
          question: t('groups.providers.items.commission.question'),
          answer: t('groups.providers.items.commission.answer', {
            instructorRate: percent(commission.instructorRate),
            venueRate: percent(commission.venueRate),
          }),
        },
        {
          question: t('groups.providers.items.payout.question'),
          answer: t('groups.providers.items.payout.answer', {
            holdbackDays: days(payout.holdbackDays),
            minimum: money(payout.minimumAmount),
          }),
        },
        {
          question: t('groups.providers.items.ownStudents.question'),
          answer: t('groups.providers.items.ownStudents.answer'),
        },
      ],
    },
    {
      id: 'shop',
      title: t('groups.shop.title'),
      items: [
        {
          question: t('groups.shop.items.delivery.question'),
          answer: t('groups.shop.items.delivery.answer', {
            yerevanDays: dayRange(commerce.deliveryEstimateDays.yerevan),
            regionDays: dayRange(commerce.deliveryEstimateDays.regions),
            threshold: money(commerce.freeDeliveryThreshold),
          }),
        },
        {
          question: t('groups.shop.items.returns.question'),
          answer: t('groups.shop.items.returns.answer', { days: days(commerce.returnWindowDays) }),
        },
        {
          question: t('groups.shop.items.giftCards.question'),
          answer: t('groups.shop.items.giftCards.answer', {
            months: tRoot('common.units.months', { count: promotions.giftCard.validityMonths }),
          }),
        },
      ],
    },
  ];

  const trail: Crumb[] = [{ name: tFooter('faq'), path: routes.faq() }];

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
        <FaqAccordion groups={groups} />
      </ContentSection>

      <ContentSection tone="raised" spacing="tight" prose>
        <h2 className="text-heading-3">{tHelp('stillStuck.title')}</h2>
        <p className="text-body mt-3 text-content-secondary">{tHelp('stillStuck.body')}</p>
        <Button asChild className="mt-6">
          <Link href={routes.contact()}>{tHelp('stillStuck.cta')}</Link>
        </Button>
      </ContentSection>

      <SiteFooter />
    </main>
  );
}
