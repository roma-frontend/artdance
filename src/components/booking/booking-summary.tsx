/**
 * BOOKING SUMMARY — что именно бронируется, за сколько и на каких условиях.
 *
 * Правая колонка экрана бронирования: список «поле — значение», итог, действие и
 * условия отмены. На мобильном сетка схлопывается, и сводка уезжает под
 * календарь — итог с кнопкой в этом случае должен остаться на экране
 * (`StickyActionBar`, волна booking); сам компонент об этом не знает и работает
 * в любой колонке.
 *
 * **Неполная сводка — это состояние, а не пустой блок.** Пока не выбраны дата и
 * время, строки показывают прочерк, а кнопка отключена: пользователь видит, чего
 * не хватает, вместо того чтобы искать, почему кнопка ничего не делает.
 *
 * **Условия отмены берутся из `booking.freeCancellationHours`.** В макете это
 * текст «Free cancellation up to 24 hours before»; число из конфигурации, потому
 * что «поменяйте окно отмены с 24 на 12» — правка одной строки, а не поиск по
 * проекту. Для брони эти условия фиксируются в БД в момент операции: изменение
 * правила не должно переписывать историю уже созданных броней.
 *
 * **Удержание слота показывается таймером, а не обещанием.** `holdExpiresAt` —
 * момент с сервера; по его истечении кнопка гаснет и появляется
 * `booking.holdExpired`, потому что слот к этому времени уже свободен для других.
 * Освобождать его и перечитывать доступность — дело родительского экрана,
 * сводка только сообщает о событии (`onHoldExpired`).
 *
 * **Итог считается сложением через `domain/money.ts`**, а не в разметке: плата
 * за выезд — отдельная позиция заказа (`TRAVEL_FEE`), и складывать её с ценой
 * занятия нужно там же, где считаются все остальные деньги.
 */

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { CountdownTimer, type CountdownState } from '@/components/ui/countdown-timer';
import { Price } from '@/components/ui/price';
import { booking, type BookingLocationOption } from '@/config';
import { add, type Money } from '@/domain/money';
import { shiftClock } from '@/lib/time/clock';
import { cn } from '@/lib/utils';

interface BookingSummaryProps {
  classTitle?: string;
  instructorName?: string;
  date?: Date | undefined;
  /** Начало в `HH:mm`. Конец считается из длительности. */
  startTime?: string | undefined;
  durationMinutes?: number;
  location?: { option: BookingLocationOption; name?: string } | undefined;
  /** Цена занятия. Без неё сводка считается неполной. */
  fee?: Money | undefined;
  /** Плата за выезд, если выбран адрес клиента. */
  travelFee?: Money;
  /** ISO-момент истечения удержания слота с сервера. */
  holdExpiresAt?: string | null;
  onHoldExpired?(): void;
  onContinue?(): void;
  /** Отправка идёт: кнопка блокируется, чтобы не создать две брони. */
  submitting?: boolean;
  className?: string;
}

/** Прочерк вместо пустой строки: незаполненное поле должно быть видно. */
const PLACEHOLDER = '—';

export function BookingSummary({
  classTitle,
  instructorName,
  date,
  startTime,
  durationMinutes = booking.defaultDurationMinutes,
  location,
  fee,
  travelFee = 0,
  holdExpiresAt,
  onHoldExpired,
  onContinue,
  submitting = false,
  className,
}: BookingSummaryProps) {
  const t = useTranslations();
  const format = useFormatter();

  const [holdState, setHoldState] = useState<CountdownState>('running');
  const holdExpired = Boolean(holdExpiresAt) && holdState === 'expired';

  const complete = Boolean(date && startTime && fee !== undefined);
  const total = fee === undefined ? undefined : add(fee, travelFee);

  const locationLabel = location
    ? location.option === 'STUDIO'
      ? (location.name ?? t('booking.locationStudio'))
      : location.option === 'CUSTOMER_LOCATION'
        ? t('booking.locationCustomer')
        : t('booking.locationOnline')
    : undefined;

  return (
    <aside
      className={cn(
        'flex flex-col rounded-xl border border-border-default bg-surface-card p-8 shadow-lg',
        className,
      )}
    >
      <h2 className="text-card-title mb-4">{t('booking.summaryTitle')}</h2>

      {/*
        `<dl>`, а не строки из двух `<span>`: пара «поле — значение» должна
        читаться скринридером парой, иначе «Дата» и «сб, 7 сент.» звучат как два
        независимых куска текста.
      */}
      <dl className="flex flex-col">
        <SummaryRow label={t('booking.summaryClass')} value={classTitle} />
        <SummaryRow label={t('booking.summaryInstructor')} value={instructorName} />
        <SummaryRow
          label={t('booking.summaryDate')}
          value={date ? format.dateTime(date, 'dayWithWeekday') : undefined}
        />
        <SummaryRow
          label={t('booking.summaryTime')}
          value={
            startTime
              ? t('booking.timeRange', {
                  start: startTime,
                  end: shiftClock(startTime, durationMinutes),
                })
              : undefined
          }
        />
        <SummaryRow
          label={t('booking.summaryDuration')}
          value={t('common.units.minutes', { count: durationMinutes })}
        />
        <SummaryRow label={t('booking.summaryLocation')} value={locationLabel} />
        <SummaryRow
          label={t('booking.summaryFee')}
          value={fee === undefined ? undefined : format.number(fee, 'price')}
        />
        {/* Выезд показывается строкой только когда он выбран и стоит денег. */}
        {travelFee > 0 && (
          <SummaryRow
            label={t('booking.locationCustomer')}
            value={format.number(travelFee, 'price')}
          />
        )}
      </dl>

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border-default pt-3">
        <span className="text-body-sm font-bold">{t('common.labels.total')}</span>
        {total === undefined ? (
          <span className="text-price text-content-tertiary">{PLACEHOLDER}</span>
        ) : (
          <Price amount={total} emphasis="total" />
        )}
      </div>

      {holdExpiresAt && (
        <p
          className={cn(
            'text-caption mt-4 flex items-center justify-between gap-2 rounded-md px-3 py-2',
            holdExpired
              ? 'bg-danger-soft text-content-danger'
              : 'bg-accent-soft text-content-secondary',
          )}
        >
          <span>
            {holdExpired
              ? t('booking.holdExpired')
              : t('booking.holdNotice', {
                  minutes: t('common.units.minutes', { count: booking.holdTtlMinutes }),
                })}
          </span>
          {!holdExpired && (
            <CountdownTimer
              expiresAt={holdExpiresAt}
              onExpire={onHoldExpired}
              onStateChange={setHoldState}
              className="shrink-0"
            />
          )}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        block
        disabled={!complete || submitting || holdExpired}
        onClick={onContinue}
        className="mt-5"
      >
        {t('booking.continueCta')}
      </Button>

      <p className="text-caption mt-3 text-center text-content-tertiary">
        {t('booking.cancellationNote', {
          hours: t('common.units.hours', { count: booking.freeCancellationHours }),
        })}
      </p>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="text-body-sm flex items-baseline justify-between gap-4 py-2">
      <dt className="text-content-secondary">{label}</dt>
      <dd className={cn('text-right font-medium', value === undefined && 'text-content-tertiary')}>
        {value ?? PLACEHOLDER}
      </dd>
    </div>
  );
}
