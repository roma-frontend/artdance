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
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { cartValidate, fetchCart } from '@/lib/cart/api';
import { useCartStore } from '@/lib/cart/store';

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
import {
  cardBrandLabel,
  detectCardBrand,
  formatCardholder,
  formatCardNumber,
  formatCvv,
  formatEmailInput,
  formatExpiry,
  formatName,
  formatPhone,
  formatPostalCode,
  isCardNumberValid,
  isCvvValid,
  isEmailValid,
  isExpiryValid,
  isPhoneValid,
  isPostalCodeValid,
  onlyDigits,
} from '@/lib/input-masks';

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
  const [cartChanged, setCartChanged] = useState(false);

  const set = (name: FieldName) => (value: string) => {
    let next = value;
    if (name === 'cardNumber') next = formatCardNumber(value);
    else if (name === 'expiry') next = formatExpiry(value);
    else if (name === 'cvv') next = formatCvv(value, values.cardNumber);
    else if (name === 'phone') next = formatPhone(value);
    else if (name === 'email') next = formatEmailInput(value);
    else if (name === 'firstName' || name === 'lastName') next = formatName(value);
    else if (name === 'postalCode') next = formatPostalCode(value);
    else if (name === 'cardholder') next = formatCardholder(value);
    setValues((current) => ({ ...current, [name]: next }));
    setErrors((current) => (current[name] ? { ...current, [name]: undefined } : current));
  };

  /*
   * Итоги считает домен, а не разметка: на шаге доставки появляется зона, и
   * стоимость доставки меняет и итог, и НДС в нём. Формула одна — `cartTotals`,
   * та же, что в корзине и на сервере перед списанием.
   * Если корзина пришла извне (CartScreen/useCartStore), используем её — иначе
   * на /checkout/contact видно «0 товаров», хотя /cart не пуст.
   */
  const cartSnapshot = useCartStore((s) => s.snapshot);
  const effectiveLines: readonly CartScreenLine[] = (() => {
    if (!cartSnapshot || cartSnapshot.items.length === 0) return lines;
    return cartSnapshot.items.map((it) => {
      const image = (it as unknown as { image: { key: string; alt: { hy: string; ru: string; en: string }; width?: number; height?: number; blurDataUrl?: string; focalPoint?: string } | null }).image;
      return {
        id: it.id,
        slug: (it as unknown as { slug: string | null }).slug ?? undefined,
        title: it.title,
        brand: (it.brand ?? undefined) as unknown as string | undefined,
        image: image
          ? { key: image.key, alt: image.alt, ...(image.width ? { width: image.width } : {}), ...(image.height ? { height: image.height } : {}), ...(image.blurDataUrl ? { blurDataUrl: image.blurDataUrl } : {}), ...(image.focalPoint ? { focalPoint: image.focalPoint } : {}) }
          : { key: '', alt: { hy: '', ru: '', en: it.title } },
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        stock: it.stock,
        unavailable: !it.isActive || it.stock <= 0,
        lineType: 'PRODUCT' as const,
        options: [] as unknown as CartScreenLine['options'],
      };
    });
  })();

  const totals = cartTotals({
    lines: effectiveLines
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

  const summaryLines: readonly OrderSummaryLine[] = effectiveLines.map((line) => ({
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
      if (values.phone?.trim() && !isPhone(values.phone)) found.phone = 'validation.phone';
      if (values.firstName?.trim() && values.firstName.trim().length < 2) found.firstName = 'validation.minLength';
      if (values.lastName?.trim() && values.lastName.trim().length < 2) found.lastName = 'validation.minLength';
      if (values.firstName?.trim() && /[^A-Za-zА-Яа-яЁёԱ-Ֆա-ֆ\s'-]/.test(values.firstName.trim())) found.firstName = 'validation.maxLength';
      if (values.lastName?.trim() && /[^A-Za-zА-Яа-яЁёԱ-Ֆա-ֆ\s'-]/.test(values.lastName.trim())) found.lastName = 'validation.maxLength';
    }

    if (step === 'delivery' && deliveryMethod !== undefined) {
      if (deliveryMethod === 'courier') {
        for (const name of ['address', 'city'] as const) {
          if (!values[name]?.trim()) found[name] = 'validation.required';
        }
        if (values.postalCode?.trim() && !isPostalCode(values.postalCode)) found.postalCode = 'validation.maxLength';
      }
    }

    if (step === 'delivery' && deliveryMethod === undefined) {
      found['address' as FieldName] = 'validation.required';
    }

    if (step === 'payment') {
      if (!method) {
        found['cardNumber' as FieldName] = 'validation.required';
      } else if (inlineCardForm && method === 'CARD') {
        for (const name of ['cardNumber', 'expiry', 'cvv', 'cardholder'] as const) {
          if (!values[name]?.trim()) found[name] = 'validation.required';
        }
        if (values.cardNumber?.trim() && !isCardNumber(values.cardNumber)) found.cardNumber = 'validation.invalidCard';
        if (values.expiry?.trim() && !isExpiry(values.expiry)) found.expiry = 'validation.invalidExpiry';
        if (values.cvv?.trim() && !isCvv(values.cvv, values.cardNumber)) found.cvv = 'validation.invalidCvv';
        if (values.cardholder?.trim() && values.cardholder.trim().length < 2) found.cardholder = 'validation.minLength';
        if (values.cardholder?.trim() && /[^A-Z\s'-]/.test(values.cardholder.trim())) found.cardholder = 'validation.maxLength';
      }
    }

    setErrors(found);
    return Object.keys(found).length === 0;
  };

  // Загружаем корзину на всех шагах; на confirm — validate.
  useEffect(() => {
    let cancelled = false;
    const load = step === 'confirm' ? cartValidate() : fetchCart().then((s) => s ?? null).catch(() => null);
    void Promise.resolve(load).then((snap) => {
      if (!snap || cancelled) return;
      useCartStore.getState().setSnapshot(snap as never);
      if ((snap as unknown as { issues: unknown[] }).issues?.length > 0 && step === 'confirm') setCartChanged(true);
    });
    return () => {
      cancelled = true;
    };
  }, [step]);

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
              placeholder="+374 99 123456"
              maxLength={16}
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
                placeholder="1234-5678-9012-3456"
                maxLength={19}
                brandHint={(() => {
                  const b = detectCardBrand(values.cardNumber ?? '');
                  return b !== 'unknown' ? cardBrandLabel[b] : undefined;
                })()}
                value={values.cardNumber}
                error={errors.cardNumber}
                onChange={set('cardNumber')}
              />

              <div className="form-2col">
                <TextField
                  name="expiry"
                  labelKey="checkout.payment.expiry"
                  placeholder="MM/YY"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  required
                  maxLength={5}
                  value={values.expiry}
                  error={errors.expiry}
                  onChange={set('expiry')}
                />
                <TextField
                  name="cvv"
                  labelKey="checkout.payment.cvv"
                  placeholder={/^3[47]/.test(onlyDigits(values.cardNumber ?? '')) ? '****' : '***'}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  required
                  maxLength={/^3[47]/.test(onlyDigits(values.cardNumber ?? '')) ? 4 : 3}
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
                placeholder="NAME SURNAME"
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

      <OrderSummary totals={totals} lines={summaryLines} locale={locale} changed={cartChanged}>
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
  type?: 'text' | 'email' | 'tel' | 'password';
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
  hintKey?: MessageKey;
  brandHint?: string;
}

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
  placeholder,
  maxLength,
  hintKey,
  brandHint,
}: TextFieldProps) {
  return (
    <FormField name={name} labelKey={labelKey} required={required} errorKey={error ?? null} hintKey={hintKey}>
      {(field) => (
        <div className="relative">
          <input
            id={field.id}
            name={field.name}
            type={type}
            inputMode={inputMode}
            autoComplete={autoComplete}
            placeholder={placeholder}
            maxLength={maxLength}
            value={value ?? ''}
            onChange={(event) => onChange(event.target.value)}
            aria-describedby={field.describedBy}
            aria-invalid={field.invalid}
            className="form-input w-full"
          />
          {brandHint && (
            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-content-tertiary">
              {brandHint}
            </span>
          )}
        </div>
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

/* ── валидация (обёртки над input-masks, уже импортированы выше) ── */
function isEmail(v: string) { return isEmailValid(v); }
function isPhone(v: string) { return isPhoneValid(v); }
function isPostalCode(v: string) { return isPostalCodeValid(v); }
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- оставлен для симметрии валидаторов
function digitsOf(v: string) { return onlyDigits(v); }
function isCardNumber(v: string) { return isCardNumberValid(v); }
function isExpiry(v: string) { return isExpiryValid(v); }
function isCvv(v: string, pan?: string) { return isCvvValid(v, pan); }
