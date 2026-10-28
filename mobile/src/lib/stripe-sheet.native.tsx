import type { ReactElement } from 'react';
import { TurboModuleRegistry } from 'react-native';

import { colors, radius } from '@/theme';

type StripeModule = typeof import('@stripe/stripe-react-native');

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const urlScheme = 'artdance';

/**
 * Нативный модуль Stripe есть только в development/production сборке.
 * В Expo Go его нет, и обычный import уронит приложение, поэтому пакет грузится
 * лениво и только при наличии модуля. Модуль — TurboModule, проверяем через TurboModuleRegistry.
 */
/** Нативная форма нужна и модуль, и публичный ключ: без ключа Stripe не инициализируется. */
export function isNativeStripeAvailable(): boolean {
  return TurboModuleRegistry.get('StripeSdk') != null && publishableKey.length > 0;
}

function loadStripe(): StripeModule | null {
  if (!isNativeStripeAvailable()) return null;
  return require('@stripe/stripe-react-native') as StripeModule;
}

/** Оборачивает приложение в StripeProvider, если доступен нативный модуль и ключ. Иначе пропускает детей как есть. */
export function StripeRoot({ children }: { children: ReactElement }) {
  const stripe = loadStripe();
  if (!stripe) return <>{children}</>;
  const { StripeProvider } = stripe;
  return (
    <StripeProvider publishableKey={publishableKey} urlScheme={urlScheme}>
      {children}
    </StripeProvider>
  );
}

/** Стиль поля карты в цветах темы. Нативная часть принимает только hex, поэтому rgba не используем. */
const cardStyle = {
  backgroundColor: colors.surface2,
  textColor: colors.text,
  placeholderColor: colors.text3,
  textErrorColor: colors.danger,
  cursorColor: colors.accentBright,
  borderColor: colors.elevated,
  borderWidth: 1,
  borderRadius: radius.md,
  fontSize: 16,
};

/**
 * Поле карты Stripe. Номер, срок и CVC видны только нативной форме: приложение получает лишь
 * признак, что данные заполнены, и кнопка оплаты становится доступна.
 */
export function NativeCardField({ onComplete }: { onComplete: (complete: boolean) => void }) {
  const stripe = loadStripe();
  if (!stripe) return null;
  const { CardField } = stripe;
  return (
    <CardField
      postalCodeEnabled={false}
      cardStyle={cardStyle}
      style={{ height: 50 }}
      onCardChange={(details) => onComplete(details.complete)}
    />
  );
}

export type CardConfirmResult = 'PAID' | 'DECLINED' | 'FAILED' | 'CANCELED';

/**
 * Подтверждает PaymentIntent картой из NativeCardField. PAID означает только «Stripe принял платёж»:
 * итог сверяется на сервере, как и в остальных способах.
 */
export async function confirmCardPayment(clientSecret: string): Promise<CardConfirmResult> {
  const stripe = loadStripe();
  if (!stripe) return 'FAILED';

  const { paymentIntent, error } = await stripe.confirmPayment(clientSecret, { paymentMethodType: 'Card' });
  if (error) {
    const code = String(error.code);
    if (code === 'Canceled') return 'CANCELED';
    if (code === 'Failed') return 'DECLINED';
    return 'FAILED';
  }
  return paymentIntent ? 'PAID' : 'FAILED';
}
