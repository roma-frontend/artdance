/**
 * PAYMENT SERVICE — создание платежа за заказ.
 *
 * Единственная точка, где заказ уходит провайдеру. Она обязана быть идемпотентной
 * по построению: кнопка «Оплатить» нажимается дважды, вкладка перезагружается,
 * провайдер редиректит обратно с тем же `transactionId`. Ключ идемпотентности —
 * заказ плюс сумма: повтор того же платежа возвращает ту же попытку, а
 * изменившаяся сумма (например, добранный баланс кошелька) честно создаёт новую.
 *
 * Провайдер скрыт за `PaymentProvider`: здесь нет ни ключей, ни формата редиректа —
 * `mock` работает локально, `stripe` и армянские шлюзы подключаются одной
 * переменной окружения.
 */

import 'server-only';

import { routes } from '@/config/routes';
import { absoluteUrl } from '@/config/site';
import { domainErrors } from '@/domain/errors';
import { isLocale } from '@/i18n/config';
import type { PaymentMethod, PaymentStatus } from '@/domain/enums';
import { db } from '@/lib/db';
import { getPaymentProvider, providerForMethod, type PaymentProviderId } from '@/lib/payments';
import { getEffectiveEntitlementsSafe } from '@/server/entitlements/service';
import { applyWalletToPayment } from '@/server/wallet/service';

export interface CreateOrderPaymentInput {
  orderId: string;
  /** Владелец заказа: сессия или гостевой ключ. Ровно одно из двух. */
  userId: string | null;
  anonymousId?: string | null;
  method: PaymentMethod;
  locale: string;
  /** Списать доступный баланс кошелька до вызова провайдера. */
  useWallet?: boolean;
  /** Вернуть клиента в приложение: в returnUrl добавляется `app=1`. */
  fromApp?: boolean;
  /** Диплинк приложения, куда отправить клиента после оплаты. Только вместе с fromApp. */
  returnTo?: string;
  /** Оплата нативной формой в приложении: вернуть clientSecret вместо redirect. */
  inAppSheet?: boolean;
}

export interface OrderPaymentResult {
  orderId: string;
  orderNumber: string;
  paymentId: string;
  /** Сумма, ушедшая провайдеру. Ноль — заказ закрыт балансом целиком. */
  amount: number;
  walletApplied: number;
  provider: PaymentProviderId;
  providerTransactionId: string | null;
  redirectUrl: string | null;
  qrPayload: string | null;
  status: PaymentStatus;
  settledByWallet: boolean;
  /** Секрет для нативной формы. Не сохраняется в БД: Stripe повторно отдаёт его по idempotencyKey. */
  clientSecret?: string | null;
}

/** Возвращает заказ с контактами: они уходят провайдеру в выписку. */
async function loadOrderForPayment(orderId: string, userId: string | null, anonymousId: string | null) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      anonymousId: true,
      status: true,
      total: true,
      walletApplied: true,
      contactEmail: true,
      contactPhone: true,
      contactName: true,
      currencyCode: true,
      items: { select: { titleSnapshot: true, quantity: true }, take: 5 },
    },
  });
  if (!order) throw domainErrors.notFound();

  /*
   * Чужой заказ не оплачиваем и не показываем. Владелец — либо аккаунт, либо
   * гостевой ключ; заказ с одного ключа не открывается другим, иначе вход под
   * своим аккаунтом дал бы доступ к гостевому заказу по номеру.
   */
  const owned = userId ? order.userId === userId : order.anonymousId !== null && order.anonymousId === anonymousId;
  if (!owned) throw domainErrors.forbidden();
  return order;
}

function returnUrlFor(orderNumber: string, locale: string, fromApp: boolean): string {
  const resolved = isLocale(locale) ? locale : 'hy';
  return absoluteUrl(`/${resolved}${routes.checkoutResult(orderNumber)}${fromApp ? '?app=1' : ''}`);
}

