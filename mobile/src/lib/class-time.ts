/**
 * Расчёт времени занятий. Без зависимостей от React Native и Expo,
 * поэтому тесты запускаются в Node.
 *
 * Расписание хранится в локальном времени Еревана (UTC+4), поэтому считаем его отдельно
 * от часового пояса телефона.
 */

const YEREVAN_OFFSET = '+04:00';
const YEREVAN_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Дата «сегодня» в Ереване в формате YYYY-MM-DD. */
export function yerevanDate(now: number): string {
  return new Date(now + YEREVAN_MS).toISOString().slice(0, 10);
}

/** Время `HH:MM` в Ереване для момента `now`. */
export function yerevanClock(now: number): string {
  return new Date(now + YEREVAN_MS).toISOString().slice(11, 16);
}

/** Первая дата (YYYY-MM-DD) с заданным днём недели (0 = воскресенье) на `from` или позже. */
export function nextDateOn(weekday: number, from: string): string {
  const base = new Date(`${from}T12:00:00Z`);
  const diff = (weekday - base.getUTCDay() + 7) % 7;
  return new Date(base.getTime() + diff * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Ближайший старт занятия (Ереван): сегодня, если ещё не началось, иначе через неделю.
 * @param weekday день недели, 0 = воскресенье
 * @param startTime время начала в формате HH:MM
 * @param now текущий момент в миллисекундах UTC
 */
export function nextClassStart(weekday: number, startTime: string, now: number): Date {
  const today = yerevanDate(now);
  let date = nextDateOn(weekday, today);
  if (date === today && new Date(`${date}T${startTime}:00${YEREVAN_OFFSET}`).getTime() < now) {
    date = new Date(new Date(`${date}T12:00:00Z`).getTime() + 7 * DAY_MS).toISOString().slice(0, 10);
  }
  return new Date(`${date}T${startTime}:00${YEREVAN_OFFSET}`);
}
