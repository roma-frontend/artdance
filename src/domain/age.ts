/**
 * ВОЗРАСТ УЧАСТНИКА — полные годы на дату в часовом поясе площадки.
 *
 * Нужен только для правила несовершеннолетних при брони (D-03). Дата рождения
 * приходит строкой `YYYY-MM-DD` и не сохраняется: по ней решается, нужно ли
 * подтверждение родителя или опекуна, и больше ни для чего.
 */

import { zonedDateKey } from '@/domain/availability/compute';

/** Старше этого возраста дата считается ошибкой ввода. */
const MAX_AGE_YEARS = 120;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Полные годы на момент `on`. Возвращает null, если строка не `YYYY-MM-DD`, такой даты
 * не существует (30 февраля), она в будущем или старше `MAX_AGE_YEARS`. Вызывающий код
 * обязан отказать, а не угадывать возраст.
 */
export function completedYears(birthDate: string, on: Date, timeZone: string): number | null {
  const match = ISO_DATE.exec(birthDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  const today = zonedDateKey(on, timeZone);
  if (birthDate > today) return null;

  let age = Number(today.slice(0, 4)) - year;
  // Даты в одном формате `YYYY-MM-DD` сравниваются строкой так же, как по календарю.
  if (today.slice(5) < birthDate.slice(5)) age -= 1;
  return age > MAX_AGE_YEARS ? null : age;
}