/*
 * Провайдер возвращает клиента на наш https-адрес (банки и Stripe не принимают кастомные схемы),
 * а `/api/payments/return` перенаправляет его в приложение. Без returnTo — прежний путь.
 */
function appReturnUrlFor(returnTo: string | undefined, fallback: () => string): string {
  return returnTo ? absoluteUrl(`/api/payments/return?to=${encodeURIComponent(returnTo)}`) : fallback();
}

/* Строка платежа уникальна по idempotencyKey, поэтому новая попытка пишется в ту же строку. */
function isReusableAttempt(existing: { status: string; providerPayload: unknown }): boolean {
  if (existing.status === 'FAILED' || existing.status === 'CANCELLED') return false;
  const { expiresAt } = (existing.providerPayload ?? {}) as { expiresAt?: string | null };
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

export interface CreateBookingPaymentInput {
  bookingId: string;
  /** Бронь оплачивает только её владелец-аккаунт. */
  userId: string;
  method: PaymentMethod;
  locale: string;
  /** Вернуть клиента в приложение: возврат на страницу результата с `app=1`. */
  fromApp?: boolean;
  /** Диплинк приложения, куда отправить клиента после оплаты. Только вместе с fromApp. */
  returnTo?: string;
  /** Оплата нативной формой в приложении: вернуть clientSecret вместо redirect. */
  inAppSheet?: boolean;
}

export interface BookingPaymentResult {
  bookingId: string;
  paymentId: string;
  amount: number;
  provider: PaymentProviderId;
  providerTransactionId: string | null;
  redirectUrl: string | null;
  qrPayload: string | null;
  status: PaymentStatus;
  clientSecret?: string | null;
}

/**
 * Создаёт (или возвращает уже созданный) платёж за неоплаченную бронь.
 *
 * Бронь создаётся `CONFIRMED` (оплата на месте или заранее), поэтому принимаются
 * активные `PENDING`/`CONFIRMED` без зачисленного платежа. Redirect не доказательство.
 */
export async function createBookingPayment(input: CreateBookingPaymentInput): Promise<BookingPaymentResult> {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    select: {
      id: true,
      reference: true,
      customerId: true,
      status: true,
      totalPrice: true,
      subject: true,
      customer: { select: { email: true, phone: true, name: true } },
      payments: { where: { status: { in: ['AUTHORIZED', 'PAID', 'PARTIALLY_REFUNDED'] } }, select: { id: true }, take: 1 },
    },
  });
  if (!booking) throw domainErrors.notFound();
  if (booking.customerId !== input.userId) throw domainErrors.forbidden();
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') throw domainErrors.validationFailed('status');
  if (booking.payments.length > 0) throw domainErrors.validationFailed('status');

  const amount = booking.totalPrice;
  if (amount <= 0) throw domainErrors.validationFailed('totalPrice');

  const provider = providerForMethod(input.method);
  const idempotencyKey = `booking:${booking.id}:${amount}`;

  const existing = await db.payment.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, providerTransactionId: true, providerPayload: true },
  });

  /*
   * Уже созданная попытка возвращается, а не создаёт вторую оплату. Для нативной формы
   * пропускаем: clientSecret не хранится, а Stripe по idempotencyKey вернёт ту же PaymentIntent.
   */
  if (existing?.providerTransactionId && isReusableAttempt(existing) && !input.inAppSheet) {
    const payload = (existing.providerPayload ?? {}) as { redirectUrl?: string; qrPayload?: string };
    return {
      bookingId: booking.id,
      paymentId: existing.id,
      amount,
      provider: provider.id,
      providerTransactionId: existing.providerTransactionId,
      redirectUrl: payload.redirectUrl ?? null,
      qrPayload: payload.qrPayload ?? null,
      status: existing.status as PaymentStatus,
      clientSecret: null,
    };
  }

  const payment = existing
    ? await db.payment.update({ where: { id: existing.id }, data: { status: 'PENDING' }, select: { id: true } })
    : await db.payment.create({
        data: {
          bookingId: booking.id,
          provider: provider.id,
          method: input.method,
          status: 'PENDING',
          amount,
          paidAmount: 0,
          currencyCode: 'AMD',
          idempotencyKey,
        },
        select: { id: true },
      });

  const intent = await provider.createPayment({
    paymentId: payment.id,
    orderNumber: booking.reference,
    amount,
    currencyCode: 'AMD',
    description: `Booking ${booking.reference}`.slice(0, 250),
    method: input.method,
    locale: input.locale,
    customer: { email: booking.customer.email, phone: booking.customer.phone ?? undefined, name: booking.customer.name },
    returnUrl: input.fromApp
      ? appReturnUrlFor(input.returnTo, () => returnUrlFor(booking.reference, input.locale, true))
      : absoluteUrl(`/${isLocale(input.locale) ? input.locale : 'hy'}${routes.accountBookings()}`),
    metadata: { bookingId: booking.id },
    inAppSheet: input.inAppSheet === true,
  });

  await db.payment.update({
    where: { id: payment.id },
    data: {
      provider: intent.provider,
      providerTransactionId: intent.providerTransactionId,
      providerPayload: {
        redirectUrl: intent.redirectUrl,
        qrPayload: intent.qrPayload ?? null,
        expiresAt: intent.expiresAt ? intent.expiresAt.toISOString() : null,
      } as never,
    },
  });

  return {
    bookingId: booking.id,
    paymentId: payment.id,
    amount,
    provider: intent.provider,
    providerTransactionId: intent.providerTransactionId,
    redirectUrl: intent.redirectUrl,
    qrPayload: intent.qrPayload ?? null,
    status: intent.status,
    clientSecret: intent.clientSecret ?? null,
  };
}

