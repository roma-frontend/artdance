/**
 * PRICE — сумма с единицей: за занятие, за час, за месяц, «от», итого.
 *
 * Форматирование только через `useFormatter().number(value, 'price')`. Символ ֏,
 * разрядность и позиция знака заданы форматом локали в `i18n/config.ts`, а не
 * строкой в разметке: в армянской и русской локали разделитель разрядов разный,
 * и «5,000 ֏» вместо «5 000 ֏» — это не мелочь, а признак непереведённого сайта.
 *
 * Единица («за занятие») — отдельный элемент со своим цветом и кеглем, а не часть
 * строки перевода с уже подставленной суммой: иначе цену нельзя выделить
 * визуально и нельзя прочитать голосом отдельно от единицы.
 *
 * Работает и в серверном, и в клиентском компоненте: `useFormatter` из next-intl
 * доступен в обоих.
 */

import { useFormatter, useTranslations } from 'next-intl';

import type { Money } from '@/domain/money';
import { cn } from '@/lib/utils';

/** Единица измерения цены. `total` и `plain` выводятся без подписи. */
export type PriceUnit = 'perClass' | 'perHour' | 'perMonth' | 'perYear' | 'perSession' | 'plain';

interface PriceProps {
  amount: Money;
  unit?: PriceUnit;
  /** «От 5 000 ֏» — когда цена зависит от варианта или длительности. */
  from?: boolean;
  /** Итоговая сумма: крупнее и цветом основного контента, а не акцентом. */
  emphasis?: 'accent' | 'total' | 'onCinema';
  className?: string;
}

export function Price({
  amount,
  unit = 'plain',
  from = false,
  emphasis = 'accent',
  className,
}: PriceProps) {
  const format = useFormatter();
  const t = useTranslations('common.labels');

  /*
   * Приписки («от», «за занятие») приглушены относительно суммы, но на тёмной
   * плоскости приглушать нужно в другую сторону: `content-tertiary` рассчитан на
   * светлую подложку и на кинематографичной секции почти сливается с фоном.
   */
  const asideColor =
    emphasis === 'onCinema' ? 'text-content-on-cinema-muted' : 'text-content-tertiary';

  return (
    <span
      className={cn(
        'text-price inline-flex items-baseline gap-1',
        emphasis === 'accent' && 'text-content-accent',
        emphasis === 'total' && 'text-content-primary',
        emphasis === 'onCinema' && 'text-content-on-cinema',
        className,
      )}
    >
      {from && <span className={cn('text-caption font-normal', asideColor)}>{t('from')}</span>}

      {format.number(amount, 'price')}

      {unit !== 'plain' && (
        <span className={cn('text-caption font-normal', asideColor)}>{t(unit)}</span>
      )}
    </span>
  );
}
