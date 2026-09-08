/**
 * ПОЛИТИКА БРОНИ — отмена, перенос, возврат.
 *
 * Задачи 3.6 и 3.7 плана. Здесь решается, что произойдёт с деньгами, и это самое
 * спорное место продукта: клиент помнит «бесплатная отмена за сутки», инструктор
 * помнит «я держал зал», а платформа обязана ответить одинаково обоим.
 *
 * **Условия берутся из снимка брони, а не из конфигурации.** Это жёсткое правило
 * проекта: `Booking.cancellationWindowHours` и `Booking.lateCancellationRate`
 * пишутся в БД в момент бронирования. Если завтра заказчик поменяет окно отмены с
 * 24 часов на 12, вчерашние брони обязаны решаться по вчерашним условиям —
 * иначе спор невозможно закрыть, а прошлое переписывается правкой конфига.
 * Поэтому ни один импорт из `config/business.ts` в этом файле не нужен: числа
 * приходят снимком.
 *
 * **Функции ничего не бросают, а возвращают исход.** Отмена — это не ошибка, а
 * развилка: бесплатно, с удержанием или нельзя. Экрану нужно показать разницу
 * («удержим 50%») ДО того, как человек нажмёт кнопку, и для этого исход должен
 * быть значением. Исключение бросает только `refundAmountFor`: считать возврат по
 * запрещённой отмене — это ошибка вызывающего кода, а не выбор пользователя.
 *
 * **Округление — через `domain/money.ts`.** Удержание 50% от 12 000 ֏ должно дать
 * 6 000 ֏ и в сводке на экране, и в возврате провайдеру, и в отчёте: одно
 * округление в одном месте.
 *
 * `now` всегда параметром — тесты не зависят от даты запуска.
 */

import type { BookingStatus } from '@/domain/enums';
import { domainErrors } from '@/domain/errors';
import { applyRate, clampNonNegative, subtract, type Money } from '@/domain/money';
import type { MessageKey } from '@/i18n/types';
import { isValidInterval, type Interval } from '@/lib/time/interval';

const MS_PER_HOUR = 60 * 60 * 1_000;

/**
 * Снимок брони — ровно те поля, которые нужны решению, и ни одного больше.
 *
 * Не `Booking` из Prisma: домен не должен знать про связи, идентификаторы и
 * форматы БД, иначе его нельзя протестировать без базы, а тесты правил
 * бронирования обязательны.
 */
export interface BookingSnapshot {
  startsAt: Date;
  status: BookingStatus;
  /** Итоговая стоимость брони, зафиксированная при создании. */
  totalPrice: Money;
  /** Окно бесплатной отмены в часах — из снимка брони. */
  cancellationWindowHours: number;
  /** Доля удержания при поздней отмене (0.5 = 50%) — из снимка брони. */
  lateCancellationRate: number;
  /** Окно бесплатного переноса в часах — из снимка брони. */
  rescheduleWindowHours: number;
  /** Сколько переносов уже сделано. */
  rescheduleCount: number;
  /** Предел переносов, зафиксированный при создании брони. */
  maxReschedules: number;
}

/**
 * Статусы, из которых бронь ещё можно отменить или перенести.
 *
 * `RESCHEDULED` в список не входит: эта запись — история, актуальна её замена.
 * `WAITLISTED` тоже: место ещё не выдано, из листа ожидания выходят, а не
 * отменяют бронь.
 */
const activeStatuses: readonly BookingStatus[] = ['PENDING', 'CONFIRMED'];

export type CancellationRefusal =
  /** Занятие уже началось или прошло. */
  | 'ALREADY_STARTED'
  /** Бронь уже не активна: отменена, завершена, истекла, перенесена. */
  | 'NOT_ACTIVE';

export type CancellationOutcome =
  | { kind: 'free' }
  | { kind: 'fee'; rate: number; amount: Money }
  | { kind: 'forbidden'; reason: CancellationRefusal };

/**
 * Что будет, если отменить бронь сейчас.
 *
 * Порядок проверок важен: сначала «эту бронь вообще можно отменить», потом
 * «началось ли занятие», и только потом окно. Иначе завершённая бронь получала бы
 * ответ «удержим 50%» вместо «отменять нечего».
 *
 * Граница окна включительна: отмена ровно за 24 часа — бесплатная. Спорную минуту
 * платформа отдаёт клиенту осознанно, а не по случайности сравнения.
 */
export function cancellationOutcome(booking: BookingSnapshot, now: Date): CancellationOutcome {
  if (!activeStatuses.includes(booking.status)) {
    return { kind: 'forbidden', reason: 'NOT_ACTIVE' };
  }
  if (now.getTime() >= booking.startsAt.getTime()) {
    return { kind: 'forbidden', reason: 'ALREADY_STARTED' };
  }

  const hoursUntil = (booking.startsAt.getTime() - now.getTime()) / MS_PER_HOUR;
  if (hoursUntil >= booking.cancellationWindowHours) return { kind: 'free' };

  const rate = booking.lateCancellationRate;
  if (rate <= 0) return { kind: 'free' };

  return { kind: 'fee', rate, amount: applyRate(booking.totalPrice, rate) };
}

