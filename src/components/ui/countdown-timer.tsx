/**
 * COUNTDOWN TIMER — сколько осталось до истечения срока.
 *
 * Используется удержанием слота (`booking.holdTtlMinutes`), окном подтверждения
 * из листа ожидания и стартом события.
 *
 * **Срок считает сервер, отображает клиент.** Приходит `expiresAt` — момент, а
 * не «осталось 15 минут»: продолжительность, посчитанная на сервере и
 * отрисованная через две секунды, врёт уже на две секунды, а после минуты в
 * очереди — на минуту. Момент задержкой не портится.
 *
 * **Часы клиента могут быть неверны, и это принято.** Таймер — подсказка, а не
 * гарантия: истечение удержания определяет сервер по своим часам. Поэтому
 * `onExpire` не отменяет бронь, а просит интерфейс перечитать состояние.
 *
 * **До гидратации выводится прочерк.** Разница часов сервера и клиента даёт
 * разный текст в одном узле, а это ошибка гидратации React. Значение появляется
 * первым же клиентским кадром — визуально мгновенно.
 *
 * Обновление раз в секунду, а не через `requestAnimationFrame`: видимых
 * изменений одно в секунду, и шестьдесят пересчётов ради него — расход батареи
 * телефона на невидимое. По истечении таймер останавливается: считать дальше
 * нечего.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

import { useIsHydrated } from '@/lib/hooks/use-is-hydrated';
import { cn } from '@/lib/utils';

/** Состояние таймера. Текст и цвет рядом выбирает вызывающий компонент. */
export type CountdownState = 'running' | 'warning' | 'expired';

interface CountdownTimerProps {
  /** ISO-момент истечения из ответа сервера. */
  expiresAt: string;
  /** С этого остатка состояние становится `warning`. */
  warningAtSeconds?: number;
  /** Вызывается один раз при переходе через ноль. */
  onExpire?(): void;
  /** Сообщить состояние наружу: рамка карточки и подпись меняются вместе. */
  onStateChange?(state: CountdownState): void;
  className?: string;
}

const SECOND_MS = 1_000;
const SECONDS_PER_MINUTE = 60;

function secondsLeft(expiresAt: string, now: number): number {
  const target = new Date(expiresAt).getTime();
  /* Некорректная дата — то же, что истёкшая: интерфейс не должен ждать вечно. */
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.round((target - now) / SECOND_MS));
}

/**
 * `mm:ss` из остатка.
 *
 * Здесь НЕ используется `lib/time/clock.ts`: тот модуль форматирует время суток
 * («18:30» — половина седьмого вечера), а это длительность («18:30» —
 * восемнадцать с половиной минут). Одинаковый вид при разном смысле — как раз
 * повод не связывать их одной функцией.
 */
function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownTimer({
  expiresAt,
  warningAtSeconds = SECONDS_PER_MINUTE,
  onExpire,
  onStateChange,
  className,
}: CountdownTimerProps) {
  const hydrated = useIsHydrated();

  /*
   * Начальное значение считается инициализатором, а не эффектом. На сервере оно
   * тоже вычислится и разойдётся с клиентским, но в первый кадр не попадёт:
   * до гидратации рисуется прочерк. Зато сразу после неё виден точный остаток,
   * а не пустая секунда ожидания первого тика.
   */
  const [now, setNow] = useState(() => Date.now());

  const remaining = secondsLeft(expiresAt, now);
  const expired = remaining === 0;

  useEffect(() => {
    if (expired) return;
    const id = window.setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => window.clearInterval(id);
  }, [expired]);

  /* Уведомление ровно одно на срок: смена `expiresAt` открывает его заново. */
  const notified = useRef(false);
  useEffect(() => {
    notified.current = false;
  }, [expiresAt]);

  useEffect(() => {
    if (!expired || notified.current) return;
    notified.current = true;
    onExpire?.();
  }, [expired, onExpire]);

  const state: CountdownState = expired
    ? 'expired'
    : remaining <= warningAtSeconds
      ? 'warning'
      : 'running';

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  return (
    <time
      dateTime={expiresAt}
      data-state={state}
      /*
       * `aria-live` намеренно нет: секунды, объявляемые вслух, перекрывают всё
       * остальное на экране. О приближении конца сообщает подпись рядом
       * (`booking.holdNotice` / `holdExpired`), которая меняется один раз.
       */
      className={cn(
        'text-numeric tabular-nums',
        state === 'warning' && 'text-content-warning',
        state === 'expired' && 'text-content-danger',
        className,
      )}
    >
      {hydrated ? formatRemaining(remaining) : '—'}
    </time>
  );
}
