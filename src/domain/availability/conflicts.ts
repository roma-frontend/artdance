/**
 * КОНФЛИКТЫ — последняя проверка перед записью брони в базу.
 *
 * Задача 3.3 плана. Функции не возвращают `false`, а бросают `DomainError` с
 * кодом и переводимым сообщением: результат этой проверки почти всегда попадает
 * человеку на экран, и «не удалось забронировать» без причины — худший из
 * возможных ответов на этом шаге.
 *
 * **Что здесь проверяется и что нет.** Здесь — то, что можно проверить, глядя на
 * набор интервалов и правил: не наложилась ли бронь на существующую, хватает ли
 * мест, попадает ли время в разрешённое окно платформы. Здесь НЕ решается гонка:
 * две одновременные попытки увидят одинаково свободный слот, и разведёт их
 * уникальный индекс `SlotHold` в БД. Порядок такой:
 *
 *   1. эти функции — понятная ошибка до записи, внутри транзакции;
 *   2. уникальный индекс — гарантия при гонке, ценой ошибки уровня БД.
 *
 * Убрать первый шаг нельзя (человек получит «внутреннюю ошибку» вместо «время
 * заняли»), убрать второй — тоже (два запроса пройдут проверку одновременно).
 *
 * `now` приходит параметром: время не берётся из окружения нигде в домене.
 *
 * Сигнатуры зафиксированы в `docs/09-helpers-catalog.md` §2.
 */

import { domainErrors } from '@/domain/errors';
import { isAlignedToGranularity } from '@/lib/time/clock';
import {
  assertValidInterval,
  contains,
  durationMinutes,
  mergeIntervals,
  overlaps,
  type Interval,
} from '@/lib/time/interval';
import { startOfZonedDay } from '@/domain/holidays';
import { site } from '@/config/site';

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/**
 * Правила платформы, применимые к одной попытке бронирования.
 *
 * Собирается вызывающей стороной из `config/business.ts` — в домене нет импорта
 * конфигурации, потому что для уже созданной брони правила берутся из её
 * зафиксированного снимка, а не из текущего конфига.
 */
export interface BookingPolicy {
  minLeadMinutes: number;
  maxAdvanceDays: number;
  /** Допустимые длительности. Пустой список = длительность не ограничена. */
  allowedDurationsMinutes?: readonly number[];
  /** Сетка расписания: начало обязано лежать на ней. */
  granularityMinutes?: number;
  timeZone?: string;
}

/**
 * Нет ли наложения на уже занятое время — с буфером между занятиями.
 *
 * Буфер прибавляется к существующим интервалам, а не к кандидату: он
 * характеризует ресурс («инструктору нужно 15 минут между занятиями»), а не
 * конкретную заявку, и в письмо клиенту попадать не должен.
 */
export function assertNoConflict(
  existing: readonly Interval[],
  candidate: Interval,
  bufferMinutes: number,
): void {
  assertValidInterval(candidate, 'Бронируемый интервал');

  for (const busy of mergeIntervals(existing)) {
    if (overlaps(candidate, busy, bufferMinutes)) throw domainErrors.slotConflict();
  }
}

/**
 * Попадает ли бронь целиком в свободное окно.
 *
 * Проверка отдельная от `assertNoConflict`, потому что отвечает на другой вопрос
 * и даёт другую ошибку: «время занято» и «в это время не работаем» — разные
 * сообщения, и подменять второе первым значит врать про расписание.
 *
 * Окна берутся из `computeFreeSlots`/`expandRules`, то есть уже без занятого
 * времени и исключений.
 */
export function assertInsideAvailability(
  windows: readonly Interval[],
  candidate: Interval,
): void {
  assertValidInterval(candidate, 'Бронируемый интервал');

  const fits = mergeIntervals(windows).some((window) => contains(window, candidate));
  if (!fits) throw domainErrors.slotUnavailable();
}

/**
 * Хватает ли мест в группе.
 *
 * Считает по числу занятых, а не по «есть ли хоть одно место»: заявка на трёх
 * человек при одном свободном месте должна отказываться с числом, а не проходить
 * и ломать вместимость зала.
 */
export function assertCapacity(booked: number, requested: number, capacity: number): void {
  if (requested <= 0) throw domainErrors.capacityExceeded(Math.max(0, capacity - booked));
  if (booked + requested > capacity) {
    throw domainErrors.capacityExceeded(Math.max(0, capacity - booked));
  }
}

/**
 * Соответствует ли время правилам платформы: опережение, горизонт, длительность,
 * сетка.
 *
 * Порядок проверок — от самой частой и самой понятной причины отказа к более
 * редким: человек, который пытается забронировать занятие через час, должен
 * увидеть «нужно за два часа», а не «длительность не поддерживается».
 */
export function assertWithinPolicy(candidate: Interval, policy: BookingPolicy, now: Date): void {
  assertValidInterval(candidate, 'Бронируемый интервал');

  const leadMinutes = (candidate.start.getTime() - now.getTime()) / MS_PER_MINUTE;
  if (leadMinutes < policy.minLeadMinutes) {
    throw domainErrors.leadTimeViolation(String(policy.minLeadMinutes / 60));
  }

  /*
   * Горизонт считается по календарным суткам пояса бизнеса, а не «сейчас плюс 90
   * × 24 часа»: «бронирование открыто на 90 дней» для человека означает дату в
   * календаре, и слот в 21:00 девяностого дня не должен отказываться потому, что
   * запрос пришёл в 09:00.
   */
  const horizon = startOfZonedDay(
    new Date(now.getTime() + policy.maxAdvanceDays * MS_PER_DAY),
    policy.timeZone ?? site.timeZone,
  ).getTime() + MS_PER_DAY;
  if (candidate.start.getTime() >= horizon) {
    throw domainErrors.bookingHorizonViolation(String(policy.maxAdvanceDays));
  }

  const duration = durationMinutes(candidate);
  const allowed = policy.allowedDurationsMinutes;
  if (allowed && allowed.length > 0 && !allowed.includes(duration)) {
    throw domainErrors.slotUnavailable();
  }

  if (policy.granularityMinutes) {
    const dayStart = startOfZonedDay(candidate.start, policy.timeZone ?? site.timeZone).getTime();
    const offsetMinutes = (candidate.start.getTime() - dayStart) / MS_PER_MINUTE;
    if (!isAlignedToGranularity(offsetMinutes, policy.granularityMinutes)) {
      throw domainErrors.slotUnavailable();
    }
  }
}

/**
 * Нет ли у клиента уже брони на это же время.
 *
 * Не то же самое, что конфликт ресурса: инструктор свободен, а человек не может
 * быть в двух местах. Отдельный код ошибки, потому что и сообщение другое —
 * «вы уже записаны», а не «время занято».
 */
export function assertNoDuplicateEnrollment(
  customerBookings: readonly Interval[],
  candidate: Interval,
): void {
  assertValidInterval(candidate, 'Бронируемый интервал');

  for (const own of mergeIntervals(customerBookings)) {
    if (overlaps(candidate, own)) throw domainErrors.duplicateEnrollment();
  }
}
