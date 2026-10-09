/**
 * Реестр платёжных провайдеров.
 *
 * Единственное место, где выбирается конкретная реализация. Бизнес-логика
 * вызывает `getPaymentProvider()` и не знает, кто за ним стоит.
 *
 * Адаптеры Paynet / ArCa EPG / Ameria VPOS / Idram добавляются здесь по мере
 * подписания договоров; интерфейс и весь checkout при этом не меняются.
 */

import 'server-only';

import { getServerEnv } from '@/config/env';
import type { PaymentMethod } from '@/domain/enums';

import { mockPaymentProvider } from './mock-provider';
import { createStripeProvider } from './stripe-provider';
import type { PaymentProvider, PaymentProviderId } from './types';

export * from './types';

type ProviderFactory = () => PaymentProvider;

const registry: Partial<Record<PaymentProviderId, ProviderFactory>> = {
  mock: () => mockPaymentProvider,
  stripe: () => createStripeProvider(),
  // Локальные провайдеры (Paynet/ArCa/Ameria/Idram) добавляются здесь после подписания договоров
  // (см. docs/launch/banks-acquiring.md). Интерфейс PaymentProvider при этом не меняется.
};

const cache = new Map<PaymentProviderId, PaymentProvider>();

export function getPaymentProvider(id?: PaymentProviderId): PaymentProvider {
  const providerId = id ?? getServerEnv().PAYMENT_PROVIDER;
  const cached = cache.get(providerId);
  if (cached) return cached;

  const factory = registry[providerId];
  if (!factory) {
    throw new Error(
      `[payments] Провайдер "${providerId}" не зарегистрирован. ` +
        `Доступные: ${Object.keys(registry).join(', ')}.`,
    );
  }
  const provider = factory();
  cache.set(providerId, provider);
  return provider;
}

/** Способы оплаты, доступные в текущей конфигурации — для рендера чекаута. */
export function availablePaymentMethods(): readonly PaymentMethod[] {
  return getPaymentProvider().supportedMethods;
}

/** Глобальный провайдер (Stripe) — карты со всего мира, 135+ валют. */
export function getGlobalPaymentProvider(): PaymentProvider {
  const env = getServerEnv();
  const gid = env.PAYMENT_GLOBAL_PROVIDER as PaymentProviderId;
  const primary = env.PAYMENT_PROVIDER as PaymentProviderId;
  // если глобальный не настроен (mock) — падаем на primary
  const id: PaymentProviderId = gid && gid !== 'mock' ? gid : primary;
  return getPaymentProvider(id);
}

/** Объединённый список для чекаута: AM-методы + CARD (worldwide). */
export function availablePaymentMethodsWithGlobal(): readonly PaymentMethod[] {
  const primary = getPaymentProvider();
  const global = getGlobalPaymentProvider();
  if (primary.id === global.id) return primary.supportedMethods;
  const set = new Set<PaymentMethod>([...primary.supportedMethods, ...global.supportedMethods]);
  return [...set] as readonly PaymentMethod[];
}

/**
 * Принимает ли текущий провайдер реквизиты карты на нашей стороне.
 *
 * Решает, рендерить ли поля карты в оформлении. Спрашивается у провайдера, а не
 * задаётся в компоненте: для redirect-схемы своя форма карты — прямой вред.
 */
export function supportsInlineCardForm(): boolean {
  return getPaymentProvider().supportsInlineCard;
}

/**
 * Роутинг по способу оплаты: AM-кошельки/ArCa → primary, CARD извне/мир → global (Stripe).
 * Пока config один, возвращает его же.
 */
export function providerForMethod(method: PaymentMethod): PaymentProvider {
  const primary = getPaymentProvider();
  if (primary.supportedMethods.includes(method)) return primary;
  const global = getGlobalPaymentProvider();
  if (global.supportedMethods.includes(method)) return global;
  throw new Error(`[payments] Способ оплаты ${method} не поддерживается (primary ${primary.id}, global ${global.id}).`);
}
