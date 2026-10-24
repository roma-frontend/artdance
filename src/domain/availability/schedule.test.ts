import { describe, expect, it } from 'vitest';

import {
  scheduleExceptionSchema,
  scheduleInstant,
  scheduleRuleSchema,
  windowsOverlap,
} from './schedule';

describe('scheduleInstant', () => {
  it('трактует введённое время как время бизнеса (UTC+4)', () => {
    expect(scheduleInstant('2026-10-24', '10:00')?.toISOString()).toBe('2026-10-24T06:00:00.000Z');
  });

  it('возвращает null для невалидного ввода', () => {
    expect(scheduleInstant('2026-10-24', '25:00')).toBeNull();
    expect(scheduleInstant('bad', '10:00')).toBeNull();
  });
});

describe('scheduleRuleSchema', () => {
  it('принимает корректное недельное окно', () => {
    const parsed = scheduleRuleSchema.safeParse({
      weekday: 3,
      startTime: '18:00',
      endTime: '22:00',
    });
    expect(parsed.success).toBe(true);
  });

  it('отвергает время не в формате HH:mm', () => {
    const parsed = scheduleRuleSchema.safeParse({
      weekday: 3,
      startTime: '25:00',
      endTime: '22:00',
    });
    expect(parsed.success).toBe(false);
  });

  it('отвергает окно, где конец раньше начала', () => {
    const parsed = scheduleRuleSchema.safeParse({
      weekday: 3,
      startTime: '20:00',
      endTime: '18:00',
    });
    expect(parsed.success).toBe(false);
  });

  it('отвергает пустое окно (начало = конец)', () => {
    const parsed = scheduleRuleSchema.safeParse({
      weekday: 3,
      startTime: '18:00',
      endTime: '18:00',
    });
    expect(parsed.success).toBe(false);
  });

  it('отвергает день недели вне 0..6', () => {
    const parsed = scheduleRuleSchema.safeParse({
      weekday: 7,
      startTime: '18:00',
      endTime: '22:00',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('scheduleExceptionSchema', () => {
  it('принимает корректное исключение', () => {
    const parsed = scheduleExceptionSchema.safeParse({
      date: '2026-10-25',
      startTime: '10:00',
      endTime: '12:00',
      isAvailable: false,
      reason: 'Отпуск',
    });
    expect(parsed.success).toBe(true);
  });

  it('отвергает дату не в формате YYYY-MM-DD', () => {
    const parsed = scheduleExceptionSchema.safeParse({
      date: '25.10.2026',
      startTime: '10:00',
      endTime: '12:00',
    });
    expect(parsed.success).toBe(false);
  });

  it('отвергает пустое окно', () => {
    const parsed = scheduleExceptionSchema.safeParse({
      date: '2026-10-25',
      startTime: '12:00',
      endTime: '12:00',
    });
    expect(parsed.success).toBe(false);
  });

  it('усекает слишком длинную причину', () => {
    const parsed = scheduleExceptionSchema.safeParse({
      date: '2026-10-25',
      startTime: '10:00',
      endTime: '12:00',
      reason: 'а'.repeat(200),
    });
    expect(parsed.success).toBe(false);
  });
});

describe('windowsOverlap', () => {
  it('пересекающиеся окна дают true', () => {
    expect(windowsOverlap('18:00', '22:00', '20:00', '23:00')).toBe(true);
    expect(windowsOverlap('18:00', '22:00', '17:00', '19:00')).toBe(true);
    expect(windowsOverlap('18:00', '22:00', '18:00', '19:00')).toBe(true);
  });

  it('окна вплотную друг к другу пересечением не считаются', () => {
    expect(windowsOverlap('18:00', '20:00', '20:00', '22:00')).toBe(false);
  });

  it('разделённые окна дают false', () => {
    expect(windowsOverlap('09:00', '11:00', '15:00', '17:00')).toBe(false);
  });

  it('битые значения безопасно дают false', () => {
    expect(windowsOverlap('25:00', '26:00', '10:00', '12:00')).toBe(false);
  });
});
