import type { ReactElement } from 'react';
import { TurboModuleRegistry } from 'react-native';

type StripeModule = typeof import('@stripe/stripe-react-native');

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const urlScheme = 'artdance';

/**
 * Нативный модуль Stripe есть только в development/production сборке.
 * В Expo Go его нет, и обычный import уронит приложение, поэтому пакет грузится
 * лениво и только при наличии модуля. Модуль — TurboModule, проверяем через TurboModuleRegistry.
 */
export function isNativeStripeAvailable(): boolean {
  return TurboModuleRegistry.get('StripeSdk') != null;
}

function loadStripe(): StripeModule | null {
  if (!isNativeStripeAvailable() || !publishableKey) return null;
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

export type SheetResult = 'COMPLETED' | 'CANCELED' | 'FAILED' | 'UNAVAILABLE';

/**
 * Показывает нативную форму оплаты Stripe (PaymentSheet).
 * COMPLETED означает только «форма закрыта с успехом»: подтверждение оплаты
 * выполняется на сервере через reconcile, как и в остальных способах.
 */
export async function presentStripeSheet(clientSecret: string, returnURL: string): Promise<SheetResult> {
  const stripe = loadStripe();
  if (!stripe) return 'UNAVAILABLE';

  const init = await stripe.initPaymentSheet({
    merchantDisplayName: 'ArtDance',
    paymentIntentClientSecret: clientSecret,
    returnURL,
  });
  if (init.error) return 'UNAVAILABLE';

  const result = await stripe.presentPaymentSheet();
  if (result.error) return String(result.error.code) === 'Canceled' ? 'CANCELED' : 'FAILED';
  if (result.didCancel) return 'CANCELED';
  return 'COMPLETED';
}
