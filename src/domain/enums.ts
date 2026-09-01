/**
 * DOMAIN ENUMS — словари предметной области.
 *
 * Значения совпадают с enum'ами Prisma (`prisma/schema.prisma`) один-в-один:
 * это единственное допустимое дублирование, и оно проверяется тестом
 * `src/domain/enums.test.ts`. Отображаемые названия берутся из i18n по ключу,
 * который возвращает `*LabelKey()`.
 */

/* ─────────────────────────────── Роли ─────────────────────────────── */

export const userRoles = ['CUSTOMER', 'INSTRUCTOR', 'VENUE_OWNER', 'ADMIN', 'SUPPORT'] as const;
export type UserRole = (typeof userRoles)[number];

const userRoleLabelKeys: Record<UserRole, string> = {
  CUSTOMER: 'auth.roles.customer',
  INSTRUCTOR: 'auth.roles.instructor',
  VENUE_OWNER: 'auth.roles.venueOwner',
  ADMIN: 'auth.roles.admin',
  SUPPORT: 'auth.roles.support',
};

export function userRoleLabelKey(role: UserRole): string {
  return userRoleLabelKeys[role];
}

/** Иерархия прав: индекс = уровень. Проверка «не ниже, чем» вместо списков ролей. */
const roleRank: Record<UserRole, number> = {
  CUSTOMER: 0,
  INSTRUCTOR: 1,
  VENUE_OWNER: 1,
  SUPPORT: 2,
  ADMIN: 3,
};

export function hasAtLeastRole(actual: UserRole, required: UserRole): boolean {
  return roleRank[actual] >= roleRank[required];
}

/* ────────────────────────── Направления танца ────────────────────────── */

export const danceStyles = [
  'HIP_HOP',
  'BALLET',
  'SALSA',
  'BACHATA',
  'CONTEMPORARY',
  'HEELS',
  'KPOP',
  'LATIN',
  'TANGO',
  'ARMENIAN_FOLK',
  'JAZZ',
  'BREAKING',
  'FLAMENCO',
  'BALLROOM',
  'AFRO',
  'WEDDING_DANCE',
  'KIDS',
  'STRETCHING',
] as const;
export type DanceStyle = (typeof danceStyles)[number];

const danceStyleI18nKeys: Record<DanceStyle, string> = {
  HIP_HOP: 'hipHop',
  BALLET: 'ballet',
  SALSA: 'salsa',
  BACHATA: 'bachata',
  CONTEMPORARY: 'contemporary',
  HEELS: 'heels',
  KPOP: 'kpop',
  LATIN: 'latin',
  TANGO: 'tango',
  ARMENIAN_FOLK: 'armenianFolk',
  JAZZ: 'jazz',
  BREAKING: 'breaking',
  FLAMENCO: 'flamenco',
  BALLROOM: 'ballroom',
  AFRO: 'afro',
  WEDDING_DANCE: 'weddingDance',
  KIDS: 'kids',
  STRETCHING: 'stretching',
};

export function danceStyleLabelKey(style: DanceStyle): string {
  return `danceStyles.${danceStyleI18nKeys[style]}`;
}

/** URL-слаг направления. Нужен, чтобы `/discover?style=hip-hop` не хардкодился. */
export function danceStyleSlug(style: DanceStyle): string {
  return style.toLowerCase().replace(/_/g, '-');
}

export function danceStyleFromSlug(slug: string): DanceStyle | undefined {
  const normalized = slug.toUpperCase().replace(/-/g, '_');
  return danceStyles.find((s) => s === normalized);
}

/* ──────────────────────────── Уровни ──────────────────────────── */

export const skillLevels = ['ALL_LEVELS', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'] as const;
export type SkillLevel = (typeof skillLevels)[number];

const skillLevelI18nKeys: Record<SkillLevel, string> = {
  ALL_LEVELS: 'allLevels',
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  PROFESSIONAL: 'professional',
};

export function skillLevelLabelKey(level: SkillLevel): string {
  return `levels.${skillLevelI18nKeys[level]}`;
}

/* ──────────────────────────── Статусы ──────────────────────────── */

export const bookingStatuses = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_PROVIDER',
  'NO_SHOW',
  'RESCHEDULED',
  'WAITLISTED',
  'EXPIRED',
] as const;
export type BookingStatus = (typeof bookingStatuses)[number];

const bookingStatusI18nKeys: Record<BookingStatus, string> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED_BY_CUSTOMER: 'cancelledByCustomer',
  CANCELLED_BY_PROVIDER: 'cancelledByProvider',
  NO_SHOW: 'noShow',
  RESCHEDULED: 'rescheduled',
  WAITLISTED: 'waitlisted',
  EXPIRED: 'expired',
};

export function bookingStatusLabelKey(status: BookingStatus): string {
  return `status.booking.${bookingStatusI18nKeys[status]}`;
}

/** Статусы, которые считаются «занимающими слот» при проверке конфликтов. */
export const slotBlockingBookingStatuses: readonly BookingStatus[] = [
  'PENDING',
  'CONFIRMED',
  'RESCHEDULED',
];

/** Статусы, из которых возможна отмена. */
export const cancellableBookingStatuses: readonly BookingStatus[] = ['PENDING', 'CONFIRMED', 'RESCHEDULED'];

export const paymentStatuses = [
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'CANCELLED',
  'CHARGEBACK',
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

const paymentStatusI18nKeys: Record<PaymentStatus, string> = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  PAID: 'paid',
  PARTIALLY_REFUNDED: 'partiallyRefunded',
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  CHARGEBACK: 'chargeback',
};

