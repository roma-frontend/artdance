/**
 * SPOTS LEFT — сколько мест осталось, с цветовой градацией.
 *
 * Порог «осталось мало» — `commerce.lowStockThreshold`, а не число в разметке:
 * это коммерческий рычаг (им управляют, чтобы подталкивать к брони), и менять
 * его должен владелец продукта в одном месте, а не разработчик в семи карточках.
 *
 * Цвет несёт смысл, поэтому он не остаётся единственным носителем информации:
 * текст всегда называет количество словами («осталось 2 места», «мест нет»).
 * Пользователь с дальтонизмом получает то же сообщение, что и остальные —
 * требование WCAG 1.4.1.
 *
 * Состояние «мест нет» отличается от «есть лист ожидания»: во втором случае
 * действие ещё возможно, и подпись обязана это сообщать.
 */

import { useTranslations } from 'next-intl';

import { commerce } from '@/config';
import { cn } from '@/lib/utils';

interface SpotsLeftProps {
  /** Свободных мест. Ноль — группа заполнена. */
  spots: number;
  /** Открыт ли лист ожидания при заполненной группе. */
  waitlistOpen?: boolean;
  className?: string;
}

export function SpotsLeft({ spots, waitlistOpen = false, className }: SpotsLeftProps) {
  const t = useTranslations();

  const soldOut = spots <= 0;
  const few = !soldOut && spots <= commerce.lowStockThreshold;

  if (soldOut && waitlistOpen) {
    return (
      <span className={cn('text-caption font-semibold text-signal', className)}>
        {t('common.actions.joinWaitlist')}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'text-caption font-semibold',
        soldOut && 'text-content-tertiary',
        few && 'text-warning',
        !soldOut && !few && 'text-success',
        className,
      )}
    >
      {t('common.counts.spotsLeft', { count: Math.max(0, spots) })}
    </span>
  );
}
