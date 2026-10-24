'use client';

/**
 * AVAILABILITY EDITOR — форма расписания инструктора.
 *
 * Состояние минимально: индикатор отправки и результат последнего действия.
 * Список правил исключений рендерит сервер (страница после успешного
 * сохранения делает `router.refresh()`), поэтому между перезагрузками
 * компонент не держит копию базы.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { MessageKey } from '@/i18n/types';
import { formatClock } from '@/lib/time/clock';
import { zonedParts } from '@/lib/time/schedule';
import {
  deleteAvailabilityEntry,
  saveAvailabilityException,
  saveAvailabilityRule,
  toggleAvailabilityRule,
  type AvailabilityActionState,
} from '@/server/actions/availability';
import type { ScheduleRuleItem, ScheduleExceptionItem } from './types';

const initialError: AvailabilityActionState = { status: 'idle' };

interface Props {
  rules: readonly ScheduleRuleItem[];
  exceptions: readonly ScheduleExceptionItem[];
}

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Дата и время момента в поясе бизнеса, как их ввёл инструктор. */
function businessWall(iso: string) {
  const parts = zonedParts(new Date(iso));
  const date = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  return { date, time: formatClock(parts.minutesOfDay) };
}

/** Ключи i18n дней недели, укороченный вид: 0 = вс. */
const weekdayMessageKeys: Record<number, string> = {
  0: 'studio.availability.weekday.sun',
  1: 'studio.availability.weekday.mon',
  2: 'studio.availability.weekday.tue',
  3: 'studio.availability.weekday.wed',
  4: 'studio.availability.weekday.thu',
  5: 'studio.availability.weekday.fri',
  6: 'studio.availability.weekday.sat',
};