export type RescheduleRefusal =
  | 'ALREADY_STARTED'
  | 'NOT_ACTIVE'
  /** Лимит переносов на бронь исчерпан. */
  | 'LIMIT_REACHED'
  /** Окно бесплатного переноса закрыто — остаётся отмена по общим правилам. */
  | 'WINDOW_CLOSED'
  /** Новое время в прошлом или интервал некорректен. */
  | 'INVALID_TARGET'
  /** Новое время совпадает с текущим: переносить нечего. */
  | 'SAME_TIME';

export type RescheduleOutcome =
  | {
      kind: 'allowed';
      /** Разница в цене: положительная — доплата, отрицательная — возврат. */
      priceDifference: Money;
      /** Сколько переносов останется после этого. */
      remaining: number;
    }
  | { kind: 'forbidden'; reason: RescheduleRefusal };

/**
 * Новое время брони. Цена приходит вместе с ним: тот же слот в другой день может
 * стоить иначе (выходной, другой зал), и решать это должен слой запросов, а не
 * политика.
 */
export interface RescheduleTarget extends Interval {
  /** Стоимость нового времени. Без неё считается, что цена не изменилась. */
  price?: Money;
}

/**
 * Можно ли перенести бронь на новое время и что это меняет в деньгах.
 *
 * **Перенос позже окна запрещён, а не платный.** Иначе появляется второй способ
 * получить удержание — и два разных ответа на один вопрос «сколько я потеряю».
 * После закрытия окна остаётся отмена, у которой правило одно и оно
 * зафиксировано в снимке брони.
 */
export function rescheduleOutcome(
  booking: BookingSnapshot,
  target: RescheduleTarget,
  now: Date,
): RescheduleOutcome {
  if (!activeStatuses.includes(booking.status)) {
    return { kind: 'forbidden', reason: 'NOT_ACTIVE' };
  }
  if (now.getTime() >= booking.startsAt.getTime()) {
    return { kind: 'forbidden', reason: 'ALREADY_STARTED' };
  }
  if (booking.rescheduleCount >= booking.maxReschedules) {
    return { kind: 'forbidden', reason: 'LIMIT_REACHED' };
  }

  const hoursUntil = (booking.startsAt.getTime() - now.getTime()) / MS_PER_HOUR;
  if (hoursUntil < booking.rescheduleWindowHours) {
    return { kind: 'forbidden', reason: 'WINDOW_CLOSED' };
  }

  if (!isValidInterval(target) || target.start.getTime() <= now.getTime()) {
    return { kind: 'forbidden', reason: 'INVALID_TARGET' };
  }
  if (target.start.getTime() === booking.startsAt.getTime()) {
    return { kind: 'forbidden', reason: 'SAME_TIME' };
  }

  /*
   * Длительность нового времени не проверяется здесь намеренно: за неё отвечает
   * `assertWithinPolicy`, и дублировать правило значило бы иметь два места, где
   * список допустимых длительностей может разойтись.
   */
  const targetPrice = target.price ?? booking.totalPrice;

  return {
    kind: 'allowed',
    priceDifference: subtract(targetPrice, booking.totalPrice),
    remaining: booking.maxReschedules - booking.rescheduleCount - 1,
  };
}

/**
 * Сколько вернуть клиенту при отмене.
 *
 * Считается от фактически оплаченного, а не от стоимости брони: клиент мог
 * оплатить часть, доплатить после переноса или использовать подарочную карту, и
 * возврат больше оплаченного — это дыра в деньгах.
 *
 * Запрещённая отмена возврата не даёт и бросает: если вызывающий код дошёл до
 * расчёта возврата по завершённой броне, тихий ноль скроет ошибку, из-за которой
 * клиент не получит деньги и не узнает почему.
 */
export function refundAmountFor(outcome: CancellationOutcome, paid: Money): Money {
  switch (outcome.kind) {
    case 'free':
      return clampNonNegative(paid);
    case 'fee':
      return clampNonNegative(subtract(paid, Math.min(outcome.amount, paid)));
    case 'forbidden':
      throw domainErrors.refundNotAllowed();
  }
}

/**
 * Ключ i18n для объяснения отказа. Один на месте отказа — иначе на трёх экранах
 * появятся три разные формулировки одного правила.
 */
export function cancellationRefusalMessageKey(reason: CancellationRefusal): MessageKey {
  switch (reason) {
    case 'ALREADY_STARTED':
    case 'NOT_ACTIVE':
      return 'booking.cancelForbidden';
  }
}

export function rescheduleRefusalMessageKey(reason: RescheduleRefusal): MessageKey {
  switch (reason) {
    case 'LIMIT_REACHED':
      return 'booking.rescheduleLimit';
    case 'WINDOW_CLOSED':
      return 'booking.rescheduleWindowClosed';
    case 'ALREADY_STARTED':
    case 'NOT_ACTIVE':
      return 'booking.cancelForbidden';
    case 'INVALID_TARGET':
    case 'SAME_TIME':
      return 'booking.conflictError';
  }
}
