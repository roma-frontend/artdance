/**
 * DOMAIN ENUMS — словари предметной области.
 *
 * Значения совпадают с enum'ами Prisma (`prisma/schema.prisma`) один-в-один:
 * это единственное допустимое дублирование, и оно проверяется тестом
 * `src/domain/enums.test.ts`. Отображаемые названия берутся из i18n по ключу,
 * который возвращает `*LabelKey()`.
 *
 * Ключи типизированы `MessageKey`, а не `string`, и это существенно. Они
 * собираются из шаблона (`danceStyles.${…}`), поэтому опечатка или
 * переименование namespace в каталоге переводов не видны ни компилятору, ни
 * линтеру — экран падает в рантайме на `MISSING_MESSAGE`, причём только там, где
 * этот словарь показывается. Ровно так был потерян `catalog.sort.*`. С
 * `MessageKey` несуществующий ключ становится ошибкой сборки.
 */

import { limits } from '@/config/business';
import type { MessageKey } from '@/i18n/types';
import { keyIncludes, searchKey } from '@/lib/search/normalize';

/* ─────────────────────────────── Роли ─────────────────────────────── */

export const userRoles = ['CUSTOMER', 'INSTRUCTOR', 'VENUE_OWNER', 'ADMIN', 'SUPPORT'] as const;
export type UserRole = (typeof userRoles)[number];

const userRoleLabelKeys: Record<UserRole, MessageKey> = {
  CUSTOMER: 'auth.roles.customer',
  INSTRUCTOR: 'auth.roles.instructor',
  VENUE_OWNER: 'auth.roles.venueOwner',
  ADMIN: 'auth.roles.admin',
  SUPPORT: 'auth.roles.support',
};

