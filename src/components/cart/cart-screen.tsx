/**
 * CART SCREEN — корзина: позиции слева, сводка справа.
 *
 * Клиентский островок целиком, и это не лень: количество, промокод и итог
 * меняются от каждого нажатия, а сервер отдаёт только начальное состояние.
 * Страница (`app/[locale]/cart/page.tsx`) остаётся серверной и статической.
 *
 * **Итоги считает `domain/cart.ts`, а не этот компонент.** Здесь нет ни одной
 * арифметической операции над деньгами: `cartTotals` вызывается и здесь (чтобы
 * цифры менялись мгновенно), и на сервере перед оформлением (чтобы они были
 * настоящими). Правило при этом остаётся прежним: клиентский расчёт —
 * предположение, серверный — истина.
 *
 * **Пустая корзина — полноценное состояние, а не отсутствие блока.** В прототипе
 * его нет, как и у любого другого списка; здесь есть объяснение и выход в
 * магазин, иначе пользователь, удаливший последнюю позицию, попадает в тупик.
 *
 * **Что здесь пока заглушка и почему это видно в коде.** Промокод проверяется
 * сравнением с `promotions.welcomeCode`: настоящая проверка — существует ли код,
 * не истёк ли, не исчерпан ли лимит, стакается ли с подпиской — это запрос к БД
 * и server action волны commerce. Удаление и изменение количества по той же
 * причине меняют только локальное состояние: в продукте каждое действие уходит
 * на сервер, возвращает пересчитанную корзину и может ответить «цена
 * изменилась» (`changed`) или «товар кончился» (`unavailable`) — оба состояния у
 * компонентов уже реализованы и ждут источник.
 */

'use client';

import { ShoppingBagIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { CartLineItem, type CartLineView } from '@/components/cart/cart-line-item';
import { PromoCodeForm } from '@/components/cart/promo-code-form';
import { OrderSummary } from '@/components/checkout/order-summary';
import { TrustBadges } from '@/components/checkout/trust-badges';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { promotions, routes, type LineItemType } from '@/config';
import {
  cartTotals,
  welcomePromo,
  type AppliedPromo,
  type CartLine,
  type DeliveryZone,
} from '@/domain/cart';
import type { PaymentMethod } from '@/domain/enums';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';

/**
 * Позиция корзины с типом, нужным для расчёта.
 *
 * `lineType` не входит в `CartLineView`, потому что строке товара он не нужен:
 * это свойство позиции ЗАКАЗА (от него зависят комиссия, налог и возвратность),
 * и знать о нём должен расчёт, а не разметка.
 */
export interface CartScreenLine extends CartLineView {
  lineType: LineItemType;
}

interface CartScreenProps {
  lines: readonly CartScreenLine[];
  promo: AppliedPromo | null;
  /** Зона доставки, если адрес уже известен. В корзине обычно `null`. */
  deliveryZone: DeliveryZone | null;
  /** Реально подключённые способы оплаты — для трест-бейджей. */
  paymentMethods: readonly PaymentMethod[];
  locale: Locale;
}

/** Позиция корзины → позиция расчёта. Недоступные в итог не попадают. */
function toCartLine(line: CartScreenLine): CartLine {
  return {
    id: line.id,
    lineType: line.lineType,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
  };
}

export function CartScreen({
  lines: initialLines,
  promo: initialPromo,
  deliveryZone,
  paymentMethods,
  locale,
}: CartScreenProps) {
  const t = useTranslations();

  const [lines, setLines] = useState<readonly CartScreenLine[]>(initialLines);
  const [promo, setPromo] = useState<AppliedPromo | null>(initialPromo);
  const [promoInvalid, setPromoInvalid] = useState(false);

  const totals = cartTotals({
    lines: lines.filter((line) => !line.unavailable).map(toCartLine),
    promo,
    deliveryZone,
  });

  const changeQuantity = (id: string, quantity: number) => {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, quantity } : line)),
    );
  };

  const removeLine = (id: string) => {
    setLines((current) => current.filter((line) => line.id !== id));
  };

  /**
   * TODO(commerce): заменить на server action `applyPromoCode`. Здесь проверка
   * заведомо неполная — она только показывает оба исхода на экране.
   */
  const applyPromo = (code: string) => {
    if (code === promotions.welcomeCode.code) {
      setPromo(welcomePromo());
      setPromoInvalid(false);
      return;
    }
    setPromoInvalid(true);
  };

  const removePromo = () => {
    setPromo(null);
    setPromoInvalid(false);
  };

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingBagIcon className="size-10" aria-hidden />}
        title={t('cart.empty')}
        description={t('cart.emptyHint')}
        action={
          <Button asChild variant="accent">
            <Link href={routes.shop()}>{t('cart.emptyCta')}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="detail-grid">
      {/*
        Список, а не набор `<article>` подряд: количество позиций озвучивается
        скринридером, и «третий из пяти» в корзине — полезная информация.
      */}
      <ul className="flex flex-col gap-4">
        {lines.map((line) => (
          <li key={line.id}>
            <CartLineItem
              line={line}
              locale={locale}
              onQuantityChange={changeQuantity}
              onRemove={removeLine}
            />
          </li>
        ))}
      </ul>

      <OrderSummary totals={totals}>
        <PromoCodeForm
          appliedCode={promo?.code ?? null}
          onApply={applyPromo}
          onRemove={removePromo}
          invalid={promoInvalid}
          className="mt-5"
        />

        <Button asChild size="lg" block className="mt-5">
          <Link href={routes.checkout()}>{t('common.actions.checkout')}</Link>
        </Button>

        <TrustBadges paymentMethods={paymentMethods} className="mt-5" />
      </OrderSummary>
    </div>
  );
}
