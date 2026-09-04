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

import { demoCartTotals, demoProducts } from '../../../prisma/fixtures/demo';
import type { CartScreenLine } from '@/components/cart/cart-screen';
import { welcomePromo, type AppliedPromo, type DeliveryZone } from '@/domain/cart';

import { mediaRef } from './media';

export interface CartContent {
  lines: readonly CartScreenLine[];
  /** Уже применённый промокод. В production — из `Cart.promotionId`. */
  promo: AppliedPromo | null;
  /** Зона доставки, если адрес известен. В корзине — нет. */
  deliveryZone: DeliveryZone | null;
}

export function getCartContent(): CartContent {
  return {
    lines: demoCartTotals.items.map((item) => {
      const product = demoProducts.find((candidate) => candidate.slug === item.productSlug);
      if (!product) {
        throw new Error(`[content] Позиция корзины ссылается на неизвестный товар «${item.productSlug}».`);
      }

      const variant = product.variants.find((candidate) => candidate.sku === item.variantSku);
      if (!variant) {
        throw new Error(`[content] Неизвестный вариант товара «${item.variantSku}».`);
      }

      /*
       * Подписи вариантов — данные, а не строка: «Цвет: чёрный · Размер: M»
       * собирает компонент из ключей i18n, поэтому в армянской локали не
       * появится английское «Color».
       */
      const options: CartScreenLine['options'] = [
        ...(variant.color ? [{ kind: 'color' as const, value: variant.color }] : []),
        ...(variant.size ? [{ kind: 'size' as const, value: variant.size }] : []),
      ];

      return {
        id: variant.sku,
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        image: mediaRef(product.asset),
        unitPrice: variant.price,
        quantity: item.quantity,
        options,
        stock: variant.stock,
        /* Подарочная карта не облагается комиссией и не возвращается — свой тип позиции. */
        lineType: product.isGiftCard === true ? 'GIFT_CARD' : 'PRODUCT',
      };
    }),
    /**
     * Приветственный код из макета применён заранее — так же, как в прототипе,
     * где строка «Discount (WELCOME10)» есть, а поля ввода нет. Снять его можно
     * в самой корзине, и тогда виден путь «ввод → применение → отказ».
     */
    promo: welcomePromo(),
    deliveryZone: null,
  };
}
