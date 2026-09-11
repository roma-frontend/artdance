'use client';

/**
 * STATUS ACTIONS — переходы состояний заказа, брони и выплаты.
 *
 * Один компонент на три сущности: механика одинаковая — кнопка, ответ сервера,
 * обновление экрана. Разное только в том, какое действие вызвать, и это
 * различается пропсом-описанием, а не тремя копиями кода с тремя разными
 * способами показать ошибку.
 *
 * Необратимые переходы (отмена брони, отправка выплаты, возврат) идут через
 * подтверждение с названием последствия. Отмена брони дополнительно требует
 * причину: она попадает в журнал и в письмо клиенту, и «отменено без причины» —
 * это спор, который платформа проиграет.
 */

import { useAction } from 'next-safe-action/hooks';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

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
import type { BookingStatus, OrderStatus } from '@/domain/enums';
import { useRouter } from '@/i18n/routing';
import type { Translate } from '@/i18n/translate';
import type { MessageKey } from '@/i18n/types';
import {
  cancelBooking,
  releasePayout,
  setBookingStatus,
  setOrderStatus,
} from '@/server/actions/admin/operations';

/* ─────────────────────────────── Заказ ─────────────────────────────── */

interface OrderStatusActionsProps {
  id: string;
  /** Разрешённые переходы, посчитанные на сервере. */
  transitions: readonly OrderStatus[];
}

export function OrderStatusActions({ id, transitions }: OrderStatusActionsProps) {
  const t = useTranslations('admin.orders');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const { execute, status, result } = useAction(setOrderStatus, {
    onSuccess: () => router.refresh(),
  });

  if (transitions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-label uppercase text-content-secondary">{t('nextStatus')}</p>
      <div className="flex flex-wrap gap-2">
        {transitions.map((next) => (
          <Button
            key={next}
            type="button"
            variant="outline"
            size="sm"
            disabled={status === 'executing'}
            onClick={() => execute({ id, status: next })}
          >
            {tRoot(`status.order.${orderStatusKey(next)}` as MessageKey)}
          </Button>
        ))}
      </div>
      <ActionError error={result.serverError} t={tRoot} />
    </div>
  );
}

/**
 * Ключ подписи статуса заказа. Значения enum в БД — `SCREAMING_SNAKE`, ключи
 * i18n — `camelCase`; преобразование живёт в одном месте.
 */
function orderStatusKey(status: OrderStatus): string {
  return status.toLowerCase().replace(/_(.)/g, (_, letter: string) => letter.toUpperCase());
}

/* ─────────────────────────────── Бронь ─────────────────────────────── */

interface BookingStatusActionsProps {
  id: string;
  transitions: readonly BookingStatus[];
  cancellable: boolean;
}

export function BookingStatusActions({ id, transitions, cancellable }: BookingStatusActionsProps) {
  const t = useTranslations('admin.bookings');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();

  const [reason, setReason] = useState('');
  const [byProvider, setByProvider] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const statusAction = useAction(setBookingStatus, { onSuccess: () => router.refresh() });
  const cancelAction = useAction(cancelBooking, {
    onSuccess: () => {
      setDialogOpen(false);
      router.refresh();
    },
  });

  const busy = statusAction.status === 'executing' || cancelAction.status === 'executing';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {transitions.map((next) => (
          <Button
            key={next}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => statusAction.execute({ id, status: next })}
          >
            {tRoot(`status.booking.${bookingStatusKey(next)}` as MessageKey)}
          </Button>
        ))}

        {cancellable ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDialogOpen(true)}>
            {t('cancelCta')}
          </Button>
        ) : null}
      </div>

      <ActionError error={statusAction.result.serverError} t={tRoot} />

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('overrideNotice')}</AlertDialogDescription>
          </AlertDialogHeader>

          <div className="flex flex-col gap-3">
            <label htmlFor="booking-cancel-reason" className="text-label uppercase text-content-secondary">
              {t('cancelReasonLabel')}
            </label>
            <textarea
              id="booking-cancel-reason"
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
              {tRoot('status.booking.cancelledByProvider')}
            </label>

            <ActionError error={cancelAction.result.serverError} t={tRoot} />

            {cancelAction.result.data ? (
              <p role="status" className="text-body-sm text-content-secondary">
                {t('feeNotice', { amount: cancelAction.result.data.fee })}
                {' · '}
                {t('refundNotice', { amount: cancelAction.result.data.refund })}
              </p>
            ) : null}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || reason.trim().length < 3}
              onClick={(event) => {
                event.preventDefault();
                cancelAction.execute({ id, reason, byProvider });
              }}
            >
              {t('cancelCta')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function bookingStatusKey(status: BookingStatus): string {
  return status.toLowerCase().replace(/_(.)/g, (_, letter: string) => letter.toUpperCase());
}

/* ─────────────────────────────── Выплата ─────────────────────────────── */

export function PayoutActions({ id }: { id: string }) {
  const t = useTranslations('admin.payouts');
  const tRoot = useTranslations() as unknown as Translate;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { execute, status, result } = useAction(releasePayout, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  const busy = status === 'executing';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="accent" size="sm" disabled={busy} onClick={() => setOpen(true)}>
        {tRoot('admin.actions.release')}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => execute({ id, hold: true })}
      >
        {tRoot('admin.actions.hold')}
      </Button>

      <ActionError error={result.serverError} t={tRoot} />

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('releaseTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('releaseBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tRoot('common.actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                execute({ id, hold: false });
              }}
            >
              {tRoot('admin.actions.release')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ──────────────────────────── Ошибка действия ──────────────────────────── */

interface ActionErrorProps {
  error: { messageKey: string; params?: Record<string, string | number> } | undefined;
  t: Translate;
}

/** Одно место, где ошибка действия превращается в текст. */
export function ActionError({ error, t }: ActionErrorProps) {
  if (!error) return null;

  return (
    <p role="alert" className="text-body-sm font-semibold text-content-danger">
      {t(error.messageKey as MessageKey, error.params)}
    </p>
  );
}
