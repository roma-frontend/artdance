/**
 * CHECKOUT SCREEN — оформление заказа: шаг слева, сводка справа.
 *
 * Шаги живут в URL (`checkoutSteps` в `config/routes.ts`), поэтому «назад»
 * браузера работает как ожидается, а брошенное оформление возобновляется
 * ссылкой. Индикатор рисует `CheckoutStepper`, содержимое — этот компонент.
 *
 * **Поля собраны через `FormField`, а не расставлены руками.** В прототипе
 * подписи заменены placeholder'ами: они исчезают при первом символе и не
 * читаются скринридером (WCAG 3.3.2). `FormField` навешивает `id`/`htmlFor`,
 * `aria-describedby` и `aria-invalid` сам — забыть их нельзя, потому что место
 * вызова их и не задаёт.
 *
 * **Способы оплаты и форма карты приходят от провайдера.** Список — из
 * `availablePaymentMethods()`, наличие inline-формы — из `supportsInlineCard`.
 * Три плитки в разметке, как в макете, означали бы три способа, из которых
 * работает один; поле «номер карты» при redirect-схеме — хуже, чем лишнее.
 *
 * **Сводка справа считается `domain/cart.ts`**, а зона доставки выбирается на
 * своём шаге: до него доставка не посчитана, а не «бесплатна».
 *
 * **Что здесь заглушка и почему это честно видно.** Значения полей не переживают
 * переход между шагами: каждый шаг — свой URL, а черновик заказа (`Order` в
 * статусе `DRAFT` плюс server action на каждом шаге) — задача волны commerce.
 * По той же причине последняя кнопка не создаёт платёж: он идёт только через
 * `getPaymentProvider()`, и подтверждение приходит после `getPayment()` или
 * проверенного webhook — redirect клиента доказательством оплаты не является.
 * Пока платёж не подключён, кнопка отвечает «скоро», а не рисует успех.
 */

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type FormEvent, type ReactNode } from 'react';

import { OrderSummary, type OrderSummaryLine } from '@/components/checkout/order-summary';
import { PaymentMethodPicker } from '@/components/checkout/payment-method-picker';
import { TrustBadges } from '@/components/checkout/trust-badges';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { checkoutSteps, commerce, routes, type CheckoutStep } from '@/config';
import { cartTotals, type AppliedPromo, type DeliveryZone } from '@/domain/cart';
import type { PaymentMethod } from '@/domain/enums';
import type { CartScreenLine } from '@/components/cart/cart-screen';
import type { Locale } from '@/i18n/config';
import { Link, useRouter } from '@/i18n/routing';
import type { MessageKey } from '@/i18n/types';

/** Поля всех четырёх шагов. Имя поля = имя в форме = основа `id`. */
type FieldName =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'postalCode'
  | 'notes'
  | 'cardNumber'
  | 'expiry'
  | 'cvv'
  | 'cardholder';

type FieldValues = Partial<Record<FieldName, string>>;
type FieldErrors = Partial<Record<FieldName, MessageKey>>;

/** Способ получения. Зона доставки выводится из него, а не выбирается отдельно. */
type DeliveryMethod = 'courier' | 'pickup';

const deliveryZoneFor: Record<DeliveryMethod, DeliveryZone> = {
  /*
   * Курьер по умолчанию считается по тарифу Еревана; регион определяется по
   * адресу на сервере (`commerce.deliveryFee`), а не выбором в интерфейсе —
   * иначе тариф можно занизить, отправив другой вариант.
   */
  courier: 'yerevan',
  pickup: 'pickup',
};

interface CheckoutScreenProps {
  step: CheckoutStep;
  lines: readonly CartScreenLine[];
  paymentMethods: readonly PaymentMethod[];
  inlineCardForm: boolean;
  locale: Locale;
  /** Промокод, применённый в корзине: скидка не теряется при переходе. */
  promo: AppliedPromo | null;
}

