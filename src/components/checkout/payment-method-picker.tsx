/**
 * PAYMENT METHOD PICKER — выбор способа оплаты.
 *
 * **Список способов приходит пропсом, а не пишется в компоненте.** Что реально
 * доступно, знает только настроенный провайдер: `availablePaymentMethods()` в
 * `lib/payments` — server-only, потому что читает окружение. Три плитки «ARCA /
 * Idram / Telcell», зашитые в разметку, как в прототипе, означают три способа
 * оплаты, два из которых не работают, пока с банком не подписан договор.
 *
 * **Пустой список — это не пустая сетка.** Провайдер не настроен → оплатить
 * нельзя, и сказать об этом нужно здесь, а не на шаге списания
 * (`errors.paymentFailed`). Ровно тот случай, для которого в каталоге компонентов
 * заведён `MaintenanceNotice`: «платежи недоступны» сообщается заранее.
 *
 * **Оплата идёт в приложении, а не на сайте банка.** Выбор способа ничего не
 * списывает: шаг оформления передаёт его в `useInAppPayment()`. Реквизиты карты
 * этот компонент не показывает и не принимает.
 *
 * **`RadioGroup`, а не `<div onclick>`.** В макете плитки — обычные `div`:
 * выбрать способ оплаты с клавиатуры нельзя. Radix даёт модель радиогруппы
 * целиком: стрелки, одна точка входа в табуляции, `aria-checked`.
 */

'use client';

import {
  BanknoteIcon,
  CreditCardIcon,
  QrCodeIcon,
  SmartphoneIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { paymentMethodLabelKey, type PaymentMethod } from '@/domain/enums';
import { cn } from '@/lib/utils';

/**
 * Значок способа оплаты. Карта нарисованных логотипов банков здесь не место:
 * чужой логотип, воспроизведённый по памяти, — юридический риск и заметная
 * небрежность (то же решение принято для соцсетей в подвале).
 */
const methodIcons: Record<PaymentMethod, ComponentType<{ className?: string }>> = {
  CARD: CreditCardIcon,
  ARCA: CreditCardIcon,
  IDRAM: SmartphoneIcon,
  TELCELL: SmartphoneIcon,
  ARCA_QR: QrCodeIcon,
  CASH_ON_DELIVERY: BanknoteIcon,
};

/** Локальные AM-методы; Stripe/CARD — глобальная карта. Показываем две группы. */
const armenianMethods: readonly PaymentMethod[] = ['ARCA', 'IDRAM', 'TELCELL', 'ARCA_QR'];
const worldwideMethods: readonly PaymentMethod[] = ['CARD'];

interface PaymentMethodPickerProps {
  /** Из `availablePaymentMethods()`. Пустой список = оплата недоступна. */
  methods: readonly PaymentMethod[];
  value?: PaymentMethod | undefined;
  onChange(method: PaymentMethod): void;
  /** Предыдущая попытка оплаты не прошла. */
  failed?: boolean;
  className?: string;
}

export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  failed = false,
  className,
}: PaymentMethodPickerProps) {
  const t = useTranslations();

  /* Подсказка про оплату в приложении: показываем, когда способ выбран и он онлайновый. */
  const showInAppNote = value !== undefined && value !== 'CASH_ON_DELIVERY';

  return (
    <section
      className={cn(
        'rounded-xl border border-border-default bg-surface-card p-8 shadow-md',
        className,
      )}
    >
      <h2 className="text-card-title mb-5">{t('checkout.payment.title')}</h2>

      {failed && (
        <p
          role="alert"
          className="text-caption mb-4 rounded-md bg-danger-soft px-3 py-2 font-semibold text-content-danger"
        >
          {t('checkout.result.failedSubtitle')}
        </p>
      )}

      {methods.length === 0 ? (
        <p
          role="status"
          className="text-body-sm flex items-start gap-3 rounded-md border border-dashed border-border-default p-6"
        >
          <TriangleAlertIcon className="size-5 shrink-0 text-content-warning" aria-hidden />
          <span>
            <span className="block font-semibold">{t('errors.paymentFailed.title')}</span>
            <span className="text-caption block text-content-secondary">
              {t('errors.paymentFailed.description')}
            </span>
          </span>
        </p>
      ) : (
        <div className="space-y-4">
          {(() => {
            const am = methods.filter((m) => armenianMethods.includes(m as never));
            const global = methods.filter((m) => worldwideMethods.includes(m as never));
            const cash = methods.filter((m) => !armenianMethods.includes(m as never) && !worldwideMethods.includes(m as never));
            const Section = ({ title, items }: { title: string; items: readonly PaymentMethod[] }) =>
              items.length === 0 ? null : (
                <div>
                  <p className="text-caption mb-2 font-semibold tracking-widest text-content-tertiary uppercase">{title}</p>
                  <RadioGroup
                    value={value}
                    onValueChange={(next) => onChange(next as PaymentMethod)}
                    className="grid-cols-1 gap-3 xs:grid-cols-3"
                  >
                    {items.map((method) => {
                      const Icon = methodIcons[method];
                      const checked = value === method;
                      return (
                        <label
                          key={method}
                          className={cn(
                            'flex cursor-pointer flex-col items-center gap-2 rounded-md border p-4 text-center',
                            'transition-colors duration-normal ease-brand',
                            'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus',
                            checked
                              ? 'border-accent bg-accent-soft text-content-accent'
                              : 'border-border-default text-content-secondary hover:border-border-strong',
                          )}
                        >
                          <RadioGroupItem value={method} className="sr-only" />
                          <Icon className="size-5 shrink-0" aria-hidden />
                          <span className={cn('text-caption', checked && 'font-semibold')}>{t(paymentMethodLabelKey(method))}</span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>
              );
            return (
              <>
                {global.length > 0 && <Section title={t('checkout.payment.sectionWorldwide')} items={global} />}
                {am.length > 0 && <Section title={t('checkout.payment.sectionArmenia')} items={am} />}
                {cash.length > 0 && <Section title={t('checkout.payment.sectionOther')} items={cash} />}
              </>
            );
          })()}
        </div>
      )}

      {showInAppNote && (
        <p className="text-caption mt-4 text-content-secondary">{t('checkout.payment.inAppNote')}</p>
      )}
    </section>
  );
}
