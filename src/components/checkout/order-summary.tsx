/**
 * ORDER SUMMARY — сводка заказа: позиции, скидка, доставка, итог.
 *
 * Один компонент на два экрана. В корзине позиции уже перечислены рядом, поэтому
 * `lines` не передаются и сводка остаётся короткой; в оформлении товаров на
 * экране нет, и они показываются миниатюрами — ровно как в макете.
 *
 * **Компонент ничего не считает.** Он принимает готовый `CartTotals` из
 * `domain/cart.ts`. Это не формальность: итог, посчитанный в разметке, разойдётся
 * с итогом, ушедшим в платёжного провайдера, на округлении скидки — и разбираться
 * в этом придётся в споре об оплате.
 *
 * **Строки НДС нет, хотя налог посчитан.** Цены в каталоге указаны с НДС
 * (`tax.pricesIncludeVat`), и отдельная строка читалась бы как «плюс 20% сверху».
 * Налог нужен документу и бухгалтерии, а не корзине; он есть в `totals.vat`.
 *
 * **`recalculating` и `changed` — состояния из карты компонентов.** Первое: итог
 * пересчитывается на сервере, и старые цифры на это время помечены как
 * неактуальные (`aria-busy`), а не подменяются спиннером — прыжок раскладки в
 * сводке страшнее, чем секунда неточности. Второе: пересчёт вернул другие суммы,
 * и об этом нужно сказать до нажатия «оплатить», а не после.
 */

import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { Media } from '@/components/ui/media';
import { Price } from '@/components/ui/price';
import { commerce } from '@/config';
import type { CartTotals } from '@/domain/cart';
import { resolveMedia, type MediaRef } from '@/domain/content';
import type { Money } from '@/domain/money';
import type { Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

export interface OrderSummaryLine {
  id: string;
  title: string;
  quantity: number;
  /** Стоимость позиции: цена × количество. */
  total: Money;
  image?: MediaRef;
}

interface OrderSummaryProps {
  totals: CartTotals;
  /** Позиции миниатюрами. В корзине не передаются — они уже на экране. */
  lines?: readonly OrderSummaryLine[];
  locale?: Locale;
  recalculating?: boolean;
  /** Суммы изменились после серверной проверки корзины. */
  changed?: boolean;
  /** Промокод, кнопка оплаты, трест-бейджи — всё, что идёт под итогом. */
  children?: ReactNode;
  className?: string;
}

export function OrderSummary({
  totals,
  lines,
  locale,
  recalculating = false,
  changed = false,
  children,
  className,
}: OrderSummaryProps) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <aside
      aria-busy={recalculating}
      className={cn(
        'flex flex-col rounded-xl border border-border-default bg-surface-card p-8 shadow-lg',
        className,
      )}
    >
      <h2 className="text-card-title mb-4">{t('cart.summaryTitle')}</h2>

      {lines && lines.length > 0 && locale && (
        <ul className="mb-4 flex flex-col gap-3">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3">
              {line.image && (
                <div className="w-12 shrink-0">
                  <Media
                    {...resolveMedia(line.image, locale)}
                    preset="thumbnail"
                    fallback="product"
                    className="rounded-sm"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-caption truncate font-semibold">{line.title}</p>
                {/*
                  Количество через ICU, а не «×2»: в макете у позиции с одной
                  штукой осталось одинокое «×» — знак умножения без множителя.
                */}
                <p className="text-caption text-content-tertiary">
                  {t('common.counts.items', { count: line.quantity })}
                </p>
              </div>
              <p className="text-caption shrink-0 font-semibold">
                {format.number(line.total, 'price')}
              </p>
            </li>
          ))}
        </ul>
      )}

      <dl className={cn('flex flex-col', recalculating && 'opacity-60')}>
        <SummaryRow
          label={t('cart.itemsCount', { count: totals.itemCount })}
          value={format.number(totals.subtotal, 'price')}
        />

        {totals.discount > 0 && (
          <SummaryRow
            label={
              totals.promoCode
                ? `${t('common.labels.discount')} (${totals.promoCode})`
                : t('common.labels.discount')
            }
            /* Скидка — единственная строка со знаком минус: она уменьшает итог. */
            value={`−${format.number(totals.discount, 'price')}`}
            tone="accent"
          />
        )}

        <SummaryRow
          label={t('common.labels.delivery')}
          value={
            totals.deliveryFee === 0
              ? t('common.labels.free')
              : format.number(totals.deliveryFee, 'price')
          }
          tone={totals.deliveryFee === 0 ? 'success' : 'default'}
        />
      </dl>

      {/*
        Подсказка «добавьте на N до бесплатной доставки» показывается только
        когда доставка выбрана и ещё платная: без зоны сумма ни о чём не говорит.
      */}
      {totals.deliveryFee > 0 && totals.freeDeliveryRemaining > 0 && (
        <p className="text-caption mt-1 text-content-secondary">
          {t('shop.freeDeliveryHint', {
            threshold: format.number(commerce.freeDeliveryThreshold, 'price'),
          })}
        </p>
      )}

      <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-border-default pt-3">
        <span className="text-body-sm font-bold">{t('common.labels.total')}</span>
        <Price amount={totals.total} emphasis="total" />
      </div>

      {changed && (
        <p role="alert" className="text-caption mt-3 font-semibold text-content-warning">
          {t('cart.pricesChanged')}
        </p>
      )}

      {children}
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'accent' | 'success';
}) {
  return (
    <div className="text-body-sm flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-content-secondary">{label}</dt>
      <dd
        className={cn(
          'text-right font-medium tabular-nums',
          tone === 'accent' && 'text-content-accent',
          tone === 'success' && 'font-semibold text-content-success',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