export function userRoleLabelKey(role: UserRole): MessageKey {
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

const danceStyleI18nKeys = {
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
} as const satisfies Record<DanceStyle, string>;

export function danceStyleLabelKey(style: DanceStyle): MessageKey {
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

/* ──────────────── Как направление называют в запросах ────────────────
 *
 * Словарь написаний живёт здесь, а не в хелпере поиска, потому что это
 * содержание предметной области: «Брейкинг», «breakdance» и «Բրեյքինգ» — одно и
 * то же направление, и знать об этом должен домен, а не таблица алфавитов.
 *
 * Транслитерация (`searchKey`) снимает разницу АЛФАВИТОВ: «хип-хоп» и «hip hop»
 * дают один ключ сами. Словарь нужен для разницы ЯЗЫКОВ: «детские» и «kids»
 * никакой транслитерацией друг в друга не превращаются, а искать по-русски
 * человек будет именно так.
 *
 * Разговорные формы («контемп», «брейк-данс», «растяжка») перечислены рядом с
 * официальными: запрос человека — не название из каталога.
 */

const danceStyleSearchTerms = {
  HIP_HOP: ['hip hop', 'hiphop', 'хип-хоп', 'хипхоп', 'Հիփ-հոփ'],
  BALLET: ['ballet', 'балет', 'классика', 'Բալետ'],
  SALSA: ['salsa', 'сальса', 'Սալսա'],
  BACHATA: ['bachata', 'бачата', 'Բաչատա'],
  CONTEMPORARY: [
    'contemporary',
    'contemp',
    'контемпорари',
    'контемп',
    'современный танец',
    'Կոնտեմպորարի',
  ],
  HEELS: ['heels', 'каблуки', 'на каблуках', 'Հիլս'],
  KPOP: ['k-pop', 'kpop', 'к-поп', 'кейпоп', 'Քեյ-փոփ'],
  LATIN: ['latin', 'латина', 'латино', 'Լատինական'],
  TANGO: ['tango', 'танго', 'Տանգո'],
  ARMENIAN_FOLK: [
    'armenian folk',
    'армянские народные',
    'народный танец',
    'кочари',
    'Հայկական ազգային',
    'քոչարի',
  ],
  JAZZ: ['jazz', 'джаз', 'Ջազ'],
  BREAKING: ['breaking', 'breakdance', 'брейкинг', 'брейк-данс', 'Բրեյքինգ'],
  FLAMENCO: ['flamenco', 'фламенко', 'Ֆլամենկո'],
  BALLROOM: ['ballroom', 'бальные танцы', 'бальные', 'Բալային'],
  AFRO: ['afro', 'афро', 'Աֆրո'],
  WEDDING_DANCE: [
    'wedding dance',
    'свадебный танец',
    'первый танец',
    'Հարսանեկան պար',
  ],
  KIDS: ['kids', 'детские', 'для детей', 'Մանկական'],
  STRETCHING: [
    'stretching',
    'conditioning',
    'стретчинг',
    'растяжка',
    'офп',
    'Ձգում',
    'ֆիզ պատրաստություն',
  ],
} as const satisfies Record<DanceStyle, readonly string[]>;

/**
 * Ключи написаний считаются один раз при загрузке модуля.
 *
 * Их около семидесяти, и пересчитывать их на каждое нажатие клавиши в поиске
 * незачем: сам словарь не меняется во время работы приложения.
 */
const danceStyleSearchKeys: ReadonlyArray<{ style: DanceStyle; keys: readonly string[] }> =
  danceStyles.map((style) => ({
    style,
    keys: danceStyleSearchTerms[style].map(searchKey),
  }));

/**
 * Направления, которые человек мог иметь в виду, набрав `term`.
 *
 * Совпадение считается в обе стороны, и это не перестраховка, а два разных
 * реальных запроса:
 *
 *   • часть названия — «сал» → «Сальса»;
 *   • название внутри запроса — «hip hop для детей» → «Хип-хоп» и «Детские».
 *
 * Допуск на опечатку тот же, что и в остальном поиске, поэтому подсказка в
 * оверлее и выдача каталога не расходятся. Порядок — как в `danceStyles`, то есть
 * стабильный.
 */
export function danceStylesMatchingTerm(term: string): readonly DanceStyle[] {
  const needle = searchKey(term);
  if (needle.length === 0) return [];

  const matches = (key: string): boolean =>
    keyIncludes(key, needle, limits.search.typo) || keyIncludes(needle, key, limits.search.typo);

  return danceStyleSearchKeys
    .filter(({ keys }) => keys.some(matches))
    .map(({ style }) => style);
}

/* ──────────────── Редакционное описание направления ────────────────
 *
 * Хаб направления (`/styles/[style]`) существует ради органики: человек ищет
 * «уроки бачаты в Ереване», а не «каталог занятий». Отвечать ему страницей, где
 * из уникального только название в заголовке, бессмысленно — восемнадцать таких
 * страниц поисковик считает одним документом в восемнадцати копиях.
 *
 * Поэтому у каждого направления есть три собственных текста, и они живут в
 * каталоге переводов, а не в базе: это редакционный материал платформы (что это
 * за танец, кому подойдёт, что взять с собой), одинаковый для всех студий и
 * инструкторов, и переводится он вместе с интерфейсом. Описание КОНКРЕТНОГО
 * занятия — другое дело, оно приходит из `DanceClassTranslation`.
 */

/** Одно предложение под заголовком хаба. Оно же — описание страницы для выдачи. */
export function danceStyleLedeKey(style: DanceStyle): MessageKey {
  return `styleHub.styles.${danceStyleI18nKeys[style]}.lede`;
}

/** Абзац «что это за танец»: происхождение, характер, чему учит. */
export function danceStyleAboutKey(style: DanceStyle): MessageKey {
  return `styleHub.styles.${danceStyleI18nKeys[style]}.about`;
}

/** Что взять на первое занятие. У каблуков и брейкинга ответы разные. */
export function danceStyleGearKey(style: DanceStyle): MessageKey {
  return `styleHub.styles.${danceStyleI18nKeys[style]}.gear`;
}

/* ──────────────────────── Соседние направления ────────────────────────
 *
 * Зачем: хаб без исходящих ссылок — тупик и для человека, и для обхода. Тому, кто
 * пришёл на «бачату», осмысленно предложить сальсу, а не «хип-хоп» из соседней
 * строки алфавита.
 *
 * Связи заданы вручную, потому что это знание о танце, а не производная от
 * данных. Считать «похожесть» по совпадению инструкторов соблазнительно, но в
 * начале работы платформы у направления один преподаватель, и «похожими»
 * окажутся все его дисциплины разом.
 *
 * Симметрия не требуется: «детские» уместно вести к балету, а балет к детским —
 * нет. Проверяется другое (`enums.test.ts`): направление не ссылается на себя,
 * все значения существуют, у каждого есть хотя бы два соседа — иначе блок
 * «похожие» на каком-то хабе окажется полосой из одной плитки.
 */

const relatedStyleMap = {
  HIP_HOP: ['BREAKING', 'KPOP', 'AFRO'],
  BALLET: ['CONTEMPORARY', 'JAZZ', 'STRETCHING'],
  SALSA: ['BACHATA', 'LATIN', 'BALLROOM'],
  BACHATA: ['SALSA', 'LATIN', 'TANGO'],
  CONTEMPORARY: ['BALLET', 'JAZZ', 'STRETCHING'],
  HEELS: ['JAZZ', 'KPOP', 'CONTEMPORARY'],
  KPOP: ['HIP_HOP', 'HEELS', 'BREAKING'],
  LATIN: ['SALSA', 'BACHATA', 'BALLROOM'],
  TANGO: ['BALLROOM', 'LATIN', 'WEDDING_DANCE'],
  ARMENIAN_FOLK: ['WEDDING_DANCE', 'KIDS', 'BALLROOM'],
  JAZZ: ['CONTEMPORARY', 'BALLET', 'HEELS'],
  BREAKING: ['HIP_HOP', 'KPOP', 'STRETCHING'],
  FLAMENCO: ['LATIN', 'TANGO', 'BALLROOM'],
  BALLROOM: ['TANGO', 'LATIN', 'WEDDING_DANCE'],
  AFRO: ['HIP_HOP', 'LATIN', 'BREAKING'],
  WEDDING_DANCE: ['BALLROOM', 'TANGO', 'ARMENIAN_FOLK'],
  KIDS: ['ARMENIAN_FOLK', 'HIP_HOP', 'BALLET'],
  STRETCHING: ['BALLET', 'CONTEMPORARY', 'BREAKING'],
} as const satisfies Record<DanceStyle, readonly DanceStyle[]>;

export function relatedDanceStyles(style: DanceStyle): readonly DanceStyle[] {
  return relatedStyleMap[style];
}

/* ──────────────────────────── Уровни ──────────────────────────── */

export const skillLevels = ['ALL_LEVELS', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL'] as const;
export type SkillLevel = (typeof skillLevels)[number];

const skillLevelI18nKeys = {
  ALL_LEVELS: 'allLevels',
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  PROFESSIONAL: 'professional',
} as const satisfies Record<SkillLevel, string>;

export function skillLevelLabelKey(level: SkillLevel): MessageKey {
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

const bookingStatusI18nKeys = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED_BY_CUSTOMER: 'cancelledByCustomer',
  CANCELLED_BY_PROVIDER: 'cancelledByProvider',
  NO_SHOW: 'noShow',
  RESCHEDULED: 'rescheduled',
  WAITLISTED: 'waitlisted',
  EXPIRED: 'expired',
} as const satisfies Record<BookingStatus, string>;

export function bookingStatusLabelKey(status: BookingStatus): MessageKey {
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

const paymentStatusI18nKeys = {
  PENDING: 'pending',
  AUTHORIZED: 'authorized',
  PAID: 'paid',
  PARTIALLY_REFUNDED: 'partiallyRefunded',
  REFUNDED: 'refunded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  CHARGEBACK: 'chargeback',
} as const satisfies Record<PaymentStatus, string>;

export function paymentStatusLabelKey(status: PaymentStatus): MessageKey {
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

const orderStatusI18nKeys = {
  CREATED: 'created',
  PAID: 'paid',
  PACKING: 'packing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned',
} as const satisfies Record<OrderStatus, string>;

export function orderStatusLabelKey(status: OrderStatus): MessageKey {
  return `status.order.${orderStatusI18nKeys[status]}`;
}

export const payoutStatuses = ['SCHEDULED', 'PROCESSING', 'PAID', 'FAILED', 'ON_HOLD'] as const;
export type PayoutStatus = (typeof payoutStatuses)[number];

const payoutStatusI18nKeys = {
  SCHEDULED: 'scheduled',
  PROCESSING: 'processing',
  PAID: 'paid',
  FAILED: 'failed',
  ON_HOLD: 'onHold',
} as const satisfies Record<PayoutStatus, string>;

export function payoutStatusLabelKey(status: PayoutStatus): MessageKey {
  return `status.payout.${payoutStatusI18nKeys[status]}`;
}

export const moderationStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ModerationStatus = (typeof moderationStatuses)[number];

export function moderationStatusLabelKey(status: ModerationStatus): MessageKey {
  const keys = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
  } as const satisfies Record<ModerationStatus, string>;
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

export function eventTypeLabelKey(type: EventType): MessageKey {
  const keys = {
    WORKSHOP: 'typeWorkshop',
    BATTLE: 'typeBattle',
    MASTERCLASS: 'typeMasterclass',
    SHOWCASE: 'typeShowcase',
    SOCIAL: 'typeSocial',
    COMPETITION: 'typeCompetition',
  } as const satisfies Record<EventType, string>;
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

const venueAmenityI18nKeys = {
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
} as const satisfies Record<VenueAmenity, string>;

export function venueAmenityLabelKey(amenity: VenueAmenity): MessageKey {
  return `studio.amenities.${venueAmenityI18nKeys[amenity]}`;
}

export const paymentMethods = ['CARD', 'ARCA', 'IDRAM', 'TELCELL', 'ARCA_QR', 'CASH_ON_DELIVERY'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export function paymentMethodLabelKey(method: PaymentMethod): MessageKey {
  const keys = {
    CARD: 'methodCard',
    ARCA: 'methodArca',
    IDRAM: 'methodIdram',
    TELCELL: 'methodTelcell',
    ARCA_QR: 'methodQr',
    CASH_ON_DELIVERY: 'methodCash',
  } as const satisfies Record<PaymentMethod, string>;
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