/**
 * Создаёт (или возвращает уже созданный) платёж по заказу.
 *
 * Возвращает `settledByWallet: true`, когда баланса хватило целико: заказ уже
 * оплачен и доставлен, вызывать провайдера бессмысленно.
 */
export async function createOrderPayment(input: CreateOrderPaymentInput): Promise<OrderPaymentResult> {
  const order = await loadOrderForPayment(input.orderId, input.userId, input.anonymousId ?? null);

  /*
   * Повторная отправка уже оплаченного заказа — не ошибка, а ответ на повтор:
   * клиент вернулся с редиректа и страница рисуется заново.
   */
  if (order.status === 'PAID') {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: '',
      amount: 0,
      walletApplied: order.walletApplied,
      provider: getPaymentProvider().id,
      providerTransactionId: null,
      redirectUrl: null,
      qrPayload: null,
      status: 'PAID',
      settledByWallet: true,
    };
  }
  if (order.status !== 'CREATED') throw domainErrors.validationFailed('status');

  let walletApplied = order.walletApplied;
  /*
   * Баланс принадлежит аккаунту: у гостя кошелька нет, и списывать нечего.
   * Выключенный модуль кошелька не списывает баланс, даже если клиент прислал `useWallet`.
   */
  if (
    input.useWallet &&
    input.userId &&
    walletApplied === 0 &&
    (await getEffectiveEntitlementsSafe()).wallet
  ) {
    const applied = await applyWalletToPayment({
      userId: input.userId,
      amount: order.total,
      orderId: order.id,
    });
    walletApplied = applied.applied;
    if (walletApplied > 0) {
      await db.order.update({
        where: { id: order.id },
        data: { walletApplied: { increment: walletApplied } },
        select: { id: true },
      });
    }
  }

  const charge = Math.max(0, order.total - walletApplied);

  /* Баланса хватило: заказ закрыт без внешнего провайдера. */
  if (charge === 0) {
    const claimed = await db.order.updateMany({
      where: { id: order.id, status: 'CREATED' },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (claimed.count === 1) {
      const { settlePaidOrder } = await import('./settle');
      await settlePaidOrder(order.id);
    }
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: '',
      amount: 0,
      walletApplied,
      provider: getPaymentProvider().id,
      providerTransactionId: null,
      redirectUrl: null,
      qrPayload: null,
      status: 'PAID',
      settledByWallet: true,
    };
  }

  /* Оплата при получении: денег до доставки нет, провайдер не участвует, заказ идёт в сборку без PAID. */
  if (input.method === 'CASH_ON_DELIVERY') {
    await db.order.updateMany({
      where: { id: order.id, status: 'CREATED' },
      data: { status: 'PACKING' },
    });
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: '',
      amount: charge,
      walletApplied,
      provider: getPaymentProvider().id,
      providerTransactionId: null,
      redirectUrl: null,
      qrPayload: null,
      status: 'PENDING',
      settledByWallet: false,
    };
  }

  const provider = providerForMethod(input.method);
  const idempotencyKey = `${order.id}:${charge}`;

  const existing = await db.payment.findUnique({
    where: { idempotencyKey },
    select: { id: true, status: true, providerTransactionId: true, providerPayload: true },
  });

  /* Уже созданная попытка: возвращаем её, а не тянем у клиента вторую оплату. Нативная форма создаёт заново (см. booking). */
  if (existing?.providerTransactionId && isReusableAttempt(existing) && !input.inAppSheet) {
    const payload = (existing.providerPayload ?? {}) as { redirectUrl?: string; qrPayload?: string };
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: existing.id,
      amount: charge,
      walletApplied,
      provider: provider.id,
      providerTransactionId: existing.providerTransactionId,
      redirectUrl: payload.redirectUrl ?? null,
      qrPayload: payload.qrPayload ?? null,
      status: existing.status as PaymentStatus,
      settledByWallet: false,
      clientSecret: null,
    };
  }

  const payment = existing
    ? await db.payment.update({ where: { id: existing.id }, data: { status: 'PENDING' }, select: { id: true } })
    : await db.payment.create({
        data: {
          orderId: order.id,
          provider: provider.id,
          method: input.method,
          status: 'PENDING',
          amount: charge,
          paidAmount: 0,
          currencyCode: order.currencyCode,
          idempotencyKey,
        },
        select: { id: true },
      });

  const description = order.items
    .map((item) => (item.quantity > 1 ? `${item.titleSnapshot} ×${item.quantity}` : item.titleSnapshot))
    .join(', ')
    .slice(0, 250);

  const intent = await provider.createPayment({
    paymentId: payment.id,
    orderNumber: order.orderNumber,
    amount: charge,
    currencyCode: order.currencyCode,
    description,
    method: input.method,
    locale: input.locale,
    customer: { email: order.contactEmail, phone: order.contactPhone, name: order.contactName },
    returnUrl: appReturnUrlFor(input.fromApp ? input.returnTo : undefined, () =>
      returnUrlFor(order.orderNumber, input.locale, input.fromApp === true),
    ),
    metadata: { orderId: order.id },
    inAppSheet: input.inAppSheet === true,
  });

  await db.payment.update({
    where: { id: payment.id },
    data: {
      provider: intent.provider,
      providerTransactionId: intent.providerTransactionId,
      providerPayload: {
        redirectUrl: intent.redirectUrl,
        qrPayload: intent.qrPayload ?? null,
        expiresAt: intent.expiresAt ? intent.expiresAt.toISOString() : null,
      } as never,
    },
  });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    paymentId: payment.id,
    amount: charge,
    walletApplied,
    provider: intent.provider,
    providerTransactionId: intent.providerTransactionId,
    redirectUrl: intent.redirectUrl,
    qrPayload: intent.qrPayload ?? null,
    status: intent.status,
    settledByWallet: false,
    clientSecret: intent.clientSecret ?? null,
  };
}
