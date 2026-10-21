import { getFormatter, getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Price } from '@/components/ui/price';
import { ClassPassPurchaseForm } from '@/components/pricing/class-pass-purchase-form';
import type { Locale } from '@/i18n/config';
import { classPassById, classPasses, priceGuidance } from '@/config/pricing';
import { classPassOfferPrice } from '@/domain/class-pass';

/** Полная цена пакета: цена за занятие со скидкой × число занятий. */
function passTotal(offer: (typeof classPasses)[number]): number {
  return classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons) * offer.lessons;
}

export async function ClassPassGrid({
  locale,
  signedIn,
  paymentsEnabled,
}: {
  locale: Locale;
  signedIn: boolean;
  paymentsEnabled: boolean;
}) {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const format = await getFormatter({ locale });

  return (
    <ul className="grid gap-6 md:grid-cols-3">
      {classPasses.map((offer) => {
        const perLesson = classPassOfferPrice(priceGuidance.groupClass.typical, offer.discountRate, offer.lessons);
        const total = passTotal(offer);
        const badgeLabel = offer.badge ? (offer.badge === 'pricing.classPasses.popular' ? t('classPasses.popular' as never) : t('classPasses.bestValue' as never)) : null;
        return (
          <li key={offer.id} className="flex flex-col rounded-xl border border-border-default bg-surface-card p-8 shadow-sm">
            {badgeLabel && (
              <Badge variant={offer.id === 'cp-10' ? 'accent' : 'metal'} className="mb-3 self-start">
                {badgeLabel}
              </Badge>
            )}
            <h3 className="text-card-title">{t('classPasses.lessonsCount' as never, { count: offer.lessons } as never)}</h3>
            <p className="text-body-sm mt-1 text-content-tertiary">{t('classPasses.validity' as never, { days: offer.validityDays } as never)}</p>
            <div className="mt-4">
              <Price amount={perLesson} unit="perSession" emphasis="total" />
              <p className="text-caption mt-1 text-content-tertiary">{t('classPasses.fromPerLesson' as never, { price: format.number(perLesson, 'price') } as never)}</p>
            </div>
            <ClassPassPurchaseForm
              passId={classPassById(offer.id)?.id ?? offer.id}
              /* Цена на кнопке — полная стоимость пакета, а не цена занятия. */
              label={t('classPasses.cta' as never, { lessons: offer.lessons, total: format.number(total, 'price') } as never)}
              signedIn={signedIn}
              paymentsEnabled={paymentsEnabled}
            />
          </li>
        );
      })}
    </ul>
  );
}
