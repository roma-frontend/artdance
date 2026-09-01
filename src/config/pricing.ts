/**
 * PRICING — тарифная сетка платформы.
 *
 * Здесь только структура и суммы. Названия и описания планов — в i18n
 * (`pricing.plans.<id>.name`), поэтому один и тот же план читается на трёх языках
 * без дублирования цифр.
 *
 * Суммы в минорных единицах отсутствуют: AMD целочисленный (см. `business.currency`).
 */

/** ID планов — стабильные ключи, используются в БД, i18n и аналитике. */
export const subscriptionPlanIds = ['starter', 'pro', 'elite'] as const;
export type SubscriptionPlanId = (typeof subscriptionPlanIds)[number];

export const billingIntervals = ['MONTHLY', 'YEARLY'] as const;
export type BillingInterval = (typeof billingIntervals)[number];

/** Машиночитаемые квоты плана. UI рисует их через i18n-строки по этим ключам. */
export interface PlanQuota {
  groupClassesPerMonth: number | 'unlimited';
  privateSessionsPerMonth: number;
  danceStyles: number | 'all';
  priorityBooking: boolean;
  progressJournal: boolean;
  studioRentalDiscountRate: number;
  guestWorkshops: boolean;
  competitionPrep: boolean;
  vipEvents: boolean;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  /** Порядок в UI. */
  order: number;
  /** Выделять как рекомендуемый. Ровно один план должен быть `true`. */
  highlighted: boolean;
  price: Record<BillingInterval, number>;
  /** Скидка за годовую оплату, в процентах — для бейджа «−2 месяца». */
  yearlyDiscountPercent: number;
  quota: PlanQuota;
  /** Порядок фич в таблице сравнения — ключи i18n, не тексты. */
  featureKeys: readonly string[];
  trialDays: number;
}

export const subscriptionPlans: Record<SubscriptionPlanId, SubscriptionPlan> = {
  starter: {
    id: 'starter',
    order: 1,
    highlighted: false,
    price: { MONTHLY: 15_000, YEARLY: 150_000 },
    yearlyDiscountPercent: 17,
    quota: {
      groupClassesPerMonth: 4,
      privateSessionsPerMonth: 0,
      danceStyles: 3,
      priorityBooking: false,
      progressJournal: false,
      studioRentalDiscountRate: 0,
      guestWorkshops: false,
      competitionPrep: false,
      vipEvents: false,
    },
    featureKeys: ['groupClasses', 'styleAccess', 'communityEvents', 'mobileApp'],
    trialDays: 0,
  },
  pro: {
    id: 'pro',
    order: 2,
    highlighted: true,
    price: { MONTHLY: 35_000, YEARLY: 350_000 },
    yearlyDiscountPercent: 17,
    quota: {
      groupClassesPerMonth: 'unlimited',
      privateSessionsPerMonth: 2,
      danceStyles: 'all',
      priorityBooking: true,
      progressJournal: true,
      studioRentalDiscountRate: 0.1,
      guestWorkshops: false,
      competitionPrep: false,
      vipEvents: false,
    },
    featureKeys: [
      'unlimitedGroupClasses',
      'privateSessions',
      'allStyles',
      'progressJournal',
      'priorityBooking',
      'performanceOpportunities',
    ],
    trialDays: 7,
  },
  elite: {
    id: 'elite',
    order: 3,
    highlighted: false,
    price: { MONTHLY: 65_000, YEARLY: 650_000 },
    yearlyDiscountPercent: 17,
    quota: {
      groupClassesPerMonth: 'unlimited',
      privateSessionsPerMonth: 99,
      danceStyles: 'all',
      priorityBooking: true,
      progressJournal: true,
      studioRentalDiscountRate: 0.2,
      guestWorkshops: true,
      competitionPrep: true,
      vipEvents: true,
    },
    featureKeys: [
      'everythingInPro',
      'unlimitedPrivateSessions',
      'competitionPrep',
      'guestWorkshops',
      'studioRentalDiscount',
      'vipEvents',
    ],
    trialDays: 0,
  },
};

export const orderedSubscriptionPlans: readonly SubscriptionPlan[] = subscriptionPlanIds
  .map((id) => subscriptionPlans[id])
  .sort((a, b) => a.order - b.order);

/* ─────────────────── Разовые продукты платформы ─────────────────── */

/**
 * Ориентиры цен для сидов и валидации, не для отображения.
 * Реальные цены живут в БД и управляются админкой.
 */
export const priceGuidance = {
  groupClass: { min: 4_000, typical: 12_000, max: 30_000 },
  privateLesson: { min: 8_000, typical: 15_000, max: 40_000 },
  studioRentalPerHour: { min: 8_000, typical: 20_000, max: 45_000 },
  workshop: { min: 5_000, typical: 8_000, max: 25_000 },
  onlineCourse: { min: 10_000, typical: 25_000, max: 80_000 },
} as const;

/** Разрешённые типы позиций в заказе. Влияет на расчёт комиссии и налога. */
export const lineItemTypes = [
  'CLASS_BOOKING',
  'PRIVATE_SESSION',
  'STUDIO_RENTAL',
  'COURSE_ENROLLMENT',
  'EVENT_TICKET',
  'PRODUCT',
  'GIFT_CARD',
  'SUBSCRIPTION',
  'TRAVEL_FEE',
  'DELIVERY_FEE',
] as const;
export type LineItemType = (typeof lineItemTypes)[number];

/** Какие типы позиций облагаются комиссией платформы. */
export const commissionableLineItems: readonly LineItemType[] = [
  'CLASS_BOOKING',
  'PRIVATE_SESSION',
  'STUDIO_RENTAL',
  'COURSE_ENROLLMENT',
  'EVENT_TICKET',
];

/** Позиции, не подлежащие возврату при отмене. */
export const nonRefundableLineItems: readonly LineItemType[] = ['GIFT_CARD', 'DELIVERY_FEE'];
