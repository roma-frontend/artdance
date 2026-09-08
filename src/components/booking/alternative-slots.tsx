/**
 * ALTERNATIVE SLOTS — «мест нет» превращается в предложение.
 *
 * Фича C-02 бэклога и самая дешёвая выручка в продукте: человек, дошедший до
 * заполненной группы, уже выбрал направление, инструктора, зал и согласился с
 * ценой. Тупик на этом шаге — потерянный клиент, которого не нужно привлекать
 * заново.
 *
 * **Почему запрос из браузера, а не пропсом с сервера.** Страница занятия
 * статическая: она собирается заранее и отдаётся из CDN. Доступность, вшитая в
 * такой HTML, замёрзнет на момент сборки и начнёт предлагать время, занятое
 * неделю назад. Поэтому времена приходят из `GET /api/availability`, который
 * никогда не кешируется, а страница остаётся кешируемой целиком.
 *
 * **Отказ не шумит.** Не ответивший эндпоинт, пустая выдача и неизвестный
 * инструктор дают одно и то же: блока нет. Это дополнение к экрану, а не его
 * содержимое — сообщение об ошибке загрузки альтернатив только запутало бы
 * человека, который и так узнал, что мест нет. Дальше он видит лист ожидания.
 *
 * **Скелет держит высоту.** Без него блок появляется через сеть и сдвигает вниз
 * кнопку записи в лист ожидания — ровно в тот момент, когда по ней целятся.
 *
 * **Дата форматируется локалью.** Сервер отдаёт момент в ISO: «сб, 19 сент.» на
 * трёх языках выглядит по-разному, а формат `dayWithWeekday` описан один раз в
 * конфигурации next-intl.
 */

'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';

import { Skeleton } from '@/components/ui/skeleton';
import { apiRoutes, limits, routes } from '@/config';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import type { AlternativeSlot } from '@/server/content/booking';

interface AlternativeSlotsProps {
  instructorSlug: string;
  /** Сколько времён запросить. По умолчанию — предел из бизнес-правил. */
  count?: number;
  className?: string;
}

interface AvailabilityPayload {
  slots?: readonly AlternativeSlot[];
}

export function AlternativeSlots({
  instructorSlug,
  count = limits.alternativeSlots,
  className,
}: AlternativeSlotsProps) {
  const t = useTranslations('booking');
  const format = useFormatter();

  const [slots, setSlots] = useState<readonly AlternativeSlot[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /*
     * Запрос отменяется при уходе со страницы: ответ, пришедший в размонтированный
     * компонент, — это предупреждение в консоли и утечка обработчика.
     */
    const controller = new AbortController();

    const params = new URLSearchParams({ instructor: instructorSlug, count: String(count) });

    void (async () => {
      try {
        const response = await fetch(`${apiRoutes.availability()}?${params.toString()}`, {
          signal: controller.signal,
          /* Доступность не кешируется ни на сервере, ни здесь. */
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(String(response.status));

        const payload = (await response.json()) as AvailabilityPayload;
        setSlots(payload.slots ?? []);
      } catch {
        /* Тишина осознанная: см. шапку. Блок просто не появляется. */
        setSlots([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [count, instructorSlug]);

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-2', className)} aria-busy>
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: count }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!slots || slots.length === 0) return null;

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div>
        <h3 className="text-body-sm font-semibold">{t('alternativesTitle')}</h3>
        <p className="text-caption mt-1 text-content-secondary">{t('alternativesHint')}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {slots.map((slot) => (
          <li key={slot.startIso}>
            {/*
              Ссылка, а не кнопка: это переход на экран бронирования, который
              обязан открываться в новой вкладке и попадать в историю.
            */}
            <Link
              href={routes.instructorBooking(instructorSlug)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md border border-border-default px-4 py-3',
                'transition-colors duration-normal ease-brand',
                'hover:border-accent hover:bg-accent-soft hover:text-content-accent',
              )}
            >
              <span className="text-body-sm font-medium">
                {format.dateTime(new Date(slot.startIso), 'dayWithWeekday')}
              </span>
              <span className="text-caption tabular-nums text-content-secondary">
                {t('timeRange', { start: slot.startTime, end: slot.endTime })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
