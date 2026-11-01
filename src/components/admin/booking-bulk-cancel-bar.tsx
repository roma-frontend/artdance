'use client';

/**
 * МАССОВАЯ ОТМЕНА БРОНЕЙ — панель над таблицей броней (E-01).
 *
 * Выбор строк — обычные чекбоксы таблицы (`name="ids"`), они читаются из FormData в
 * момент отправки. Отмена здесь не выполняется: создаётся заявка на согласование, и
 * второй администратор подтверждает её в разделе согласований. Предел строк — тот же
 * `maxBulkActionItems`, что проверяет сервер: интерфейс объясняет его до отправки.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { ActionError } from '@/components/admin/status-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { security } from '@/config/business';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import { cn } from '@/lib/utils';
import { requestBulkBookingCancel } from '@/server/actions/admin/operations';

interface BookingBulkCancelBarProps {
  children: React.ReactNode;
}

export function BookingBulkCancelBar({ children }: BookingBulkCancelBarProps) {
  const t = useTranslations('admin.bookings');
  const tList = useTranslations('admin.list');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const formRef = useRef<HTMLFormElement>(null);
  const [selected, setSelected] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [byProvider, setByProvider] = useState(false);

  const { execute, status, result } = useAction(requestBulkBookingCancel, {
    onSuccess: () => {
      setDialogOpen(false);
      setReason('');
      setByProvider(false);
      setSelected(0);
      formRef.current?.reset();
      router.refresh();
    },
  });

  const limit = security.guardrails.maxBulkActionItems;
  const isRunning = status === 'executing';
  const overLimit = selected > limit;
  const canSubmit = !isRunning && !overLimit && selected > 0 && reason.trim().length >= 3;

  function selectedIds(): string[] {
    const form = formRef.current;
    if (!form) return [];
    return new FormData(form)
      .getAll('ids')
      .filter((value): value is string => typeof value === 'string');
  }

  return (
    <form
      ref={formRef}
      /* Счётчик пересчитывается по событию формы: слушать каждый чекбокс не нужно. */
      onChange={() => setSelected(selectedIds().length)}
      onSubmit={(event) => event.preventDefault()}
      className="flex flex-col gap-4"
    >
      {children}

      <div
        aria-live="polite"
        className={cn(
          'flex flex-wrap items-center gap-3 rounded-2xl border border-border-default bg-surface-card px-4 py-3 shadow-sm transition-all duration-normal ease-brand',
          selected > 0 &&
            'sticky bottom-4 z-sticky shadow-xl backdrop-blur-md bg-surface-card/95 border-border-strong ring-1 ring-border-default/50',
        )}
      >
        <p className="text-body-sm text-content-secondary">
          {selected === 0 ? tList('selectRow') : tList('selectedCount', { count: selected })}
        </p>

        {overLimit ? (
          <p role="alert" className="text-body-sm font-semibold text-content-danger">
            {tList('bulkLimit', { max: limit })}
          </p>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={selected === 0 || overLimit || isRunning}
          onClick={() => setDialogOpen(true)}
        >
          {t('bulkCancelCta')}
        </Button>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('bulkCancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('bulkCancelDescription')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-3">
            <p className="text-body-sm text-content-secondary">{tList('selectedCount', { count: selected })}</p>

            <label htmlFor="booking-bulk-cancel-reason" className="text-label uppercase text-content-secondary">
              {t('cancelReasonLabel')}
            </label>
            <textarea
              id="booking-bulk-cancel-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="form-input resize-y"
            />

            <label className="text-body-sm flex items-center gap-2 text-content-secondary">
              <input
                type="checkbox"
                checked={byProvider}
                onChange={(event) => setByProvider(event.target.checked)}
                className="size-4 rounded-sm border-border-strong accent-accent"
              />
              {t('bulkCancelByProvider')}
            </label>

            <ActionError error={result.serverError} t={tRoot} />

            {result.data ? (
              <p role="status" className="text-body-sm text-content-secondary">
                {t('bulkCancelRequested', { count: result.data.count })}
              </p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={!canSubmit}
              onClick={(event) => {
                event.preventDefault();
                execute({ ids: selectedIds(), reason, byProvider });
              }}
            >
              {t('bulkCancelSubmit')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
