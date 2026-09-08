/**
 * PLAN COMPARISON TABLE — сравнение тарифов по квотам.
 *
 * Таблица строится из `PlanQuota`, а не из списков текста: список «что входит» у
 * каждого плана свой и отвечает на вопрос «что я получу», а сравнение отвечает на
 * другой — «чем Pro отличается от Elite». Второй вопрос требует одинаковых строк
 * у всех планов, и получить их можно только из машиночитаемых квот. Стоит
 * написать эту таблицу текстом — и «2 индивидуальных занятия» в карточке разойдётся
 * с «2» в таблице ровно в тот момент, когда заказчик поменяет квоту.
 *
 * Разметка — настоящая `<table>` с `<th scope>`: сетка из `div` в этом месте
 * читается скринридером как поток бессвязных значений, потому что связь «строка —
 * колонка» существует только визуально.
 *
 * Значение ячейки бывает трёх видов: число, «без ограничений» и «да/нет». Все три
 * приходят из квоты; булево показывается иконкой с текстовой альтернативой —
 * галочка без подписи в таблице означает «не озвучено вообще».
 */

import { CheckIcon, MinusIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { subscriptionPlanNameKey, type PlanQuota, type SubscriptionPlan } from '@/config';
import { cn } from '@/lib/utils';

interface PlanComparisonTableProps {
  plans: readonly SubscriptionPlan[];
  className?: string;
}

/** Строка сравнения: подпись из i18n и как достать значение из квоты. */
interface QuotaRow {
  id: string;
  labelKey:
    | 'groupClasses'
    | 'privateSessions'
    | 'styles'
    | 'priorityBooking'
    | 'progressJournal'
    | 'studioDiscount'
    | 'guestWorkshops'
    | 'competitionPrep'
    | 'vipEvents';
  value(quota: PlanQuota): number | 'unlimited' | 'all' | boolean;
}

const rows: readonly QuotaRow[] = [
  { id: 'groupClasses', labelKey: 'groupClasses', value: (q) => q.groupClassesPerMonth },
  { id: 'privateSessions', labelKey: 'privateSessions', value: (q) => q.privateSessionsPerMonth },
  { id: 'styles', labelKey: 'styles', value: (q) => (q.danceStyles === 'all' ? 'all' : q.danceStyles) },
  { id: 'priorityBooking', labelKey: 'priorityBooking', value: (q) => q.priorityBooking },
  { id: 'progressJournal', labelKey: 'progressJournal', value: (q) => q.progressJournal },
  { id: 'studioDiscount', labelKey: 'studioDiscount', value: (q) => q.studioRentalDiscountRate },
  { id: 'guestWorkshops', labelKey: 'guestWorkshops', value: (q) => q.guestWorkshops },
  { id: 'competitionPrep', labelKey: 'competitionPrep', value: (q) => q.competitionPrep },
  { id: 'vipEvents', labelKey: 'vipEvents', value: (q) => q.vipEvents },
];

export function PlanComparisonTable({ plans, className }: PlanComparisonTableProps) {
  const t = useTranslations();
  const tQuota = useTranslations('pricing.quota');
  const format = useFormatter();

  /**
   * Значение ячейки.
   *
   * Ноль в квоте — это «не входит», а не «ноль занятий»: показывать «0» рядом с
   * «2» и «без ограничений» значит заставлять читателя догадываться.
   */
  function cell(row: QuotaRow, plan: SubscriptionPlan): ReactNode {
    const value = row.value(plan.quota);

    if (value === 'unlimited') return tQuota('unlimited');
    if (value === 'all') return tQuota('allStyles');

    if (typeof value === 'boolean') {
      return value ? <Yes label={tQuota('included')} /> : <No label={tQuota('notIncluded')} />;
    }

    if (value === 0) return <No label={tQuota('notIncluded')} />;

    /* Доля — это скидка на аренду; остальные числа — количества. */
    return row.id === 'studioDiscount' ? format.number(value, 'percent') : format.number(value, 'plain');
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-150 border-collapse text-start">
        <caption className="sr-only">{t('pricing.comparisonTitle')}</caption>

        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="text-caption py-4 text-start font-semibold text-content-tertiary">
              {t('pricing.planColumn')}
            </th>
            {plans.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className={cn(
                  'text-card-title py-4 text-start',
                  plan.highlighted && 'text-content-accent',
                )}
              >
                {t(subscriptionPlanNameKey(plan.id))}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-border-default">
              <th scope="row" className="text-body-sm py-4 pe-4 text-start font-normal text-content-secondary">
                {tQuota(row.labelKey)}
              </th>
              {plans.map((plan) => (
                <td key={plan.id} className="text-body-sm py-4 pe-4">
                  {cell(row, plan)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Yes({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-content-accent">
      <CheckIcon aria-hidden className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function No({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-content-tertiary">
      <MinusIcon aria-hidden className="size-4" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
