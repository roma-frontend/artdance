import { describe, expect, it } from 'vitest';

import { completedYears } from './age';

const YEREVAN = 'Asia/Yerevan';

describe('completedYears', () => {
  it('в день рождения возраст уже новый, накануне ещё старый', () => {
    expect(completedYears('2008-09-01', new Date('2026-08-31T12:00:00+04:00'), YEREVAN)).toBe(17);
    expect(completedYears('2008-09-01', new Date('2026-09-01T12:00:00+04:00'), YEREVAN)).toBe(18);
  });

  it('считает по поясу площадки, а не по UTC', () => {
    // 21:30 UTC — уже 01:30 следующего дня в Ереване (UTC+4).
    const instant = new Date('2026-09-01T21:30:00Z');
    expect(completedYears('2008-09-02', instant, YEREVAN)).toBe(18);
    expect(completedYears('2008-09-02', instant, 'UTC')).toBe(17);
  });

  it('29 февраля: в невисокосный год возраст растёт 1 марта', () => {
    expect(completedYears('2000-02-29', new Date('2025-02-28T12:00:00+04:00'), YEREVAN)).toBe(24);
    expect(completedYears('2000-02-29', new Date('2025-03-01T12:00:00+04:00'), YEREVAN)).toBe(25);
  });

  it('несуществующая дата, будущее и не YYYY-MM-DD дают null', () => {
    const now = new Date('2026-09-01T12:00:00+04:00');
    expect(completedYears('2026-02-30', now, YEREVAN)).toBeNull();
    expect(completedYears('2026-09-02', now, YEREVAN)).toBeNull();
    expect(completedYears('01.05.1990', now, YEREVAN)).toBeNull();
    expect(completedYears('', now, YEREVAN)).toBeNull();
  });

  it('старше 120 лет считается ошибкой ввода', () => {
    expect(completedYears('1880-01-01', new Date('2026-09-01T12:00:00+04:00'), YEREVAN)).toBeNull();
  });
});
