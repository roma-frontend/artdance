/**
 * TIME SLOT PICKER — свободное время на выбранную дату.
 *
 * Слот — это время суток (`HH:mm`) плюс признак доступности, а не момент: дата
 * уже выбрана в календаре, и дублировать её в каждом слоте значит однажды
 * получить рассинхрон между сеткой и заголовком. Арифметика — через
 * `lib/time/clock.ts`, поэтому конец занятия («18:00 → 19:30») считается одной
 * функцией и одинаково здесь, в сводке, в письме и в `.ics`.
 *
 * **Недоступный слот остаётся на экране зачёркнутым, а не исчезает.** Это из
 * макета, и это правильно: пустая сетка не отвечает на вопрос «а когда вообще
 * бывает», а зачёркнутые 10:00 и 11:30 показывают, что день рабочий и занят.
 * Такие слоты — `<button disabled>`, а не `<div>`: скринридер обязан сообщить,
 * что цель недоступна, и получить это можно только из настоящей кнопки.
 *
 * **`aria-pressed`, а не `aria-selected`.** Роль `option` требует родителя
 * `listbox` со всей его моделью навигации; здесь же группа кнопок-переключателей,
 * и `aria-pressed` описывает её честно.
 *
 * **Состояние «только что заняли» отдельно от «недоступно».** Слот, который
 * увели из-под пользователя в момент оформления, — самая частая ошибка
 * бронирования, и она не должна выглядеть как обычный серый прямоугольник:
 * рядом появляется объяснение (`booking.conflictError`).
 *
 * Доступность слотов НЕ кешируется (`dataRevalidate.availability = 0`):
 * устаревший ответ означает двойную бронь. Компонент только отображает то, что
 * ему передали, и ничего не запоминает.
 */

'use client';

import { useFormatter, useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { booking } from '@/config';
import { shiftClock } from '@/lib/time/clock';
import { cn } from '@/lib/utils';

export interface TimeSlot {
  /** Начало в формате `HH:mm`, 24 часа. */
  start: string;
  available: boolean;
}

interface TimeSlotPickerProps {
  slots: readonly TimeSlot[];
  selected?: string | undefined;
  onSelect(start: string): void;
  /** Дата слотов — только для заголовка списка. */
  date?: Date | undefined;
  /** Длительность занятия: из неё считается конец слота. */
  durationMinutes?: number;
  loading?: boolean;
  /**
   * Слот, занятый другим клиентом секунду назад. Показывается недоступным с
   * объяснением, а не молча исчезает из сетки.
   */
  justTaken?: string | null;
  className?: string;
}

export function TimeSlotPicker({
  slots,
  selected,
  onSelect,
  date,
  durationMinutes = booking.defaultDurationMinutes,
  loading = false,
  justTaken,
  className,
}: TimeSlotPickerProps) {
  const t = useTranslations();
  const format = useFormatter();

  const headingId = 'time-slot-picker-heading';

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-labelledby={headingId}>
      <h3 id={headingId} className="text-body-sm font-semibold">
        {date
          ? t('booking.availableTimes', { date: format.dateTime(date, 'dayWithWeekday') })
          : t('common.actions.selectTime')}
      </h3>

      {loading ? (
        /* Шесть ячеек — столько же, сколько слотов в типичном дне: сетка не прыгает. */
        <div className="grid grid-cols-3 gap-2" aria-busy>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-full" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        /*
         * Пустое состояние текстом, а не `EmptyState`: тот рисует крупный блок с
         * пунктирной рамкой на всю ширину, и в узкой колонке рядом с календарём
         * он перевешивает сам календарь. Причина и выход при этом на месте.
         */
        <div role="status" className="rounded-lg border border-dashed border-border-default p-6">
          <p className="text-body-sm font-semibold">{t('booking.noSlots')}</p>
          <p className="text-caption mt-1 text-content-secondary">{t('booking.noSlotsHint')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => {
              const taken = justTaken === slot.start;
              const unavailable = !slot.available || taken;
              const isSelected = selected === slot.start && !unavailable;
              const end = shiftClock(slot.start, durationMinutes);

              return (
                <button
                  key={slot.start}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={isSelected}
                  /*
                   * Доступное имя — весь интервал, а не только начало: «18:00»
                   * без длительности не говорит, до какого времени человек
                   * занят. Видимая подпись остаётся короткой, как в макете.
                   */
                  aria-label={t('booking.timeRange', { start: slot.start, end })}
                  onClick={() => onSelect(slot.start)}
                  className={cn(
                    'text-caption rounded-md border px-3 py-3 text-center font-medium tabular-nums',
                    'transition-colors duration-normal ease-brand',
                    isSelected
                      ? 'border-accent bg-accent font-semibold text-content-on-accent shadow-md'
                      : unavailable
                        ? 'border-border-default text-content-tertiary line-through'
                        : 'border-border-default text-content-primary hover:border-accent hover:bg-accent-soft hover:text-content-accent',
                    unavailable && 'cursor-not-allowed',
                  )}
                >
                  {slot.start}
                </button>
              );
            })}
          </div>

          {hasJustTakenSlot(justTaken, slots) && (
            <p role="alert" className="text-caption font-semibold text-content-signal">
              {t('booking.conflictError')}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/** Есть ли среди показанных слотов тот, который только что заняли. */
function hasJustTakenSlot(
  justTaken: string | null | undefined,
  slots: readonly TimeSlot[],
): boolean {
  return Boolean(justTaken) && slots.some((slot) => slot.start === justTaken);
}
