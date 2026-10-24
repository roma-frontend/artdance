import { getFormatter, getTranslations } from 'next-intl/server';

import type { FaqGroup } from '@/components/content/faq-accordion';
import { booking, commerce, commission, payout, promotions, tax } from '@/config';
import type { Locale } from '@/i18n/config';

/**
 * Группы FAQ с подставленными значениями из конфига. Страница `/faq` и API для
 * мобильного приложения берут их отсюда, поэтому тексты и цифры совпадают.
 */
export async function buildFaqGroups(locale: Locale): Promise<FaqGroup[]> {
  const t = await getTranslations({ locale, namespace: 'faq' });
  const tRoot = await getTranslations({ locale });
  const format = await getFormatter({ locale });

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

  return [
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
}
