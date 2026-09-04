/**
 * PAYMENT PROVIDER ABSTRACTION.
 *
 * Ключевое архитектурное решение проекта. В Армении нет одного очевидного
 * шлюза: Paynet даёт единый API (ARCA/Idram/Telcell/ArcaQR), но условия
 * эквайринга согласуются отдельно с каждым банком (ArCa EPG у ACBA/Ardshin/
 * Ineco, VPOS у Ameriabank), и переговоры занимают недели.
 *
 * Поэтому бизнес-логика НИКОГДА не обращается к провайдеру напрямую. Она знает
 * только этот интерфейс. Смена или добавление провайдера = новый адаптер и одна
 * переменная окружения (`PAYMENT_PROVIDER`), без правок в booking/checkout.
 *
 * Практические следствия:
 *  • Разработку можно начать сегодня на `mock`, не дожидаясь договора с банком.
 *  • Можно подключить два провайдера одновременно (карты через банк, кошельки
 *    через Paynet) и роутить платёж по способу оплаты.
 *  • Провайдер не может «протечь» в UI: наружу отдаётся только `PaymentIntent`.
 */

import type { PaymentMethod, PaymentStatus } from '@/domain/enums';
import type { Money } from '@/domain/money';

export const paymentProviderIds = ['paynet', 'arca-epg', 'ameria-vpos', 'idram', 'mock'] as const;
export type PaymentProviderId = (typeof paymentProviderIds)[number];

/** Заказ, за который платим. Провайдер не знает про наши таблицы. */
export interface PaymentOrderRef {
  /** Наш внутренний идентификатор платежа (идемпотентный ключ). */
  paymentId: string;
  /** Человекочитаемый номер заказа для выписки банка. */
  orderNumber: string;
  amount: Money;
  currencyCode: string;
  /** Описание в выписке. Ограничение большинства шлюзов — 255 символов. */
  description: string;
  method: PaymentMethod;
  /** Локаль страницы оплаты провайдера. */
  locale: string;
  customer: {
    email?: string;
    phone?: string;
    name?: string;
  };
  /** URL возврата после оплаты. Строится из `routes`, не из литерала. */
  returnUrl: string;
  /** Произвольные метаданные, которые провайдер вернёт в webhook. */
  metadata?: Record<string, string>;
}

/** Результат создания платежа: куда отправить клиента. */
export interface PaymentIntent {
  provider: PaymentProviderId;
  /** Идентификатор транзакции на стороне провайдера. */
  providerTransactionId: string;
  status: PaymentStatus;
  /** Redirect на страницу оплаты. `null`, если оплата inline (QR/кошелёк). */
  redirectUrl: string | null;
  /** Для ArcaQR и подобных: данные для отрисовки QR. */
  qrPayload?: string;
  /** Когда истекает возможность оплатить. */
  expiresAt?: Date;
}

/** Нормализованный результат проверки статуса. */
export interface PaymentSnapshot {
  providerTransactionId: string;
  status: PaymentStatus;
  paidAmount: Money;
  /** Код/сообщение отказа от провайдера — в лог, не пользователю. */
  failureCode?: string;
  failureMessage?: string;
  /** Полный сырой ответ — для аудита и разбора спорных случаев. */
  raw: unknown;
}

export interface RefundRequest {
  providerTransactionId: string;
  amount: Money;
  reason: string;
  /** Идемпотентный ключ, чтобы повтор не привёл к двойному возврату. */
  idempotencyKey: string;
}

export interface RefundResult {
  providerRefundId: string;
  status: PaymentStatus;
  refundedAmount: Money;
  raw: unknown;
}

/** Разобранный и проверенный webhook. */
export interface WebhookEvent {
  /** Уникальный ID события у провайдера — ключ дедупликации. */
  eventId: string;
  providerTransactionId: string;
  status: PaymentStatus;
  amount: Money;
  occurredAt: Date;
  raw: unknown;
}

export interface WebhookVerificationInput {
  rawBody: string;
  headers: Record<string, string>;
}

/**
 * Контракт провайдера. Реализация обязана быть server-only и не иметь
 * побочных эффектов вне HTTP-вызова к шлюзу.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Способы оплаты, которые этот провайдер реально поддерживает. */
  readonly supportedMethods: readonly PaymentMethod[];
  /** Поддерживает ли частичный возврат — влияет на логику отмены брони. */
  readonly supportsPartialRefund: boolean;
  /**
   * Принимает ли провайдер реквизиты карты на НАШЕЙ стороне.
   *
   * От этого зависит, рендерить ли поля карты в оформлении. Флаг объявлен у
   * провайдера, а не у компонента, потому что это его свойство: у redirect-схемы
   * (ArCa EPG, Paynet) карта вводится на странице банка, и своё поле «номер
   * карты» в этом случае не просто лишнее, а вредное — оно приучает вводить
   * карту где угодно. Включать вместе с PCI-обязательствами, не «для удобства».
   */
  readonly supportsInlineCard: boolean;

  createPayment(order: PaymentOrderRef): Promise<PaymentIntent>;

  /**
   * Явная сверка статуса. Обязательна перед подтверждением брони:
   * redirect клиента НЕ является доказательством оплаты.
   */
  getPayment(providerTransactionId: string): Promise<PaymentSnapshot>;

  refund(request: RefundRequest): Promise<RefundResult>;

  /**
   * Проверка подписи и разбор webhook. Бросает `DomainError`, если подпись
   * не сходится — обработчик обязан ответить 400 и не менять состояние.
   */
  parseWebhook(input: WebhookVerificationInput): Promise<WebhookEvent>;
}

/** Ошибка уровня провайдера — оборачивается в `domainErrors.paymentFailed`. */
export class PaymentProviderError extends Error {
  readonly provider: PaymentProviderId;
  readonly raw: unknown;

  constructor(provider: PaymentProviderId, message: string, raw?: unknown) {
    super(`[payments:${provider}] ${message}`);
    this.name = 'PaymentProviderError';
    this.provider = provider;
    this.raw = raw;
  }
}
