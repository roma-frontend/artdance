/**
 * GROWTH — бонусы рефералов, задержки писем восстановления, алерты.
 * Покрывает 07 §6 `src/config/growth.ts` для B-05, C-04, C-05.
 */

export const growth = {
  referral: {
    /** Бонус каждой стороне, AMD: пригласившему и приглашённому. Единая сумма, её видит пользователь. */
    bonusAmount: 3_000,
    /** Минимум трат для начисления. Не проверяется: правило не реализовано, нужно решение владельца. */
    minSpend: 5_000,
    /** Сколько дней действует реферальная связь. */
    expiryDays: 90,
    /** Параметр адреса, в котором приходит код: `?ref=CODE`. */
    queryParam: 'ref',
    /** Cookie, в которой код хранится до регистрации. */
    cookieName: 'ref',
  },
  abandonedCart: {
    delayMinutes: 30,
    followUpHours: 24,
  },
  savedSearch: {
    frequency: 'daily' as const,
    maxPerUser: 10,
  },
  digest: {
    dailyHour: 9,
    maxItems: 10,
  },
  loyalty: {
    pointsPerBooking: 10,
    conversionRate: 1,
  },
} as const;

export type GrowthConfig = typeof growth;
