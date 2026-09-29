import { getFormatter, getTranslations } from 'next-intl/server';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Price } from '@/components/ui/price';
import type { Locale } from '@/i18n/config';
import { classPasses, classPassPricePerLesson, priceGuidance } from '@/config/pricing';

export async function ClassPassGrid({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'pricing' });
  const format = await getFormatter({ locale });

  return (
    <ul className="grid gap-6 md:grid-cols-3">
      {classPasses.map((offer) => {
        const perLesson = classPassPricePerLesson(priceGuidance.groupClass.typical, offer.discountRate);
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
            <form action={async (formData: FormData) => {
              'use server';
              const { purchaseClassPassAction } = await import('@/server/actions/class-passes');
              await purchaseClassPassAction(formData);
            }} className="mt-6">
              <input type="hidden" name="passId" value={offer.id} />
              <Button type="submit" block variant={offer.id === 'cp-10' ? 'accent' : 'outline'}>
                {t('classPasses.cta' as never, { lessons: offer.lessons } as never)}
              </Button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
