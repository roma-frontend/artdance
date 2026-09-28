/**
 * Содержимое корзины.
 *
 * Тот же шов, что `home.ts`: сегодня позиции берутся из контрольного расчёта
 * прототипа (`demoCartTotals` в `prisma/fixtures/demo.ts`), поэтому экран
 * сравним с макетом один-в-один, а тест `demo.test.ts` держит формулу итогов.
 * Когда появится база (задача 2.1), меняется реализация этой функции — и ни
 * одного компонента.
 *
 * Что здесь принципиально:
 *
 * **Цена приходит из товара, а не из корзины клиента.** Позиция хранит только
 * ссылку на вариант и количество; `unitPrice` берётся из варианта в момент
 * сборки. Иначе цену можно передать запросом — классическая уязвимость корзин.
 *
 * **Итоги здесь НЕ считаются.** Их считает `cartTotals` из `domain/cart.ts` —
 * одна формула для браузера, сервера и платёжного провайдера.
 *
 * **Зона доставки — `null`.** Корзина не знает адреса, поэтому доставка не
 * считается; в макете на этом месте «Free», и это совпадение, а не расчёт:
 * подытог заведомо выше `commerce.freeDeliveryThreshold`. Настоящая зона
 * появляется на шаге «Доставка» в оформлении.
 */

import 'server-only';

import type { CartScreenLine } from '@/components/cart/cart-screen';
import type { AppliedPromo, DeliveryZone } from '@/domain/cart';

export interface CartContent {
  lines: readonly CartScreenLine[];
  /** Уже применённый промокод. В production — из `Cart.promotionId`. */
  promo: AppliedPromo | null;
  /** Зона доставки, если адрес известен. В корзине — нет. */
  deliveryZone: DeliveryZone | null;
}

/**
 * Продакшн: корзина — это то, что лежит в `Cart`/`CartItem` пользователя
 * (или `anonymousId`), а не демо-набор из `prisma/fixtures`. Три товара
 * «по умолчанию» были сравнением с макетом; в проде показ пустой корзины
 * до выбора покупателя — требование, а не эстетика.
 */
export function getCartContent(): CartContent {
  return { lines: [], promo: null, deliveryZone: null };
}
