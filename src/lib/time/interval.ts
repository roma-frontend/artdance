/**
 * ИНТЕРВАЛЫ ВРЕМЕНИ — арифметика отрезков «от момента до момента».
 *
 * Уровнем ниже (`clock.ts`) живёт время суток без даты; здесь — уже конкретные
 * моменты. Всё бронирование сводится к четырём вопросам об отрезках:
 * пересекаются ли два, что осталось от рабочего окна после вычитания занятого,
 * как склеить перекрывающиеся блокировки в одну и сколько это длится. Каждый из
 * них ошибочно решается «на глаз» по-разному в разных местах кода, поэтому
 * решается здесь один раз.
 *
 * **Интервал полуоткрыт: `[start, end)`.** Занятие 18:00–19:00 и занятие
 * 19:00–20:00 НЕ пересекаются: конец одного равен началу другого, и это
 * нормальное расписание, а не конфликт. Без этого правила любая плотная сетка
 * слотов объявляла бы себя занятой сама на себя.
 *
 * **Буфер — свойство ресурса, а не отрезка.** `bufferBetweenBookingsMinutes`
 * нужен, чтобы между двумя бронями одного инструктора осталось время
 * переодеться; при проверке пересечения он раздвигает сравнение, но не меняет
 * сами границы брони — иначе он попал бы в письмо клиенту и в `.ics`.
 *
 * Библиотека дат не нужна: здесь только `getTime()` и сложение миллисекунд.
 * Часовые пояса на этом уровне не существуют — момент времени един для всех
 * поясов, а превращение «суббота 18:00 в Ереване» в момент делает
 * `lib/time/schedule.ts`.
 *
 * Сигнатуры зафиксированы в `docs/09-helpers-catalog.md` §2.
 */

const MS_PER_MINUTE = 60_000;

export interface Interval {
  start: Date;
  end: Date;
}

export class IntervalError extends Error {
  constructor(message: string) {
    super(`[interval] ${message}`);
    this.name = 'IntervalError';
  }
}

/**
 * Отрезок корректен, если оба конца — реальные даты и конец строго позже начала.
 *
 * Нулевая длительность считается ошибкой, а не пустым множеством: «бронь с 18:00
 * до 18:00» — это потерянная длительность где-то выше по стеку, и молча
 * пропустить её значит записать её в БД.
 */
export function isValidInterval(interval: Interval): boolean {
  const start = interval.start.getTime();
  const end = interval.end.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && end > start;
}

export function assertValidInterval(interval: Interval, label = 'Интервал'): void {
  if (!isValidInterval(interval)) {
    throw new IntervalError(
      `${label} некорректен: ${interval.start.toISOString?.() ?? interval.start} → ` +
        `${interval.end.toISOString?.() ?? interval.end}`,
    );
  }
}

export function durationMinutes(interval: Interval): number {
  assertValidInterval(interval);
  return (interval.end.getTime() - interval.start.getTime()) / MS_PER_MINUTE;
}

/** Сдвиг границ отрезка: наружу при положительном значении, внутрь при отрицательном. */
export function padInterval(interval: Interval, minutes: number): Interval {
  return {
    start: new Date(interval.start.getTime() - minutes * MS_PER_MINUTE),
    end: new Date(interval.end.getTime() + minutes * MS_PER_MINUTE),
  };
}

/**
 * Пересекаются ли два отрезка, с учётом буфера между ними.
 *
 * Буфер применяется один раз и к одному из отрезков, а не к обоим: требование
 * «между бронями 15 минут» означает 15 минут суммарно, а раздвижение обоих дало
 * бы 30. Какой именно раздвигать — неважно, условие симметрично.
 */
export function overlaps(a: Interval, b: Interval, bufferMinutes = 0): boolean {
  assertValidInterval(a, 'Первый интервал');
  assertValidInterval(b, 'Второй интервал');

  const padded = bufferMinutes === 0 ? b : padInterval(b, bufferMinutes);
  return a.start.getTime() < padded.end.getTime() && padded.start.getTime() < a.end.getTime();
}

/** Лежит ли `inner` целиком внутри `outer`. Границы включительно. */
export function contains(outer: Interval, inner: Interval): boolean {
  return (
    outer.start.getTime() <= inner.start.getTime() && inner.end.getTime() <= outer.end.getTime()
  );
}

/** Момент внутри отрезка. Начало включается, конец — нет: `[start, end)`. */
export function containsInstant(interval: Interval, instant: Date): boolean {
  return instant.getTime() >= interval.start.getTime() && instant.getTime() < interval.end.getTime();
}

/** Общая часть двух отрезков или `null`, если её нет. */
export function intersectIntervals(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start.getTime(), b.start.getTime());
  const end = Math.min(a.end.getTime(), b.end.getTime());
  return end > start ? { start: new Date(start), end: new Date(end) } : null;
}

/** По возрастанию начала; при равных началах раньше идёт более короткий. */
export function sortIntervals(list: readonly Interval[]): Interval[] {
  return [...list].sort(
    (x, y) => x.start.getTime() - y.start.getTime() || x.end.getTime() - y.end.getTime(),
  );
}

/**
 * Склейка перекрывающихся и соприкасающихся отрезков в минимальный набор.
 *
 * Соприкасающиеся склеиваются тоже: две брони 18:00–19:00 и 19:00–20:00 как
 * блокировка — это один занятый отрезок 18:00–20:00, и оставлять их раздельными
 * значило бы получить в `subtractIntervals` пустой «свободный» промежуток
 * нулевой длины между ними.
 */
export function mergeIntervals(list: readonly Interval[]): Interval[] {
  const sorted = sortIntervals(list.filter(isValidInterval));
  const merged: Interval[] = [];

  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start.getTime() <= last.end.getTime()) {
      if (current.end.getTime() > last.end.getTime()) last.end = new Date(current.end.getTime());
      continue;
    }
    merged.push({ start: new Date(current.start.getTime()), end: new Date(current.end.getTime()) });
  }

  return merged;
}

/**
 * Что осталось от `base` после вычитания блокировок.
 *
 * Это и есть «свободное время инструктора»: рабочее окно минус брони,
 * удержания и исключения. Возвращает отрезки в порядке возрастания; отрезки
 * нулевой длины отбрасываются — свободного времени в них нет.
 */
export function subtractIntervals(base: Interval, blocks: readonly Interval[]): Interval[] {
  assertValidInterval(base, 'Базовый интервал');

  let cursor = base.start.getTime();
  const free: Interval[] = [];

  for (const block of mergeIntervals(blocks)) {
    const blockStart = block.start.getTime();
    const blockEnd = block.end.getTime();

    if (blockEnd <= cursor) continue;
    if (blockStart >= base.end.getTime()) break;

    if (blockStart > cursor) free.push({ start: new Date(cursor), end: new Date(blockStart) });
    cursor = Math.max(cursor, blockEnd);
    if (cursor >= base.end.getTime()) return free;
  }

  if (cursor < base.end.getTime()) free.push({ start: new Date(cursor), end: base.end });
  return free;
}

/**
 * Вычитание из набора окон, а не из одного: расписание на неделю — это несколько
 * рабочих окон, и занятое время режет их все.
 */
export function subtractFromAll(
  bases: readonly Interval[],
  blocks: readonly Interval[],
): Interval[] {
  const merged = mergeIntervals(blocks);
  return bases.flatMap((base) => subtractIntervals(base, merged));
}

/** Суммарная длительность набора без двойного счёта перекрытий. */
export function totalMinutes(list: readonly Interval[]): number {
  return mergeIntervals(list).reduce((sum, interval) => sum + durationMinutes(interval), 0);
}
