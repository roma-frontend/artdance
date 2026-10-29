'use client';

/**
 * BOOKING REQUEST ACTIONS — ответ инструктора на заявку на бронь (D-04).
 *
 * «Принять» делается одним нажатием. «Отклонить» сначала открывает причину для клиента
 * и только потом подтверждение: отказ отменяет бронь и освобождает место, поэтому одним
 * лишним кликом его делать не должны. Решение уходит в POST /api/studio/bookings/{id}/respond;
 * при успехе страница перечитывается, и заявка пропадает из списка.
 */

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { apiRoutes } from '@/config';
import { useRouter } from '@/i18n/routing';

/** Совпадает с лимитом сервера: более длинная причина API отклонит. */
const REASON_MAX_LENGTH = 500;

type Decision = 'ACCEPT' | 'DECLINE';

export function BookingRequestActions({ bookingId }: { bookingId: string }) {
  const t = useTranslations('studio.requests');
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState<Decision | null>(null);
  const [failed, setFailed] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();

  const busy = sending !== null || isRefreshing;

  async function respond(decision: Decision) {
    setSending(decision);
    setFailed(false);
    try {
      const trimmedReason = reason.trim();
      const response = await fetch(apiRoutes.studioBookingRespond(bookingId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          decision === 'DECLINE' && trimmedReason ? { decision, reason: trimmedReason } : { decision },
        ),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      setFailed(true);
    } finally {
      setSending(null);
    }
  }

  const errorNotice = failed ? (
    <p role="alert" className="text-body-sm font-medium text-content-danger">
      {t('error')}
    </p>
  ) : null;

  if (declining) {
    return (
      <div className="flex w-full flex-col gap-3 sm:w-80">
        <div className="flex flex-col gap-2">
          <label htmlFor={`booking-reason-${bookingId}`} className="text-body-sm font-medium text-content-secondary">
            {t('reasonLabel')}
          </label>
          <textarea
            id={`booking-reason-${bookingId}`}
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
            className="form-input resize-y"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            pending={sending === 'DECLINE'}
            disabled={busy}
            onClick={() => respond('DECLINE')}
          >
            {t('confirmDecline')}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setDeclining(false)}>
            {t('back')}
          </Button>
        </div>
        {errorNotice}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="accent"
          size="sm"
          pending={sending === 'ACCEPT'}
          disabled={busy}
          onClick={() => respond('ACCEPT')}
        >
          {t('accept')}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setDeclining(true)}>
          {t('decline')}
        </Button>
      </div>
      {errorNotice}
    </div>
  );
}