export function CheckoutScreen({
  step,
  lines,
  paymentMethods,
  inlineCardForm,
  locale,
  promo,
}: CheckoutScreenProps) {
  const t = useTranslations();
  const format = useFormatter();
  const router = useRouter();

  const [values, setValues] = useState<FieldValues>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | undefined>(undefined);
  const [method, setMethod] = useState<PaymentMethod | undefined>(undefined);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [notice, setNotice] = useState(false);

  const set = (name: FieldName) => (value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    /* Ошибка снимается при первом исправлении, а не после повторной отправки. */
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  /*
   * Итоги считает домен, а не разметка: на шаге доставки появляется зона, и
   * стоимость доставки меняет и итог, и НДС в нём. Формула одна — `cartTotals`,
   * та же, что в корзине и на сервере перед списанием.
   */
  const totals = cartTotals({
    lines: lines
      .filter((line) => !line.unavailable)
      .map((line) => ({
        id: line.id,
        lineType: line.lineType,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
      })),
    promo,
    deliveryZone: deliveryMethod ? deliveryZoneFor[deliveryMethod] : null,
  });

  const summaryLines: readonly OrderSummaryLine[] = lines.map((line) => ({
    id: line.id,
    title: line.title,
    quantity: line.quantity,
    total: line.unitPrice * line.quantity,
    image: line.image,
  }));

  const stepIndex = checkoutSteps.indexOf(step);
  const previousStep = stepIndex > 0 ? checkoutSteps[stepIndex - 1] : undefined;
  const nextStep = checkoutSteps[stepIndex + 1];

  /** Проверка шага. Ошибки — ключи из `validation`, а не строки у места вызова. */
  const validate = (): boolean => {
    const found: FieldErrors = {};

    if (step === 'contact') {
      for (const name of ['firstName', 'lastName', 'email', 'phone'] as const) {
        if (!values[name]?.trim()) found[name] = 'validation.required';
      }
      if (values.email?.trim() && !isEmail(values.email)) found.email = 'validation.email';
    }

    if (step === 'delivery' && deliveryMethod === 'courier') {
      for (const name of ['address', 'city'] as const) {
        if (!values[name]?.trim()) found[name] = 'validation.required';
      }
    }

    if (step === 'payment' && inlineCardForm && method === 'CARD') {
      for (const name of ['cardNumber', 'expiry', 'cvv', 'cardholder'] as const) {
        if (!values[name]?.trim()) found[name] = 'validation.required';
      }
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    if (step === 'confirm') {
      if (!termsAccepted) {
        setTermsError(true);
        return;
      }
      /*
       * TODO(commerce): здесь server action создаёт заказ и платёж через
       * `getPaymentProvider()`. До этого кнопка честно сообщает, что оплата ещё
       * не подключена: нарисованный «успех» без списания — худший вариант.
       */
      setNotice(true);
      return;
    }

    if (nextStep) router.push(routes.checkoutStep(nextStep));
  };

  return (
    <form onSubmit={submit} className="checkout-grid" noValidate>
      <div className="flex flex-col gap-6">
        {step === 'contact' && (
          <StepCard title={t('checkout.contact.title')}>
            <div className="form-2col">
              <TextField
                name="firstName"
                labelKey="checkout.contact.firstName"
                autoComplete="given-name"
                required
                value={values.firstName}
                error={errors.firstName}
                onChange={set('firstName')}
              />
              <TextField
                name="lastName"
                labelKey="checkout.contact.lastName"
                autoComplete="family-name"
                required
                value={values.lastName}
                error={errors.lastName}
                onChange={set('lastName')}
              />
            </div>

            <TextField
              name="email"
              labelKey="checkout.contact.email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={values.email}
              error={errors.email}
              onChange={set('email')}
            />

            <TextField
              name="phone"
              labelKey="checkout.contact.phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              value={values.phone}
              error={errors.phone}
              onChange={set('phone')}
            />

            <CheckboxRow id="createAccount" label={t('checkout.contact.createAccountLabel')} />

            <p className="text-caption text-content-tertiary">
              {t('checkout.contact.guestNote')}
            </p>
          </StepCard>
        )}

        {step === 'delivery' && (
          <StepCard title={t('checkout.delivery.title')}>
            <RadioGroup
              value={deliveryMethod}
              onValueChange={(next) => setDeliveryMethod(next as DeliveryMethod)}
              className="gap-2"
            >
              {(['courier', 'pickup'] as const).map((option) => (
                <label
                  key={option}
                  className={
                    deliveryMethod === option
                      ? 'flex cursor-pointer items-center gap-3 rounded-md border border-accent bg-accent-soft p-3'
                      : 'flex cursor-pointer items-center gap-3 rounded-md border border-border-default p-3 transition-colors duration-normal ease-brand hover:border-border-strong'
                  }
                >
                  <RadioGroupItem value={option} />
                  <span className="text-body-sm font-semibold">
                    {option === 'courier'
                      ? t('checkout.delivery.methodCourier')
                      : t('checkout.delivery.methodPickup')}
                  </span>
                </label>
              ))}
            </RadioGroup>

            {/* Срок — из `commerce.deliveryEstimateDays`, а не из текста перевода. */}
            {deliveryMethod === 'courier' && (
              <>
                <p className="text-caption text-content-secondary">
                  {t('checkout.delivery.estimate', {
                    min: commerce.deliveryEstimateDays.yerevan.min,
                    max: commerce.deliveryEstimateDays.yerevan.max,
                  })}
                </p>

                <TextField
                  name="address"
                  labelKey="checkout.delivery.address"
                  autoComplete="street-address"
                  required
                  value={values.address}
                  error={errors.address}
                  onChange={set('address')}
                />

                <div className="form-2col">
                  <TextField
                    name="city"
                    labelKey="checkout.delivery.city"
                    autoComplete="address-level2"
                    required
                    value={values.city}
                    error={errors.city}
                    onChange={set('city')}
                  />
                  <TextField
                    name="postalCode"
                    labelKey="checkout.delivery.postalCode"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={values.postalCode}
                    error={errors.postalCode}
                    onChange={set('postalCode')}
                  />
                </div>

                <TextField
                  name="notes"
                  labelKey="checkout.delivery.notes"
                  value={values.notes}
                  error={errors.notes}
                  onChange={set('notes')}
                />
              </>
            )}
          </StepCard>
        )}

        {step === 'payment' && (
          <PaymentMethodPicker
            methods={paymentMethods}
            value={method}
            onChange={setMethod}
            inlineCardForm={inlineCardForm}
          >
            <div className="flex flex-col gap-4">
              <TextField
                name="cardNumber"
                labelKey="checkout.payment.cardNumber"
                inputMode="numeric"
                autoComplete="cc-number"
                required
                value={values.cardNumber}
                error={errors.cardNumber}
                onChange={set('cardNumber')}
              />

              <div className="form-2col">
                <TextField
                  name="expiry"
                  labelKey="checkout.payment.expiry"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  required
                  value={values.expiry}
                  error={errors.expiry}
                  onChange={set('expiry')}
                />
                <TextField
                  name="cvv"
                  labelKey="checkout.payment.cvv"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  required
                  value={values.cvv}
                  error={errors.cvv}
                  onChange={set('cvv')}
                />
              </div>

              <TextField
                name="cardholder"
                labelKey="checkout.payment.cardholder"
                autoComplete="cc-name"
                required
                value={values.cardholder}
                error={errors.cardholder}
                onChange={set('cardholder')}
              />
            </div>
          </PaymentMethodPicker>
        )}

        {step === 'confirm' && (
          <StepCard title={t('checkout.steps.confirm')}>
            {/*
              Флажок и текст согласия — рядом, но не внутри одного `<label>`:
              в тексте есть ссылки на оферту, а ссылка внутри подписи флажка
              означает, что нажатие по ней ещё и переключает согласие. Связь
              обеспечивает `aria-labelledby`, поэтому скринридер читает флажок
              вместе с условием.
            */}
            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                aria-labelledby="terms-consent"
                checked={termsAccepted}
                onCheckedChange={(next) => {
                  setTermsAccepted(next === true);
                  if (next === true) setTermsError(false);
                }}
                className="mt-0.5"
              />
              <p id="terms-consent" className="text-body-sm text-content-secondary">
                {t.rich('checkout.termsConsent', {
                  terms: (chunks) => (
                    <Link href={routes.terms()} className="text-content-accent underline">
                      {chunks}
                    </Link>
                  ),
                  refund: (chunks) => (
                    <Link href={routes.refundPolicy()} className="text-content-accent underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>

            {termsError && (
              <p role="alert" className="text-caption font-semibold text-content-danger">
                {t('validation.termsRequired')}
              </p>
            )}

            {notice && (
              <p
                role="status"
                className="text-body-sm rounded-md bg-accent-soft px-4 py-3 text-content-secondary"
              >
                {t('common.states.comingSoon')}
              </p>
            )}
          </StepCard>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {previousStep && (
            <Button asChild variant="outline">
              <Link href={routes.checkoutStep(previousStep)}>{t('common.actions.back')}</Link>
            </Button>
          )}

          <Button
            type="submit"
            size="lg"
            /* На шаге оплаты нельзя идти дальше, не выбрав способ. */
            disabled={step === 'payment' && method === undefined}
            className="ms-auto"
          >
            {step === 'confirm'
              ? t('checkout.payment.submitCta', {
                  total: format.number(totals.total, 'price'),
                })
              : t('common.actions.continue')}
          </Button>
        </div>
      </div>

      <OrderSummary totals={totals} lines={summaryLines} locale={locale}>
        <TrustBadges variant="checkout" paymentMethods={paymentMethods} className="mt-6" />
      </OrderSummary>
    </form>
  );
}

/* ─────────────────────────── Части шага ─────────────────────────── */

function StepCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md md:p-8">
      <h2 className="text-card-title mb-5">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

interface TextFieldProps {
  name: FieldName;
  labelKey: MessageKey;
  value: string | undefined;
  error: MessageKey | undefined;
  onChange(value: string): void;
  type?: 'text' | 'email' | 'tel';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  autoComplete?: string;
  required?: boolean;
}

/**
 * Текстовое поле шага. Отдельная функция, потому что связка «FormField + input»
 * повторяется двенадцать раз, и в одиннадцатый раз кто-нибудь забыл бы
 * `aria-describedby`.
 */
function TextField({
  name,
  labelKey,
  value,
  error,
  onChange,
  type = 'text',
  inputMode,
  autoComplete,
  required = false,
}: TextFieldProps) {
  return (
    <FormField name={name} labelKey={labelKey} required={required} errorKey={error ?? null}>
      {(field) => (
        <input
          id={field.id}
          name={field.name}
          type={type}
          inputMode={inputMode}
          autoComplete={autoComplete}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={field.describedBy}
          aria-invalid={field.invalid}
          className="form-input"
        />
      )}
    </FormField>
  );
}

interface CheckboxRowProps {
  id: string;
  label: ReactNode;
  checked?: boolean;
  onCheckedChange?(checked: boolean): void;
}

/** Флажок с подписью-меткой: нажатие по тексту переключает его, как и ожидается. */
function CheckboxRow({ id, label, checked, onCheckedChange }: CheckboxRowProps) {
  return (
    <label htmlFor={id} className="text-body-sm flex cursor-pointer items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(next) => onCheckedChange?.(next === true)}
        className="mt-0.5"
      />
      <span className="text-content-secondary">{label}</span>
    </label>
  );
}

/* ─────────────────────────── Мелочи ─────────────────────────── */

/**
 * Проверка адреса — только форма записи, и намеренно грубая: единственный
 * надёжный способ узнать, что адрес существует, — письмо с подтверждением.
 * Строгая регулярка отсекает валидные адреса и не отсекает опечатки.
 */
function isEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