export function paymentStatusLabelKey(status: PaymentStatus): string {
  return `status.payment.${paymentStatusI18nKeys[status]}`;
}

/** Терминальные статусы — webhook по ним не должен менять состояние. */
export const terminalPaymentStatuses: readonly PaymentStatus[] = [
  'REFUNDED',
  'CANCELLED',
  'CHARGEBACK',
];

export const orderStatuses = [
  'CREATED',
  'PAID',
  'PACKING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
] as const;
export type OrderStatus = (typeof orderStatuses)[number];

const orderStatusI18nKeys: Record<OrderStatus, string> = {
  CREATED: 'created',
  PAID: 'paid',
  PACKING: 'packing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
};

export function orderStatusLabelKey(status: OrderStatus): string {
  return `status.order.${orderStatusI18nKeys[status]}`;
}

export const payoutStatuses = ['SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'] as const;
export type PayoutStatus = (typeof payoutStatuses)[number];

const payoutStatusI18nKeys: Record<PayoutStatus, string> = {
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  ON_HOLD: 'onHold',
};

export function payoutStatusLabelKey(status: PayoutStatus): string {
  return `status.payout.${payoutStatusI18nKeys[status]}`;
}

export const moderationStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export function moderationStatusLabelKey(status: ModerationStatus): string {
  const keys: Record<ModerationStatus, string> = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  };
  return `status.moderation.${keys[status]}`;
}

/* ──────────────────────── Типы сущностей ──────────────────────── */

export const eventTypes = [
  'WORKSHOP',
  'BATTLE',
  'MASTERCLASS',
  'SHOWCASE',
  'SOCIAL',
  'COMPETITION',
] as const;
export type EventType = (typeof eventTypes)[number];

export function eventTypeLabelKey(type: EventType): string {
  const keys: Record<EventType, string> = {
    WORKSHOP: 'typeWorkshop',
    BATTLE: 'typeBattle',
    MASTERCLASS: 'typeMasterclass',
    SHOWCASE: 'typeShowcase',
    SOCIAL: 'typeSocial',
    COMPETITION: 'typeCompetition',
  };
  return `events.${keys[type]}`;
}

export const venueAmenities = [
  'MIRRORS',
  'SOUND_SYSTEM',
  'SPRUNG_FLOOR',
  'WOOD_FLOOR',
  'BARRE',
  'SHOWERS',
  'LOCKERS',
  'CHANGING_ROOM',
  'AIR_CONDITIONING',
  'NATURAL_LIGHT',
  'PARKING',
  'WIFI',
  'WATER_DISPENSER',
  'WHEELCHAIR_ACCESS',
] as const;
export type VenueAmenity = (typeof venueAmenities)[number];

const venueAmenityI18nKeys: Record<VenueAmenity, string> = {
  MIRRORS: 'mirrors',
  SOUND_SYSTEM: 'soundSystem',
  SPRUNG_FLOOR: 'sprungFloor',
  WOOD_FLOOR: 'woodFloor',
  BARRE: 'barre',
  SHOWERS: 'showers',
  LOCKERS: 'lockers',
  CHANGING_ROOM: 'changingRoom',
  AIR_CONDITIONING: 'airConditioning',
  NATURAL_LIGHT: 'naturalLight',
  PARKING: 'parking',
  WIFI: 'wifi',
  WATER_DISPENSER: 'waterDispenser',
  WHEELCHAIR_ACCESS: 'wheelchairAccess',
};

export function venueAmenityLabelKey(amenity: VenueAmenity): string {
  return `studio.amenities.${venueAmenityI18nKeys[amenity]}`;
}

export const paymentMethods = ['CARD', 'ARCA', 'IDRAM', 'TELCELL', 'ARCA_QR', 'CASH_ON_DELIVERY'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export function paymentMethodLabelKey(method: PaymentMethod): string {
  const keys: Record<PaymentMethod, string> = {
    CARD: 'methodCard',
    ARCA: 'methodArca',
    IDRAM: 'methodIdram',
    TELCELL: 'methodTelcell',
    ARCA_QR: 'methodQr',
    CASH_ON_DELIVERY: 'methodCash',
  };
  return `checkout.payment.${keys[method]}`;
}

export const deliveryMethods = ['COURIER', 'PICKUP_POINT'] as const;
export type DeliveryMethod = (typeof deliveryMethods)[number];

export const notificationChannels = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] as const;
export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationTypes = [
  'BOOKING_CONFIRMED',
  'BOOKING_REMINDER',
  'BOOKING_CANCELLED',
  'BOOKING_RESCHEDULED',
  'WAITLIST_SPOT_AVAILABLE',
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'PAYMENT_FAILED',
  'REFUND_ISSUED',
  'REVIEW_REQUEST',
  'PAYOUT_PROCESSED',
  'ACCOUNT_VERIFY_EMAIL',
  'ACCOUNT_RESET_PASSWORD',
  'MARKETING_DIGEST',
] as const;
export type NotificationType = (typeof notificationTypes)[number];

/** Типы, которые нельзя отключить в настройках (транзакционные). */
export const mandatoryNotificationTypes: readonly NotificationType[] = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'ORDER_CONFIRMED',
  'PAYMENT_FAILED',
  'REFUND_ISSUED',
  'ACCOUNT_VERIFY_EMAIL',
  'ACCOUNT_RESET_PASSWORD',
];
