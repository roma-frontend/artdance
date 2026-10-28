'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import type { MessageKey } from '@/i18n/types';
import {
  cardBrandLabel,
  detectCardBrand,
  formatCardNumber,
  formatCvv,
  formatExpiry,
  isCardNumberValid,
  isCvvValid,
  isExpiryValid,
  onlyDigits,
} from '@/lib/input-masks';
import { confirmTestPayment } from '@/lib/payments/api';
import { testCardScenario } from '@/lib/payments/test-card';

type CardField = 'cardNumber' | 'expiry' | 'cvv';
type FieldErrors = Partial<Record<CardField | 'form', MessageKey>>;

export type RetryResult = { ok: true; providerTransactionId: string } | { ok: false; messageKey: MessageKey };

interface TestCardFormProps {
  providerTransactionId: string;
  /** Сумма для подписи кнопки, уже отформатированная. */
  totalLabel: string;
  /**
   * Новая попытка после отказа. Мок-платёж в статусе FAILED терминальный, поэтому повтор
   * идёт по новой транзакции того же заказа, а не по старой.
   */
  retry: () => Promise<RetryResult>;
  onPaid: () => void;
}

/**
 * Форма тестовой карты для заглушки. Номер карты остаётся в браузере: на сервер уходит
 * только исход (`scenario`), который выбирается по номеру тестовой карты.
 */
export function TestCardForm({ providerTransactionId, totalLabel, retry, onPaid }: TestCardFormProps) {
  const t = useTranslations();
  const [transactionId, setTransactionId] = useState(providerTransactionId);
  const [values, setValues] = useState({ cardNumber: '', expiry: '', cvv: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [declined, setDeclined] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const digits = onlyDigits(values.cardNumber);
  const brand = detectCardBrand(digits);
  const cvvPlaceholder = /^3[47]/.test(digits) ? '****' : '***';
  const formMessage = errors.form ?? (declined ? 'paymentSheet.declined' : null);

  function update(name: CardField, raw: string) {
    const next =
      name === 'cardNumber'
        ? formatCardNumber(raw)
        : name === 'expiry'
          ? formatExpiry(raw)
          : formatCvv(raw, values.cardNumber);
    setValues((prev) => ({ ...prev, [name]: next }));
    setErrors((prev) => ({ ...prev, [name]: undefined, form: undefined }));
  }

  function validate(): FieldErrors {
    const found: FieldErrors = {};
    const { cardNumber, expiry, cvv } = values;

    if (!cardNumber.trim()) found.cardNumber = 'validation.required';
    else if (!isCardNumberValid(cardNumber)) found.cardNumber = 'validation.invalidCard';
    else if (!testCardScenario(cardNumber)) found.cardNumber = 'paymentSheet.testCardUnknown';

    if (!expiry.trim()) found.expiry = 'validation.required';
    else if (!isExpiryValid(expiry)) found.expiry = 'validation.invalidExpiry';

    if (!cvv.trim()) found.cvv = 'validation.required';
    else if (!isCvvValid(cvv, cardNumber)) found.cvv = 'validation.invalidCvv';

    return found;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const scenario = testCardScenario(values.cardNumber);
    if (!scenario) return;

    setSubmitting(true);
    let target = transactionId;
    if (declined) {
      const fresh = await retry();
      if (!fresh.ok) {
        setErrors({ form: fresh.messageKey });
        setSubmitting(false);
        return;
      }
      target = fresh.providerTransactionId;
      setTransactionId(target);
      setDeclined(false);
    }

    const result = await confirmTestPayment({ providerTransactionId: target, scenario });
    setSubmitting(false);
    if (!result.ok) {
      setErrors({ form: result.error.messageKey });
      return;
    }
    if (result.data.status === 'declined') {
      setDeclined(true);
      return;
    }
    onPaid();
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      <p className="text-caption text-content-secondary">{t('paymentSheet.testHint')}</p>

      <FormField name="cardNumber" labelKey="checkout.payment.cardNumber" required errorKey={errors.cardNumber ?? null}>
        {({ id, describedBy, invalid, name }) => (
          <div className="relative">
            <Input
              id={id}
              name={name}
              value={values.cardNumber}
              onChange={(event) => update('cardNumber', event.target.value)}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="4242 4242 4242 4242"
              required
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              className="pe-24"
            />
            {brand !== 'unknown' && (
              <span
                aria-hidden="true"
                className="text-caption pointer-events-none absolute inset-y-0 end-3 flex items-center font-semibold text-content-tertiary"
              >
                {cardBrandLabel[brand]}
              </span>
            )}
          </div>
        )}
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField name="expiry" labelKey="checkout.payment.expiry" required errorKey={errors.expiry ?? null}>
          {({ id, describedBy, invalid, name }) => (
            <Input
              id={id}
              name={name}
              value={values.expiry}
              onChange={(event) => update('expiry', event.target.value)}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/YY"
              required
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormField>

        <FormField name="cvv" labelKey="checkout.payment.cvv" required errorKey={errors.cvv ?? null}>
          {({ id, describedBy, invalid, name }) => (
            <Input
              id={id}
              name={name}
              value={values.cvv}
              onChange={(event) => update('cvv', event.target.value)}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder={cvvPlaceholder}
              required
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
            />
          )}
        </FormField>
      </div>

      {formMessage && (
        <p role="alert" className="text-caption font-semibold text-content-danger">
          {t(formMessage)}
        </p>
      )}

      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={submitting}>
        {submitting
          ? t('paymentSheet.processing')
          : declined
            ? t('checkout.result.retryCta')
            : t('checkout.payment.submitCta', { total: totalLabel })}
      </Button>
    </form>
  );
}
