/**
 * АРЕНДА ЗАЛА — чистые правила без обращения к БД и конфигу.
 *
 * Правила (минимум, максимум, сетка) передаёт вызывающая сторона из `venue` в
 * `config/business.ts`, как и в `assertWithinPolicy`: домен не импортирует конфиг.
 */

import { domainErrors } from '@/domain/errors';

export interface RentalRules {
  minMinutes: number;
  maxMinutes: number;
  granularityMinutes: number;
}

/** Холд относится к аренде зала: есть площадка, нет инструктора и занятия. */
export function isRentalHold(hold: { roomId: string | null; instructorId: string | null; sessionId: string | null }): boolean {
  return Boolean(hold.roomId) && !hold.instructorId && !hold.sessionId;
}

/** Длительность в минутах между началом и концом. */
export function rentalMinutes(startsAt: Date, endsAt: Date): number {
  return Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
}

/** Длительность в пределах минимума и максимума и кратна сетке. */
export function assertRentalDuration(minutes: number, rules: RentalRules): void {
  if (!Number.isInteger(minutes) || minutes < rules.minMinutes || minutes > rules.maxMinutes) {
    throw domainErrors.validationFailed('durationMinutes');
  }
  if (minutes % rules.granularityMinutes !== 0) {
    throw domainErrors.validationFailed('durationMinutes');
  }
}

/** Сумма аренды в драмах: почасовая ставка пропорционально минутам, округление до целого. */
export function rentalPrice(pricePerHour: number, minutes: number): number {
  return Math.round((pricePerHour * minutes) / 60);
}
