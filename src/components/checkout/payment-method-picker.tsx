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
 * **Форма карты рендерится только для inline-ввода.** У redirect-схемы (ArCa
 * EPG, Paynet) реквизиты вводятся на странице банка, и своё поле «номер карты» в
 * этом случае — не просто лишнее, а вредное: оно выглядит как место, куда можно
 * ввести карту, и приучает делать это на любом сайте. В прототипе форма карты
 * стоит всегда — это дефект макета, а не требование.
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
import type { ComponentType, ReactNode } from 'react';

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

/** Способы, при которых клиент уходит на страницу провайдера. */
const redirectingMethods: readonly PaymentMethod[] = ['ARCA', 'IDRAM', 'TELCELL', 'ARCA_QR'];

interface PaymentMethodPickerProps {
  /** Из `availablePaymentMethods()`. Пустой список = оплата недоступна. */
  methods: readonly PaymentMethod[];
  value?: PaymentMethod | undefined;
  onChange(method: PaymentMethod): void;
  /**
   * Провайдер принимает реквизиты карты на нашей стороне. По умолчанию нет:
   * inline-ввод требует PCI-обязательств и включается осознанно.
   */
  inlineCardForm?: boolean;
  /** Поля карты. Рендерятся только при `inlineCardForm` и выбранной карте. */
  children?: ReactNode;
  /** Предыдущая попытка оплаты не прошла. */
  failed?: boolean;
  className?: string;
}

export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  inlineCardForm = false,
  children,
  failed = false,
  className,
}: PaymentMethodPickerProps) {
  const t = useTranslations();

  const showCardForm = inlineCardForm && value === 'CARD';
  const showRedirectNote = value !== undefined && redirectingMethods.includes(value);

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
              {t('common.states.comingSoon')}
            </span>
          </span>
        </p>
      ) : (
        <RadioGroup
          value={value}
          onValueChange={(next) => onChange(next as PaymentMethod)}
          /* Три колонки, как в макете; на узком экране — одна. */
          className="grid-cols-1 gap-3 xs:grid-cols-3"
        >
          {methods.map((method) => {
            const Icon = methodIcons[method];
            const checked = value === method;

            return (
              <label
                key={method}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-md border p-4 text-center',
                  'transition-colors duration-normal ease-brand',
                  /*
                   * Кружок радиокнопки скрыт визуально, а фокус остаётся на нём:
                   * без обводки у плитки клавиатурный пользователь не видит,
                   * где находится (WCAG 2.4.7). `focus-within`, а не
                   * `focus-visible`, потому что фокус получает вложенный input.
                   */
                  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-focus',
                  checked
                    ? 'border-accent bg-accent-soft text-content-accent'
                    : 'border-border-default text-content-secondary hover:border-border-strong',
                )}
              >
                {/*
                  Кружок радиокнопки скрыт визуально, но остаётся в разметке:
                  выбор обозначен рамкой и фоном, как в макете, а семантику и
                  клавиатуру обеспечивает настоящий input Radix.
                */}
                <RadioGroupItem value={method} className="sr-only" />
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className={cn('text-caption', checked && 'font-semibold')}>
                  {t(paymentMethodLabelKey(method))}
                </span>
              </label>
            );
          })}
        </RadioGroup>
      )}

      {showRedirectNote && (
        <p className="text-caption mt-4 text-content-secondary">
          {t('checkout.payment.redirectNote')}
        </p>
      )}

      {showCardForm && <div className="mt-6">{children}</div>}
    </section>
  );
}
