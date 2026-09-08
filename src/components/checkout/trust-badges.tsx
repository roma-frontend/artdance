/**
 * TRUST BADGES — бейджи безопасности, возврата и способов оплаты.
 *
 * Два набора из макета: короткий в корзине (три пункта) и подробный в оформлении
 * (четыре, с рамкой сверху).
 *
 * **Срок возврата — из `commerce.returnWindowDays`.** В прототипе это «14-day
 * Returns» строкой; здесь число приходит плейсхолдером, потому что срок возврата
 * — юридическое условие, и оно меняется в одном месте вместе с офертой.
 *
 * **Список способов оплаты обязан совпадать с реально подключёнными.** Это не
 * педантизм: логотип банка, через который заплатить нельзя, подрывает доверие
 * ровно там, где оно нужнее всего. Поэтому при передаче `paymentMethods` (их
 * возвращает `availablePaymentMethods()` на сервере) подписи собираются из
 * домена, а строка `cart.trustPayments` остаётся фоллбэком на время, пока
 * провайдер не выбран.
 *
 * **Иконки — `lucide`, а не эмодзи.** В макете это 🔒 📦 💳 ↩: эмодзи рисуются
 * по-разному в каждой системе, а скринридер читает их как «замок», «посылка»,
 * «кредитная карта» — то есть добавляет к тексту случайные слова. Здесь они
 * `aria-hidden`, а смысл несёт подпись.
 */

import { PackageIcon, LockIcon, ShieldCheckIcon, CreditCardIcon, RotateCcwIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ComponentType } from 'react';

import { commerce } from '@/config';
import { paymentMethodLabelKey, type PaymentMethod } from '@/domain/enums';
import { cn } from '@/lib/utils';

interface TrustBadgesProps {
  /** `cart` — три пункта под кнопкой, `checkout` — четыре с рамкой сверху. */
  variant?: 'cart' | 'checkout';
  /** Реально подключённые способы оплаты. Без них берётся строка-фоллбэк. */
  paymentMethods?: readonly PaymentMethod[];
  className?: string;
}

interface Badge {
  id: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}

export function TrustBadges({ variant = 'cart', paymentMethods, className }: TrustBadgesProps) {
  const t = useTranslations();
  const format = useFormatter();

  const returnsLabel = t('shop.returnsHint', { days: commerce.returnWindowDays });

  const paymentsLabel =
    paymentMethods && paymentMethods.length > 0
      ? /* Перечисление собирает `Intl.ListFormat`: разделитель зависит от языка. */
        format.list(
          paymentMethods.map((method) =>
            t(paymentMethodLabelKey(method)),
          ),
          'enumeration',
        )
      : t('cart.trustPayments');

  const badges: readonly Badge[] =
    variant === 'checkout'
      ? [
          { id: 'ssl', icon: LockIcon, label: t('checkout.trust.ssl') },
          { id: 'arca', icon: ShieldCheckIcon, label: t('checkout.trust.arcaVerified') },
          { id: 'protection', icon: ShieldCheckIcon, label: t('checkout.trust.buyerProtection') },
          {
            id: 'returns',
            icon: RotateCcwIcon,
            label: t('checkout.trust.returns', { days: commerce.returnWindowDays }),
          },
        ]
      : [
          { id: 'secure', icon: LockIcon, label: t('cart.trustSecure') },
          { id: 'returns', icon: PackageIcon, label: returnsLabel },
          { id: 'payments', icon: CreditCardIcon, label: paymentsLabel },
        ];

  return (
    <ul
      className={cn(
        'text-caption flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-content-tertiary',
        variant === 'checkout' && 'border-t border-border-default pt-6',
        className,
      )}
    >
      {badges.map((badge) => {
        const Icon = badge.icon;
        return (
          <li key={badge.id} className="flex items-center gap-1.5">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {badge.label}
          </li>
        );
      })}
    </ul>
  );
}
