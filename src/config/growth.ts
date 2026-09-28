/**
 * GROWTH — бонусы рефералов, задержки писем восстановления, алерты.
 * Покрывает 07 §6 `src/config/growth.ts` для B-05, C-04, C-05.
 */

export const growth = {
  referral: {
    /** Бонус пригласившему и приглашённому, AMD. */
    referrerBonus: 2_000,
    inviteeBonus: 1_000,
    /** Минимум трат, чтобы бонус начислился. */
    minSpend: 5_000,
    /** Сколько дней действует реферальная связь. */
    expiryDays: 90,
  },
  abandonedCart: {
    delayMinutes: 30,
    followUpHours: 24,
  },
  savedSearch: {
    frequency: 'daily' as const,
    maxPerUser: 10,
  },
  firstBookingDiscount: {
    percent: 10,
    maxDiscount: 2_000,
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
