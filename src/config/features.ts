/**
 * FEATURE FLAGS — карта включаемых модулей.
 *
 * Зачем: платформа сдаётся фазами. Модуль, который ещё не готов (видеокурсы,
 * marketplace-выплаты), выключается флагом, а не удалением кода и не
 * закомментированными блоками. Ни одна навигация, sitemap или карточка
 * не должна вести на выключенный раздел — списки строятся из этой карты.
 */

import { clientEnv } from './env';

/** Флаги, известные клиенту (влияют на рендер). */
export const features = {
  shop: clientEnv.NEXT_PUBLIC_FEATURE_SHOP,
  courses: clientEnv.NEXT_PUBLIC_FEATURE_COURSES,
  events: clientEnv.NEXT_PUBLIC_FEATURE_EVENTS,
  subscriptions: clientEnv.NEXT_PUBLIC_FEATURE_SUBSCRIPTIONS,
  videoCourses: clientEnv.NEXT_PUBLIC_FEATURE_VIDEO,
} as const;

export type FeatureKey = keyof typeof features;

export function isEnabled(feature: FeatureKey): boolean {
  return features[feature];
}

/**
 * Фазы поставки. Используются в планировании и в админке («что уже сдано»).
 * Служат единственным источником для чек-листа приёмки.
 */
export const deliveryPhases = {
  phase1: {
    id: 'phase1',
    modules: [
      'auth',
      'profiles',
      'instructors',
      'classes',
      'studios',
      'availability',
      'bookingEngine',
      'payments',
      'notificationsEmail',
      'adminCore',
      'i18n',
      'seo',
    ],
  },
  phase2: {
    id: 'phase2',
    modules: [
      'shop',
      'cart',
      'checkout',
      'inventory',
      'reviews',
      'favorites',
      'promotions',
      'giftCards',
      'events',
      'notificationsSms',
      'maps',
      'analytics',
    ],
  },
  phase3: {
    id: 'phase3',
    modules: [
      'subscriptions',
      'commissions',
      'payouts',
      'videoCourses',
      'calendarSync',
      'crmReports',
      'loyalty',
      'mobileApp',
    ],
  },
} as const;

export type DeliveryPhaseId = keyof typeof deliveryPhases;
