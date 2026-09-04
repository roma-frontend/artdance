/**
 * BOOKING SCREEN — сборка экрана бронирования.
 *
 * Слева календарь и слоты, справа сводка. Компонент держит одно состояние на
 * четырёх участников (`BookingCalendar`, `TimeSlotPicker`,
 * `LocationOptionPicker`, `BookingSummary`) и ничего не считает сам: суммы —
 * `domain/money.ts`, время — `lib/time/clock.ts`, правила — `config/business.ts`.
 *
 * **Выбор слота начинает удержание.** Слот держится `booking.holdTtlMinutes`, и
 * это видно таймером в сводке, а не обещанием в тексте. Смена времени начинает
 * отсчёт заново: держится ровно один слот.
 *
 * **Истечение удержания ничего не отменяет молча.** Кнопка гаснет, появляется
 * `booking.holdExpired`, и человек выбирает время снова — вместо того чтобы
 * узнать о потере слота на шаге оплаты. Часы браузера могут быть неверны, поэтому
 * таймер — уведомление, а не решение: освобождает слот сервер.
 *
 * **Что здесь заглушка.** Удержание создаётся в браузере, а не запросом
 * `POST /api/booking/hold`: гонку за слот решает уникальный индекс `SlotHold` в
 * БД, и это задача волны booking. По той же причине смена даты не перечитывает
 * доступность — она приходит одним набором на весь экран. Оба шва помечены
 * `TODO(booking)` и не требуют правок компонентов, только источник данных.
 */

'use client';

import { useState } from 'react';

import { BookingCalendar } from '@/components/booking/booking-calendar';
import { BookingSummary } from '@/components/booking/booking-summary';
import { LocationOptionPicker } from '@/components/booking/location-option-picker';
import { TimeSlotPicker } from '@/components/booking/time-slot-picker';
import { booking, routes, type BookingLocationOption } from '@/config';
import { useRouter } from '@/i18n/routing';
import type { BookingContent } from '@/server/content/booking';

interface BookingScreenProps {
  content: BookingContent;
}

export function BookingScreen({ content }: BookingScreenProps) {
  const router = useRouter();

  const [date, setDate] = useState<Date | undefined>(() => new Date(content.earliestDateIso));
  const [startTime, setStartTime] = useState<string | undefined>(
    content.preselectedSlot ?? undefined,
  );
  const [location, setLocation] = useState<BookingLocationOption>('STUDIO');

  /**
   * Момент истечения удержания. Пока слот не выбран — удержания нет, и таймера в
   * сводке тоже: обратный отсчёт без предмета отсчёта только пугает.
   *
   * TODO(booking): момент приходит из ответа `POST /api/booking/hold`, который
   * создаёт `SlotHold`. Локальный расчёт — заглушка того же формата (ISO).
   */
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(() =>
    content.preselectedSlot ? holdUntil() : null,
  );

  const selectSlot = (start: string) => {
    setStartTime(start);
    /* Новый выбор — новое удержание: держится ровно один слот. */
    setHoldExpiresAt(holdUntil());
  };

  const selectDate = (next: Date | undefined) => {
    setDate(next);
    /*
     * Смена даты сбрасывает время: «18:00» от другого дня — самый простой способ
     * забронировать не то, что человек видел на экране.
     */
    setStartTime(undefined);
    setHoldExpiresAt(null);
  };

  const travelFee = location === 'CUSTOMER_LOCATION' ? booking.travelFee : 0;

  return (
    <div className="booking-detail-grid">
      <div className="flex flex-col gap-6">
        {/*
          Календарь и слоты — один блок: выбор даты без видимого результата
          выглядит как несработавшее нажатие.
        */}
        <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-md md:p-8">
          <BookingCalendar selected={date} onSelect={selectDate} />

          <div className="mt-6 border-t border-border-default pt-6">
            <TimeSlotPicker
              slots={content.slots}
              selected={startTime}
              onSelect={selectSlot}
              date={date}
              durationMinutes={content.durationMinutes}
            />
          </div>
        </div>

        <LocationOptionPicker
          value={location}
          onChange={setLocation}
          studioName={content.studioName}
          acceptsTravel={content.acceptsTravel}
          acceptsOnline={content.acceptsOnline}
        />
      </div>

      <BookingSummary
        classTitle={content.classTitle}
        instructorName={content.instructorName}
        date={date}
        startTime={startTime}
        durationMinutes={content.durationMinutes}
        location={{ option: location, name: content.studioName }}
        fee={content.fee}
        travelFee={travelFee}
        holdExpiresAt={holdExpiresAt}
        /*
         * Оплата брони идёт через то же оформление, что и заказ: один поток
         * оплаты, один набор способов, один webhook.
         */
        onContinue={() => router.push(routes.checkout())}
      />
    </div>
  );
}

/** Момент истечения удержания слота в формате ISO. */
function holdUntil(): string {
  return new Date(Date.now() + booking.holdTtlMinutes * 60_000).toISOString();
}
