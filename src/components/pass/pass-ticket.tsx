'use client';

/**
 * PASS TICKET — красивый билет пропуска (QR + перфорация + статусы).
 * Дизайн: светлый билет на тёмном «конверте», как театральный билет — дорого и читаемо.
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type QrState = 'ready' | 'checkedIn' | 'expired' | 'invalid' | 'cancelled';

export function PassTicket({
  statusLabel,
  reference,
  startsText,
  endsText,
  venueText,
  instructorText,
  qrSvg,
  qrRef,
  qrState,
  checkedInAtText,
  onCopyRef,
  onPrint,
  icsHref,
  addToCalendarLabel,
  myBookingsLabel,
  myBookingsHref,
  footerTip,
  cancelledHint,
  checkedInLabel,
  passTitle,
  bookingLabel,
  startsLabel,
  endsLabel,
  venueLabel,
  instructorLabel,
  expiredLabel,
  copyLabel,
  printLabel,
  bookingTitle,
}: {
  statusLabel: string;
  reference: string;
  startsText: string;
  endsText: string;
  venueText?: string | null;
  instructorText?: string | null;
  qrSvg: string;
  qrRef: string;
  qrState: QrState;
  checkedInAtText?: string | null;
  onCopyRef?: string;
  onPrint?: string;
  icsHref: string;
  addToCalendarLabel: string;
  myBookingsLabel: string;
  myBookingsHref: string;
  footerTip: string;
  cancelledHint?: string | null;
  checkedInLabel?: string;
  passTitle?: string;
  bookingLabel?: string;
  startsLabel?: string;
  endsLabel?: string;
  venueLabel?: string;
  instructorLabel?: string;
  expiredLabel?: string;
  copyLabel?: string;
  printLabel?: string;
  bookingTitle?: string | null;
}) {
  const isUsed = qrState === 'checkedIn';
  const isBad = qrState === 'expired' || qrState === 'invalid' || qrState === 'cancelled';

  return (
    <div className="mx-auto max-w-prose" data-pass-ticket-wrap>
      <div
        data-pass-ticket
        className="overflow-hidden rounded-2xl border border-border-default bg-surface-card shadow-xl"
      >
        {/* Header: бренд + статус */}
        <div className="flex items-center justify-between gap-3 bg-surface-sunken px-6 py-4">
          <div className="min-w-0">
            <p className="text-caption font-semibold tracking-widest text-content-tertiary uppercase">ArtDance</p>
            <p className="truncate text-heading-3 leading-none">{passTitle ?? 'Entry pass'}</p>
          </div>
          <Badge variant={isUsed ? 'metal' : isBad ? 'warning' : 'success'} size="md" className="shrink-0">
            {statusLabel}
          </Badge>
        </div>

        {/* Тонкая золотая нить */}
        <div aria-hidden className="h-px w-full bg-accent/20" />

        {/* Название брони — заголовок билета (h1 страницы) */}
        {bookingTitle ? (
          <div className="px-6 pt-4">
            <h1 className="text-heading-3 leading-tight">{bookingTitle}</h1>
          </div>
        ) : null}

        {/* Детали */}
        <div className="px-6 pt-5">
          <dl className="grid grid-cols-2 gap-4 text-body-sm">
            <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg bg-surface-sunken px-3 py-2.5">
              <dt className="text-content-tertiary">{bookingLabel ?? 'Booking'}</dt>
              <dd className="font-mono text-sm font-semibold tracking-wide">{reference}</dd>
            </div>
            <div>
              <dt className="text-caption text-content-tertiary">{startsLabel ?? 'Starts'}</dt>
              <dd className="mt-1 font-semibold">{startsText}</dd>
            </div>
            <div>
              <dt className="text-caption text-content-tertiary">{endsLabel ?? 'Ends'}</dt>
              <dd className="mt-1 font-semibold">{endsText}</dd>
            </div>
            {venueText ? (
              <div className="col-span-2">
                <dt className="text-caption text-content-tertiary">{venueLabel ?? 'Venue'}</dt>
                <dd className="mt-1 font-medium">{venueText}</dd>
              </div>
            ) : null}
            {instructorText ? (
              <div className="col-span-2">
                <dt className="text-caption text-content-tertiary">{instructorLabel ?? 'Instructor'}</dt>
                <dd className="mt-1 font-medium">{instructorText}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {/* Перфорация + QR */}
        <div className="relative mt-6">
          {/* верхняя перфорация */}
          <div aria-hidden className="absolute -top-2 left-0 right-0 flex justify-between gap-3 px-2">
            <span className="size-4 -translate-y-1/2 rounded-full bg-surface-sunken ring-1 ring-border-default" />
            <span className="size-4 -translate-y-1/2 rounded-full bg-surface-sunken ring-1 ring-border-default" />
          </div>
          <div className="mx-3 rounded-xl border border-dashed border-border-default bg-surface-sunken p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div
                className="relative overflow-hidden rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5"
                style={{ width: 208, height: 208 }}
                aria-hidden
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="font-mono text-caption font-semibold tracking-widest text-content-secondary">{qrRef}</p>
              {qrState === 'checkedIn' ? (
                <p className="rounded-full bg-metal-soft px-3 py-1 text-caption font-semibold text-content-metal">
                  {checkedInLabel ?? 'Checked in'} {checkedInAtText ? `· ${checkedInAtText}` : ''}
                </p>
              ) : null}
              {qrState === 'expired' ? (
                <p className="rounded-full bg-warning-soft px-3 py-1 text-caption font-semibold text-content-warning">{expiredLabel ?? 'Expired'}</p>
              ) : null}
              {qrState === 'cancelled' && cancelledHint ? (
                <p className="text-caption text-content-tertiary">{cancelledHint}</p>
              ) : null}
              <p className="max-w-[36ch] text-caption leading-relaxed text-content-tertiary">{footerTip}</p>
            </div>
          </div>
          {/* нижняя перфорация */}
          <div aria-hidden className="absolute -bottom-2 left-0 right-0 flex justify-between px-2">
            <span className="size-4 translate-y-1/2 rounded-full bg-surface-sunken ring-1 ring-border-default" />
            <span className="size-4 translate-y-1/2 rounded-full bg-surface-sunken ring-1 ring-border-default" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 px-6 py-6 print:hidden">
          <Button asChild variant="accent">
            <a href={icsHref}>{addToCalendarLabel}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={myBookingsHref}>{myBookingsLabel}</a>
          </Button>
          {onCopyRef ? (
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard?.writeText(qrRef);
              }}
            >
              {copyLabel ?? 'Copy code'}
            </Button>
          ) : null}
          {onPrint ? (
            <Button variant="outline" onClick={() => window.print()}>
              {printLabel ?? 'Print'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
