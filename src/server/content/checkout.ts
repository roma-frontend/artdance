/**
 * Контент экрана оформления.
 *
 * Оформление не заводит свою корзину: позиции приходят из того же источника, что
 * и на `/cart` (`getCartContent`). Вторая сборка означала бы вторую истину об
 * итоге — и спор об оплате там, где расхождение заметят.
 *
 * **Способы оплаты спрашиваются у провайдера, а не перечисляются в разметке.**
 * `availablePaymentMethods()` читает окружение и потому server-only; три плитки
 * «ARCA / Idram / Telcell», зашитые в компонент, как в прототипе, означали бы
 * три способа, два из которых не работают до подписания договора с банком.
 *
 * **Наличие формы карты — тоже свойство провайдера** (`supportsInlineCardForm`),
 * а не решение экрана: у redirect-схемы своё поле «номер карты» приучает вводить
 * карту где угодно.
 *
 * Чего здесь нет: создания платежа. Это server action волны commerce, и он
 * обязан идти через `getPaymentProvider()`; redirect клиента доказательством
 * оплаты не является — бронь и заказ подтверждаются после `getPayment()` или
 * проверенного webhook.
 */

import 'server-only';

import type { PaymentMethod } from '@/domain/enums';
import { availablePaymentMethods, supportsInlineCardForm } from '@/lib/payments';

import { getCartContent, type CartContent } from './cart';

export interface CheckoutContent {
  cart: CartContent;
  /** Пустой список = оплатить нельзя, и сказать об этом нужно заранее. */
  paymentMethods: readonly PaymentMethod[];
  inlineCardForm: boolean;
}

export function getCheckoutContent(): CheckoutContent {
  return {
    cart: getCartContent(),
    paymentMethods: availablePaymentMethods(),
    inlineCardForm: supportsInlineCardForm(),
  };
}
