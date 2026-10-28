/**
 * Лимиты платных SMS (D-05). Значения временные: окончательные числа согласует заказчик.
 * Окна скользящие: считаются последние `windowHours` часов, а не календарные сутки и месяц.
 */
export const smsBudget = {
  day: { limit: 200, windowHours: 24 },
  month: { limit: 3000, windowHours: 24 * 30 },
} as const;

export type SmsBudgetPeriod = keyof typeof smsBudget;
