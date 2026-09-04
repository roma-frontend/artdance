/**
 * CART LINE ITEM — позиция корзины.
 *
 * В прототипе это строка из фото, названия, цены и трёх `<div>` со символами
 * «−», числом и «+». Здесь то же самое, но с работающими элементами и
 * состояниями, которых в макете нет ни у одной позиции.
 *
 * **Количество не хранится внутри.** Истина о корзине — на сервере: после
 * `validateCart` цена или доступное количество могут измениться, и локальное
 * состояние означало бы расхождение с итогом заказа. Компонент сообщает о
 * желании изменить количество и рисует то, что ему вернули.
 *
 * **Три состояния сверх макета, без которых корзина врёт.**
 *  • `unavailable` — товар кончился, пока он лежал в корзине. Позиция остаётся
 *    видимой (иначе непонятно, почему изменился итог), но не участвует в оплате.
 *  • `previousUnitPrice` — цена изменилась с момента добавления. Старая цена
 *    зачёркнута рядом с новой: молча пересчитанный итог выглядит как обман.
 *  • `stock ≤ commerce.lowStockThreshold` — «осталось 2»: тот же порог, что в
 *    карточке товара, из конфигурации, а не из разметки.
 *
 * **Удаление — текстовая кнопка, а не крестик.** Из макета, и это к лучшему:
 * крестик в углу строки нажимается случайно, а «Удалить» требует осознанного
 * действия. Доступное имя включает название товара — в списке из пяти позиций
 * пять кнопок «Удалить» неразличимы для скринридера.
 *
 * **Миниатюра — `Media` с preset `thumbnail`.** Размер уменьшается на узких
 * экранах (100 → 76 → 60px, как в прототипе), но пропорции задаёт preset, а не
 * класс: соотношение сторон кадра — свойство роли изображения.
 */

'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { QuantityStepper } from '@/components/ui/quantity-stepper';
import { commerce, routes } from '@/config';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Money } from '@/domain/money';
import type { Locale } from '@/i18n/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

/** Выбранный вариант товара: подпись собирается из ключей i18n, а не из строки. */
export type CartLineOptionKind = 'size' | 'color' | 'style';

export interface CartLineView {
  id: string;
  /** Слаг товара для ссылки. Без него позиция не кликается (подарочная карта). */
  slug?: string;
  title: string;
  brand?: string;
  image: MediaRef;
  unitPrice: Money;
  /** Цена на момент добавления, если она отличается от текущей. */
  previousUnitPrice?: Money;
  quantity: number;
  options?: readonly { kind: CartLineOptionKind; value: string }[];
  /** Остаток на складе. Ниже порога появляется предупреждение. */
  stock?: number;
  unavailable?: boolean;
}

interface CartLineItemProps {
  line: CartLineView;
  locale: Locale;
  onQuantityChange(id: string, quantity: number): void;
  onRemove(id: string): void;
  /** Запрос по этой позиции ещё выполняется. */
  pending?: boolean;
  className?: string;
}

const optionLabelKeys = {
  size: 'shop.sizeLabel',
  color: 'shop.colorLabel',
  style: 'common.labels.style',
} as const;

export function CartLineItem({
  line,
  locale,
  onQuantityChange,
  onRemove,
  pending = false,
  className,
}: CartLineItemProps) {
  const t = useTranslations();
  const format = useFormatter();

  const lowStock =
    !line.unavailable && line.stock !== undefined && line.stock <= commerce.lowStockThreshold;

  return (
    <article
      className={cn(
        'flex gap-5 rounded-lg border border-border-default bg-surface-card p-6',
        line.unavailable && 'opacity-70',
        className,
      )}
    >
      <div className="w-15 shrink-0 xs:w-19 md:w-25">
        <Media
          {...resolveMedia(line.image, locale)}
          preset="thumbnail"
          fallback="product"
          className="rounded-md"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {line.brand && (
          <p className="text-eyebrow text-content-tertiary uppercase">{line.brand}</p>
        )}

        <h3 className="text-body-sm mt-1 font-semibold">
          {line.slug ? (
            <Link
              href={routes.product(line.slug)}
              className="transition-colors duration-normal ease-brand hover:text-content-accent"
            >
              {line.title}
            </Link>
          ) : (
            line.title
          )}
        </h3>

        {line.options && line.options.length > 0 && (
          <p className="text-caption mt-1 text-content-secondary">
            {/*
              «Цвет: чёрный · Размер: M» — подписи из i18n, значения из данных.
              Разделитель один и тот же, поэтому собирается перечислением, а не
              конкатенацией со случайными пробелами.
            */}
            {line.options
              .map((option) => `${t(optionLabelKeys[option.kind])}: ${option.value}`)
              .join(' · ')}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <Price amount={line.unitPrice} />
          {line.previousUnitPrice !== undefined &&
            line.previousUnitPrice !== line.unitPrice && (
              <s className="text-caption text-content-tertiary">
                {format.number(line.previousUnitPrice, 'price')}
              </s>
            )}
        </div>

        {line.unavailable && (
          <Badge variant="signal" className="mt-2 self-start">
            {t('shop.outOfStock')}
          </Badge>
        )}

        {lowStock && (
          <p className="text-caption mt-2 font-semibold text-content-warning">
            {t('shop.lowStock', { count: line.stock ?? 0 })}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <QuantityStepper
            value={line.quantity}
            onChange={(next) => onQuantityChange(line.id, next)}
            disabled={pending || line.unavailable}
            label={`${t('common.labels.quantity')} — ${line.title}`}
          />

          <button
            type="button"
            onClick={() => onRemove(line.id)}
            disabled={pending}
            className={cn(
              'text-caption ms-auto text-content-danger',
              'transition-opacity duration-normal ease-brand hover:opacity-70',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {t('common.actions.remove')}
            <span className="sr-only"> — {line.title}</span>
          </button>
        </div>
      </div>
    </article>
  );
}
