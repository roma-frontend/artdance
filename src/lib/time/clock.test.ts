import { describe, expect, it } from 'vitest';

import { demoAvailableSlots } from '../../../prisma/fixtures/demo';
import { booking } from '@/config/business';

import {
  ClockError,
  MINUTES_PER_DAY,
  alignToGranularity,
  clockDifference,
  formatClock,
  isAlignedToGranularity,
  parseClock,
  shiftClock,
  tryParseClock,
} from './clock';

describe('parseClock', () => {
  it('разбирает время суток в минуты от полуночи', () => {
    expect(parseClock('00:00')).toBe(0);
    expect(parseClock('18:00')).toBe(18 * 60);
    expect(parseClock('19:30')).toBe(19 * 60 + 30);
    expect(parseClock('23:59')).toBe(1_439);
  });

  it('отклоняет то, что не является временем суток', () => {
    /* Без ведущего нуля строки перестают сортироваться лексикографически. */
    expect(() => parseClock('7:00')).toThrow(ClockError);
    expect(() => parseClock('24:00')).toThrow(ClockError);
    expect(() => parseClock('18:60')).toThrow(ClockError);
    expect(() => parseClock('18:0')).toThrow(ClockError);
    expect(() => parseClock('')).toThrow(ClockError);
  });

  it('tryParseClock возвращает null вместо исключения', () => {
    expect(tryParseClock('18:00')).toBe(1_080);
    expect(tryParseClock('nonsense')).toBeNull();
  });
});

describe('formatClock', () => {
  it('обратим с parseClock на всех слотах суток', () => {
    for (let minutes = 0; minutes < 24 * 60; minutes += 1) {
      expect(parseClock(formatClock(minutes))).toBe(minutes);
    }
  });

  it('приводит значение по модулю суток, а не падает', () => {
    expect(formatClock(24 * 60)).toBe('00:00');
    expect(formatClock(-30)).toBe('23:30');
    expect(formatClock(25 * 60)).toBe('01:00');
  });

  it('требует целых минут', () => {
    expect(() => formatClock(90.5)).toThrow(ClockError);
    expect(() => formatClock(Number.NaN)).toThrow(ClockError);
  });
});

describe('shiftClock', () => {
  it('считает конец занятия по началу и длительности', () => {
    expect(shiftClock('18:00', 90)).toBe('19:30');
    expect(shiftClock('10:00', 45)).toBe('10:45');
  });

  it('переходит через полночь вперёд, а не в отрицательное время', () => {
    expect(shiftClock('23:00', 120)).toBe('01:00');
    expect(shiftClock('00:30', -60)).toBe('23:30');
  });
});

describe('clockDifference', () => {
  it('даёт длительность между началом и концом', () => {
    expect(clockDifference('18:00', '19:30')).toBe(90);
  });

  it('интервал через полночь считает вперёд', () => {
    expect(clockDifference('23:00', '01:00')).toBe(120);
  });
});

describe('alignToGranularity', () => {
  it('вниз — по умолчанию, вверх — когда слот в прошлом недопустим', () => {
    const now = parseClock('18:07');
    expect(alignToGranularity(now, 30)).toBe(parseClock('18:00'));
    expect(alignToGranularity(now, 30, 'up')).toBe(parseClock('18:30'));
  });

  it('значение на сетке не двигается ни в одну сторону', () => {
    const aligned = parseClock('18:30');
    expect(alignToGranularity(aligned, 30)).toBe(aligned);
    expect(alignToGranularity(aligned, 30, 'up')).toBe(aligned);
  });

  it('отклоняет некорректный шаг сетки', () => {
    expect(() => alignToGranularity(60, 0)).toThrow(ClockError);
    expect(() => alignToGranularity(60, 7.5)).toThrow(ClockError);
  });
});

/*
 * Инварианты правил бронирования.
 *
 * Проверки стоят здесь, а не в тестах конфигурации, потому что ломаются они
 * именно арифметикой слотов: изменение `booking.*` в `config/business.ts`
 * должно упасть здесь, а не в календаре на демо.
 */
describe('правила расписания согласованы с сеткой слотов', () => {
  it('слоты демо-данных лежат на сетке предложения', () => {
    for (const slot of demoAvailableSlots) {
      expect(isAlignedToGranularity(parseClock(slot), booking.slotGranularityMinutes)).toBe(true);
    }
  });

  it('минимальный срок брони кратен шагу сетки', () => {
    expect(isAlignedToGranularity(booking.minLeadTimeMinutes, booking.slotGranularityMinutes)).toBe(
      true,
    );
  });

  it('буфер между бронями меньше шага сетки', () => {
    /*
     * Буфер — техническая пауза, а не слот. Будь он равен шагу или больше,
     * движок доступности терял бы по целому предложению после каждой брони.
     */
    expect(booking.bufferBetweenBookingsMinutes).toBeGreaterThan(0);
    expect(booking.bufferBetweenBookingsMinutes).toBeLessThan(booking.slotGranularityMinutes);
  });

  it('конец занятия считается точно для любой длительности из прайса', () => {
    /*
     * ВАЖНО: длительности НЕ обязаны лежать на сетке. Занятие в 45 минут,
     * начатое в 18:00, заканчивается в 18:45 — между слотами. Именно поэтому
     * доступность обязана считаться по интервалам, а не по решётке стартов:
     * решётка ответила бы «18:30 свободно», хотя зал занят до 18:45 плюс буфер.
     * Здесь фиксируется, что арифметика конца точна для всех пар «слот ×
     * длительность» из реальных данных.
     */
    for (const slot of demoAvailableSlots) {
      for (const duration of booking.durationsMinutes) {
        const end = shiftClock(slot, duration);
        expect(clockDifference(slot, end)).toBe(duration % MINUTES_PER_DAY);
      }
    }
  });
});
