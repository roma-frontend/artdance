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
import type { PaymentProvider, PaymentProviderId } from './types';

export * from './types';

type ProviderFactory = () => PaymentProvider;

const registry: Partial<Record<PaymentProviderId, ProviderFactory>> = {
  mock: () => mockPaymentProvider,
  /**
   * TODO(phase-payments): подключить после получения тестовых реквизитов.
   *  paynet:        () => createPaynetProvider(getServerEnv()),
   *  'arca-epg':    () => createArcaEpgProvider(getServerEnv()),
   *  'ameria-vpos': () => createAmeriaVposProvider(getServerEnv()),
   *  idram:         () => createIdramProvider(getServerEnv()),
   */
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
 * Роутинг по способу оплаты: позволяет держать карты в банке-эквайрере,
 * а кошельки — в агрегаторе. Пока провайдер один, возвращает его же.
 */
export function providerForMethod(method: PaymentMethod): PaymentProvider {
  const primary = getPaymentProvider();
  if (primary.supportedMethods.includes(method)) return primary;
  throw new Error(`[payments] Способ оплаты ${method} не поддерживается провайдером ${primary.id}.`);
}
