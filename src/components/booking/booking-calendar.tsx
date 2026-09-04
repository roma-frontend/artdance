/**
 * BOOKING CALENDAR — выбор даты занятия.
 *
 * **Почему на `react-day-picker`, а не своей сеткой.** Своя сетка из семи
 * колонок пишется за час, но вместе с ней пишется и всё остальное: перемещение
 * стрелками с переносом на соседнюю неделю, `role="grid"` с одной точкой входа в
 * табуляции (roving tandindex), названия месяцев и дней в трёх локалях, неделя с
 * понедельника, границы месяца, недоступные дни. Это несколько дней работы и
 * ровно та часть, где ошибки доступности не видны глазом. Библиотека уже в
 * зависимостях, обёртка `ui/calendar.tsx` уже стоит в проекте — второй календарь
 * был бы вторым способом делать одно и то же.
 *
 * Внешний вид при этом целиком наш: вендорная обёртка рассчитана на компактный
 * календарь в поповере, а в макете это сетка во всю ширину колонки с крупными
 * ячейками. Поэтому переопределены `classNames` — не патчем вендорного файла
 * (его перезаписывает `shadcn add --overwrite`), а пропсом.
 *
 * **Горизонт и прошлое — из правил, а не из разметки.** Вперёд открыто
 * `booking.maxAdvanceDays`, назад закрыто всё: `disabled` собирается из
 * `booking`, и «откройте бронирование на полгода» — правка одной строки
 * конфигурации.
 *
 * **`availableDates` различает «не знаем» и «нет ничего».** `undefined` —
 * доступность не загружена или не фильтруется, выбирать можно любой день в
 * горизонте. Пустой массив — свободных дней нет, и это отдельное состояние с
 * объяснением, а не молча серый календарь.
 *
 * **Часовой пояс — бизнеса, а не устройства.** `site.timeZone`: человек,
 * открывший сайт из Москвы, должен видеть ереванские сутки, иначе «10 сентября»
 * у него и у инструктора — разные дни.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import type { Matcher } from 'react-day-picker';

import { Calendar } from '@/components/ui/calendar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { booking, site } from '@/config';
import { isLocale, localeMeta, type Locale } from '@/i18n/config';
import { dayPickerLocales } from '@/i18n/date-locales';
import { cn } from '@/lib/utils';

interface BookingCalendarProps {
  selected?: Date | undefined;
  onSelect(date: Date | undefined): void;
  /** Отображаемый месяц. Без него календарь ведёт его сам. */
  month?: Date;
  onMonthChange?(month: Date): void;
  /**
   * Дни, на которые есть свободные слоты. `undefined` — доступность неизвестна
   * (выбирается любой день в горизонте), `[]` — свободных дней нет.
   */
  availableDates?: readonly Date[] | undefined;
  loading?: boolean;
  /** Точка «сейчас». Параметром, чтобы тесты не зависели от даты запуска. */
  now?: Date;
  className?: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/** Полночь по часовому поясу бизнеса не нужна: сравнение идёт по календарным дням. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function BookingCalendar({
  selected,
  onSelect,
  month,
  onMonthChange,
  availableDates,
  loading = false,
  now = new Date(),
  className,
}: BookingCalendarProps) {
  const t = useTranslations('booking');
  const rawLocale = useLocale();
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'hy';

  const today = startOfDay(now);
  const horizon = startOfDay(new Date(today.getTime() + booking.maxAdvanceDays * MS_PER_DAY));

  /** Дни без доступности гасятся по ключу «год-месяц-день», а не по времени. */
  const availableKeys = useMemo(
    () => (availableDates ? new Set(availableDates.map((date) => dayKey(startOfDay(date)))) : null),
    [availableDates],
  );

  const disabled = useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = [{ before: today }, { after: horizon }];
    if (availableKeys) {
      matchers.push((date: Date) => !availableKeys.has(dayKey(startOfDay(date))));
    }
    return matchers;
  }, [availableKeys, horizon, today]);

  if (loading) {
    /*
     * Скелет повторяет геометрию календаря: шесть строк по семь ячеек. Иначе
     * после загрузки вёрстка прыгает на высоту сетки, и уже выбранное время
     * уезжает из-под курсора.
     */
    return (
      <div className={cn('flex flex-col gap-4', className)} aria-busy>
        <Skeleton className="h-9 w-40" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 42 }, (_, index) => (
            <Skeleton key={index} className="aspect-square w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (availableDates && availableDates.length === 0) {
    return (
      <EmptyState className={className} title={t('noSlots')} description={t('noSlotsHint')} />
    );
  }

  return (
    <Calendar
      mode="single"
      required={false}
      selected={selected}
      onSelect={onSelect}
      month={month}
      onMonthChange={onMonthChange}
      disabled={disabled}
      startMonth={today}
      endMonth={horizon}
      locale={dayPickerLocales[locale]}
      weekStartsOn={localeMeta[locale].firstDayOfWeek}
      timeZone={site.timeZone}
      /*
       * Дни соседних месяцев не показываются: в макете на их месте пустые
       * ячейки. Показанный, но недоступный день соседнего месяца читается как
       * «занято», а не как «другой месяц».
       */
      showOutsideDays={false}
      labels={{
        labelPrevious: () => t('previousMonth'),
        labelNext: () => t('nextMonth'),
      }}
      className={cn('w-full p-0', className)}
      classNames={{
        root: 'w-full',
        months: 'w-full',
        month: 'w-full gap-4',
        /* Подпись месяца слева, кнопки справа — как в прототипе. */
        month_caption: 'text-card-title flex h-11 items-center justify-start p-6',
        caption_label: 'text-card-title select-none',
        nav: 'absolute end-0 top-0 flex items-center gap-2',
        button_previous:
          'inline-flex size-9 items-center justify-center rounded-full border border-border-default p-0 text-content-primary transition-colors duration-normal ease-brand hover:border-accent hover:text-content-accent aria-disabled:opacity-40',
        button_next:
          'inline-flex size-9 items-center justify-center rounded-full border border-border-default p-0 text-content-primary transition-colors duration-normal ease-brand hover:border-accent hover:text-content-accent aria-disabled:opacity-40',
        weekdays: 'flex gap-1',
        weekday: 'text-eyebrow flex-1 py-3 text-center uppercase text-content-tertiary',
        week: 'mt-1 flex gap-1',
        day: 'group/day relative aspect-square flex-1 p-0 text-center',
        /*
         * Кнопка дня перекрывается целиком. Вендорная обёртка рисует её
         * вариантом `ghost`, а у нас `ghost` — это кнопка с акцентной рамкой и
         * акцентным текстом: тридцать таких ячеек превратили бы календарь в
         * решётку из тридцати кнопок «действие». В макете день — просто число,
         * которое реагирует на наведение, а выбранный — акцентная плашка.
         */
        day_button: cn(
          'flex size-full items-center justify-center rounded-md',
          'text-body-sm border-transparent bg-transparent font-normal normal-case tracking-normal',
          'text-content-primary shadow-none',
          'hover:bg-accent-soft hover:text-content-accent',
          'data-[selected-single=true]:bg-accent data-[selected-single=true]:font-bold',
          'data-[selected-single=true]:text-content-on-accent data-[selected-single=true]:shadow-md',
        ),
        /* Сегодня — обводка акцентом (в макете так помечен текущий день). */
        today: 'rounded-md border border-accent bg-transparent font-bold text-content-accent',
        disabled: 'text-content-disabled',
        hidden: 'invisible',
      }}
    />
  );
}