export function AvailabilityEditor({ rules, exceptions }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const [feedback, setFeedback] = useState<AvailabilityActionState>(initialError);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);

  const collectFeedback = (result: { data?: AvailabilityActionState; serverError?: string } | undefined) => {
    if (result?.data) setFeedback(result.data);
    else setFeedback({ status: 'error', messageKey: 'studio.availability.error' as MessageKey });
  };

  const saveRule = useAction(saveAvailabilityRule, {
    onSuccess: (result) => {
      collectFeedback({ data: result.data });
      if (result.data?.status === 'success') router.refresh();
    },
    onError: () => collectFeedback(undefined),
  });
  const saveException = useAction(saveAvailabilityException, {
    onSuccess: (result) => {
      collectFeedback({ data: result.data });
      if (result.data?.status === 'success') router.refresh();
    },
    onError: () => collectFeedback(undefined),
  });
  const removeEntry = useAction(deleteAvailabilityEntry, {
    onSuccess: (result) => {
      collectFeedback({ data: result.data });
      if (result.data?.status === 'success') router.refresh();
    },
    onError: () => collectFeedback(undefined),
  });
  const toggleRule = useAction(toggleAvailabilityRule, {
    onSuccess: (result) => {
      collectFeedback({ data: result.data });
      if (result.data?.status === 'success') router.refresh();
    },
    onError: () => collectFeedback(undefined),
  });

  const sortedRules = [...rules].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.weekday as (typeof WEEKDAY_ORDER)[number]) - WEEKDAY_ORDER.indexOf(b.weekday as (typeof WEEKDAY_ORDER)[number]) || a.startTime.localeCompare(b.startTime),
  );
  const sortedExceptions = [...exceptions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="space-y-10">
      {/* ─────────────── Недельное расписание ─────────────── */}
      <section aria-labelledby="rules-title">
        <h2 id="rules-title" className="text-heading-3">{t('studio.availability.rulesTitle')}</h2>
        <p className="text-body-sm mt-1 text-content-secondary">{t('studio.availability.rulesHint')}</p>

        <ul className="mt-4 space-y-2">
          {sortedRules.length === 0 && <li className="text-body-sm text-content-tertiary">{t('studio.availability.rulesEmpty')}</li>}
          {sortedRules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-surface-card p-4">
              <span className="min-w-28 font-semibold">{t(weekdayMessageKeys[rule.weekday] as never)}</span>
              <span className="font-mono text-body-sm">{rule.startTime}–{rule.endTime}</span>
              {rule.validFrom && <span className="text-caption text-content-tertiary">{t('studio.availability.validFrom')}: {rule.validFrom}</span>}
              {rule.validUntil && <span className="text-caption text-content-tertiary">{t('studio.availability.validUntil')}: {rule.validUntil}</span>}
              <label className="ml-auto flex items-center gap-2 text-caption">
                <input
                  type="checkbox"
                  checked={rule.isActive}
                  onChange={(event) => {
                    setBusyRuleId(rule.id);
                    toggleRule.execute({ id: rule.id, isActive: event.target.checked });
                  }}
                  disabled={busyRuleId === rule.id || toggleRule.status === 'executing'}
                  className="min-h-5 min-w-5"
                />
                {t('studio.availability.active')}
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => removeEntry.execute({ table: 'rule', id: rule.id })}
                disabled={removeEntry.status === 'executing'}
              >
                {t('studio.availability.delete')}
              </Button>
            </li>
          ))}
        </ul>

        <form
          action={void 0}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            saveRule.execute({
              weekday: Number(data.get('weekday')),
              startTime: String(data.get('startTime')),
              endTime: String(data.get('endTime')),
              validFrom: String(data.get('validFrom') || '') || undefined,
              validUntil: String(data.get('validUntil') || '') || undefined,
              isActive: true,
            });
            form.reset();
          }}
          className="mt-4 grid gap-3 rounded-xl border border-border-default bg-surface-card p-4 sm:grid-cols-5"
        >
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.weekdayLabel')}</span>
            <select name="weekday" required className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3">
              {WEEKDAY_ORDER.map((weekday) => (
                <option key={weekday} value={weekday}>{t(weekdayMessageKeys[weekday] as never)}</option>
              ))}
            </select>
          </label>
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.startTime')}</span>
            <input type="time" name="startTime" required step={300} className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.endTime')}</span>
            <input type="time" name="endTime" required step={300} className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.validFrom')}</span>
            <input type="date" name="validFrom" className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.validUntil')}</span>
            <input type="date" name="validUntil" className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <div className="sm:col-span-5">
            <Button type="submit" variant="accent" disabled={saveRule.status === 'executing'}>{t('studio.availability.addRule')}</Button>
          </div>
        </form>
      </section>

      {/* ─────────────── Исключения ─────────────── */}
      <section aria-labelledby="exceptions-title">
        <h2 id="exceptions-title" className="text-heading-3">{t('studio.availability.exceptionsTitle')}</h2>
        <p className="text-body-sm mt-1 text-content-secondary">{t('studio.availability.exceptionsHint')}</p>

        <ul className="mt-4 space-y-2">
          {sortedExceptions.length === 0 && <li className="text-body-sm text-content-tertiary">{t('studio.availability.exceptionsEmpty')}</li>}
          {sortedExceptions.map((exception) => (
            <li key={exception.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-default bg-surface-card p-4">
              <span className="font-mono text-body-sm">{businessWall(exception.startsAt).date} · {businessWall(exception.startsAt).time}–{businessWall(exception.endsAt).time}</span>
              <span className={exception.isAvailable ? 'text-caption font-semibold text-content-success' : 'text-caption font-semibold text-content-danger'}>
                {exception.isAvailable ? t('studio.availability.extraWindow') : t('studio.availability.blocked')}
              </span>
              {exception.reason && <span className="text-caption text-content-tertiary">{exception.reason}</span>}
              <div className="ml-auto">
                <Button type="button" variant="outline" onClick={() => removeEntry.execute({ table: 'exception', id: exception.id })} disabled={removeEntry.status === 'executing'}>
                  {t('studio.availability.delete')}
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            saveException.execute({
              date: String(data.get('date')),
              startTime: String(data.get('startTime')),
              endTime: String(data.get('endTime')),
              isAvailable: data.get('isAvailable') === 'on',
              reason: String(data.get('reason') || '') || undefined,
            });
            form.reset();
          }}
          className="mt-4 grid gap-3 rounded-xl border border-border-default bg-surface-card p-4 sm:grid-cols-4"
        >
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.date')}</span>
            <input type="date" name="date" required className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.startTime')}</span>
            <input type="time" name="startTime" required step={300} className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <label className="text-body-sm">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.endTime')}</span>
            <input type="time" name="endTime" required step={300} className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <label className="flex items-end gap-2 text-body-sm pb-2">
            <input type="checkbox" name="isAvailable" className="min-h-5 min-w-5" />
            <span>{t('studio.availability.extraWindow')}</span>
          </label>
          <label className="text-body-sm sm:col-span-3">
            <span className="mb-1.5 block font-semibold">{t('studio.availability.reason')}</span>
            <input type="text" name="reason" maxLength={160} className="min-h-11 w-full rounded-md border border-border-default bg-surface-raised px-3" />
          </label>
          <div className="sm:col-span-4">
            <Button type="submit" variant="accent" disabled={saveException.status === 'executing'}>{t('studio.availability.addException')}</Button>
          </div>
        </form>
      </section>

      {feedback.status !== 'idle' && feedback.messageKey && (
        <p role={feedback.status === 'error' ? 'alert' : 'status'} className="text-body-sm">
          {t(feedback.messageKey as never)}
        </p>
      )}
    </div>
  );
}
