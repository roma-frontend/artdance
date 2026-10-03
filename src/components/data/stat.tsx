/**
 * STAT / STAT GRID — числовой показатель сводки.
 *
 * Существует, чтобы число на дашборде было отформатировано ровно так же, как в
 * таблице и в письме: `kind` решает, деньги это, штуки или доля. Без общего
 * компонента оборот на сводке печатается «1250000», а в отчёте «1 250 000 ֏», и
 * владелец платформы обоснованно перестаёт доверять обоим.
 *
 * Пустое значение — не ноль. «Ноль броней» и «нет данных» выглядят по-разному:
 * первое — факт, второе — отсутствие факта, и путать их в отчётности нельзя.
 */

import type { ReactNode } from 'react';
import { getFormatter } from 'next-intl/server';

import { AdminStagger, AdminStaggerItem } from '@/components/admin/admin-motion';
import { getRootTranslate } from '@/i18n/translate';
import { cn } from '@/lib/utils';
import type { MessageKey } from '@/i18n/types';

export type StatKind = 'count' | 'money' | 'percent';

export interface StatSpec {
  labelKey: MessageKey;
  value: number | null;
  kind: StatKind;
  /** Адрес раздела, к которому относится число. */
  href?: string;
  hintKey?: MessageKey;
}

interface StatGridProps {
  items: readonly StatSpec[];
  className?: string;
}

export async function StatGrid({ items, className }: StatGridProps) {
  if (items.length === 0) return null;

  return (
    <AdminStagger className={cn('grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)}>
      {items.map((item) => (
        <AdminStaggerItem key={item.labelKey}>
          <Stat spec={item} />
        </AdminStaggerItem>
      ))}
    </AdminStagger>
  );
}

export async function Stat({ spec }: { spec: StatSpec }) {
  const t = await getRootTranslate();
  const format = await getFormatter();

  return (
    <div className="group rounded-2xl border border-border-default bg-surface-card p-4 shadow-sm transition-all hover:shadow-md hover:border-border-strong sm:p-5">
      <dt className="text-caption font-semibold uppercase tracking-wide text-content-tertiary">{t(spec.labelKey)}</dt>
      <dd className="mt-2 text-lg font-bold tracking-tight text-content-primary sm:text-xl">{formatValue(spec, format)}</dd>
      {spec.hintKey ? <p className="text-caption mt-1 text-content-tertiary leading-snug">{t(spec.hintKey)}</p> : null}
    </div>
  );
}

function formatValue(spec: StatSpec, format: Awaited<ReturnType<typeof getFormatter>>): ReactNode {
  if (spec.value === null) return <span className="text-content-tertiary">—</span>;

  switch (spec.kind) {
    case 'money':
      return format.number(spec.value, 'price');
    case 'percent':
      return format.number(spec.value, 'percent');
    case 'count':
      return format.number(spec.value, 'plain');
  }
}
